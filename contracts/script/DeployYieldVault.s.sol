// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SimpleYieldVault} from "../src/SimpleYieldVault.sol";

contract DeployYieldVault is Script {
    function run() external returns (address) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(pk);
        address testUsd = 0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63;
        uint16 apyBps = 500; // 5% APR

        vm.startBroadcast(pk);
        SimpleYieldVault vault = new SimpleYieldVault(
            IERC20(testUsd),
            operator,
            apyBps
        );
        vm.stopBroadcast();

        console2.log("SimpleYieldVault deployed at:", address(vault));
        console2.log("Operator:", operator);
        console2.log("APY (bps):", apyBps);
        console2.log("Asset:", testUsd);
        return address(vault);
    }
}
