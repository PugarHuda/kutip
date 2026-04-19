// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @title ERC-6551 Token-Bound Account (minimal implementation)
///
/// The account is a proxy whose `implementation()` logic lives here.
/// Immutable args (salt, chainId, tokenContract, tokenId) are appended
/// to the proxy's runtime bytecode and read via `_context()`.
///
/// The "owner" of the account is whoever holds the NFT at
/// (tokenContract, tokenId). Only that owner can `execute()` calls
/// from the TBA.
contract ERC6551Account is IERC1271, IERC165, IERC721Receiver {
    uint256 public nonce;

    error NotOwner();
    error CallFailed();

    receive() external payable {}

    function _context()
        internal
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        bytes memory footer = new bytes(0x60);
        // Proxy suffix is stored at offset 0x4d (77 bytes prefix).
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        (chainId, tokenContract, tokenId) = abi.decode(
            footer,
            (uint256, address, uint256)
        );
    }

    function token()
        public
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        return _context();
    }

    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = _context();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    /// @notice Execute an arbitrary call from this account. Only the NFT
    /// owner can invoke.
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        if (msg.sender != owner()) revert NotOwner();
        ++nonce;
        bool ok;
        (ok, result) = to.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function isValidSignature(bytes32, bytes memory)
        external
        pure
        override
        returns (bytes4)
    {
        // Minimal impl returns the failure magic value; upgrade later
        // to EIP-1271 verify-via-owner-signature if account wants to
        // delegate signing.
        return 0xffffffff;
    }

    function supportsInterface(bytes4 iface) external pure returns (bool) {
        return
            iface == type(IERC1271).interfaceId ||
            iface == type(IERC165).interfaceId ||
            iface == type(IERC721Receiver).interfaceId;
    }
}
