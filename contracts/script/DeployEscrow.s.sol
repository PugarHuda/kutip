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
        // Optional NameRegistry address — when set, claim() requires the
        // claimer to match the on-chain ORCID binding. Reads via try
        // because Foundry's vm.envAddress reverts on missing env vars,
        // and we still want legacy "no registry" deploys to succeed.
        address nameRegistry;
        try vm.envAddress("NEXT_PUBLIC_NAME_REGISTRY") returns (address a) {
            nameRegistry = a;
        } catch {
            nameRegistry = address(0);
        }

        vm.startBroadcast();
        escrow = new UnclaimedYieldEscrow(paymentToken, operator, apyBps, nameRegistry);
        vm.stopBroadcast();

        console.log("UnclaimedYieldEscrow deployed at:", address(escrow));
        console.log("  paymentToken: ", paymentToken);
        console.log("  operator:     ", operator);
        console.log("  apyBps:       ", apyBps);
        console.log("  nameRegistry: ", nameRegistry);
    }
}
