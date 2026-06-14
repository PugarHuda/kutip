#!/usr/bin/env node
/**
 * Auto-record finale clips with Playwright.
 *
 * Records the two main-pitch clips (payout, verify) PLUS six Q&A
 * backup clips for slide 8. Every clip carries an injected blue
 * cursor pointer that follows mouse movements, so the recording
 * shows the viewer which part of the page is being talked about —
 * native Chromium headless recordings hide the cursor.
 *
 * Usage from repo root:
 *   npm i -D playwright
 *   npx playwright install chromium
 *   node scripts/record-clips.mjs
 *
 * The third main clip (`flow.mp4`) still requires manual capture
 * because it depends on a wallet-signed live query — see
 * docs/finale-pitch.md.
 */

import { chromium } from "playwright";
import { mkdirSync, renameSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT = resolve(REPO, "web/public/clips");
const BASE = process.env.KUTIP_BASE_URL ?? "https://kutip-zeta.vercel.app";
const QUERY_ID =
  process.env.KUTIP_QUERY_ID ??
  "0xcdb7f0b64832284e7b3ddd8bc5553882efdd1f54e99501adb2923adeec12361c";

mkdirSync(OUT, { recursive: true });

// Init script — runs on every new page, draws a glowing blue dot that
// tracks the mouse so the recording is followable.
function cursorInit() {
  const ensure = () => {
    if (document.getElementById("__finale_cursor")) return;
    if (!document.body) {
      setTimeout(ensure, 40);
      return;
    }
    const c = document.createElement("div");
    c.id = "__finale_cursor";
    c.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:30px",
      "height:30px",
      "border-radius:50%",
      "background:rgba(99,102,241,0.35)",
      "border:2px solid rgba(99,102,241,0.95)",
      "pointer-events:none",
      "z-index:2147483647",
      "transform:translate(-50%,-50%)",
      "transition:top 60ms linear, left 60ms linear",
      "box-shadow:0 0 32px rgba(99,102,241,0.65),0 0 6px rgba(255,255,255,0.9)"
    ].join(";");
    const inner = document.createElement("div");
    inner.style.cssText = [
      "position:absolute",
      "inset:9px",
      "border-radius:50%",
      "background:rgba(99,102,241,0.95)"
    ].join(";");
    c.appendChild(inner);
    document.body.appendChild(c);
    document.addEventListener(
      "mousemove",
      (e) => {
        c.style.left = e.clientX + "px";
        c.style.top = e.clientY + "px";
      },
      true
    );
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensure);
  } else {
    ensure();
  }
}

async function record(name, fn) {
  console.log(`\n▸ Recording ${name}.webm …`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }
  });
  await context.addInitScript(cursorInit);
  const page = await context.newPage();
  try {
    // Park cursor mid-screen so it has a starting position visible.
    await page.mouse.move(640, 360);
    await fn(page);
  } catch (err) {
    console.error(`  ✗ ${name} failed:`, err.message);
  }
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();
  if (!video) return console.warn(`  (no video for ${name})`);
  const tmp = await video.path();
  const final = join(OUT, `${name}.webm`);
  if (existsSync(final)) console.log(`  · overwriting ${final}`);
  renameSync(tmp, final);
  console.log(`  ✓ saved ${final}`);
}

// Smooth-scroll helper that also moves the cursor toward what's revealed.
async function scrollAndPoint(page, y, cursor) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await page.waitForTimeout(900);
  if (cursor) await page.mouse.move(cursor[0], cursor[1], { steps: 30 });
}

// ─── MAIN-PITCH CLIPS (slides 3 + 5) ────────────────────────────────

async function payout(page) {
  await page.goto(`${BASE}/verify/${QUERY_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.mouse.move(640, 200, { steps: 25 });
  await page.waitForTimeout(1200);
  await scrollAndPoint(page, 500, [820, 360]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 1100, [600, 420]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 1700, [900, 400]);
  await page.waitForTimeout(2000);
}

async function verify(page) {
  await page.goto(`${BASE}/dashboard/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const firstLink = page.locator('a[href*="/dashboard/verify/"]').first();
  await firstLink.scrollIntoViewIfNeeded();
  const box = await firstLink.boundingBox();
  if (box) await page.mouse.move(box.x + 60, box.y + 30, { steps: 30 });
  await page.waitForTimeout(1200);
  await firstLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  await scrollAndPoint(page, 500, [700, 380]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 1200, [620, 420]);
  await page.waitForTimeout(3000);
}

// ─── Q&A BACKUP CLIPS (slide 8) — each ~8 s ──────────────────────────

async function qaMirror(page) {
  // Verify page shows cross-chain receipt context — KiteScan tx + the
  // contract row. Presenter narrates the Fuji mirror over this.
  await page.goto(`${BASE}/verify/${QUERY_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.mouse.move(500, 240, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 400, [840, 380]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 800, [600, 420]);
  await page.waitForTimeout(1800);
}

async function qaAgents(page) {
  await page.goto(`${BASE}/dashboard/agents`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 300, { steps: 25 });
  await page.waitForTimeout(1200);
  await scrollAndPoint(page, 500, [400, 420]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 1100, [820, 380]);
  await page.waitForTimeout(2400);
}

async function qaReverseX402(page) {
  await page.goto(`${BASE}/verify/${QUERY_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Skip past payouts to the reverse-x402 paywall card.
  await scrollAndPoint(page, 1800, [600, 400]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 2300, [820, 380]);
  await page.waitForTimeout(2400);
}

async function qaEscrow(page) {
  await page.goto(`${BASE}/dashboard/escrow`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1200);
  await scrollAndPoint(page, 400, [500, 380]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 900, [820, 420]);
  await page.waitForTimeout(2400);
}

async function qaBounties(page) {
  await page.goto(`${BASE}/dashboard/bounties`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1200);
  await scrollAndPoint(page, 400, [500, 380]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 900, [820, 420]);
  await page.waitForTimeout(2200);
}

async function qaMcp(page) {
  // The docs hub mentions MCP integration; settle for the index since
  // the [[...slug]] route may render slowly on cold start.
  await page.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 320, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 500, [500, 400]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 1200, [820, 380]);
  await page.waitForTimeout(2200);
}

// ─── RUN ALL ─────────────────────────────────────────────────────────

await record("payout", payout);
await record("verify", verify);
await record("qa-mirror", qaMirror);
await record("qa-agents", qaAgents);
await record("qa-reverse-x402", qaReverseX402);
await record("qa-escrow", qaEscrow);
await record("qa-bounties", qaBounties);
await record("qa-mcp", qaMcp);

console.log("\n▸ Done. Commit:");
console.log("   git add web/public/clips/*.webm");
console.log("   git commit -m \"clips: cursor pointer + Q&A backup reel\"");
console.log("   git push\n");
console.log("▸ Manual still: record `flow.mp4` per docs/finale-pitch.md.");
