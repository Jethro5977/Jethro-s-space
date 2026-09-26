import { expect, test } from "@playwright/test";

async function prepare(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/three-preview-ready/, { timeout: 20_000 });
  await page.evaluate(async () => {
    const { app } = await import("/src/app-core.js");
    const library = app.loadLibrary();
    library.cards = library.cards.slice(0, 5).map((card, index) => ({ ...card, rarity: ["silver", "rwb", "neon", "gold", "black"][index] }));
    await app.saveLibraryResilient(library);
  });
  await page.locator("#packMiniBtn").click();
}

async function alphaPixels(page) {
  return page.locator("#packConfettiCanvas").evaluate(canvas => {
    const bytes = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) count++;
    return count;
  });
}

test("rare hits draw real confetti and preserve readable reveal progress", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await prepare(page);
  await page.locator("#packEnvelope").press("Enter");
  await expect(page.locator("#packRevealStatus")).toContainText("0 / 5");
  await expect.poll(() => alphaPixels(page)).toBe(0);
  for (const rarity of ["neon", "gold", "black"]) {
    const slot = page.locator(`.pack-card-slot.rarity-${rarity}`);
    await slot.click();
    await expect.poll(() => alphaPixels(page)).toBeGreaterThan(30);
    // A filter on the preserve-3d inner flattens the faces, exposing the
    // mirrored card back during the rare-hit animation.
    await expect(slot.locator(".pack-card-inner")).toHaveCSS("filter", "none");
    await expect(slot.locator(".pack-card-caption")).toHaveCSS("opacity", "1");
    await info.attach(`reveal-${rarity}`, { body: await page.locator("#packOpening").screenshot({ path: info.outputPath(`reveal-${rarity}.png`) }), contentType: "image/png" });
    await expect.poll(() => alphaPixels(page)).toBe(0);
  }
  for (const rarity of ["silver", "rwb"]) await page.locator(`.pack-card-slot.rarity-${rarity}`).click();
  await expect(page.locator("#packRevealStatus")).toHaveText("LINEUP COMPLETE · 5 / 5");
  await page.locator("#packCloseBtn").click();
  await expect(page.locator("#packOpening")).toBeHidden();
  expect(await alphaPixels(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("closing during flash-open cancels the old session before reopening", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    document.querySelector("#packFlashOpenBtn").click();
    document.querySelector("#packExitBtn").click();
    document.querySelector("#packMiniBtn").click();
  });
  // Deliberately exceed both old delayed transitions to catch stale callbacks.
  await page.waitForTimeout(1400);
  expect(await page.evaluate(async () => (await import("/src/pack-opening.js")).packPhase)).toBe("sealed");
  await expect(page.locator("#packCards")).toBeHidden();
  await expect(page.locator(".pack-flash-overlay, .pack-split-flash, .pack-rarity-flash")).toHaveCount(0);
  expect(await alphaPixels(page)).toBe(0);
  await page.locator("#packEnvelope").press("Enter");
  await expect(page.locator("#packCards")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#packOpening")).toBeHidden();
});

test("mobile reduced motion disables particles and keeps every card reachable", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page);
  await page.locator("#packFlashOpenBtn").click();
  await expect(page.locator("#packRevealStatus")).toContainText("0 / 5");
  for (const slot of await page.locator(".pack-card-slot").all()) await slot.click();
  await expect(page.locator("#packRevealStatus")).toHaveText("LINEUP COMPLETE · 5 / 5");
  expect(await alphaPixels(page)).toBe(0);
  await expect(page.locator(".pack-flash-overlay, .pack-split-flash, .pack-rarity-flash")).toHaveCount(0);
  const metrics = await page.locator("#packOpening").evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.client + 1);
  await info.attach("mobile-lineup", { body: await page.screenshot({ path: info.outputPath("mobile-lineup.png") }), contentType: "image/png" });
  await page.locator("#packCloseBtn").click();
  await expect(page.locator("#packOpening")).toBeHidden();
});

test("reduced motion can be enabled and disabled during an active pack", async ({ page }) => {
  await prepare(page);
  await page.locator("#packEnvelope").press("Enter");
  await expect.poll(() => alphaPixels(page)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => alphaPixels(page)).toBe(0);
  await expect(page.locator("#packRevealStatus")).toContainText("0 / 5");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".pack-card-slot.rarity-gold").click();
  await expect.poll(() => alphaPixels(page)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
});

test("interrupted pointer tearing resets and a full drag opens the pack", async ({ page }) => {
  await prepare(page);
  const envelope = page.locator("#packEnvelope");
  const bounds = await envelope.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 80, { steps: 4 });
  await envelope.dispatchEvent("pointercancel");
  await page.mouse.up();
  expect(await page.evaluate(async () => (await import("/src/pack-opening.js")).packPhase)).toBe("sealed");
  await expect(envelope).toHaveAttribute("data-frame", "1");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 220, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#packRevealStatus")).toContainText("0 / 5");
  await page.locator("#packExitBtn").click();
  await expect(page.locator("#packOpening")).toBeHidden();
});
