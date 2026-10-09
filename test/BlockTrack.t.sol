// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BlockTrack.sol";

contract BlockTrackTest is Test {
    BlockTrack c;
    address admin = address(0xA11CE);
    address logistics = address(0xB0B);
    address stranger = address(0xBAD);

    function setUp() public {
        vm.prank(admin);
        c = new BlockTrack();
    }

    function test_CreateAndUnique() public {
        vm.prank(admin);
        c.createParcel("BT1001");
        vm.expectRevert("tracking id exists");
        vm.prank(admin);
        c.createParcel("BT1001");
        vm.expectRevert("empty tracking id");
        vm.prank(admin);
        c.createParcel("");
        (string memory id, , BlockTrack.Status st, , bool exists) = c.getParcel("BT1001");
        assertEq(id, "BT1001");
        assertTrue(exists);
        assertTrue(st == BlockTrack.Status.Created);
    }

    function test_OnlyAdminCreateAndRoles() public {
        vm.expectRevert();
        vm.prank(stranger);
        c.createParcel("X1");
        vm.expectRevert();
        vm.prank(stranger);
        c.addLogisticsUser(logistics);
        vm.prank(admin);
        c.addLogisticsUser(logistics);
        assertTrue(c.isLogistics(logistics));
        vm.prank(admin);
        c.removeLogisticsUser(logistics);
        assertFalse(c.isLogistics(logistics));
    }

    function test_UpdateAndHistory() public {
        vm.prank(admin);
        c.createParcel("BT2002");
        vm.prank(admin);
        c.addLogisticsUser(logistics);
        vm.expectRevert("not authorized");
        vm.prank(stranger);
        c.updateParcelStatus("BT2002", BlockTrack.Status.InTransit, "hack");
        vm.prank(logistics);
        c.updateParcelStatus("BT2002", BlockTrack.Status.InTransit, "left hub");
        (, , BlockTrack.Status st, ,) = c.getParcel("BT2002");
        assertTrue(st == BlockTrack.Status.InTransit);
        BlockTrack.StatusUpdate[] memory h = c.getTrackingHistory("BT2002");
        assertEq(h.length, 2);
        assertEq(h[1].note, "left hub");
        assertEq(h[1].updatedBy, logistics);
    }

    function test_BadTransitions() public {
        vm.prank(admin);
        c.createParcel("BT3003");
        vm.prank(admin);
        c.addLogisticsUser(logistics);
        vm.expectRevert("same status");
        vm.prank(logistics);
        c.updateParcelStatus("BT3003", BlockTrack.Status.Created, "back");
        vm.prank(logistics);
        c.updateParcelStatus("BT3003", BlockTrack.Status.Delivered, "done");
        vm.expectRevert("already delivered");
        vm.prank(logistics);
        c.updateParcelStatus("BT3003", BlockTrack.Status.InTransit, "late");
    }

    function test_PublicRead() public {
        vm.prank(admin);
        c.createParcel("BT4004");
        vm.prank(stranger);
        (string memory id,,,,) = (c.getParcel("BT4004"));
        // getParcel returns 5 values; check id only via low-level
        assertEq(id, "BT4004");
        vm.prank(stranger);
        BlockTrack.StatusUpdate[] memory h = c.getTrackingHistory("BT4004");
        assertEq(h.length, 1);
    }
}
