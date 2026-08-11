export const CARD_DIMENSIONS = Object.freeze({
  width: 3,
  height: 4.2,
  depth: 0.065,
  baseCameraRadius: 9.6
});

export const SLAB_CONFIGS = Object.freeze({
  none: Object.freeze({ depth: 0, width: 3.12, height: 4.34, tint: 0xffffff, transmission: 0 }),
  magnetic: Object.freeze({ depth: 0.2, width: 3.46, height: 4.78, tint: 0xe7f7ff, transmission: 0.9, magnets: true }),
  forge: Object.freeze({ depth: 0.27, width: 3.56, height: 5.18, tint: 0xc4f7ff, transmission: 0.82, magnets: true }),
  museum: Object.freeze({ depth: 0.31, width: 3.58, height: 5.2, tint: 0xffe4a0, transmission: 0.72, magnets: true }),
  acrylic: Object.freeze({ depth: 0.46, width: 3.64, height: 5.24, tint: 0xeaf9ff, transmission: 0.97, magnets: true }),
  crystal: Object.freeze({ depth: 0.16, width: 3.3, height: 4.58, tint: 0xf4fcff, transmission: 0.96, magnets: false }),
  gallery: Object.freeze({ depth: 0.36, width: 3.6, height: 5.22, tint: 0xdce8f4, transmission: 0.78, magnets: true })
});

export const HOLO_EFFECT_MODES = Object.freeze({
  none: 0,
  diamond: 1,
  lightning: 2,
  rainbow: 3,
  crystal: 4,
  holographic: 5,
  laser: 6,
  flame: 7,
  galaxy: 8
});

const RARITIES = new Set(["base", "silver", "gold", "neon", "rwb", "black"]);

export function normalizeRendererState(input = {}) {
  const slabType = Object.hasOwn(SLAB_CONFIGS, input.slabType) ? input.slabType : "acrylic";
  const effect = Object.hasOwn(HOLO_EFFECT_MODES, input.effect) ? input.effect : "none";
  const rarity = RARITIES.has(input.rarity) ? input.rarity : "base";

  return {
    ...input,
    slabType,
    effect,
    rarity,
    effectIntensity: clamp(Number(input.effectIntensity) || 0, 0, 100),
    cardThickness: input.cardThickness !== false,
    motionOn: input.motionOn === true,
    name: String(input.name || "CUSTOM CARD"),
    gradeValue: String(input.gradeValue || "10")
  };
}

export function cardEdgeColor(rarity) {
  if (rarity === "gold") return 0xd6b85a;
  if (rarity === "black") return 0x181713;
  if (rarity === "silver") return 0xd8d9de;
  if (rarity === "neon") return 0x39ff14;
  return 0xe8e8ec;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
