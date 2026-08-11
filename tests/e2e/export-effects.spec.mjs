import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

const effectBaseline = JSON.parse(await readFile(new URL("../fixtures/export-effect-hashes.json", import.meta.url), "utf8"));
const effects = ["diamond", "rainbow", "crystal", "holographic", "laser", "lightning", "flame", "galaxy"];
const normalizedIntensity = { diamond: 18, crystal: 32, galaxy: 10 };

async function openStudio(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/three-preview-ready/, { timeout: 20_000 });
}

async function exportedPixelHash(page, effect) {
  await page.locator("#tabBtnDesign").click();
  await page.locator(`[data-effect="${effect}"]`).click();
  await expect(page.locator(`[data-effect="${effect}"]`)).toHaveClass(/active/);
  await page.locator("#effectIntensity").fill("80");
  await expect(page.locator("#effectIntensityOut")).toHaveText(`${normalizedIntensity[effect] || 80}%`);
  await page.locator("#tabBtnExport").click();
  await expect(page.locator("#tab-export")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-export="front"]').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const rawRgba = await sharp(downloadPath).ensureAlpha().raw().toBuffer();
  return createHash("sha256").update(rawRgba).digest("hex");
}

for (const effect of effects) {
  test(`visual export hash: ${effect}`, async ({ page }) => {
    await openStudio(page);
    const actualHash = await exportedPixelHash(page, effect);
    expect(actualHash, `${effect} export pixels changed; update the reviewed baseline intentionally.`).toBe(effectBaseline.effects[effect]);
  });
}
