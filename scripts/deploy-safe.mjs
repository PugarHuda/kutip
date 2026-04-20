#!/usr/bin/env node
/**
 * Deploy a 2-of-3 Safe on Kite testnet.
 *
 * Owners:
 *   1. Operator EOA (current deployer) — PRIVATE_KEY in .env
 *   2. Ecosystem backup — deterministic from PRIVATE_KEY + salt "ecosystem"
 *   3. Researcher guardian — deterministic from PRIVATE_KEY + salt "guardian"
 *
 * In production these would be separate human-held keys. For hackathon
 * demo we generate deterministic keys so the setup is reproducible and
 * the story is "here's how multisig governance would look" without
 * compromising the story.
 *
 * Run: node scripts/deploy-safe.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");
const envRaw = readFileSync(envPath, "utf-8");
for (const line of envRaw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
}

const PK = process.env.PRIVATE_KEY;
if (!PK?.startsWith("0x")) {
  console.error("PRIVATE_KEY missing from .env");
  process.exit(1);
}
const RPC = process.env.KITE_RPC_URL ?? "https://rpc-testnet.gokite.ai/";

const SAFE_L2_SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";
const SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
const FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99"; // canonical

function deriveKey(seedHex, salt) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "string"],
      [seedHex, salt]
    )
  );
}

const operatorWallet = new ethers.Wallet(PK);
const ecosystemKey = deriveKey(PK, "kutip-ecosystem-v1");
const guardianKey = deriveKey(PK, "kutip-guardian-v1");
const ecosystemWallet = new ethers.Wallet(ecosystemKey);
const guardianWallet = new ethers.Wallet(guardianKey);

const owners = [
  operatorWallet.address,
  ecosystemWallet.address,
  guardianWallet.address
].sort(); // Safe requires sorted owners

const THRESHOLD = 2;

const SAFE_SETUP_ABI = [
  "function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)"
];

const setupIface = new ethers.Interface(SAFE_SETUP_ABI);
const initializer = setupIface.encodeFunctionData("setup", [
  owners,
  THRESHOLD,
  ethers.ZeroAddress,
  "0x",
  FALLBACK_HANDLER,
  ethers.ZeroAddress,
  0,
  ethers.ZeroAddress
]);

const FACTORY_ABI = [
  "function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
  "event ProxyCreation(address indexed proxy, address singleton)"
];

const provider = new ethers.JsonRpcProvider(RPC, { chainId: 2368, name: "kite-testnet" });
const signer = new ethers.Wallet(PK, provider);
const factory = new ethers.Contract(SAFE_PROXY_FACTORY, FACTORY_ABI, signer);

const saltNonce = BigInt(Date.now());

console.log("[safe] operator  :", operatorWallet.address);
console.log("[safe] ecosystem :", ecosystemWallet.address);
console.log("[safe] guardian  :", guardianWallet.address);
console.log("[safe] threshold :", THRESHOLD);
console.log("[safe] salt      :", saltNonce);
console.log("[safe] deploying proxy via factory ...");

const tx = await factory.createProxyWithNonce(
  SAFE_L2_SINGLETON,
  initializer,
  saltNonce
);
console.log("[safe] tx sent:", tx.hash);
const receipt = await tx.wait();

const iface = new ethers.Interface(FACTORY_ABI);
let proxy = null;
for (const log of receipt.logs) {
  try {
    const parsed = iface.parseLog(log);
    if (parsed?.name === "ProxyCreation") {
      proxy = parsed.args.proxy;
      break;
    }
  } catch {
    /* not the event we want */
  }
}

if (!proxy) {
  console.error("[safe] could not locate ProxyCreation event");
  process.exit(2);
}

console.log("[safe] ok · Safe address =", proxy);
console.log("[safe] block =", receipt.blockNumber, "gas =", receipt.gasUsed.toString());
console.log("[safe] explorer: https://testnet.kitescan.ai/address/" + proxy);

// Write to .env (append/update only the new keys — preserve everything else)
let env = readFileSync(envPath, "utf-8");
const updates = {
  NEXT_PUBLIC_OPERATOR_SAFE: proxy,
  KUTIP_SAFE_ECOSYSTEM_SIGNER: ecosystemWallet.address,
  KUTIP_SAFE_GUARDIAN_SIGNER: guardianWallet.address,
  KUTIP_SAFE_ECOSYSTEM_PK: ecosystemKey,
  KUTIP_SAFE_GUARDIAN_PK: guardianKey,
  KUTIP_SAFE_THRESHOLD: "2",
  KUTIP_SAFE_OWNERS: owners.join(",")
};
for (const [k, v] of Object.entries(updates)) {
  const line = `${k}=${v}`;
  if (env.match(new RegExp(`^${k}=.*`, "m"))) {
    env = env.replace(new RegExp(`^${k}=.*`, "m"), line);
  } else {
    env = env.trimEnd() + "\n" + line + "\n";
  }
}
writeFileSync(envPath, env);
console.log("[safe] .env updated with Safe + signer keys");
