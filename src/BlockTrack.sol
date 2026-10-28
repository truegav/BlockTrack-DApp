// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/// @title BlockTrack
/// @notice Privacy-preserving parcel tracking. The chain stores only ciphertext,
///         wrapped per-order keys, role assignments and status history. Plaintext
///         metadata never touches the ledger.
/// @dev Encryption happens in the client. This contract is deliberately unable to
///      decrypt anything; it enforces who may write and anchors the encrypted record.
contract BlockTrack is AccessControlEnumerable {
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");

    uint256 public constant MAX_TRACKING_ID_LENGTH = 32;
    uint256 public constant MAX_CIPHERTEXT_LENGTH = 8192;
    uint256 public constant MAX_NOTE_LENGTH = 2048;
    uint256 public constant MAX_WRAPPED_KEY_LENGTH = 256;
    uint256 public constant MAX_DISPLAY_NAME_LENGTH = 48;
    uint256 public constant PUBLIC_KEY_LENGTH = 65;

    enum Status {
        Created,
        PickedUp,
        InTransit,
        OutForDelivery,
        Delivered,
        FailedAttempt,
        Cancelled
    }

    struct Profile {
        string displayName;
        bytes encryptionKey;
        bool exists;
    }

    struct Order {
        string trackingId;
        address owner;
        address courier;
        Status status;
        uint64 createdAt;
        uint64 updatedAt;
        bytes ciphertext;
        bool exists;
    }

    struct StatusUpdate {
        Status status;
        uint64 timestamp;
        address actor;
        bytes encryptedNote;
    }

    struct PublicUpdate {
        Status status;
        uint64 timestamp;
    }

    mapping(string => Order) private _orders;
    mapping(string => StatusUpdate[]) private _history;
    mapping(address => Profile) private _profiles;

    /// @dev orderKey => grantee => ECIES-wrapped order key
    mapping(bytes32 => mapping(address => bytes)) private _wrappedKeys;
    /// @dev orderKey => list of addresses holding a wrapped key
    mapping(bytes32 => address[]) private _keyHolders;

    event OrderCreated(string trackingId, address indexed owner, uint64 timestamp);
    event CourierAssigned(string trackingId, address indexed courier, uint64 timestamp);
    event StatusUpdated(
        string trackingId,
        Status status,
        address indexed actor,
        uint64 timestamp
    );
    event KeyGranted(string trackingId, address indexed grantee);
    event KeyRevoked(string trackingId, address indexed grantee);
    event ProfileRegistered(address indexed account, string displayName);
    event DisplayNameUpdated(address indexed account, string displayName);
    event LogisticsAdded(address indexed account);
    event LogisticsRemoved(address indexed account);

    error NotAuthorized();
    error InvalidOwner();
    error InvalidHolder();
    error DuplicateHolder();
    error HoldersMismatch();
    error MissingOwnerKey();
    error MissingAdminKey();
    error OrderAlreadyExists();
    error OrderNotFound();
    error OrderFinalized();
    error InvalidTrackingId();
    error InvalidCiphertext();
    error CiphertextTooLarge();
    error InvalidWrappedKey();
    error InvalidStatusTransition();
    error NoteTooLarge();
    error InvalidPublicKey();
    error InvalidDisplayName();
    error ProfileAlreadyRegistered();
    error ProfileNotFound();
    error InvalidCourier();
    error CourierRoleRequired();
    error AlreadyLogistics();
    error NotLogistics();
    error CannotCancel();

    constructor() {
        // AccessControl's constructor also grants this to the deployer; keeping it
        // explicit documents the intent and is idempotent.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();
        _;
    }

    function isAdmin(address account) public view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function isLogistics(address account) public view returns (bool) {
        return hasRole(LOGISTICS_ROLE, account);
    }

    function getAdmin() external view returns (address) {
        return
            getRoleMemberCount(DEFAULT_ADMIN_ROLE) == 0
                ? address(0)
                : getRoleMember(DEFAULT_ADMIN_ROLE, 0);
    }

    function getAdmins() external view returns (address[] memory list) {
        list = _roleMembers(DEFAULT_ADMIN_ROLE);
    }

    function getCouriers() external view returns (address[] memory list) {
        list = _roleMembers(LOGISTICS_ROLE);
    }

    function addLogisticsUser(address account) external onlyAdmin {
        if (account == address(0)) revert InvalidCourier();
        if (hasRole(LOGISTICS_ROLE, account)) revert AlreadyLogistics();
        _grantRole(LOGISTICS_ROLE, account);
        emit LogisticsAdded(account);
    }

    function removeLogisticsUser(address account) external onlyAdmin {
        if (!hasRole(LOGISTICS_ROLE, account)) revert NotLogistics();
        _revokeRole(LOGISTICS_ROLE, account);
        emit LogisticsRemoved(account);
    }

    // ---------------------------------------------------------------------
    // Profiles (public key registry)
    // ---------------------------------------------------------------------

    function registerProfile(
        string calldata displayName,
        bytes calldata encryptionKey
    ) external {
        if (_profiles[msg.sender].exists) revert ProfileAlreadyRegistered();
        _validateDisplayName(displayName);
        _validatePublicKey(encryptionKey);
        _profiles[msg.sender] = Profile({
            displayName: displayName,
            encryptionKey: encryptionKey,
            exists: true
        });
        emit ProfileRegistered(msg.sender, displayName);
    }

    function updateDisplayName(string calldata displayName) external {
        if (!_profiles[msg.sender].exists) revert ProfileNotFound();
        _validateDisplayName(displayName);
        _profiles[msg.sender].displayName = displayName;
        emit DisplayNameUpdated(msg.sender, displayName);
    }

    function profileExists(address account) external view returns (bool) {
        return _profiles[account].exists;
    }

    function getProfile(
        address account
    ) external view returns (string memory displayName, bytes memory encryptionKey, bool exists) {
        Profile storage profile = _profiles[account];
        return (profile.displayName, profile.encryptionKey, profile.exists);
    }

    // ---------------------------------------------------------------------
    // Orders
    // ---------------------------------------------------------------------

    /// @notice Create an order for the caller. The caller must be present in
    ///         `holders` with a wrapped key, and so must the primary admin.
    function createOrder(
        string calldata trackingId,
        bytes calldata ciphertext,
        address[] calldata holders,
        bytes[] calldata wrappedKeys
    ) external {
        _createOrder(msg.sender, trackingId, ciphertext, holders, wrappedKeys);
    }

    /// @notice Admin can register an order on behalf of a customer (walk-ins,
    ///         phone bookings). The admin must also hold a wrapped key.
    function createOrderFor(
        address owner,
        string calldata trackingId,
        bytes calldata ciphertext,
        address[] calldata holders,
        bytes[] calldata wrappedKeys
    ) external onlyAdmin {
        _createOrder(owner, trackingId, ciphertext, holders, wrappedKeys);
    }

    /// @notice Assign or reassign a courier. The admin supplies the order key
    ///         wrapped for the courier's registered public key.
    function assignCourier(
        string calldata trackingId,
        address courier,
        bytes calldata wrappedKey
    ) external onlyAdmin {
        Order storage order = _getOrder(trackingId);
        if (_isFinal(order.status)) revert OrderFinalized();
        if (courier == address(0)) revert InvalidCourier();
        if (!hasRole(LOGISTICS_ROLE, courier)) revert CourierRoleRequired();
        _validateWrappedKey(wrappedKey);

        address previous = order.courier;
        if (previous != address(0) && previous != courier) {
            _revokeKey(trackingId, previous);
            emit KeyRevoked(trackingId, previous);
        }

        order.courier = courier;
        _grantKey(trackingId, courier, wrappedKey);
        emit CourierAssigned(trackingId, courier, uint64(block.timestamp));
        emit KeyGranted(trackingId, courier);
    }

    /// @notice Move an order to its next status. Only the assigned courier or an
    ///         admin may call this, and only along a legal transition.
    function updateStatus(
        string calldata trackingId,
        Status newStatus,
        bytes calldata encryptedNote
    ) external {
        Order storage order = _getOrder(trackingId);
        if (_isFinal(order.status)) revert OrderFinalized();
        if (!_canOperate(order, msg.sender)) revert NotAuthorized();
        if (newStatus == Status.Created || newStatus == Status.Cancelled) {
            revert InvalidStatusTransition();
        }
        if (!_isValidTransition(order.status, newStatus)) revert InvalidStatusTransition();
        if (encryptedNote.length > MAX_NOTE_LENGTH) revert NoteTooLarge();

        uint64 nowTs = uint64(block.timestamp);
        order.status = newStatus;
        order.updatedAt = nowTs;
        _history[trackingId].push(
            StatusUpdate({
                status: newStatus,
                timestamp: nowTs,
                actor: msg.sender,
                encryptedNote: encryptedNote
            })
        );

        emit StatusUpdated(trackingId, newStatus, msg.sender, nowTs);
    }

    /// @notice Owner may cancel only while Created; an admin may cancel any
    ///         non-final order. Cancelling is never allowed after delivery.
    function cancelOrder(string calldata trackingId, bytes calldata encryptedNote) external {
        Order storage order = _getOrder(trackingId);
        if (_isFinal(order.status)) revert OrderFinalized();
        if (encryptedNote.length > MAX_NOTE_LENGTH) revert NoteTooLarge();

        bool admin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool owner = msg.sender == order.owner;
        if (!admin && !owner) revert NotAuthorized();
        if (owner && !admin && order.status != Status.Created) revert CannotCancel();

        uint64 nowTs = uint64(block.timestamp);
        order.status = Status.Cancelled;
        order.updatedAt = nowTs;
        _history[trackingId].push(
            StatusUpdate({
                status: Status.Cancelled,
                timestamp: nowTs,
                actor: msg.sender,
                encryptedNote: encryptedNote
            })
        );

        emit StatusUpdated(trackingId, Status.Cancelled, msg.sender, nowTs);
    }

    // ---------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------

    function orderExists(string calldata trackingId) external view returns (bool) {
        return _orders[trackingId].exists;
    }

    function getOrder(
        string calldata trackingId
    )
        external
        view
        returns (
            string memory id,
            address owner,
            address courier,
            Status status,
            uint64 createdAt,
            uint64 updatedAt,
            bytes memory ciphertext,
            bool exists
        )
    {
        Order storage order = _getOrder(trackingId);
        return (
            order.trackingId,
            order.owner,
            order.courier,
            order.status,
            order.createdAt,
            order.updatedAt,
            order.ciphertext,
            order.exists
        );
    }

    function getTrackingHistory(
        string calldata trackingId
    ) external view returns (StatusUpdate[] memory) {
        _requireOrder(trackingId);
        return _history[trackingId];
    }

    function getPublicStatus(
        string calldata trackingId
    ) external view returns (Status status, uint64 createdAt, uint64 updatedAt) {
        Order storage order = _getOrder(trackingId);
        return (order.status, order.createdAt, order.updatedAt);
    }

    function getPublicHistory(
        string calldata trackingId
    ) external view returns (PublicUpdate[] memory updates) {
        _requireOrder(trackingId);
        StatusUpdate[] storage history = _history[trackingId];
        updates = new PublicUpdate[](history.length);
        for (uint256 i = 0; i < history.length; ++i) {
            updates[i] = PublicUpdate({
                status: history[i].status,
                timestamp: history[i].timestamp
            });
        }
    }

    function getWrappedKey(
        string calldata trackingId,
        address grantee
    ) external view returns (bytes memory) {
        _requireOrder(trackingId);
        return _wrappedKeys[_orderKey(trackingId)][grantee];
    }

    function getKeyHolders(string calldata trackingId) external view returns (address[] memory) {
        _requireOrder(trackingId);
        return _keyHolders[_orderKey(trackingId)];
    }

    function hasAccess(string calldata trackingId, address grantee) external view returns (bool) {
        if (!_orders[trackingId].exists) return false;
        return _wrappedKeys[_orderKey(trackingId)][grantee].length > 0;
    }

    function statusName(Status status) public pure returns (string memory) {
        if (status == Status.Created) return "Created";
        if (status == Status.PickedUp) return "Picked up";
        if (status == Status.InTransit) return "In transit";
        if (status == Status.OutForDelivery) return "Out for delivery";
        if (status == Status.Delivered) return "Delivered";
        if (status == Status.FailedAttempt) return "Attempt failed";
        return "Cancelled";
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _createOrder(
        address owner,
        string calldata trackingId,
        bytes calldata ciphertext,
        address[] calldata holders,
        bytes[] calldata wrappedKeys
    ) private {
        if (owner == address(0)) revert InvalidOwner();
        _validateTrackingId(trackingId);
        if (_orders[trackingId].exists) revert OrderAlreadyExists();
        if (ciphertext.length == 0) revert InvalidCiphertext();
        if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) revert CiphertextTooLarge();
        _validateHolders(owner, holders, wrappedKeys);

        uint64 nowTs = uint64(block.timestamp);
        _orders[trackingId] = Order({
            trackingId: trackingId,
            owner: owner,
            courier: address(0),
            status: Status.Created,
            createdAt: nowTs,
            updatedAt: nowTs,
            ciphertext: ciphertext,
            exists: true
        });

        bytes32 key = _orderKey(trackingId);
        for (uint256 i = 0; i < holders.length; ++i) {
            _wrappedKeys[key][holders[i]] = wrappedKeys[i];
            _keyHolders[key].push(holders[i]);
        }

        _history[trackingId].push(
            StatusUpdate({
                status: Status.Created,
                timestamp: nowTs,
                actor: msg.sender,
                encryptedNote: bytes("")
            })
        );

        emit OrderCreated(trackingId, owner, nowTs);
    }

    function _validateHolders(
        address owner,
        address[] calldata holders,
        bytes[] calldata wrappedKeys
    ) private view {
        uint256 count = holders.length;
        if (count == 0 || count != wrappedKeys.length) revert HoldersMismatch();

        uint256 adminCount = getRoleMemberCount(DEFAULT_ADMIN_ROLE);
        address primaryAdmin = adminCount == 0
            ? address(0)
            : getRoleMember(DEFAULT_ADMIN_ROLE, 0);

        bool ownerFound;
        bool adminFound;

        for (uint256 i = 0; i < count; ++i) {
            address holder = holders[i];
            if (holder == address(0)) revert InvalidHolder();
            _validateWrappedKey(wrappedKeys[i]);

            if (holder == owner) ownerFound = true;
            if (holder == primaryAdmin) adminFound = true;

            for (uint256 j = 0; j < i; ++j) {
                if (holders[j] == holder) revert DuplicateHolder();
            }
        }

        if (!ownerFound) revert MissingOwnerKey();
        if (primaryAdmin != address(0) && !adminFound) revert MissingAdminKey();
    }

    function _grantKey(
        string calldata trackingId,
        address holder,
        bytes calldata wrappedKey
    ) private {
        bytes32 key = _orderKey(trackingId);
        if (_wrappedKeys[key][holder].length == 0) {
            _keyHolders[key].push(holder);
        }
        _wrappedKeys[key][holder] = wrappedKey;
    }

    function _revokeKey(string calldata trackingId, address holder) private {
        bytes32 key = _orderKey(trackingId);
        if (_wrappedKeys[key][holder].length == 0) return;

        delete _wrappedKeys[key][holder];

        address[] storage holders = _keyHolders[key];
        uint256 length = holders.length;
        for (uint256 i = 0; i < length; ++i) {
            if (holders[i] == holder) {
                holders[i] = holders[length - 1];
                holders.pop();
                break;
            }
        }
    }

    function _canOperate(Order storage order, address account) private view returns (bool) {
        if (hasRole(DEFAULT_ADMIN_ROLE, account)) return true;
        return order.courier == account && hasRole(LOGISTICS_ROLE, account);
    }

    function _roleMembers(bytes32 role) private view returns (address[] memory list) {
        uint256 count = getRoleMemberCount(role);
        list = new address[](count);
        for (uint256 i = 0; i < count; ++i) {
            list[i] = getRoleMember(role, i);
        }
    }

    function _getOrder(string calldata trackingId) private view returns (Order storage) {
        Order storage order = _orders[trackingId];
        if (!order.exists) revert OrderNotFound();
        return order;
    }

    function _requireOrder(string calldata trackingId) private view {
        if (!_orders[trackingId].exists) revert OrderNotFound();
    }

    function _orderKey(string calldata trackingId) private pure returns (bytes32) {
        return keccak256(bytes(trackingId));
    }

    function _validateTrackingId(string calldata trackingId) private pure {
        uint256 length = bytes(trackingId).length;
        if (length == 0 || length > MAX_TRACKING_ID_LENGTH) revert InvalidTrackingId();
    }

    function _validateWrappedKey(bytes calldata wrappedKey) private pure {
        if (wrappedKey.length == 0 || wrappedKey.length > MAX_WRAPPED_KEY_LENGTH) {
            revert InvalidWrappedKey();
        }
    }

    function _validateDisplayName(string calldata displayName) private pure {
        uint256 length = bytes(displayName).length;
        if (length == 0 || length > MAX_DISPLAY_NAME_LENGTH) revert InvalidDisplayName();
    }

    function _validatePublicKey(bytes calldata publicKey) private pure {
        if (publicKey.length != PUBLIC_KEY_LENGTH || publicKey[0] != 0x04) {
            revert InvalidPublicKey();
        }
    }

    function _isFinal(Status status) private pure returns (bool) {
        return status == Status.Delivered || status == Status.Cancelled;
    }

    function _isValidTransition(Status from, Status to) private pure returns (bool) {
        if (from == Status.Created) return to == Status.PickedUp;
        if (from == Status.PickedUp) return to == Status.InTransit;
        if (from == Status.InTransit) return to == Status.OutForDelivery;
        if (from == Status.OutForDelivery) {
            return to == Status.Delivered || to == Status.FailedAttempt;
        }
        if (from == Status.FailedAttempt) return to == Status.OutForDelivery;
        return false;
    }
}
