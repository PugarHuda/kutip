// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AttributionLedger} from "../src/AttributionLedger.sol";

contract Deploy is Script {
    function run() external returns (AttributionLedger ledger) {
        address paymentToken = vm.envAddress("KITE_TESTNET_USDC");
        address operator = vm.envAddress("NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS");
        address ecosystemFund = vm.envAddress("NEXT_PUBLIC_ECOSYSTEM_FUND_ADDRESS");

        uint16 operatorBps = uint16(vm.envUint("OPERATOR_BPS"));
        uint16 authorsBps = uint16(vm.envUint("AUTHORS_BPS"));
        uint16 ecosystemBps = uint16(vm.envUint("ECOSYSTEM_BPS"));

        vm.startBroadcast();
        ledger = new AttributionLedger(
            paymentToken,
            operator,
            ecosystemFund,
            operatorBps,
            authorsBps,
            ecosystemBps
        );
        vm.stopBroadcast();

        console.log("AttributionLedger deployed at:", address(ledger));
    }
}
