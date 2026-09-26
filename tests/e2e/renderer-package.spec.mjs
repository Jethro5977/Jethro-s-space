import { expect, test } from "@playwright/test";
import sharp from "sharp";

test.use({ reducedMotion: "reduce", viewport: { width: 1100, height: 800 } });

const formats = ["source", "esm", "umd"];
const sampleState = {
  name: "PACKAGE CONTRACT",
  slabType: "gallery",
  rarity: "gold",
  effect: "laser",
  effectIntensity: 72,
  cardThickness: false,
  motionOn: false
};

async function openConsumer(page, format) {
  await page.goto(`/tests/fixtures/renderer-consumer.html?format=${format}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-consumer-ready", format);
}

async function settle(page) {
  await page.evaluate(() => consumer.settle());
}

async function capture(page, id, width = 640, height = 960) {
  const dataUrl = await page.evaluate(({ id, width, height }) => consumer.capture(id, width, height), { id, width, height });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function expectSamePixels(actual, expected, message) {
  const [actualRaw, expectedRaw] = await Promise.all([
    sharp(actual).resize(160, 240).blur(0.5).ensureAlpha().raw().toBuffer(),
    sharp(expected).resize(160, 240).blur(0.5).ensureAlpha().raw().toBuffer()
  ]);
  let total = 0;
  let changed = 0;
  for (let index = 0; index < actualRaw.length; index += 4) {
    const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(actualRaw[index + channel] - expectedRaw[index + channel])));
    total += delta;
    if (delta > 8) changed += 1;
  }
  const comparison = { meanDelta: total / (actualRaw.length / 4), changedRatio: changed / (actualRaw.length / 4) };
  // Compare card-scale appearance, filtering unstable single-pixel GLSL sparkle
  // samples. Native export size/detail is checked separately. These limits still
  // reject changes in material, camera, label or card imagery.
  if (comparison.meanDelta > 1 || comparison.changedRatio > 0.01) {
    await test.info().attach("comparison-actual", { body: actual, contentType: "image/png" });
    await test.info().attach("comparison-expected", { body: expected, contentType: "image/png" });
  }
  expect(comparison.meanDelta, message).toBeLessThanOrEqual(1);
  expect(comparison.changedRatio, message).toBeLessThanOrEqual(0.01);
}

for (const format of formats) {
  test(`renderer ${format}: WebGL, high-resolution export, partial state and view`, async ({ page }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openConsumer(page, format);
    await page.evaluate((state) => consumer.create({ id: "primary", state }), sampleState);
    await expect.poll(() => page.evaluate(() => consumer.read("primary").textureCalls)).toBe(2);
    await settle(page);
    expect(await page.evaluate(() => consumer.read("primary").ready)).toBe(true);
    const png = await capture(page, "primary", 1200, 1800);
    const metadata = await sharp(png).metadata();
    expect([metadata.width, metadata.height]).toEqual([1200, 1800]);
    const statistics = await sharp(png).stats();
    expect(Math.max(...statistics.channels.slice(0, 3).map((channel) => channel.stdev))).toBeGreaterThan(20);
    await testInfo.attach(`renderer-${format}-1200x1800`, { body: png, contentType: "image/png" });

    await page.evaluate(() => consumer.setState("primary", { effectIntensity: 21 }));
    await settle(page);
    const partialState = await capture(page, "primary");
    await page.evaluate((state) => consumer.setState("primary", { ...state, effectIntensity: 21 }), sampleState);
    await settle(page);
    await expectSamePixels(partialState, await capture(page, "primary"), "A partial intensity update must preserve slab, effect, rarity, thickness, and label.");

    await page.evaluate(() => {
      consumer.setView("primary", { rotX: 12, rotY: 22, viewScale: 0.85 });
      consumer.setView("primary", { rotY: 35 });
    });
    await settle(page);
    const partialView = await capture(page, "primary");
    await page.evaluate(() => consumer.setView("primary", { rotX: 12, rotY: 35, viewScale: 0.85 }));
    await settle(page);
    await expectSamePixels(partialView, await capture(page, "primary"), "A partial view update must preserve elevation and zoom.");

    await page.evaluate(() => { consumer.resize("primary", 400, 500); consumer.rebuild("primary"); });
    await settle(page);
    const resized = await page.evaluate(() => consumer.read("primary"));
    expect([resized.width, resized.height]).toEqual([400, 500]);
    await page.evaluate(() => { consumer.destroy("primary"); consumer.destroy("primary"); });
    expect(await page.evaluate(() => consumer.read("primary").ready)).toBe(false);
    expect(await page.evaluate(() => consumer.read("primary").canvasConnected)).toBe(true);
    expect(await page.evaluate(() => {
      try { consumer.capture("primary"); return "unexpected success"; }
      catch (error) { return error.message; }
    })).toMatch(/not ready/i);
    expect(errors).toEqual([]);
  });

  test(`renderer ${format}: embedded images stay isolated, flip, and respect canvas ownership`, async ({ page }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openConsumer(page, format);
    await page.evaluate(() => {
      consumer.create({ id: "owned", convenience: true, state: { slabType: "none", effect: "none" } });
      // Keep this isolation assertion deterministic: the holographic shader
      // intentionally samples animated sparkle noise and is covered by the
      // dedicated export/effect visual suite below.
      consumer.create({ id: "supplied", convenience: true, suppliedCanvas: true, state: { slabType: "crystal", effect: "none" } });
    });
    // Observe each actual image load through the injected document. Waiting only
    // for the first embed leaves the second one's debounced texture load racing.
    await expect.poll(() => page.evaluate(() => [consumer.read("owned").imageLoaded, consumer.read("supplied").imageLoaded])).toEqual([true, true]);
    await expect.poll(async () => {
      const png = await capture(page, "owned", 120, 180);
      const { channels } = await sharp(png).stats();
      return channels[0].mean - channels[2].mean;
    }).toBeGreaterThan(15);
    await settle(page);
    const beforeOwned = await capture(page, "owned");
    const beforeSupplied = await capture(page, "supplied");
    await page.evaluate(() => consumer.dispatchAppEvents());
    await settle(page);
    await expectSamePixels(beforeOwned, await capture(page, "owned"), "An embed must ignore unrelated app-global state and view events.");
    await expectSamePixels(beforeSupplied, await capture(page, "supplied"), "A second embed must keep its own state and camera.");

    await page.locator("#owned canvas").dispatchEvent("dblclick");
    await settle(page);
    const back = await capture(page, "owned");
    const [frontStats, backStats] = await Promise.all([sharp(beforeOwned).stats(), sharp(back).stats()]);
    expect(frontStats.channels[0].mean - backStats.channels[0].mean).toBeGreaterThan(10);
    await testInfo.attach(`renderer-${format}-flipped-back`, { body: back, contentType: "image/png" });
    await page.locator("#owned canvas").dispatchEvent("dblclick");
    await settle(page);
    await expectSamePixels(beforeOwned, await capture(page, "owned"), "Two flips must return the original front face without swapping image textures.");

    await page.evaluate(() => consumer.destroy("owned"));
    expect(await page.evaluate(() => consumer.read("owned"))).toMatchObject({ ready: false, canvasConnected: false, canvasCount: 0 });
    expect(await page.evaluate(() => consumer.read("supplied").ready)).toBe(true);
    await page.evaluate(() => consumer.destroy("supplied"));
    expect(await page.evaluate(() => consumer.read("supplied"))).toMatchObject({ ready: false, canvasConnected: true, canvasCount: 1 });
    expect(errors).toEqual([]);
  });

  test(`renderer ${format}: failed images render a fallback without unhandled rejection`, async ({ page }, testInfo) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/renderer-missing-image.png", (route) => route.fulfill({ status: 404, body: "Missing fixture image" }));
    await openConsumer(page, format);
    const missingImage = page.waitForResponse((response) => response.url().endsWith("/renderer-missing-image.png"));
    await page.evaluate(() => consumer.create({
      id: "missing", convenience: true,
      image: "/renderer-missing-image.png",
      state: { slabType: "none", effect: "none" }
    }));
    await missingImage;
    await settle(page);
    // Check the package's purple-to-gold fallback, not the initial placeholder.
    await expect.poll(async () => {
      const png = await capture(page, "missing", 120, 180);
      const { channels } = await sharp(png).stats();
      return channels[0].mean - channels[1].mean;
    }).toBeGreaterThan(4);
    const png = await capture(page, "missing");
    await testInfo.attach(`renderer-${format}-missing-image-fallback`, { body: png, contentType: "image/png" });
    expect(await page.evaluate(() => consumer.read("missing").ready)).toBe(true);
    await page.evaluate(() => consumer.destroy("missing"));
    expect(errors).toEqual([]);
  });
}

test("renderer source, npm ESM, and UMD produce matching public exports and pixels", async ({ page }) => {
  const results = [];
  for (const format of formats) {
    await openConsumer(page, format);
    await page.evaluate(() => consumer.create({ id: "parity" }));
    await expect.poll(() => page.evaluate(() => consumer.read("parity").textureCalls)).toBe(2);
    await settle(page);
    results.push({ exports: await page.evaluate(() => consumer.exports), pixels: await capture(page, "parity", 320, 480) });
    await page.evaluate(() => consumer.destroy("parity"));
  }
  for (const result of results.slice(1)) {
    expect(result.exports).toEqual(results[0].exports);
    await expectSamePixels(result.pixels, results[0].pixels, "All supported module formats must render the same consumer identically.");
  }
});
