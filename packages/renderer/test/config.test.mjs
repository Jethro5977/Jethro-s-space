import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_DIMENSIONS,
  HOLO_EFFECT_MODES,
  SLAB_CONFIGS,
  cardEdgeColor,
  normalizeRendererState
} from "../src/config.js";

test("exports stable physical dimensions and renderer modes", () => {
  assert.deepEqual(CARD_DIMENSIONS, {
    width: 3,
    height: 4.2,
    depth: 0.065,
    baseCameraRadius: 9.6
  });
  assert.equal(SLAB_CONFIGS.acrylic.depth, 0.46);
  assert.equal(HOLO_EFFECT_MODES.holographic, 5);
});

test("normalizes unsupported values without mutating the input", () => {
  const input = { slabType: "unknown", effect: "invalid", rarity: "mythic", effectIntensity: 160 };
  const normalized = normalizeRendererState(input);

  assert.deepEqual(input, { slabType: "unknown", effect: "invalid", rarity: "mythic", effectIntensity: 160 });
  assert.equal(normalized.slabType, "acrylic");
  assert.equal(normalized.effect, "none");
  assert.equal(normalized.rarity, "base");
  assert.equal(normalized.effectIntensity, 100);
  assert.equal(normalized.cardThickness, true);
});

test("maps supported rarity edge colors", () => {
  assert.equal(cardEdgeColor("gold"), 0xd6b85a);
  assert.equal(cardEdgeColor("neon"), 0x39ff14);
  assert.equal(cardEdgeColor("base"), 0xe8e8ec);
});
