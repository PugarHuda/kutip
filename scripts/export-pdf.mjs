#!/usr/bin/env node
/**
 * Export /slides deck to a single PDF for sharing offline.
 *
 * Strategy:
 *   1. Headless Chromium opens kutip-zeta.vercel.app/slides
 *   2. Swap each <video> with an <img> pointing at the poster JPG
 *      → screenshots get a stable still frame, not a random video frame
 *   3. For each slide (keyboard ArrowRight to advance): screenshot
 *   4. pdf-lib stitches the PNGs into a single multi-page PDF
 *
 * Output:
 *   docs/kutip-deck.pdf
 *
 * Usage:
 *   node scripts/export-pdf.mjs
 */

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT = resolve(REPO, "docs/kutip-deck.pdf");
const BASE = process.env.KUTIP_BASE_URL ?? "https://kutip-zeta.vercel.app";
const SLIDE_COUNT = Number(process.env.KUTIP_SLIDE_COUNT ?? 11);

mkdirSync(dirname(OUT), { recursive: true });

console.log(`▸ Exporting ${SLIDE_COUNT} slides from ${BASE}/slides`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2 // crisper text in PDF
});
const page = await ctx.newPage();
await page.goto(`${BASE}/slides`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

// Replace every <video> with its poster <img> so each screenshot
// captures a stable still frame. Video elements would otherwise grab
// a random frame depending on autoplay timing.
async function freezeVideos() {
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((v) => {
      const sources = v.querySelectorAll("source");
      let poster =
        v.getAttribute("poster") ||
        (sources[0] &&
          sources[0]
            .getAttribute("src")
            ?.replace(/\.(webm|mp4)$/i, ".jpg")) ||
        "";
      if (!poster) return;
      const img = document.createElement("img");
      img.src = poster;
      img.style.cssText =
        "width:100%;height:100%;object-fit:contain;display:block;background:#000";
      v.parentNode?.replaceChild(img, v);
    });
  });
  await page.waitForTimeout(800);
}
await freezeVideos();

const pngs = [];
for (let i = 0; i < SLIDE_COUNT; i++) {
  console.log(`  · slide ${i + 1}/${SLIDE_COUNT}`);
  await page.waitForTimeout(500);
  // Wait for any img to settle (some posters lazy-load when slide
  // remounts via key change after keyboard nav)
  const png = await page.screenshot({ fullPage: false });
  pngs.push(png);
  if (i < SLIDE_COUNT - 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    // Re-freeze: each slide remount re-instantiates videos.
    await freezeVideos();
  }
}

await browser.close();

console.log(`▸ Stitching ${pngs.length} pages into PDF...`);
const pdf = await PDFDocument.create();
for (const buf of pngs) {
  const img = await pdf.embedPng(buf);
  const pdfPage = pdf.addPage([img.width, img.height]);
  pdfPage.drawImage(img, {
    x: 0,
    y: 0,
    width: img.width,
    height: img.height
  });
}
const bytes = await pdf.save();
writeFileSync(OUT, bytes);

console.log(`✓ saved ${OUT}`);
console.log(`  ${pngs.length} pages · ${Math.round(bytes.length / 1024)} KB`);
