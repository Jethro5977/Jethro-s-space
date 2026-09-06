import test from "node:test";
import assert from "node:assert/strict";
import {
  mulberry32,
  createScratchCanvas,
  createPlaceholderCanvas,
  createLabelCanvas,
  getCardTextureSize
} from "../src/textures.js";

// ---------------------------------------------------------------------------
// Mock canvas for Node.js (no real rendering, just tracks calls)
// ---------------------------------------------------------------------------

function createMockCanvas(w, h) {
  const ops = [];
  const canvas = {
    width: w,
    height: h,
    getContext() {
      return {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 0,
        font: "",
        textAlign: "",
        clearRect: (...args) => ops.push(["clearRect", ...args]),
        fillRect: (...args) => ops.push(["fillRect", ...args]),
        strokeRect: (...args) => ops.push(["strokeRect", ...args]),
        fillText: (...args) => ops.push(["fillText", ...args]),
        beginPath: () => ops.push(["beginPath"]),
        moveTo: (...args) => ops.push(["moveTo", ...args]),
        lineTo: (...args) => ops.push(["lineTo", ...args]),
        stroke: () => ops.push(["stroke"]),
        createLinearGradient: () => ({
          addColorStop: () => {}
        })
      };
    },
    _ops: ops
  };
  return canvas;
}

// ---------------------------------------------------------------------------
// mulberry32
// ---------------------------------------------------------------------------

test("mulberry32 produces deterministic output for same seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i++) {
    assert.equal(a(), b());
  }
});

test("mulberry32 produces different output for different seeds", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  // At least one of the first 5 values should differ
  let allSame = true;
  for (let i = 0; i < 5; i++) {
    if (a() !== b()) allSame = false;
  }
  assert.ok(!allSame, "different seeds should produce different sequences");
});

test("mulberry32 output is in [0, 1)", () => {
  const rng = mulberry32(9999);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

// ---------------------------------------------------------------------------
// createScratchCanvas
// ---------------------------------------------------------------------------

test("createScratchCanvas produces 1024x1024 canvases", () => {
  const roughness = createScratchCanvas(false, createMockCanvas);
  assert.equal(roughness.width, 1024);
  assert.equal(roughness.height, 1024);

  const highlight = createScratchCanvas(true, createMockCanvas);
  assert.equal(highlight.width, 1024);
  assert.equal(highlight.height, 1024);
});

test("createScratchCanvas roughness starts with fillRect, highlight with clearRect", () => {
  const roughness = createScratchCanvas(false, createMockCanvas);
  assert.equal(roughness._ops[0][0], "fillRect");

  const highlight = createScratchCanvas(true, createMockCanvas);
  assert.equal(highlight._ops[0][0], "clearRect");
});

test("createScratchCanvas draws 84 scratch lines", () => {
  const canvas = createScratchCanvas(false, createMockCanvas);
  const strokeCount = canvas._ops.filter(([op]) => op === "stroke").length;
  assert.equal(strokeCount, 84);
});

// ---------------------------------------------------------------------------
// createPlaceholderCanvas
// ---------------------------------------------------------------------------

test("createPlaceholderCanvas produces 600x840 canvas with label text", () => {
  const canvas = createPlaceholderCanvas("FRONT", createMockCanvas);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 840);

  const textOps = canvas._ops.filter(([op]) => op === "fillText");
  assert.ok(textOps.some(([, text]) => text === "FRONT"));
});

// ---------------------------------------------------------------------------
// createLabelCanvas
// ---------------------------------------------------------------------------

test("createLabelCanvas produces 1024x160 canvas with card name", () => {
  const canvas = createLabelCanvas({ name: "GIANNIS", gradeValue: "9.5" }, createMockCanvas);
  assert.equal(canvas.width, 1024);
  assert.equal(canvas.height, 160);

  const textOps = canvas._ops.filter(([op]) => op === "fillText");
  assert.ok(textOps.some(([, text]) => text === "GIANNIS"));
  assert.ok(textOps.some(([, text]) => text === "9.5"));
});

test("createLabelCanvas uses defaults for missing fields", () => {
  const canvas = createLabelCanvas({}, createMockCanvas);
  const textOps = canvas._ops.filter(([op]) => op === "fillText");
  assert.ok(textOps.some(([, text]) => text === "CUSTOM CARD"));
  assert.ok(textOps.some(([, text]) => text === "10"));
});

test("createLabelCanvas truncates name to 34 characters", () => {
  const longName = "A".repeat(50);
  const canvas = createLabelCanvas({ name: longName }, createMockCanvas);
  const textOps = canvas._ops.filter(([op]) => op === "fillText");
  const nameOp = textOps.find(([, text]) => text.startsWith("A"));
  assert.equal(nameOp[1].length, 34);
});

// ---------------------------------------------------------------------------
// getCardTextureSize
// ---------------------------------------------------------------------------

test("getCardTextureSize clamps to [1080, 1800] width", () => {
  const small = getCardTextureSize(200, 1);
  assert.equal(small.width, 1080);

  const large = getCardTextureSize(2000, 2);
  assert.equal(large.width, 1800);

  const mid = getCardTextureSize(600, 1.5);
  assert.ok(mid.width >= 1080 && mid.width <= 1800);
});

test("getCardTextureSize height preserves card aspect ratio", () => {
  const size = getCardTextureSize(800, 1);
  const expectedRatio = 4.2 / 3; // CARD_DIMENSIONS.height / width
  const actualRatio = size.height / size.width;
  assert.ok(Math.abs(actualRatio - expectedRatio) < 0.01);
});

test("getCardTextureSize caps pixel ratio at 2", () => {
  const normal = getCardTextureSize(800, 2);
  const high = getCardTextureSize(800, 4);
  assert.equal(normal.width, high.width);
});

test("getCardTextureSize handles zero/undefined inputs", () => {
  const zero = getCardTextureSize(0, 0);
  assert.equal(zero.width, 1080);

  const undef = getCardTextureSize(undefined, undefined);
  assert.equal(undef.width, 1080);
});
