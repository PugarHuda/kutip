/**
 * ERC-8004 agent registry + ERC-6551 token-bound account helpers.
 *
 * ERC-8004 is the 2026 draft for trustless agent identity / reputation /
 * capability discovery on EVM. Our registry implements the core shape
 * (AgentCard with name, capabilities, trustMethod, reputation pointer)
 * and emits spec-aligned events.
 *
 * ERC-6551 gives each reputation NFT its own smart-account address so
 * the NFT itself can hold tokens, sign messages, and earn reputation —
 * enabling transferrable agent identity.
 */

import type { Address } from "viem";

export function getAgentRegistryAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export function getErc6551RegistryAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_ERC6551_REGISTRY?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export function getErc6551AccountImpl(): Address | null {
  const raw = process.env.NEXT_PUBLIC_ERC6551_ACCOUNT_IMPL?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export const agentRegistry8004Abi = [
  {
    type: "function",
    name: "getAgent",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "agent", type: "address" },
          { name: "owner", type: "address" },
          { name: "name", type: "string" },
          { name: "capabilities", type: "string" },
          { name: "trustMethod", type: "string" },
          { name: "trustProof", type: "bytes32" },
          { name: "reputationTarget", type: "address" },
          { name: "reputationTokenId", type: "uint256" },
          { name: "registeredAt", type: "uint64" },
          { name: "lastUpdatedAt", type: "uint64" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "agentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  }
] as const;

export const erc6551RegistryAbi = [
  {
    type: "function",
    name: "account",
    stateMutability: "view",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "salt", type: "uint256" }
    ],
    outputs: [{ type: "address" }]
  }
] as const;
