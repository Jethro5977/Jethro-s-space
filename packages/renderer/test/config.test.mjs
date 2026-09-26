import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_DIMENSIONS,
  HOLO_EFFECT_MODES,
  SLAB_CONFIGS,
  cardEdgeColor,
  normalizeRendererState
} from "../src/config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("exports stable physical dimensions", () => {
  assert.deepEqual(CARD_DIMENSIONS, {
    width: 3,
    height: 4.2,
    depth: 0.065,
    baseCameraRadius: 9.6
  });
});

test("SLAB_CONFIGS contains all 7 slab types with required fields", () => {
  const expectedTypes = ["none", "magnetic", "forge", "museum", "acrylic", "crystal", "gallery"];
  assert.deepEqual(Object.keys(SLAB_CONFIGS).sort(), expectedTypes.sort());
  for (const [type, config] of Object.entries(SLAB_CONFIGS)) {
    assert.equal(typeof config.depth, "number", `${type}.depth`);
    assert.equal(typeof config.width, "number", `${type}.width`);
    assert.equal(typeof config.height, "number", `${type}.height`);
    assert.equal(typeof config.tint, "number", `${type}.tint`);
    assert.equal(typeof config.transmission, "number", `${type}.transmission`);
  }
});

test("SLAB_CONFIGS objects are frozen", () => {
  assert.ok(Object.isFrozen(SLAB_CONFIGS));
  assert.ok(Object.isFrozen(SLAB_CONFIGS.acrylic));
});

test("HOLO_EFFECT_MODES maps all 9 effects to unique indices", () => {
  const values = Object.values(HOLO_EFFECT_MODES);
  assert.equal(values.length, 9);
  assert.equal(new Set(values).size, 9, "indices must be unique");
  assert.equal(HOLO_EFFECT_MODES.none, 0);
  assert.equal(HOLO_EFFECT_MODES.holographic, 5);
  assert.equal(HOLO_EFFECT_MODES.galaxy, 8);
});

// ---------------------------------------------------------------------------
// normalizeRendererState
// ---------------------------------------------------------------------------

test("normalizes unsupported values without mutating the input", () => {
  const input = { slabType: "unknown", effect: "invalid", rarity: "mythic", effectIntensity: 160 };
  const normalized = normalizeRendererState(input);

  // input unchanged
  assert.deepEqual(input, { slabType: "unknown", effect: "invalid", rarity: "mythic", effectIntensity: 160 });
  // defaults applied
  assert.equal(normalized.slabType, "acrylic");
  assert.equal(normalized.effect, "none");
  assert.equal(normalized.rarity, "base");
  assert.equal(normalized.effectIntensity, 100);
  assert.equal(normalized.cardThickness, true);
});

test("preserves valid values", () => {
  const input = { slabType: "forge", effect: "laser", rarity: "gold", effectIntensity: 42 };
  const normalized = normalizeRendererState(input);
  assert.equal(normalized.slabType, "forge");
  assert.equal(normalized.effect, "laser");
  assert.equal(normalized.rarity, "gold");
  assert.equal(normalized.effectIntensity, 42);
});

test("clamps effectIntensity to [0, 100]", () => {
  assert.equal(normalizeRendererState({ effectIntensity: -20 }).effectIntensity, 0);
  assert.equal(normalizeRendererState({ effectIntensity: 200 }).effectIntensity, 100);
  assert.equal(normalizeRendererState({ effectIntensity: 50 }).effectIntensity, 50);
});

test("handles empty / undefined input", () => {
  const a = normalizeRendererState();
  assert.equal(a.slabType, "acrylic");
  assert.equal(a.name, "CUSTOM CARD");
  assert.equal(a.gradeValue, "10");

  const b = normalizeRendererState({});
  assert.equal(b.effect, "none");
  assert.equal(b.motionOn, false);
});

test("cardThickness defaults to true, respects explicit false", () => {
  assert.equal(normalizeRendererState({}).cardThickness, true);
  assert.equal(normalizeRendererState({ cardThickness: false }).cardThickness, false);
  assert.equal(normalizeRendererState({ cardThickness: true }).cardThickness, true);
});

test("passes through extra properties", () => {
  const normalized = normalizeRendererState({ slabType: "acrylic", playerName: "GIANNIS" });
  assert.equal(normalized.playerName, "GIANNIS");
});

// ---------------------------------------------------------------------------
// cardEdgeColor
// ---------------------------------------------------------------------------

test("maps all rarity edge colors", () => {
  assert.equal(cardEdgeColor("gold"), 0xd6b85a);
  assert.equal(cardEdgeColor("black"), 0x181713);
  assert.equal(cardEdgeColor("silver"), 0xd8d9de);
  assert.equal(cardEdgeColor("neon"), 0x39ff14);
  assert.equal(cardEdgeColor("base"), 0xe8e8ec);
});

test("returns default color for unknown rarity", () => {
  assert.equal(cardEdgeColor("mythic"), 0xe8e8ec);
  assert.equal(cardEdgeColor(undefined), 0xe8e8ec);
});
