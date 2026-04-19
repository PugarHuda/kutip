// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry (ERC-8004 aligned)
///
/// Minimal on-chain registry for autonomous agents following the ERC-8004
/// Trustless Agents draft (2026). Agents publish a card here with name,
/// capabilities, trust method (ORCID / DID / NFT / etc.) and a pointer
/// to where reputation accumulates.
///
/// Design notes:
///   - Any address can register its own card (controller = msg.sender by
///     default). A third party can register on behalf of an agent if the
///     agent address matches msg.sender, otherwise the registration is
///     a nomination that the agent itself must confirm (unused here).
///   - Updates are owner-gated: only the controller set at registration
///     can mutate the card later.
///   - Reputation pointer is an (address, tokenId) tuple so we can route
///     to our AgentReputation ERC-721 without coupling it on-chain.
///   - Trust proof is an opaque bytes32 (hash of off-chain attestation)
///     so the standard stays minimal; verifiers off-chain resolve it.
interface IAgentRegistry8004 {
    struct AgentCard {
        address agent;               // principal address
        address owner;               // controller; can update fields
        string name;                 // human-readable agent name
        string capabilities;         // JSON-encoded skill list / service description
        string trustMethod;          // "orcid" | "did" | "nft" | "email" | "none"
        bytes32 trustProof;          // opaque proof hash (e.g. keccak256 of ORCID)
        address reputationTarget;    // where reputation accrues (ERC-721 contract)
        uint256 reputationTokenId;   // token id within reputationTarget
        uint64 registeredAt;
        uint64 lastUpdatedAt;
    }

    event AgentRegistered(
        address indexed agent,
        address indexed owner,
        string name,
        address reputationTarget,
        uint256 reputationTokenId
    );
    event AgentUpdated(address indexed agent, string name, string capabilities);
    event TrustAttested(
        address indexed agent,
        string trustMethod,
        bytes32 trustProof
    );

    function register(
        address agent,
        string calldata name,
        string calldata capabilities,
        string calldata trustMethod,
        bytes32 trustProof,
        address reputationTarget,
        uint256 reputationTokenId
    ) external;

    function getAgent(address agent) external view returns (AgentCard memory);
    function updateCapabilities(address agent, string calldata capabilities) external;
    function attestTrust(address agent, string calldata method, bytes32 proof) external;
}

contract AgentRegistry8004 is IAgentRegistry8004 {
    mapping(address => AgentCard) private cards;
    address[] public agents;

    error NotOwner();
    error AlreadyRegistered();
    error NotFound();

    function register(
        address agent,
        string calldata name,
        string calldata capabilities,
        string calldata trustMethod,
        bytes32 trustProof,
        address reputationTarget,
        uint256 reputationTokenId
    ) external {
        if (cards[agent].owner != address(0)) revert AlreadyRegistered();

        cards[agent] = AgentCard({
            agent: agent,
            owner: msg.sender,
            name: name,
            capabilities: capabilities,
            trustMethod: trustMethod,
            trustProof: trustProof,
            reputationTarget: reputationTarget,
            reputationTokenId: reputationTokenId,
            registeredAt: uint64(block.timestamp),
            lastUpdatedAt: uint64(block.timestamp)
        });
        agents.push(agent);

        emit AgentRegistered(agent, msg.sender, name, reputationTarget, reputationTokenId);
        if (trustProof != bytes32(0)) {
            emit TrustAttested(agent, trustMethod, trustProof);
        }
    }

    function updateCapabilities(address agent, string calldata capabilities) external {
        AgentCard storage c = cards[agent];
        if (c.owner == address(0)) revert NotFound();
        if (c.owner != msg.sender) revert NotOwner();

        c.capabilities = capabilities;
        c.lastUpdatedAt = uint64(block.timestamp);
        emit AgentUpdated(agent, c.name, capabilities);
    }

    function attestTrust(
        address agent,
        string calldata method,
        bytes32 proof
    ) external {
        AgentCard storage c = cards[agent];
        if (c.owner == address(0)) revert NotFound();
        if (c.owner != msg.sender) revert NotOwner();

        c.trustMethod = method;
        c.trustProof = proof;
        c.lastUpdatedAt = uint64(block.timestamp);
        emit TrustAttested(agent, method, proof);
    }

    function getAgent(address agent) external view returns (AgentCard memory) {
        AgentCard memory c = cards[agent];
        if (c.owner == address(0)) revert NotFound();
        return c;
    }

    function agentCount() external view returns (uint256) {
        return agents.length;
    }

    /// @notice Convenience paging — returns `limit` cards starting at `offset`.
    function listAgents(uint256 offset, uint256 limit)
        external
        view
        returns (AgentCard[] memory out)
    {
        uint256 end = offset + limit > agents.length ? agents.length : offset + limit;
        if (offset >= end) return new AgentCard[](0);
        out = new AgentCard[](end - offset);
        for (uint256 i; i < out.length; ++i) {
            out[i] = cards[agents[offset + i]];
        }
    }
}
