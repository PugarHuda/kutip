/**
 * UnclaimedYieldEscrow ABI + address resolver.
 *
 * When an author's ORCID isn't yet bound to a real wallet, their
 * citation share is routed to the escrow contract instead of a dead
 * synthetic address. The escrow holds the principal, simulates 5% APY,
 * and releases both to the researcher once they sign a claim.
 */

import { keccak256, toBytes, type Address, type Hex } from "viem";

export function getEscrowAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_ESCROW_ADDRESS?.trim();
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

export function orcidHashFor(orcid: string): Hex {
  const normalized = orcid.replace(/\s+/g, "").toUpperCase();
  return keccak256(toBytes(normalized));
}

export const escrowAbi = [
  {
    type: "function",
    name: "registerDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orcidHash", type: "bytes32" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "depositFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orcidHash", type: "bytes32" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orcidHash", type: "bytes32" },
      { name: "claimer", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "accruedYield",
    stateMutability: "view",
    inputs: [{ name: "orcidHash", type: "bytes32" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "deposits",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "depositedAt", type: "uint64" },
      { name: "claimedAt", type: "uint64" },
      { name: "claimer", type: "address" }
    ]
  },
  {
    type: "function",
    name: "totalPrincipalOutstanding",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "orcidHash", type: "bytes32", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newPrincipal", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "orcidHash", type: "bytes32", indexed: true },
      { name: "claimer", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "yieldPaid", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const;
