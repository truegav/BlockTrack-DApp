// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BlockTrack.sol";

contract Deploy is Script {
    function run() external returns (BlockTrack) {
        vm.startBroadcast();
        BlockTrack c = new BlockTrack();
        vm.stopBroadcast();
        console.log("BlockTrack deployed to:", address(c));
        return c;
    }
}
