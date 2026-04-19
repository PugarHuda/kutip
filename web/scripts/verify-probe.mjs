import { createPublicClient, http, defineChain } from "viem";

const kite = defineChain({ id: 2368, name: "kite", nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc-testnet.gokite.ai/"] } } });
const client = createPublicClient({ chain: kite, transport: http() });

const abi = [{ type: "event", name: "CitationPaid", inputs: [{ name: "queryId", type: "bytes32", indexed: true }, { name: "author", type: "address", indexed: true }, { name: "weightBps", type: "uint16" }, { name: "amount", type: "uint256" }], anonymous: false }];

const LEDGER = "0x99359DaF4f2504dF3da042cd38B8d01B8589E5Fa";

console.log("--- all CitationPaid events ---");
const all = await client.getContractEvents({
  address: LEDGER, abi, eventName: "CitationPaid",
  fromBlock: 20944832n, toBlock: "latest"
});
console.log("count:", all.length);
for (const l of all) {
  console.log(`  queryId=${l.args.queryId.slice(0,18)}... author=${l.args.author} amount=${l.args.amount}`);
}

const target = "0x2f273ac8243078c8ee2e185fa3ae642c9eee88a6e474a886c02f8a727c9a9558";
console.log("\n--- filtered by queryId ---");
const filtered = await client.getContractEvents({
  address: LEDGER, abi, eventName: "CitationPaid",
  args: { queryId: target },
  fromBlock: 20944832n, toBlock: "latest"
});
console.log("filter count:", filtered.length);
