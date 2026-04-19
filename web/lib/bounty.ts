import { keccak256, toBytes, type Address, type Hex } from "viem";

export function getBountyMarketAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_BOUNTY_MARKET_ADDRESS?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export function topicHashFor(topic: string): Hex {
  return keccak256(toBytes(topic.trim().toLowerCase()));
}

export const bountyMarketAbi = [
  {
    type: "function",
    name: "create",
    stateMutability: "nonpayable",
    inputs: [
      { name: "topicHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "ttlSeconds", type: "uint64" }
    ],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "queryId", type: "bytes32" },
      { name: "authors", type: "address[]" },
      { name: "weightsBps", type: "uint16[]" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "bountyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "bounties",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "sponsor", type: "address" },
      { name: "topicHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "createdAt", type: "uint64" },
      { name: "expiresAt", type: "uint64" },
      { name: "settled", type: "bool" },
      { name: "refunded", type: "bool" }
    ]
  },
  {
    type: "event",
    name: "BountyCreated",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "sponsor", type: "address", indexed: true },
      { name: "topicHash", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "BountySettled",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "queryId", type: "bytes32", indexed: true },
      { name: "authors", type: "address[]", indexed: false },
      { name: "totalPaid", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "BountyRefunded",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const;
