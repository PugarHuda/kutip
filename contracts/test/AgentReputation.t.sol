// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentReputation} from "../src/AgentReputation.sol";

contract AgentReputationTest is Test {
    AgentReputation nft;
    address operator = makeAddr("operator");
    address researcher = makeAddr("researcher");
    address summarizer = makeAddr("summarizer");

    function setUp() public {
        nft = new AgentReputation(operator);
    }

    function test_RegisterMintsToAgent() public {
        vm.prank(operator);
        uint256 tokenId = nft.registerAgent(researcher, "Researcher");
        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), researcher);
        assertEq(nft.tokenOf(researcher), tokenId);
    }

    function test_BumpAccumulates() public {
        vm.startPrank(operator);
        uint256 tokenId = nft.registerAgent(researcher, "Researcher");
        nft.bump(researcher, 3, 0.4 ether);
        nft.bump(researcher, 4, 0.6 ether);
        vm.stopPrank();

        (,,,,uint64 citations, uint256 earned, uint256 atts) = nft.reputations(tokenId);
        assertEq(citations, 7);
        assertEq(earned, 1 ether);
        assertEq(atts, 2);
    }

    function test_RevertOnDoubleRegister() public {
        vm.startPrank(operator);
        nft.registerAgent(researcher, "Researcher");
        vm.expectRevert(AgentReputation.AlreadyMinted.selector);
        nft.registerAgent(researcher, "Researcher");
        vm.stopPrank();
    }

    function test_RevertBumpOnUnknownAgent() public {
        vm.prank(operator);
        vm.expectRevert(AgentReputation.Unknown.selector);
        nft.bump(researcher, 1, 0);
    }

    function test_TokenURIHasStats() public {
        vm.startPrank(operator);
        uint256 tokenId = nft.registerAgent(researcher, "Researcher");
        nft.bump(researcher, 5, 0.5 ether);
        vm.stopPrank();

        string memory uri = nft.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 20);
    }

    function test_OnlyOperatorRegisters() public {
        vm.expectRevert(AgentReputation.NotOperator.selector);
        nft.registerAgent(researcher, "Researcher");
    }

    function test_TwoAgentsTwoTokens() public {
        vm.startPrank(operator);
        nft.registerAgent(researcher, "Researcher");
        nft.registerAgent(summarizer, "Summarizer");
        vm.stopPrank();
        assertEq(nft.tokenCount(), 2);
        assertEq(nft.ownerOf(1), researcher);
        assertEq(nft.ownerOf(2), summarizer);
    }
}
