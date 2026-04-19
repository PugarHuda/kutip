// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry8004} from "../src/AgentRegistry8004.sol";
import {ERC6551Registry} from "../src/ERC6551Registry.sol";
import {ERC6551Account} from "../src/ERC6551Account.sol";

/// Deploys:
///   - AgentRegistry (ERC-8004 aligned)
///   - ERC-6551 Registry (TBA creation)
///   - ERC-6551 Account implementation
/// Then registers both agents (Researcher + Summarizer) with ORCID-like
/// trust proofs and mints TBAs for their reputation NFTs.
contract DeployStandards is Script {
    address constant REPUTATION_NFT = 0x8f53EB5C04B773F0F31FE41623EA19d2Fd84db15;
    address constant RESEARCHER_AA = 0x4da7f4cFd443084027a39cc0f7c41466d9511776;
    address constant SUMMARIZER_AA = 0xA6C36bA2BC8E84fCF276721F30FC79ceD609ef5c;

    function run()
        external
        returns (
            AgentRegistry8004 reg8004,
            ERC6551Registry reg6551,
            ERC6551Account acctImpl,
            address researcherTBA,
            address summarizerTBA
        )
    {
        vm.startBroadcast();

        reg8004 = new AgentRegistry8004();
        reg6551 = new ERC6551Registry();
        acctImpl = new ERC6551Account();

        // Register both AA agents
        reg8004.register(
            RESEARCHER_AA,
            "Kutip Researcher",
            '{"skills":["semantic-search","citation-weighting","on-chain-attestation"],"llm":"glm-4.5-air"}',
            "nft",
            keccak256(abi.encodePacked(REPUTATION_NFT, uint256(1))),
            REPUTATION_NFT,
            1
        );
        reg8004.register(
            SUMMARIZER_AA,
            "Kutip Summarizer",
            '{"skills":["synthesis","sub-agent-billing"],"fee_bps":500}',
            "nft",
            keccak256(abi.encodePacked(REPUTATION_NFT, uint256(2))),
            REPUTATION_NFT,
            2
        );

        // Create ERC-6551 TBAs for each reputation NFT
        researcherTBA = reg6551.createAccount(
            address(acctImpl),
            2368,
            REPUTATION_NFT,
            1,
            0
        );
        summarizerTBA = reg6551.createAccount(
            address(acctImpl),
            2368,
            REPUTATION_NFT,
            2,
            0
        );

        vm.stopBroadcast();

        console.log("AgentRegistry8004:", address(reg8004));
        console.log("ERC6551Registry:  ", address(reg6551));
        console.log("ERC6551Account:   ", address(acctImpl));
        console.log("TBA researcher:   ", researcherTBA);
        console.log("TBA summarizer:   ", summarizerTBA);
    }
}
