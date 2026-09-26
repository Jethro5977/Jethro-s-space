import { expect, test } from "@playwright/test";

async function openStudio(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/three-preview-ready/, { timeout: 20_000 });
  await expect(page.locator("#threeStatus")).toContainText("PBR");
}

test("E2E-01: modular editor boots with the live Three.js preview", async ({ page }) => {
  await openStudio(page);
  await expect(page.locator("#tabBtnDesign")).toHaveAttribute("aria-selected", "true");
  const hasCanvasPixels = await page.locator("#threeCardCanvas").evaluate((canvas) => canvas.width > 0 && canvas.height > 0);
  expect(hasCanvasPixels).toBe(true);
});

test("E2E-02: keyboard navigation switches the three editor stages", async ({ page }) => {
  await openStudio(page);
  await page.locator("#tabBtnDesign").press("End");
  await expect(page.locator("#tabBtnExport")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#tab-export")).toBeVisible();
  await page.locator("#tabBtnExport").press("Home");
  await expect(page.locator("#tabBtnDesign")).toHaveAttribute("aria-selected", "true");
});

test("E2E-03: style, effect, and slab selections update the live state", async ({ page }) => {
  await openStudio(page);
  await page.locator('[data-style="optic"]').click();
  await page.locator('[data-effect="laser"]').click();
  await page.locator('[data-slab="gallery"]').click();
  await expect(page.locator('[data-style="optic"]')).toHaveClass(/active/);
  await expect(page.locator('[data-effect="laser"]')).toHaveClass(/active/);
  await expect(page.locator('[data-slab="gallery"]')).toHaveClass(/active/);
  await expect(page.locator("#threeStatus")).toContainText("GALLERY / PBR");
});

test("E2E-04: card flip switches between front and back", async ({ page }) => {
  await openStudio(page);
  await expect(page.locator("#viewSideLabel")).toContainText("FRONT");
  await page.locator("#flipBtn").click();
  await expect(page.locator("#viewSideLabel")).toContainText("BACK");
  await page.locator("#flipBtn").click();
  await expect(page.locator("#viewSideLabel")).toContainText("FRONT");
});

test("E2E-05: standard PNG export completes and downloads", async ({ page }) => {
  await openStudio(page);
  await page.locator("#tabBtnExport").click();
  const download = page.waitForEvent("download");
  await page.locator('[data-export="front"]').click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.locator("#toast")).toContainText("PNG 已生成");
});

test("E2E-06: save-to-library opens a persistent local collection", async ({ page }) => {
  await openStudio(page);
  await page.locator("#saveToLibraryMainBtn").click();
  await expect(page.locator("#toast")).toContainText(/已保存|已更新/, { timeout: 10_000 });
  await page.locator("#libraryToggleBtn").click();
  await expect(page.locator("#libraryDrawer")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#libraryGrid").locator(".library-card").first()).toBeVisible();
});

test("E2E-07: shared-library health and UI data load", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  await openStudio(page);
  await page.locator("#libraryToggleBtn").click();
  await page.getByRole("tab", { name: "SHARED LIBRARY" }).click();
  await expect(page.locator("#shared-grid")).not.toContainText("正在加载...", { timeout: 15_000 });
});

test("E2E-08: flash pack opening reaches DONE and closes cleanly", async ({ page }) => {
  await openStudio(page);
  await page.locator("#packMiniBtn").click();
  await expect(page.locator("#packOpening")).toBeVisible();
  await page.locator("#packFlashOpenBtn").click();
  const slots = page.locator(".pack-card-slot");
  await expect(page.locator("#packCards")).toBeVisible({ timeout: 15_000 });
  expect(await slots.count()).toBeGreaterThanOrEqual(3);
  for (let index = 0; index < await slots.count(); index += 1) {
    await slots.nth(index).click();
  }
  await expect(page.locator("#packCloseBtn")).toHaveClass(/visible/, { timeout: 15_000 });
  await page.locator("#packCloseBtn").click();
  await expect(page.locator("#packOpening")).toBeHidden();
});
