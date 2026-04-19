// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BountyMarket} from "../src/BountyMarket.sol";

contract DeployBounty is Script {
    function run() external returns (BountyMarket market) {
        address paymentToken = vm.envAddress("KITE_TESTNET_USDC");
        address operator = vm.envAddress("NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS");

        vm.startBroadcast();
        market = new BountyMarket(paymentToken, operator);
        vm.stopBroadcast();

        console.log("BountyMarket deployed at:", address(market));
    }
}
