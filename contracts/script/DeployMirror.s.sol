// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CitationMirror} from "../src/CitationMirror.sol";

/// @notice Deploys CitationMirror on Avalanche Fuji (chain 43113) that
///         mirrors attestations from Kite testnet (source chain 2368).
/// Env needed: PRIVATE_KEY
contract DeployMirror is Script {
    function run() external returns (address) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address operator = vm.addr(pk);
        uint32 sourceChainId = 2368;

        vm.startBroadcast(pk);
        CitationMirror mirror = new CitationMirror(operator, sourceChainId);
        vm.stopBroadcast();

        console2.log("CitationMirror deployed at:", address(mirror));
        console2.log("Operator:", operator);
        console2.log("Expected source chain:", sourceChainId);
        return address(mirror);
    }
}
