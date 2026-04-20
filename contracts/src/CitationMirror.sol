// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CitationMirror — cross-chain replica of Kite attestations
/// @notice Deployed on Avalanche Fuji. Kutip's operator relayer writes each
///         Kite attestation here within seconds of settlement, so agents
///         on any LayerZero-connected chain can discover and trust
///         Kutip citations without indexing Kite directly.
///
/// Trust model (honest):
///   - Off-chain relayer is operator-controlled. This is *LayerZero-pattern*
///     replication, not LayerZero DVN-attested. Migration path is a single
///     function swap once Kite exposes an LZ endpoint: replace `mirrorAttest`
///     caller with an LZ OApp `_lzReceive` handler.
contract CitationMirror {
    struct MirrorRecord {
        bytes32 queryId;
        uint32 sourceChainId;
        address payerOnSource;
        uint256 totalPaid;
        uint16 citationCount;
        uint64 sourceTimestamp;
        uint64 mirroredAt;
    }

    address public immutable operator;
    uint32 public immutable expectedSourceChainId;

    mapping(bytes32 => MirrorRecord) public records;
    uint256 public recordCount;

    event AttestationMirrored(
        bytes32 indexed queryId,
        uint32 indexed sourceChainId,
        address indexed payerOnSource,
        uint256 totalPaid,
        uint16 citationCount,
        uint64 sourceTimestamp
    );

    error Unauthorized();
    error DuplicateMirror();
    error InvalidSourceChain();

    constructor(address _operator, uint32 _expectedSourceChainId) {
        operator = _operator;
        expectedSourceChainId = _expectedSourceChainId;
    }

    function mirrorAttest(
        bytes32 queryId,
        uint32 sourceChainId,
        address payerOnSource,
        uint256 totalPaid,
        uint16 citationCount,
        uint64 sourceTimestamp
    ) external {
        if (msg.sender != operator) revert Unauthorized();
        if (records[queryId].mirroredAt != 0) revert DuplicateMirror();
        if (sourceChainId != expectedSourceChainId) revert InvalidSourceChain();

        records[queryId] = MirrorRecord({
            queryId: queryId,
            sourceChainId: sourceChainId,
            payerOnSource: payerOnSource,
            totalPaid: totalPaid,
            citationCount: citationCount,
            sourceTimestamp: sourceTimestamp,
            mirroredAt: uint64(block.timestamp)
        });
        unchecked { ++recordCount; }

        emit AttestationMirrored(
            queryId,
            sourceChainId,
            payerOnSource,
            totalPaid,
            citationCount,
            sourceTimestamp
        );
    }

    function isMirrored(bytes32 queryId) external view returns (bool) {
        return records[queryId].mirroredAt != 0;
    }
}
