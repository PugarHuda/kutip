// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-6551 Registry (minimal reference impl)
///
/// Canonical registry lives at 0x000000006551c19487814612e58FE06813775758
/// on most EVM chains but isn't deployed on Kite testnet — we ship our
/// own copy here so AgentReputation NFTs can get token-bound accounts.
///
/// createAccount() uses CREATE2 with a deterministic salt so anyone can
/// compute a TBA address off-chain by hashing the inputs — exactly the
/// property that makes reputation portable.
contract ERC6551Registry {
    error AccountCreationFailed();

    event AccountCreated(
        address indexed account,
        address indexed implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    );

    /// @notice Deploy a TBA for the given NFT. Implementation is the
    /// minimal account bytecode + immutable args.
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external returns (address account) {
        bytes memory code = _creationCode(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        bytes32 s = keccak256(abi.encode(salt, chainId, tokenContract, tokenId));

        assembly {
            account := create2(0, add(code, 0x20), mload(code), s)
        }
        if (account == address(0)) revert AccountCreationFailed();

        emit AccountCreated(
            account,
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
    }

    /// @notice Deterministic address view — no deploy required to know
    /// where the TBA will live.
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        bytes memory code = _creationCode(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        bytes32 s = keccak256(abi.encode(salt, chainId, tokenContract, tokenId));
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), s, keccak256(code))
        );
        return address(uint160(uint256(hash)));
    }

    /// @notice ERC-6551 creation code: proxy bytecode that delegates
    /// everything to `implementation` plus 64 bytes of immutable args.
    /// Off-the-shelf pattern from the ERC-6551 reference impl.
    function _creationCode(
        address impl,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) internal pure returns (bytes memory) {
        // Standard ERC-1167-style minimal proxy plus 4-slot immutable args
        // (salt, chainId, tokenContract, tokenId).
        return abi.encodePacked(
            hex"3d60ad80600a3d3981f3363d3d373d3d3d363d73",
            impl,
            hex"5af43d82803e903d91602b57fd5bf3",
            abi.encode(salt, chainId, tokenContract, tokenId)
        );
    }
}
