import type { Address } from "viem";

export function getReputationAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_AGENT_REPUTATION_ADDRESS?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export const agentReputationAbi = [
  {
    type: "function",
    name: "tokenCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "tokenOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "reputations",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "agent", type: "address" },
      { name: "role", type: "string" },
      { name: "firstActiveAt", type: "uint64" },
      { name: "lastActiveAt", type: "uint64" },
      { name: "citationCount", type: "uint64" },
      { name: "totalEarnedWei", type: "uint256" },
      { name: "attestationCount", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "string" }]
  },
  {
    type: "function",
    name: "bump",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "citationsAdded", type: "uint64" },
      { name: "earnedAdded", type: "uint256" }
    ],
    outputs: []
  }
] as const;
