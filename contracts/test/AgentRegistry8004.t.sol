// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry8004, IAgentRegistry8004} from "../src/AgentRegistry8004.sol";

contract AgentRegistry8004Test is Test {
    AgentRegistry8004 reg;
    address researcher = makeAddr("researcher");
    address summarizer = makeAddr("summarizer");
    address alice = makeAddr("alice");

    function setUp() public {
        reg = new AgentRegistry8004();
    }

    function test_RegisterPopulatesCard() public {
        // Agent registers its own card — owner becomes the agent itself.
        vm.prank(researcher);
        reg.register(
            researcher,
            "Kutip Researcher",
            '{"skills":["research","cite","attest"]}',
            "nft",
            keccak256("0x4da7..."),
            address(0x1234),
            1
        );

        IAgentRegistry8004.AgentCard memory c = reg.getAgent(researcher);
        assertEq(c.owner, researcher);
        assertEq(c.name, "Kutip Researcher");
        assertEq(c.reputationTokenId, 1);
        assertEq(reg.agentCount(), 1);
    }

    function test_RevertOnNonAgentRegistration() public {
        // alice tries to register `researcher`'s card — squatting attempt.
        // The new gate rejects unless msg.sender == agent.
        vm.prank(alice);
        vm.expectRevert(AgentRegistry8004.NotAgent.selector);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
    }

    function test_DoubleRegisterReverts() public {
        vm.startPrank(researcher);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
        vm.expectRevert(AgentRegistry8004.AlreadyRegistered.selector);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
        vm.stopPrank();
    }

    function test_UpdateCapabilitiesByOwner() public {
        vm.startPrank(researcher);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
        reg.updateCapabilities(researcher, '{"skills":["new"]}');
        vm.stopPrank();
        IAgentRegistry8004.AgentCard memory c = reg.getAgent(researcher);
        assertEq(c.capabilities, '{"skills":["new"]}');
    }

    function test_UpdateCapabilitiesRevertsNonOwner() public {
        vm.prank(researcher);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
        vm.prank(alice);
        vm.expectRevert(AgentRegistry8004.NotOwner.selector);
        reg.updateCapabilities(researcher, "{}");
    }

    function test_AttestTrustEmitsEvent() public {
        vm.startPrank(researcher);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
        vm.expectEmit(true, false, false, true);
        emit IAgentRegistry8004.TrustAttested(
            researcher,
            "orcid",
            keccak256("0000-0001-1234-0001")
        );
        reg.attestTrust(researcher, "orcid", keccak256("0000-0001-1234-0001"));
        vm.stopPrank();
    }

    function test_ListAgentsPaging() public {
        vm.prank(researcher);
        reg.register(researcher, "R", "{}", "none", bytes32(0), address(0), 0);
        vm.prank(summarizer);
        reg.register(summarizer, "S", "{}", "none", bytes32(0), address(0), 0);
        IAgentRegistry8004.AgentCard[] memory all = reg.listAgents(0, 10);
        assertEq(all.length, 2);
        assertEq(all[0].name, "R");
        assertEq(all[1].name, "S");

        IAgentRegistry8004.AgentCard[] memory second = reg.listAgents(1, 10);
        assertEq(second.length, 1);
        assertEq(second[0].name, "S");
    }

    function test_GetUnknownReverts() public {
        vm.expectRevert(AgentRegistry8004.NotFound.selector);
        reg.getAgent(researcher);
    }
}
