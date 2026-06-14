#!/usr/bin/env node
/**
 * Auto-record the two wallet-free finale clips with Playwright.
 *
 * Usage (from repo root):
 *   1. one-time: npm i -D playwright && npx playwright install chromium
 *   2. node scripts/record-clips.mjs
 *
 * Outputs:
 *   web/public/clips/payout.webm
 *   web/public/clips/verify.webm
 *
 * The third clip (`flow.mp4`) requires a wallet-signed live query and
 * is recorded manually — see docs/finale-pitch.md "Clip recording".
 *
 * Caveat: this script is untested in CI. If a step breaks (e.g. the
 * verify selector changed), fall back to manual Win+G capture per the
 * shot list in web/public/clips/README.md. Manual is the source of
 * truth; this script is just a time-saver.
 */

import { chromium } from "playwright";
import { mkdirSync, renameSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT = resolve(REPO, "web/public/clips");
const BASE = process.env.KUTIP_BASE_URL ?? "https://kutip-zeta.vercel.app";

// Known good queryId — a real attestation with a persisted summary.
// Override with KUTIP_QUERY_ID if you'd rather record a different one.
const QUERY_ID =
  process.env.KUTIP_QUERY_ID ??
  "0xcdb7f0b64832284e7b3ddd8bc5553882efdd1f54e99501adb2923adeec12361c";

mkdirSync(OUT, { recursive: true });

async function record(name, fn) {
  console.log(`\n▸ Recording ${name}.webm …`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }
  });
  const page = await context.newPage();
  try {
    await fn(page);
  } catch (err) {
    console.error(`  ✗ ${name} failed:`, err.message);
  }
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();
  if (!video) {
    console.warn(`  (no video — Playwright didn't record ${name})`);
    return;
  }
  const tmpPath = await video.path();
  const finalPath = join(OUT, `${name}.webm`);
  if (existsSync(finalPath)) {
    console.log(`  · overwriting existing ${finalPath}`);
  }
  renameSync(tmpPath, finalPath);
  console.log(`  ✓ saved ${finalPath}`);
}

async function payout(page) {
  await page.goto(`${BASE}/verify/${QUERY_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Reveal: the attestation chip + facts grid
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(2000);
  // Reveal: per-author payouts table
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "smooth" }));
  await page.waitForTimeout(3500);
  // Reveal: total + tx chip
  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: "smooth" }));
  await page.waitForTimeout(2500);
}

async function verify(page) {
  await page.goto(`${BASE}/dashboard/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  // Hover the first persisted run
  const firstLink = page.locator('a[href*="/dashboard/verify/"]').first();
  await firstLink.scrollIntoViewIfNeeded();
  await firstLink.hover();
  await page.waitForTimeout(1200);
  await firstLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  // Reveal the summary block + digest
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
  await page.waitForTimeout(3000);
  // Scroll to the keccak256 digest line
  await page.evaluate(() => window.scrollTo({ top: 1300, behavior: "smooth" }));
  await page.waitForTimeout(3000);
}

await record("payout", payout);
await record("verify", verify);

console.log("\n▸ Done. Commit:");
console.log("   git add web/public/clips/*.webm");
console.log("   git commit -m \"clips: finale recordings\"");
console.log("   git push");
console.log("\n▸ Then record `flow.mp4` manually — see docs/finale-pitch.md.");
