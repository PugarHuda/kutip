// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AttributionLedger — PoAI revenue split + on-chain citation proof
/// @notice One call splits a query fee between operator, cited authors, and ecosystem fund,
///         then emits attestation events the frontend can index for bibliographies.
contract AttributionLedger {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable paymentToken;
    address public immutable operator;
    address public immutable ecosystemFund;

    uint16 public immutable operatorBps;
    uint16 public immutable authorsBps;
    uint16 public immutable ecosystemBps;

    struct Citation {
        address author;
        uint16 weightBps;
    }

    struct QueryRecord {
        bytes32 queryId;
        address payer;
        uint256 totalPaid;
        uint256 authorsShare;
        uint64 timestamp;
        uint16 citationCount;
    }

    mapping(bytes32 => QueryRecord) public queries;
    mapping(address => uint256) public authorEarnings;
    mapping(address => uint256) public authorCitations;

    event QueryAttested(
        bytes32 indexed queryId,
        address indexed payer,
        uint256 totalPaid,
        uint16 citationCount
    );

    event CitationPaid(
        bytes32 indexed queryId,
        address indexed author,
        uint16 weightBps,
        uint256 amount
    );

    event OperatorPaid(bytes32 indexed queryId, uint256 amount);
    event EcosystemPaid(bytes32 indexed queryId, uint256 amount);

    error InvalidSplit();
    error EmptyCitations();
    error WeightMismatch();
    error QueryAlreadyAttested();

    constructor(
        address _paymentToken,
        address _operator,
        address _ecosystemFund,
        uint16 _operatorBps,
        uint16 _authorsBps,
        uint16 _ecosystemBps
    ) {
        if (_operatorBps + _authorsBps + _ecosystemBps != BPS_DENOMINATOR) {
            revert InvalidSplit();
        }
        paymentToken = IERC20(_paymentToken);
        operator = _operator;
        ecosystemFund = _ecosystemFund;
        operatorBps = _operatorBps;
        authorsBps = _authorsBps;
        ecosystemBps = _ecosystemBps;
    }

    /// @notice Settle a query: user already transferred `totalPaid` to this contract.
    ///         Split + attest + emit events in one atomic operation.
    function attestAndSplit(
        bytes32 queryId,
        uint256 totalPaid,
        Citation[] calldata citations
    ) external {
        if (queries[queryId].timestamp != 0) revert QueryAlreadyAttested();
        if (citations.length == 0) revert EmptyCitations();

        uint256 authorsShare = (totalPaid * authorsBps) / BPS_DENOMINATOR;
        uint256 operatorShare = (totalPaid * operatorBps) / BPS_DENOMINATOR;
        uint256 ecosystemShare = totalPaid - authorsShare - operatorShare;

        uint16 weightSum;
        for (uint256 i; i < citations.length; ++i) {
            weightSum += citations[i].weightBps;
        }
        if (weightSum != BPS_DENOMINATOR) revert WeightMismatch();

        queries[queryId] = QueryRecord({
            queryId: queryId,
            payer: msg.sender,
            totalPaid: totalPaid,
            authorsShare: authorsShare,
            timestamp: uint64(block.timestamp),
            citationCount: uint16(citations.length)
        });

        for (uint256 i; i < citations.length; ++i) {
            Citation calldata c = citations[i];
            uint256 cut = (authorsShare * c.weightBps) / BPS_DENOMINATOR;
            paymentToken.safeTransfer(c.author, cut);
            authorEarnings[c.author] += cut;
            authorCitations[c.author] += 1;
            emit CitationPaid(queryId, c.author, c.weightBps, cut);
        }

        paymentToken.safeTransfer(operator, operatorShare);
        paymentToken.safeTransfer(ecosystemFund, ecosystemShare);

        emit OperatorPaid(queryId, operatorShare);
        emit EcosystemPaid(queryId, ecosystemShare);
        emit QueryAttested(queryId, msg.sender, totalPaid, uint16(citations.length));
    }

    function getQuery(bytes32 queryId) external view returns (QueryRecord memory) {
        return queries[queryId];
    }
}
