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
import { mkdirSync, renameSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

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

// Per-clip trim — landing has a longer above-fold animation, so it
// needs a deeper cut. Everything else cuts the standard 1.5 s blank.
const TRIM_SEC = {
  landing: 3.0,
  default: 1.5
};

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
  trimVideo(final, TRIM_SEC[name] ?? TRIM_SEC.default);
  generatePoster(final);
}

// Playwright recordings start at context creation → the first ~1.5 s is
// always blank → white as the page boots. Trim that off and re-encode
// in webm/vp9 so each clip opens directly on the demo content. ffmpeg
// is required — script no-ops cleanly if it's missing.
function trimVideo(srcPath, seconds) {
  const tmp = srcPath.replace(/\.webm$/, ".trim.webm");
  const args = [
    "-y",
    "-loglevel", "error",
    "-ss", String(seconds),
    "-i", srcPath,
    "-c:v", "libvpx-vp9",
    "-b:v", "1200k",
    "-an",
    tmp
  ];
  try {
    execFileSync("ffmpeg", args, {
      stdio: ["ignore", "ignore", "inherit"]
    });
    if (existsSync(srcPath)) unlinkSync(srcPath);
    renameSync(tmp, srcPath);
    console.log(`  ✂  trimmed first ${seconds} s`);
  } catch (err) {
    console.warn(`  · ffmpeg trim skipped: ${err.message}`);
  }
}

// Poster frame eliminates the black-frame flash <video> shows before
// the first frame decodes. Pulled at 0.5 s in — past any trim residue.
function generatePoster(srcPath) {
  const jpg = srcPath.replace(/\.webm$/, ".jpg");
  const args = [
    "-y",
    "-loglevel", "error",
    "-ss", "0.5",
    "-i", srcPath,
    "-frames:v", "1",
    "-q:v", "4",
    jpg
  ];
  try {
    execFileSync("ffmpeg", args, {
      stdio: ["ignore", "ignore", "inherit"]
    });
    console.log(`  🖼  poster ${jpg.split(/[\\/]/).pop()}`);
  } catch (err) {
    console.warn(`  · poster skipped: ${err.message}`);
  }
}

// Smooth-scroll helper that also moves the cursor toward what's revealed.
async function scrollAndPoint(page, y, cursor) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await page.waitForTimeout(900);
  if (cursor) await page.mouse.move(cursor[0], cursor[1], { steps: 30 });
}

// ─── MAIN-PITCH CLIPS (slides 1 + 2 + 3 + 5) ─────────────────────────

async function landing(page) {
  // Slow auto-scroll over the landing hero so slide 1 has subtle
  // proof-of-product visual behind the hook line.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.mouse.move(640, 300, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 200, [700, 350]);
  await page.waitForTimeout(2000);
  await scrollAndPoint(page, 600, [560, 380]);
  await page.waitForTimeout(2000);
  await scrollAndPoint(page, 1100, [820, 360]);
  await page.waitForTimeout(2000);
}

async function flow(page) {
  // Anonymous research run: no wallet needed up to 0.5 USDC. Drives the
  // 5-step agent flow from query input to receipt.
  await page.goto(`${BASE}/research`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  // Aim the cursor at the query box, type slowly.
  const queryBox = page.locator("textarea").first();
  await queryBox.waitFor({ state: "visible", timeout: 10000 });
  const box = await queryBox.boundingBox();
  if (box) await page.mouse.move(box.x + 80, box.y + 30, { steps: 25 });
  await page.waitForTimeout(800);
  await queryBox.click();
  await queryBox.type(
    "Latest progress on direct air capture cost reduction",
    { delay: 35 }
  );
  await page.waitForTimeout(1200);
  // Hover the Pay button.
  const pay = page.locator('button:has-text("Pay")').first();
  await pay.waitFor({ state: "visible", timeout: 8000 });
  const payBox = await pay.boundingBox();
  if (payBox) await page.mouse.move(payBox.x + 80, payBox.y + 20, { steps: 30 });
  await page.waitForTimeout(800);
  await pay.click();
  // Watch the 5-step ticker land. Warm path ~12 s, cold ~30 s.
  // Pad to ~28 s so the receipt renders even on a cold lambda.
  await page.waitForTimeout(28000);
  // Slow scroll toward the receipt panel.
  await scrollAndPoint(page, 400, [640, 400]);
  await page.waitForTimeout(2500);
}

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

async function qaOrcid(page) {
  await page.goto(`${BASE}/claim`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 300, [500, 380]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 700, [820, 420]);
  await page.waitForTimeout(2200);
}

async function qaGasless(page) {
  await page.goto(`${BASE}/dashboard/gasless`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 400, [500, 380]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 900, [820, 420]);
  await page.waitForTimeout(2200);
}

async function qaActivity(page) {
  await page.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 400, [500, 380]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 900, [820, 420]);
  await page.waitForTimeout(2200);
}

async function qaEarnings(page) {
  await page.goto(`${BASE}/dashboard/earnings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 500, [500, 380]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 1100, [820, 420]);
  await page.waitForTimeout(2200);
}

async function qaGovernance(page) {
  await page.goto(`${BASE}/dashboard/governance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 400, [500, 380]);
  await page.waitForTimeout(2400);
  await scrollAndPoint(page, 900, [820, 420]);
  await page.waitForTimeout(2200);
}

async function qaHistory(page) {
  await page.goto(`${BASE}/dashboard/history`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.mouse.move(640, 280, { steps: 25 });
  await page.waitForTimeout(1500);
  await scrollAndPoint(page, 300, [500, 380]);
  await page.waitForTimeout(2200);
  await scrollAndPoint(page, 700, [820, 420]);
  await page.waitForTimeout(2200);
}

// ─── RUN ALL ─────────────────────────────────────────────────────────

await record("landing", landing);
await record("flow", flow);
await record("payout", payout);
await record("verify", verify);
await record("qa-mirror", qaMirror);
await record("qa-agents", qaAgents);
await record("qa-reverse-x402", qaReverseX402);
await record("qa-escrow", qaEscrow);
await record("qa-bounties", qaBounties);
await record("qa-mcp", qaMcp);
await record("qa-orcid", qaOrcid);
await record("qa-gasless", qaGasless);
await record("qa-activity", qaActivity);
await record("qa-earnings", qaEarnings);
await record("qa-governance", qaGovernance);
await record("qa-history", qaHistory);

console.log("\n▸ Done. Commit:");
console.log("   git add web/public/clips/*.webm");
console.log("   git commit -m \"clips: cursor pointer + Q&A backup reel\"");
console.log("   git push\n");
console.log("▸ Manual still: record `flow.mp4` per docs/finale-pitch.md.");
