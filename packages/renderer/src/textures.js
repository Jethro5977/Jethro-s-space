/**
 * Procedural texture generators.
 *
 * Every function accepts a `createCanvas(w, h)` factory so it works in both
 * browser (document.createElement) and headless/test environments.
 *
 * @module textures
 */

import { CARD_DIMENSIONS } from "./config.js";

// ---------------------------------------------------------------------------
// Deterministic PRNG (Mulberry32)
// ---------------------------------------------------------------------------

/**
 * Create a seeded pseudo-random number generator (Mulberry32).
 *
 * @param {number} seed  32-bit integer seed.
 * @returns {() => number}  Returns a float in [0, 1) on each call.
 */
export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Scratch textures (acrylic surface micro-scratches)
// ---------------------------------------------------------------------------

/**
 * Generate a 1024×1024 procedural scratch texture.
 *
 * @param {boolean} highlight  `true` for additive highlight scratches,
 *                             `false` for roughness-map scratches.
 * @param {(w: number, h: number) => HTMLCanvasElement} createCanvas
 * @returns {HTMLCanvasElement}
 */
export function createScratchCanvas(highlight, createCanvas) {
  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(highlight ? 9863 : 4217);

  if (highlight) {
    ctx.clearRect(0, 0, 1024, 1024);
  } else {
    ctx.fillStyle = "rgb(58,58,58)";
    ctx.fillRect(0, 0, 1024, 1024);
  }

  for (let i = 0; i < 84; i++) {
    const x = random() * 1024;
    const y = random() * 1024;
    const length = 18 + random() * 145;
    const angle = -0.82 + random() * 1.64;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.lineWidth = 0.35 + random() * 1.05;

    if (highlight) {
      ctx.strokeStyle = `rgba(235,250,255,${0.035 + random() * 0.085})`;
    } else {
      const r = 130 + Math.floor(random() * 86);
      const g = 130 + Math.floor(random() * 86);
      const b = 130 + Math.floor(random() * 86);
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
    }
    ctx.stroke();
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Placeholder card texture
// ---------------------------------------------------------------------------

/**
 * Generate a placeholder card-face texture with a centered label.
 *
 * @param {string} label  Text to render (e.g. "FRONT", "BACK").
 * @param {(w: number, h: number) => HTMLCanvasElement} createCanvas
 * @returns {HTMLCanvasElement}
 */
export function createPlaceholderCanvas(label, createCanvas) {
  const canvas = createCanvas(600, 840);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 600, 840);
  gradient.addColorStop(0, "#392866");
  gradient.addColorStop(0.5, "#14141e");
  gradient.addColorStop(1, "#b68b36");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 840);

  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 544, 784);

  ctx.fillStyle = "#fff";
  ctx.font = "700 54px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, 300, 438);

  return canvas;
}

// ---------------------------------------------------------------------------
// Slab label texture
// ---------------------------------------------------------------------------

/**
 * Generate the slab grade-label texture strip.
 *
 * @param {{ name?: string, gradeValue?: string }} data
 * @param {(w: number, h: number) => HTMLCanvasElement} createCanvas
 * @returns {HTMLCanvasElement}
 */
export function createLabelCanvas(data, createCanvas) {
  const canvas = createCanvas(1024, 160);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(10,15,20,.88)";
  ctx.fillRect(0, 0, 1024, 160);

  ctx.strokeStyle = "rgba(195,235,250,.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 1018, 154);

  ctx.fillStyle = "#dcebf2";
  ctx.font = "700 30px ui-monospace, monospace";
  ctx.fillText("CARD BUILDER // ACRYLIC", 34, 58);

  ctx.fillStyle = "#91a7b2";
  ctx.font = "600 23px ui-monospace, monospace";
  ctx.fillText(String(data.name || "CUSTOM CARD").slice(0, 34), 34, 112);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 60px ui-monospace, monospace";
  ctx.fillText(String(data.gradeValue || "10"), 972, 106);

  return canvas;
}

// ---------------------------------------------------------------------------
// Card texture size helper
// ---------------------------------------------------------------------------

/**
 * Compute the optimal card-texture resolution for the current preview.
 *
 * @param {number} hostWidth      Host element width in CSS pixels.
 * @param {number} pixelRatio     Device pixel ratio (capped to 2).
 * @returns {{ width: number, height: number }}
 */
export function getCardTextureSize(hostWidth, pixelRatio) {
  const previewWidth = Math.max(hostWidth || 0, 520);
  const ratio = Math.min(pixelRatio || 1, 2);
  const width = Math.min(1800, Math.max(1080, Math.round(previewWidth * ratio * 1.45)));
  const height = Math.round(width * (CARD_DIMENSIONS.height / CARD_DIMENSIONS.width));
  return { width, height };
}
