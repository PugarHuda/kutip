export const attributionLedgerAbi = [
  {
    type: "function",
    name: "attestAndSplit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "queryId", type: "bytes32" },
      { name: "totalPaid", type: "uint256" },
      {
        name: "citations",
        type: "tuple[]",
        components: [
          { name: "author", type: "address" },
          { name: "weightBps", type: "uint16" }
        ]
      }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "authorEarnings",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "authorCitations",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "queries",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "queryId", type: "bytes32" },
      { name: "payer", type: "address" },
      { name: "totalPaid", type: "uint256" },
      { name: "authorsShare", type: "uint256" },
      { name: "timestamp", type: "uint64" },
      { name: "citationCount", type: "uint16" }
    ]
  },
  {
    type: "event",
    name: "QueryAttested",
    inputs: [
      { name: "queryId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "totalPaid", type: "uint256", indexed: false },
      { name: "citationCount", type: "uint16", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "CitationPaid",
    inputs: [
      { name: "queryId", type: "bytes32", indexed: true },
      { name: "author", type: "address", indexed: true },
      { name: "weightBps", type: "uint16", indexed: false },
      { name: "amount", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const;

export const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;
