// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BountyMarket — anyone can sponsor research on a topic, cited
/// authors get the payout proportionally.
///
/// @notice Flow:
///   1. Sponsor (user, DAO, anyone) creates a bounty for a topic by
///      depositing USDC.
///   2. A Kutip query whose subject matches the topic triggers the
///      operator to call `settle(bountyId, authors[], weightsBps[])` —
///      the operator vouches for the match; fraud is disincentivised by
///      reputation (same key as the AttributionLedger operator).
///   3. Payout split by weight, sponsor optionally refunds after expiry
///      if no match landed.
///
/// The market is intentionally thin: a single-topic escrow with an
/// operator-gated settle. Matching/discovery logic lives off-chain in
/// the agent, keeping gas costs low and letting us evolve heuristics
/// without contract upgrades.
contract BountyMarket {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable paymentToken;
    address public immutable operator;

    struct Bounty {
        address sponsor;
        bytes32 topicHash;      // keccak256(abi.encodePacked(lowercase topic))
        uint256 amount;
        uint64 createdAt;
        uint64 expiresAt;
        bool settled;
        bool refunded;
    }

    uint256 public bountyCount;
    mapping(uint256 => Bounty) public bounties;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed sponsor,
        bytes32 indexed topicHash,
        uint256 amount,
        uint64 expiresAt
    );
    event BountySettled(
        uint256 indexed bountyId,
        bytes32 indexed queryId,
        address[] authors,
        uint256 totalPaid
    );
    event BountyRefunded(uint256 indexed bountyId, uint256 amount);

    error NotOperator();
    error NotSponsor();
    error AlreadySettled();
    error AlreadyRefunded();
    error NotYetExpired();
    error ZeroAmount();
    error LengthMismatch();
    error WeightSumInvalid();
    error BountyNotFound();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address _paymentToken, address _operator) {
        paymentToken = IERC20(_paymentToken);
        operator = _operator;
    }

    /// @notice Sponsor funds a bounty for a topic. `topicHash` is
    /// `keccak256(abi.encodePacked(bytes(topicLowercase)))` — agreed
    /// off-chain between sponsor and agent for keyword match.
    function create(
        bytes32 topicHash,
        uint256 amount,
        uint64 ttlSeconds
    ) external returns (uint256 bountyId) {
        if (amount == 0) revert ZeroAmount();
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        bountyId = bountyCount++;
        bounties[bountyId] = Bounty({
            sponsor: msg.sender,
            topicHash: topicHash,
            amount: amount,
            createdAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + ttlSeconds,
            settled: false,
            refunded: false
        });

        emit BountyCreated(bountyId, msg.sender, topicHash, amount, uint64(block.timestamp) + ttlSeconds);
    }

    /// @notice Operator pays out the bounty to cited authors. Weights
    /// sum to 10000 bps (100%).
    function settle(
        uint256 bountyId,
        bytes32 queryId,
        address[] calldata authors,
        uint16[] calldata weightsBps
    ) external onlyOperator {
        Bounty storage b = bounties[bountyId];
        if (b.sponsor == address(0)) revert BountyNotFound();
        if (b.settled) revert AlreadySettled();
        if (b.refunded) revert AlreadyRefunded();
        if (authors.length != weightsBps.length) revert LengthMismatch();

        uint16 sum;
        for (uint256 i; i < weightsBps.length; ++i) {
            sum += weightsBps[i];
        }
        if (sum != BPS_DENOMINATOR) revert WeightSumInvalid();

        b.settled = true;
        uint256 paid = b.amount;

        for (uint256 i; i < authors.length; ++i) {
            uint256 cut = (paid * weightsBps[i]) / BPS_DENOMINATOR;
            if (cut > 0) paymentToken.safeTransfer(authors[i], cut);
        }

        emit BountySettled(bountyId, queryId, authors, paid);
    }

    /// @notice Sponsor recovers unused funds after expiry.
    function refund(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        if (b.sponsor == address(0)) revert BountyNotFound();
        if (msg.sender != b.sponsor) revert NotSponsor();
        if (b.settled) revert AlreadySettled();
        if (b.refunded) revert AlreadyRefunded();
        if (block.timestamp < b.expiresAt) revert NotYetExpired();

        b.refunded = true;
        paymentToken.safeTransfer(b.sponsor, b.amount);

        emit BountyRefunded(bountyId, b.amount);
    }

    /// @notice Convenience getter so UIs don't have to destructure the
    /// whole struct when they only want freshness.
    function isActive(uint256 bountyId) external view returns (bool) {
        Bounty memory b = bounties[bountyId];
        return b.sponsor != address(0) && !b.settled && !b.refunded && block.timestamp < b.expiresAt;
    }
}
