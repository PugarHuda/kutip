// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title AgentReputation — on-chain reputation NFT for Kutip agents
///
/// @notice Each agent wallet (AA or EOA) gets a unique ERC-721 token
/// whose per-token state accumulates citations + earnings observed by
/// the operator. tokenURI returns base64 JSON with live stats so
/// OpenSea/block explorer metadata updates without off-chain hosting.
///
/// Production extension: wrap each token with an ERC-6551 token-bound
/// account so the reputation NFT itself can hold assets and sign. For
/// this hackathon we keep the ERC-721 surface clean and document TBA
/// as the roadmap path.
contract AgentReputation is ERC721 {
    using Strings for uint256;

    address public immutable operator;

    struct Reputation {
        address agent;            // primary wallet this NFT represents
        string role;              // e.g. "Researcher" | "Summarizer"
        uint64 firstActiveAt;
        uint64 lastActiveAt;
        uint64 citationCount;     // total citations across all attestations
        uint256 totalEarnedWei;   // accumulated USDC earned (as operator) in Test USD wei
        uint256 attestationCount; // number of attestations this agent payed
    }

    mapping(uint256 => Reputation) public reputations;
    mapping(address => uint256) public tokenOf; // wallet → tokenId (0 means unminted)
    uint256 public tokenCount;

    event AgentRegistered(uint256 indexed tokenId, address indexed agent, string role);
    event ReputationBumped(
        uint256 indexed tokenId,
        uint64 citationsAdded,
        uint256 earnedAdded
    );

    error NotOperator();
    error AlreadyMinted();
    error Unknown();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address _operator) ERC721("Kutip Agent Reputation", "KAR") {
        operator = _operator;
    }

    /// @notice Operator mints a reputation token for a new agent. The
    /// NFT ownership lives with the agent wallet; ERC-721 transfer
    /// semantics make reputation transferrable if the operator wants.
    function registerAgent(address agent, string calldata role) external onlyOperator returns (uint256 tokenId) {
        if (tokenOf[agent] != 0) revert AlreadyMinted();
        tokenCount++;
        tokenId = tokenCount;
        tokenOf[agent] = tokenId;

        reputations[tokenId] = Reputation({
            agent: agent,
            role: role,
            firstActiveAt: uint64(block.timestamp),
            lastActiveAt: uint64(block.timestamp),
            citationCount: 0,
            totalEarnedWei: 0,
            attestationCount: 0
        });

        _mint(agent, tokenId);
        emit AgentRegistered(tokenId, agent, role);
    }

    /// @notice Operator bumps reputation after a successful attestation.
    function bump(
        address agent,
        uint64 citationsAdded,
        uint256 earnedAdded
    ) external onlyOperator {
        uint256 tokenId = tokenOf[agent];
        if (tokenId == 0) revert Unknown();

        Reputation storage r = reputations[tokenId];
        r.citationCount += citationsAdded;
        r.totalEarnedWei += earnedAdded;
        r.attestationCount += 1;
        r.lastActiveAt = uint64(block.timestamp);

        emit ReputationBumped(tokenId, citationsAdded, earnedAdded);
    }

    /// @notice Live tokenURI — plain JSON data URL with current stats.
    /// Readable directly by block explorers; no off-chain host needed.
    /// (Base64 wrapper skipped so contract stays on solc 0.8.24 / EVM
    /// Paris without `mcopy` requirements.)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Reputation memory r = reputations[tokenId];

        return string(abi.encodePacked(
            'data:application/json,%7B%22name%22%3A%22Kutip+', r.role, '+%23', tokenId.toString(),
            '%22%2C%22description%22%3A%22On-chain+reputation+of+a+Kutip+AI+agent.+Citations+%26+earnings+accrue+as+the+agent+pays+cited+authors.%22%2C',
            '%22attributes%22%3A%5B',
                '%7B%22trait_type%22%3A%22Role%22%2C%22value%22%3A%22', r.role, '%22%7D%2C',
                '%7B%22trait_type%22%3A%22Agent+wallet%22%2C%22value%22%3A%22', Strings.toHexString(r.agent), '%22%7D%2C',
                '%7B%22display_type%22%3A%22number%22%2C%22trait_type%22%3A%22Citations+paid%22%2C%22value%22%3A', uint256(r.citationCount).toString(), '%7D%2C',
                '%7B%22display_type%22%3A%22number%22%2C%22trait_type%22%3A%22Attestations%22%2C%22value%22%3A', r.attestationCount.toString(), '%7D%2C',
                '%7B%22display_type%22%3A%22number%22%2C%22trait_type%22%3A%22Earned+%28wei%29%22%2C%22value%22%3A', r.totalEarnedWei.toString(), '%7D%2C',
                '%7B%22display_type%22%3A%22date%22%2C%22trait_type%22%3A%22First+active%22%2C%22value%22%3A', uint256(r.firstActiveAt).toString(), '%7D',
            '%5D%7D'
        ));
    }
}
