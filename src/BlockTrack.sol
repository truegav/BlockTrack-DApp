// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BlockTrack - minimal parcel tracking PoC
/// @notice Admin creates parcels, logistics accounts update status, anyone can read.
contract BlockTrack is AccessControl {
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");

    enum Status {
        Created,
        PickedUp,
        InTransit,
        OutForDelivery,
        Delivered,
        Cancelled
    }

    struct StatusUpdate {
        Status status;
        uint256 timestamp;
        address updatedBy;
        string note;
    }

    struct Parcel {
        string trackingId;
        address creator;
        Status currentStatus;
        uint256 createdAt;
        bool exists;
    }

    mapping(string => Parcel) private parcels;
    mapping(string => StatusUpdate[]) private histories;

    event ParcelCreated(string indexed trackingId, address indexed creator, uint256 timestamp);
    event StatusUpdated(
        string indexed trackingId,
        Status oldStatus,
        Status newStatus,
        address indexed updatedBy,
        uint256 timestamp,
        string note
    );
    event LogisticsAdded(address indexed account);
    event LogisticsRemoved(address indexed account);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ---------- Roles ----------

    function addLogisticsUser(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "zero address");
        grantRole(LOGISTICS_ROLE, account);
        emit LogisticsAdded(account);
    }

    function removeLogisticsUser(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(LOGISTICS_ROLE, account);
        emit LogisticsRemoved(account);
    }

    function isLogistics(address account) external view returns (bool) {
        return hasRole(LOGISTICS_ROLE, account);
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    // ---------- Parcels ----------

    /// @notice Create a parcel with a unique tracking ID. Admin only.
    function createParcel(string calldata trackingId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(trackingId).length > 0, "empty tracking id");
        require(!parcels[trackingId].exists, "tracking id exists");

        parcels[trackingId] = Parcel({
            trackingId: trackingId,
            creator: msg.sender,
            currentStatus: Status.Created,
            createdAt: block.timestamp,
            exists: true
        });

        histories[trackingId].push(
            StatusUpdate({
                status: Status.Created,
                timestamp: block.timestamp,
                updatedBy: msg.sender,
                note: "Parcel registered"
            })
        );

        emit ParcelCreated(trackingId, msg.sender, block.timestamp);
    }

    /// @notice Update parcel status. Admin or logistics only.
    function updateParcelStatus(
        string calldata trackingId,
        Status newStatus,
        string calldata note
    ) external {
        require(
            hasRole(LOGISTICS_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "not authorized"
        );
        require(parcels[trackingId].exists, "parcel not found");

        Parcel storage p = parcels[trackingId];
        require(p.currentStatus != Status.Delivered, "already delivered");
        require(p.currentStatus != Status.Cancelled, "already cancelled");
        require(newStatus != p.currentStatus, "same status");
        // Created is only set at creation; cannot go back to it.
        require(newStatus != Status.Created, "invalid status");

        Status old = p.currentStatus;
        p.currentStatus = newStatus;

        histories[trackingId].push(
            StatusUpdate({
                status: newStatus,
                timestamp: block.timestamp,
                updatedBy: msg.sender,
                note: note
            })
        );

        emit StatusUpdated(trackingId, old, newStatus, msg.sender, block.timestamp, note);
    }

    // ---------- Reads (public) ----------

    function getParcel(
        string calldata trackingId
    )
        external
        view
        returns (
            string memory id,
            address creator,
            Status currentStatus,
            uint256 createdAt,
            bool exists
        )
    {
        Parcel storage p = parcels[trackingId];
        require(p.exists, "parcel not found");
        return (p.trackingId, p.creator, p.currentStatus, p.createdAt, p.exists);
    }

    function getTrackingHistory(
        string calldata trackingId
    ) external view returns (StatusUpdate[] memory) {
        require(parcels[trackingId].exists, "parcel not found");
        return histories[trackingId];
    }

    function statusName(Status s) public pure returns (string memory) {
        if (s == Status.Created) return "Created";
        if (s == Status.PickedUp) return "Picked Up";
        if (s == Status.InTransit) return "In Transit";
        if (s == Status.OutForDelivery) return "Out for Delivery";
        if (s == Status.Delivered) return "Delivered";
        return "Cancelled";
    }

    function parcelExists(string calldata trackingId) external view returns (bool) {
        return parcels[trackingId].exists;
    }
}
