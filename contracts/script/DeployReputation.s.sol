// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentReputation} from "../src/AgentReputation.sol";

contract DeployReputation is Script {
    function run() external returns (AgentReputation nft) {
        address operator = vm.envAddress("NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS");
        address researcher = 0x4da7f4cFd443084027a39cc0f7c41466d9511776;
        address summarizer = 0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c;

        vm.startBroadcast();
        nft = new AgentReputation(operator);
        nft.registerAgent(researcher, "Researcher");
        nft.registerAgent(summarizer, "Summarizer");
        vm.stopBroadcast();

        console.log("AgentReputation:", address(nft));
        console.log("  tokenId 1: Researcher AA:", researcher);
        console.log("  tokenId 2: Summarizer AA:", summarizer);
    }
}
