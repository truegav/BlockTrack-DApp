// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BlockTrack.sol";

contract BlockTrackTest is Test {
    BlockTrack internal bt;

    address internal admin = address(0xA11CE);
    address internal courier = address(0xB0B0);
    address internal courier2 = address(0xC0C0);
    address internal owner = address(0x0A11);
    address internal owner2 = address(0x0B0B);
    address internal stranger = address(0xBAD);

    bytes internal cipher;
    bytes internal wrapped;
    bytes internal wrapped2;

    uint64 internal constant START = 1_700_000_000;

    function setUp() public {
        vm.warp(START);
        cipher = hex"0102030405060708090a0b0c0d0e0f1011121314";
        wrapped = hex"aabbccddeeff00112233445566778899";
        wrapped2 = hex"99887766554433221100ffeeddccbbaa";

        vm.prank(admin);
        bt = new BlockTrack();

        vm.startPrank(admin);
        bt.addLogisticsUser(courier);
        bt.addLogisticsUser(courier2);
        vm.stopPrank();

        _registerProfiles();
    }

    function _pubKey() internal pure returns (bytes memory key) {
        key = new bytes(65);
        key[0] = 0x04;
        for (uint256 i = 1; i < 65; ++i) {
            key[i] = bytes1(uint8(i));
        }
    }

    function _registerProfiles() internal {
        address[5] memory accounts = [admin, owner, owner2, courier, courier2];
        string[5] memory names = [
            "Maya Sharma",
            "Rohan Mehta",
            "Ananya Iyer",
            "Arjun Kapoor",
            "Priya Nair"
        ];
        for (uint256 i = 0; i < accounts.length; ++i) {
            vm.startPrank(accounts[i]);
            bt.registerProfile(names[i], _pubKey());
            vm.stopPrank();
        }
    }

    function _holders(
        address orderOwner
    ) internal view returns (address[] memory holders, bytes[] memory keys) {
        holders = new address[](2);
        holders[0] = orderOwner;
        holders[1] = admin;
        keys = new bytes[](2);
        keys[0] = wrapped;
        keys[1] = wrapped;
    }

    function _create(string memory trackingId, address orderOwner) internal {
        (address[] memory holders, bytes[] memory keys) = _holders(orderOwner);
        vm.prank(orderOwner);
        bt.createOrder(trackingId, cipher, holders, keys);
    }

    function _assign(string memory trackingId, address who, bytes memory key) internal {
        vm.prank(admin);
        bt.assignCourier(trackingId, who, key);
    }

    function _update(
        address actor,
        string memory trackingId,
        BlockTrack.Status status,
        bytes memory note
    ) internal {
        vm.prank(actor);
        bt.updateStatus(trackingId, status, note);
    }

    function _status(string memory trackingId) internal view returns (BlockTrack.Status status) {
        (, , , status, , , , ) = bt.getOrder(trackingId);
    }

    function _orderOwner(string memory trackingId) internal view returns (address orderOwner) {
        (, orderOwner, , , , , , ) = bt.getOrder(trackingId);
    }

    function _courierOf(string memory trackingId) internal view returns (address courierAddress) {
        (, , courierAddress, , , , , ) = bt.getOrder(trackingId);
    }

    function _timestamps(
        string memory trackingId
    ) internal view returns (uint64 createdAt, uint64 updatedAt) {
        (, , , , createdAt, updatedAt, , ) = bt.getOrder(trackingId);
    }

    function _ciphertext(string memory trackingId) internal view returns (bytes memory data) {
        (, , , , , , data, ) = bt.getOrder(trackingId);
    }

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    function test_CreateOrderStoresEverything() public {
        (address[] memory holders, bytes[] memory keys) = _holders(owner);
        vm.prank(owner);
        bt.createOrder("BT-1001", cipher, holders, keys);

        assertTrue(bt.orderExists("BT-1001"));
        assertEq(_orderOwner("BT-1001"), owner);
        assertEq(_courierOf("BT-1001"), address(0));
        assertTrue(_status("BT-1001") == BlockTrack.Status.Created);
        (uint64 createdAt, uint64 updatedAt) = _timestamps("BT-1001");
        assertEq(createdAt, START);
        assertEq(updatedAt, START);
        assertEq(_ciphertext("BT-1001"), cipher);
    }

    function test_CreateOrderStoresWrappedKeysForOwnerAndAdmin() public {
        _create("BT-1002", owner);

        assertEq(bt.getWrappedKey("BT-1002", owner), wrapped);
        assertEq(bt.getWrappedKey("BT-1002", admin), wrapped);
        assertTrue(bt.hasAccess("BT-1002", owner));
        assertTrue(bt.hasAccess("BT-1002", admin));
        assertFalse(bt.hasAccess("BT-1002", stranger));

        address[] memory keyHolders = bt.getKeyHolders("BT-1002");
        assertEq(keyHolders.length, 2);
        assertEq(keyHolders[0], owner);
        assertEq(keyHolders[1], admin);
    }

    function test_CreateOrderWritesInitialHistory() public {
        _create("BT-1003", owner);
        BlockTrack.StatusUpdate[] memory history = bt.getTrackingHistory("BT-1003");
        assertEq(history.length, 1);
        assertTrue(history[0].status == BlockTrack.Status.Created);
        assertEq(history[0].timestamp, START);
        assertEq(history[0].actor, owner);
        assertEq(history[0].encryptedNote.length, 0);
    }

    function test_CreateOrderRejectsDuplicate() public {
        _create("BT-1004", owner);
        (address[] memory holders, bytes[] memory keys) = _holders(owner);
        vm.expectRevert(BlockTrack.OrderAlreadyExists.selector);
        vm.prank(owner);
        bt.createOrder("BT-1004", cipher, holders, keys);
    }

    function test_CreateOrderRejectsEmptyAndLongTrackingId() public {
        (address[] memory holders, bytes[] memory keys) = _holders(owner);
        vm.expectRevert(BlockTrack.InvalidTrackingId.selector);
        vm.prank(owner);
        bt.createOrder("", cipher, holders, keys);

        string memory longId = "123456789012345678901234567890123";
        vm.expectRevert(BlockTrack.InvalidTrackingId.selector);
        vm.prank(owner);
        bt.createOrder(longId, cipher, holders, keys);
    }

    function test_CreateOrderRejectsBadCiphertext() public {
        (address[] memory holders, bytes[] memory keys) = _holders(owner);
        vm.expectRevert(BlockTrack.InvalidCiphertext.selector);
        vm.prank(owner);
        bt.createOrder("BT-EMPTY", "", holders, keys);

        bytes memory tooBig = new bytes(8193);
        vm.expectRevert(BlockTrack.CiphertextTooLarge.selector);
        vm.prank(owner);
        bt.createOrder("BT-BIG", tooBig, holders, keys);
    }

    function test_CreateOrderRequiresOwnerAndAdminKeys() public {
        address[] memory onlyAdmin = new address[](1);
        onlyAdmin[0] = admin;
        bytes[] memory keys = new bytes[](1);
        keys[0] = wrapped;
        vm.expectRevert(BlockTrack.MissingOwnerKey.selector);
        vm.prank(owner);
        bt.createOrder("BT-NO-OWNER", cipher, onlyAdmin, keys);

        address[] memory onlyOwner = new address[](1);
        onlyOwner[0] = owner;
        vm.expectRevert(BlockTrack.MissingAdminKey.selector);
        vm.prank(owner);
        bt.createOrder("BT-NO-ADMIN", cipher, onlyOwner, keys);
    }

    function test_CreateOrderRejectsDuplicateAndZeroHolders() public {
        address[] memory holders = new address[](3);
        holders[0] = owner;
        holders[1] = owner;
        holders[2] = admin;
        bytes[] memory keys = new bytes[](3);
        keys[0] = wrapped;
        keys[1] = wrapped;
        keys[2] = wrapped;
        vm.expectRevert(BlockTrack.DuplicateHolder.selector);
        vm.prank(owner);
        bt.createOrder("BT-DUP", cipher, holders, keys);

        holders[1] = address(0);
        vm.expectRevert(BlockTrack.InvalidHolder.selector);
        vm.prank(owner);
        bt.createOrder("BT-ZERO", cipher, holders, keys);
    }

    function test_CreateOrderRejectsMismatchedArraysAndEmptyKeys() public {
        address[] memory holders = new address[](2);
        holders[0] = owner;
        holders[1] = admin;
        bytes[] memory keys = new bytes[](1);
        keys[0] = wrapped;
        vm.expectRevert(BlockTrack.HoldersMismatch.selector);
        vm.prank(owner);
        bt.createOrder("BT-MISMATCH", cipher, holders, keys);

        bytes[] memory goodKeys = new bytes[](2);
        goodKeys[0] = bytes("");
        goodKeys[1] = wrapped;
        vm.expectRevert(BlockTrack.InvalidWrappedKey.selector);
        vm.prank(owner);
        bt.createOrder("BT-EMPTY-KEY", cipher, holders, goodKeys);
    }

    function test_AdminCanCreateOnBehalf() public {
        address[] memory holders = new address[](2);
        holders[0] = owner2;
        holders[1] = admin;
        bytes[] memory keys = new bytes[](2);
        keys[0] = wrapped;
        keys[1] = wrapped;

        vm.prank(admin);
        bt.createOrderFor(owner2, "BT-WALKIN", cipher, holders, keys);

        assertEq(_orderOwner("BT-WALKIN"), owner2);
        assertTrue(bt.hasAccess("BT-WALKIN", owner2));
        assertTrue(bt.hasAccess("BT-WALKIN", admin));
    }

    function test_OnlyAdminCanCreateOnBehalf() public {
        address[] memory holders = new address[](2);
        holders[0] = owner2;
        holders[1] = admin;
        bytes[] memory keys = new bytes[](2);
        keys[0] = wrapped;
        keys[1] = wrapped;

        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        vm.prank(stranger);
        bt.createOrderFor(owner2, "BT-WALKIN", cipher, holders, keys);
    }

    // ------------------------------------------------------------------
    // Roles and profiles
    // ------------------------------------------------------------------

    function test_RoleManagement() public {
        assertTrue(bt.isAdmin(admin));
        assertFalse(bt.isAdmin(stranger));
        assertTrue(bt.isLogistics(courier));
        assertTrue(bt.isLogistics(courier2));
        assertEq(bt.getAdmin(), admin);
        assertEq(bt.getAdmins().length, 1);
        assertEq(bt.getCouriers().length, 2);

        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        vm.prank(stranger);
        bt.addLogisticsUser(stranger);

        vm.expectRevert(BlockTrack.AlreadyLogistics.selector);
        vm.prank(admin);
        bt.addLogisticsUser(courier);

        vm.expectRevert(BlockTrack.InvalidCourier.selector);
        vm.prank(admin);
        bt.addLogisticsUser(address(0));

        vm.prank(admin);
        bt.removeLogisticsUser(courier2);
        assertFalse(bt.isLogistics(courier2));
        assertEq(bt.getCouriers().length, 1);

        vm.expectRevert(BlockTrack.NotLogistics.selector);
        vm.prank(admin);
        bt.removeLogisticsUser(courier2);
    }

    function test_Profiles() public {
        (string memory name, bytes memory key, bool exists) = bt.getProfile(owner);
        assertEq(name, "Rohan Mehta");
        assertEq(key, _pubKey());
        assertTrue(exists);
        assertTrue(bt.profileExists(owner));
        assertFalse(bt.profileExists(stranger));

        vm.expectRevert(BlockTrack.ProfileAlreadyRegistered.selector);
        vm.prank(owner);
        bt.registerProfile("Rohan Again", _pubKey());

        vm.prank(owner);
        bt.updateDisplayName("Rohan M.");
        (string memory updated, , ) = bt.getProfile(owner);
        assertEq(updated, "Rohan M.");

        vm.expectRevert(BlockTrack.ProfileNotFound.selector);
        vm.prank(stranger);
        bt.updateDisplayName("Ghost");
    }

    function test_ProfileValidation() public {
        bytes memory badLength = new bytes(64);
        badLength[0] = 0x04;
        vm.expectRevert(BlockTrack.InvalidPublicKey.selector);
        vm.prank(stranger);
        bt.registerProfile("Bad", badLength);

        bytes memory badPrefix = _pubKey();
        badPrefix[0] = 0x03;
        vm.expectRevert(BlockTrack.InvalidPublicKey.selector);
        vm.prank(stranger);
        bt.registerProfile("Bad", badPrefix);

        vm.expectRevert(BlockTrack.InvalidDisplayName.selector);
        vm.prank(stranger);
        bt.registerProfile("", _pubKey());

        vm.expectRevert(BlockTrack.InvalidDisplayName.selector);
        vm.prank(stranger);
        bt.registerProfile("1234567890123456789012345678901234567890123456789", _pubKey());
    }

    // ------------------------------------------------------------------
    // Assignment
    // ------------------------------------------------------------------

    function test_OnlyAdminCanAssignCourier() public {
        _create("BT-2001", owner);
        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        vm.prank(owner);
        bt.assignCourier("BT-2001", courier, wrapped);
    }

    function test_AssignCourierGrantAndReassign() public {
        _create("BT-2002", owner);

        vm.expectRevert(BlockTrack.InvalidCourier.selector);
        vm.prank(admin);
        bt.assignCourier("BT-2002", address(0), wrapped);

        vm.expectRevert(BlockTrack.CourierRoleRequired.selector);
        vm.prank(admin);
        bt.assignCourier("BT-2002", stranger, wrapped);

        vm.expectRevert(BlockTrack.InvalidWrappedKey.selector);
        vm.prank(admin);
        bt.assignCourier("BT-2002", courier, bytes(""));

        _assign("BT-2002", courier, wrapped2);
        assertEq(_courierOf("BT-2002"), courier);
        assertEq(bt.getWrappedKey("BT-2002", courier), wrapped2);
        assertTrue(bt.hasAccess("BT-2002", courier));
        assertEq(bt.getKeyHolders("BT-2002").length, 3);

        _assign("BT-2002", courier2, wrapped);
        assertEq(_courierOf("BT-2002"), courier2);
        assertFalse(bt.hasAccess("BT-2002", courier));
        assertEq(bt.getWrappedKey("BT-2002", courier).length, 0);
        assertTrue(bt.hasAccess("BT-2002", courier2));
        address[] memory keyHolders = bt.getKeyHolders("BT-2002");
        assertEq(keyHolders.length, 3);
        assertEq(keyHolders[keyHolders.length - 1], courier2);
    }

    function test_AssignSameCourierUpdatesKey() public {
        _create("BT-2003", owner);
        _assign("BT-2003", courier, wrapped);
        _assign("BT-2003", courier, wrapped2);
        assertEq(bt.getWrappedKey("BT-2003", courier), wrapped2);
        assertEq(bt.getKeyHolders("BT-2003").length, 3);
    }

    // ------------------------------------------------------------------
    // Status transitions
    // ------------------------------------------------------------------

    function test_CourierHappyPath() public {
        _create("BT-3001", owner);
        _assign("BT-3001", courier, wrapped);

        _update(courier, "BT-3001", BlockTrack.Status.PickedUp, hex"aa");
        _update(courier, "BT-3001", BlockTrack.Status.InTransit, hex"bb");
        _update(courier, "BT-3001", BlockTrack.Status.OutForDelivery, hex"cc");
        _update(courier, "BT-3001", BlockTrack.Status.Delivered, hex"dd");

        assertTrue(_status("BT-3001") == BlockTrack.Status.Delivered);
        BlockTrack.StatusUpdate[] memory history = bt.getTrackingHistory("BT-3001");
        assertEq(history.length, 5);
        assertEq(history[4].encryptedNote, hex"dd");
        assertEq(history[4].actor, courier);
    }

    function test_FailedAttemptCanRetry() public {
        _create("BT-3002", owner);
        _assign("BT-3002", courier, wrapped);

        _update(courier, "BT-3002", BlockTrack.Status.PickedUp, hex"01");
        _update(courier, "BT-3002", BlockTrack.Status.InTransit, hex"02");
        _update(courier, "BT-3002", BlockTrack.Status.OutForDelivery, hex"03");
        _update(courier, "BT-3002", BlockTrack.Status.FailedAttempt, hex"04");
        _update(courier, "BT-3002", BlockTrack.Status.OutForDelivery, hex"05");
        _update(courier, "BT-3002", BlockTrack.Status.Delivered, hex"06");

        assertTrue(_status("BT-3002") == BlockTrack.Status.Delivered);
    }

    function test_InvalidTransitions() public {
        _create("BT-3003", owner);
        _assign("BT-3003", courier, wrapped);

        vm.expectRevert(BlockTrack.InvalidStatusTransition.selector);
        _update(courier, "BT-3003", BlockTrack.Status.InTransit, hex"01");

        vm.expectRevert(BlockTrack.InvalidStatusTransition.selector);
        _update(courier, "BT-3003", BlockTrack.Status.Created, hex"01");

        vm.expectRevert(BlockTrack.InvalidStatusTransition.selector);
        _update(courier, "BT-3003", BlockTrack.Status.Cancelled, hex"01");

        _update(courier, "BT-3003", BlockTrack.Status.PickedUp, hex"01");
        vm.expectRevert(BlockTrack.InvalidStatusTransition.selector);
        _update(courier, "BT-3003", BlockTrack.Status.Delivered, hex"02");
    }

    function test_OnlyAssignedCourierOrAdminCanUpdate() public {
        _create("BT-3004", owner);
        _assign("BT-3004", courier, wrapped);

        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        _update(stranger, "BT-3004", BlockTrack.Status.PickedUp, hex"01");

        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        _update(courier2, "BT-3004", BlockTrack.Status.PickedUp, hex"01");

        _update(admin, "BT-3004", BlockTrack.Status.PickedUp, hex"02");
        assertTrue(_status("BT-3004") == BlockTrack.Status.PickedUp);
    }

    function test_AdminCanUpdateUnassignedOrderButCourierCannot() public {
        _create("BT-3005", owner);

        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        _update(courier, "BT-3005", BlockTrack.Status.PickedUp, hex"01");

        _update(admin, "BT-3005", BlockTrack.Status.PickedUp, hex"02");
        assertTrue(_status("BT-3005") == BlockTrack.Status.PickedUp);
    }

    function test_RevokedCourierCannotUpdate() public {
        _create("BT-3006", owner);
        _assign("BT-3006", courier, wrapped);

        vm.prank(admin);
        bt.removeLogisticsUser(courier);

        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        _update(courier, "BT-3006", BlockTrack.Status.PickedUp, hex"01");
    }

    function test_NoteSizeLimit() public {
        _create("BT-3007", owner);
        _assign("BT-3007", courier, wrapped);
        bytes memory tooBig = new bytes(2049);
        vm.expectRevert(BlockTrack.NoteTooLarge.selector);
        _update(courier, "BT-3007", BlockTrack.Status.PickedUp, tooBig);
    }

    function test_FinalOrderCannotMove() public {
        _create("BT-3008", owner);
        _assign("BT-3008", courier, wrapped);
        _update(courier, "BT-3008", BlockTrack.Status.PickedUp, hex"01");
        _update(courier, "BT-3008", BlockTrack.Status.InTransit, hex"02");
        _update(courier, "BT-3008", BlockTrack.Status.OutForDelivery, hex"03");
        _update(courier, "BT-3008", BlockTrack.Status.Delivered, hex"04");

        vm.expectRevert(BlockTrack.OrderFinalized.selector);
        _update(courier, "BT-3008", BlockTrack.Status.OutForDelivery, hex"05");

        vm.expectRevert(BlockTrack.OrderFinalized.selector);
        vm.prank(admin);
        bt.assignCourier("BT-3008", courier2, wrapped);
    }

    // ------------------------------------------------------------------
    // Cancellation
    // ------------------------------------------------------------------

    function test_OwnerCanCancelOnlyBeforePickup() public {
        _create("BT-4001", owner);
        vm.prank(owner);
        bt.cancelOrder("BT-4001", hex"01");
        assertTrue(_status("BT-4001") == BlockTrack.Status.Cancelled);

        vm.expectRevert(BlockTrack.OrderFinalized.selector);
        vm.prank(owner);
        bt.cancelOrder("BT-4001", hex"02");
    }

    function test_OwnerCannotCancelAfterPickup() public {
        _create("BT-4002", owner);
        _assign("BT-4002", courier, wrapped);
        _update(courier, "BT-4002", BlockTrack.Status.PickedUp, hex"01");

        vm.expectRevert(BlockTrack.CannotCancel.selector);
        vm.prank(owner);
        bt.cancelOrder("BT-4002", hex"02");
    }

    function test_StrangerCannotCancel() public {
        _create("BT-4003", owner);
        vm.expectRevert(BlockTrack.NotAuthorized.selector);
        vm.prank(stranger);
        bt.cancelOrder("BT-4003", hex"01");
    }

    function test_AdminCanCancelMidTransit() public {
        _create("BT-4004", owner);
        _assign("BT-4004", courier, wrapped);
        _update(courier, "BT-4004", BlockTrack.Status.PickedUp, hex"01");
        _update(courier, "BT-4004", BlockTrack.Status.InTransit, hex"02");

        vm.prank(admin);
        bt.cancelOrder("BT-4004", hex"03");
        assertTrue(_status("BT-4004") == BlockTrack.Status.Cancelled);

        BlockTrack.StatusUpdate[] memory history = bt.getTrackingHistory("BT-4004");
        assertTrue(history[history.length - 1].status == BlockTrack.Status.Cancelled);
        assertEq(history[history.length - 1].actor, admin);
    }

    function test_AdminCannotCancelDelivered() public {
        _create("BT-4005", owner);
        _assign("BT-4005", courier, wrapped);
        _update(courier, "BT-4005", BlockTrack.Status.PickedUp, hex"01");
        _update(courier, "BT-4005", BlockTrack.Status.InTransit, hex"02");
        _update(courier, "BT-4005", BlockTrack.Status.OutForDelivery, hex"03");
        _update(courier, "BT-4005", BlockTrack.Status.Delivered, hex"04");

        vm.expectRevert(BlockTrack.OrderFinalized.selector);
        vm.prank(admin);
        bt.cancelOrder("BT-4005", hex"05");
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    function test_MissingOrderReadsRevert() public {
        vm.expectRevert(BlockTrack.OrderNotFound.selector);
        bt.getOrder("NOPE");

        vm.expectRevert(BlockTrack.OrderNotFound.selector);
        bt.getTrackingHistory("NOPE");

        vm.expectRevert(BlockTrack.OrderNotFound.selector);
        bt.getPublicStatus("NOPE");

        vm.expectRevert(BlockTrack.OrderNotFound.selector);
        bt.getPublicHistory("NOPE");

        vm.expectRevert(BlockTrack.OrderNotFound.selector);
        bt.getWrappedKey("NOPE", owner);

        vm.expectRevert(BlockTrack.OrderNotFound.selector);
        bt.getKeyHolders("NOPE");

        assertFalse(bt.orderExists("NOPE"));
        assertFalse(bt.hasAccess("NOPE", owner));
    }

    function test_PublicViewsExposeNoCiphertextOrNotes() public {
        _create("BT-5001", owner);
        _assign("BT-5001", courier, wrapped);
        _update(courier, "BT-5001", BlockTrack.Status.PickedUp, hex"deadbeef");

        (BlockTrack.Status status, uint64 createdAt, uint64 updatedAt) = bt.getPublicStatus(
            "BT-5001"
        );
        assertTrue(status == BlockTrack.Status.PickedUp);
        assertEq(createdAt, START);
        assertEq(updatedAt, START);

        BlockTrack.PublicUpdate[] memory publicHistory = bt.getPublicHistory("BT-5001");
        assertEq(publicHistory.length, 2);
        assertTrue(publicHistory[0].status == BlockTrack.Status.Created);
        assertTrue(publicHistory[1].status == BlockTrack.Status.PickedUp);
        assertEq(publicHistory[1].timestamp, START);
    }

    function test_StatusNames() public {
        assertEq(bt.statusName(BlockTrack.Status.Created), "Created");
        assertEq(bt.statusName(BlockTrack.Status.PickedUp), "Picked up");
        assertEq(bt.statusName(BlockTrack.Status.InTransit), "In transit");
        assertEq(bt.statusName(BlockTrack.Status.OutForDelivery), "Out for delivery");
        assertEq(bt.statusName(BlockTrack.Status.Delivered), "Delivered");
        assertEq(bt.statusName(BlockTrack.Status.FailedAttempt), "Attempt failed");
        assertEq(bt.statusName(BlockTrack.Status.Cancelled), "Cancelled");
    }

    function test_TimestampsAdvanceWithBlockTime() public {
        _create("BT-5002", owner);
        _assign("BT-5002", courier, wrapped);
        vm.warp(START + 1 days);
        _update(courier, "BT-5002", BlockTrack.Status.PickedUp, hex"01");

        (uint64 createdAt, uint64 updatedAt) = _timestamps("BT-5002");
        assertEq(createdAt, START);
        assertEq(updatedAt, START + 1 days);
    }
}
