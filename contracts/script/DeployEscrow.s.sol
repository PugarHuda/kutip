// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {UnclaimedYieldEscrow} from "../src/UnclaimedYieldEscrow.sol";

/// Deploys UnclaimedYieldEscrow. Operator = deployer EOA so the agent
/// backend can call `depositFor` (after queries) and `claim` (from the
/// /api/claim flow). Simulated APY = 500 bps (5%).
contract DeployEscrow is Script {
    function run() external returns (UnclaimedYieldEscrow escrow) {
        address paymentToken = vm.envAddress("KITE_TESTNET_USDC");
        address operator = vm.envAddress("NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS");
        uint16 apyBps = 500;

        vm.startBroadcast();
        escrow = new UnclaimedYieldEscrow(paymentToken, operator, apyBps);
        vm.stopBroadcast();

        console.log("UnclaimedYieldEscrow deployed at:", address(escrow));
        console.log("  paymentToken:", paymentToken);
        console.log("  operator:    ", operator);
        console.log("  apyBps:      ", apyBps);
    }
}
