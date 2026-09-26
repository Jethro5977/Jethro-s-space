/** Canvas factory function — matches `document.createElement("canvas")` signature. */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

/**
 * Create a seeded Mulberry32 pseudo-random number generator.
 * @param seed  32-bit integer seed.
 * @returns A function that returns a float in [0, 1) on each call.
 */
export declare function mulberry32(seed: number): () => number;

/**
 * Generate a 1024x1024 procedural scratch texture canvas.
 * @param highlight    `true` for additive highlight, `false` for roughness map.
 * @param createCanvas Canvas factory.
 */
export declare function createScratchCanvas(
  highlight: boolean,
  createCanvas: CanvasFactory
): HTMLCanvasElement;

/**
 * Generate a placeholder card-face texture canvas.
 * @param label        Text label (e.g. "FRONT").
 * @param createCanvas Canvas factory.
 */
export declare function createPlaceholderCanvas(
  label: string,
  createCanvas: CanvasFactory
): HTMLCanvasElement;

/**
 * Generate the slab grade-label texture canvas.
 * @param data         Card data with optional `name` and `gradeValue`.
 * @param createCanvas Canvas factory.
 */
export declare function createLabelCanvas(
  data: { name?: string; gradeValue?: string },
  createCanvas: CanvasFactory
): HTMLCanvasElement;

/**
 * Compute optimal card-texture resolution.
 * @param hostWidth   Host element width in CSS pixels.
 * @param pixelRatio  Device pixel ratio (capped at 2).
 */
export declare function getCardTextureSize(
  hostWidth: number,
  pixelRatio: number
): { width: number; height: number };
