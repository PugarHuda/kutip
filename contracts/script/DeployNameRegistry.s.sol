// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NameRegistry} from "../src/NameRegistry.sol";

contract DeployNameRegistry is Script {
    function run() external returns (address) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(pk);

        vm.startBroadcast(pk);
        NameRegistry reg = new NameRegistry(operator);
        vm.stopBroadcast();

        console2.log("NameRegistry deployed at:", address(reg));
        console2.log("Operator:", operator);
        return address(reg);
    }
}
