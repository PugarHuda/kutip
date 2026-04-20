// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NameRegistry — on-chain binding from ORCID hash → wallet
/// @notice Permanent, auditable replacement for the in-memory claim store.
///         After a user proves ORCID ownership off-chain (OAuth + wallet
///         signature), the Kutip operator writes the binding here. Any
///         future attestation can look up the real wallet instead of
///         routing to an unclaimed placeholder.
///
/// Security:
///   - Only `operator` can write. Attack surface = operator key. Migration
///     to fully user-controlled write path (user submits tx themselves)
///     is possible once Kite exposes cheaper account creation — for now
///     the operator relays on behalf of the user (gasless UX).
///   - Each binding includes the user's EIP-191 signature over
///     `keccak256(orcid, wallet)`. Stored as evidence; anyone can
///     independently verify the binding was consented to.
contract NameRegistry {
    struct Binding {
        address wallet;
        uint64 signedAt;
        bytes signature;
    }

    address public immutable operator;
    mapping(bytes32 => Binding) public bindings;
    uint256 public bindingCount;

    event Bound(
        bytes32 indexed orcidHash,
        address indexed wallet,
        uint64 signedAt
    );
    event Revoked(bytes32 indexed orcidHash, address indexed wallet);

    error NotOperator();
    error AlreadyBound();
    error NotBound();

    constructor(address _operator) {
        operator = _operator;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function bind(
        bytes32 orcidHash,
        address wallet,
        bytes calldata signature
    ) external onlyOperator {
        if (bindings[orcidHash].wallet != address(0)) revert AlreadyBound();
        bindings[orcidHash] = Binding({
            wallet: wallet,
            signedAt: uint64(block.timestamp),
            signature: signature
        });
        unchecked { ++bindingCount; }
        emit Bound(orcidHash, wallet, uint64(block.timestamp));
    }

    /// @notice Replace an existing binding. Same ORCID, new wallet.
    ///         Use case: user lost their key, rebinding to a new wallet.
    function rebind(
        bytes32 orcidHash,
        address newWallet,
        bytes calldata signature
    ) external onlyOperator {
        if (bindings[orcidHash].wallet == address(0)) revert NotBound();
        address prev = bindings[orcidHash].wallet;
        bindings[orcidHash] = Binding({
            wallet: newWallet,
            signedAt: uint64(block.timestamp),
            signature: signature
        });
        emit Revoked(orcidHash, prev);
        emit Bound(orcidHash, newWallet, uint64(block.timestamp));
    }

    function revoke(bytes32 orcidHash) external onlyOperator {
        Binding memory b = bindings[orcidHash];
        if (b.wallet == address(0)) revert NotBound();
        delete bindings[orcidHash];
        unchecked { --bindingCount; }
        emit Revoked(orcidHash, b.wallet);
    }

    function walletOf(bytes32 orcidHash) external view returns (address) {
        return bindings[orcidHash].wallet;
    }

    function isBound(bytes32 orcidHash) external view returns (bool) {
        return bindings[orcidHash].wallet != address(0);
    }
}
