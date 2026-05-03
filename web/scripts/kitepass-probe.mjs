#!/usr/bin/env node
/**
 * One-shot script: deploy a KitePass for the operator EOA + configure
 * Kutip-flavored spending rules (10 USDC/day, 2 USDC/tx). Prints the
 * proxy address + KiteScan link for the receipt UI.
 *
 * Usage: from web/, `node scripts/kitepass-probe.mjs`
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { GokiteAASDK } from "gokite-aa-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const envRaw = readFileSync(resolve(root, ".env"), "utf-8");
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
}

const KITE_RPC = "https://rpc-testnet.gokite.ai/";
const BUNDLER = "https://bundler-service.staging.gokite.ai/rpc/";
const SETTLEMENT_TOKEN = "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";
const CLIENT_AGENT_VAULT_IMPL = "0xB5AAFCC6DD4DFc2B80fb8BCcf406E1a2Fd559e23";
const PAYMASTER = "0x9Adcbf85D5c724611a490Ba9eDc4d38d6F39e92d";

const PK = process.env.PRIVATE_KEY;
if (!PK?.startsWith("0x")) {
  console.error("PRIVATE_KEY missing");
  process.exit(1);
}
const wallet = new ethers.Wallet(PK);
const eoa = wallet.address;
const sdk = new GokiteAASDK("kite_testnet", KITE_RPC, BUNDLER);
const aa = sdk.getAccountAddress(eoa);
console.log(`EOA: ${eoa}\nAA : ${aa}\n`);

const signFn = async (userOpHash) =>
  wallet.signMessage(ethers.getBytes(userOpHash));

// Pull the SDK example helper for proxy bytecode (lazy import).
const { getTransparentProxyBytecode } = await import(
  "gokite-aa-sdk/dist/aa/example.js"
);

async function deploy() {
  console.log("[1/2] Deploying KitePass proxy …");
  const initData = ethers.Interface.from([
    "function initialize(address allowedToken, address owner)"
  ]).encodeFunctionData("initialize", [SETTLEMENT_TOKEN, aa]);

  const ctorData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "bytes"],
    [CLIENT_AGENT_VAULT_IMPL, aa, initData]
  );
  const fullInit = getTransparentProxyBytecode() + ctorData.slice(2);

  const callData = ethers.Interface.from([
    "function performCreate(uint256 value, bytes initCode) returns (address)"
  ]).encodeFunctionData("performCreate", [0n, fullInit]);

  const r = await sdk.sendUserOperationAndWait(
    eoa,
    { target: aa, value: 0n, callData },
    signFn,
    undefined,
    PAYMASTER
  );
  if (r.status.status !== "success") {
    throw new Error("deploy failed: " + (r.status.reason ?? r.status.status));
  }
  console.log("  ✓ tx:", r.status.transactionHash);

  // Parse ContractCreated to extract proxy address
  const provider = new ethers.JsonRpcProvider(KITE_RPC, {
    chainId: 2368,
    name: "kite-testnet"
  });
  const receipt = await provider.getTransactionReceipt(r.status.transactionHash);
  const sig = ethers.id("ContractCreated(address)");
  let proxy = null;
  for (const log of receipt.logs) {
    if (log.topics[0] === sig && log.topics[1]) {
      proxy = "0x" + log.topics[1].slice(-40);
      break;
    }
  }
  if (!proxy) throw new Error("could not parse proxy address from receipt");
  console.log("  ✓ KitePass proxy:", proxy);
  return proxy;
}

async function configure(kitepass) {
  console.log("\n[2/2] Configuring spending rules …");
  const today = new Date();
  const startOfDay = Math.floor(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() /
      1000
  );

  const rules = [
    {
      timeWindow: 86400n, // daily window
      budget: ethers.parseUnits("10", 18),
      initialWindowStartTime: BigInt(startOfDay),
      targetProviders: []
    },
    {
      timeWindow: 0n, // per-tx
      budget: ethers.parseUnits("2", 18),
      initialWindowStartTime: 0n,
      targetProviders: []
    }
  ];

  const callData = ethers.Interface.from([
    "function setSpendingRules(tuple(uint256 timeWindow, uint160 budget, uint96 initialWindowStartTime, bytes32[] targetProviders)[] rules)"
  ]).encodeFunctionData("setSpendingRules", [rules]);

  const r = await sdk.sendUserOperationAndWait(
    eoa,
    { target: kitepass, value: 0n, callData },
    signFn,
    undefined,
    PAYMASTER
  );
  if (r.status.status !== "success") {
    throw new Error("configure failed: " + (r.status.reason ?? r.status.status));
  }
  console.log("  ✓ tx:", r.status.transactionHash);
  console.log(
    "\nDone. KiteScan: https://testnet.kitescan.ai/address/" + kitepass
  );
}

const proxy = await deploy();
await configure(proxy);
