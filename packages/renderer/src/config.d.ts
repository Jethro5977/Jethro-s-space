/** Physical card dimensions in Three.js world units. */
export declare const CARD_DIMENSIONS: Readonly<{
  width: number;
  height: number;
  depth: number;
  baseCameraRadius: number;
}>;

/** Slab enclosure configuration. */
export interface SlabConfig {
  readonly depth: number;
  readonly width: number;
  readonly height: number;
  readonly tint: number;
  readonly transmission: number;
  readonly magnets?: boolean;
}

/** Available slab types mapped to their physical configurations. */
export declare const SLAB_CONFIGS: Readonly<Record<SlabType, SlabConfig>>;

/** Mapping from effect name to numeric shader mode index. */
export declare const HOLO_EFFECT_MODES: Readonly<Record<EffectName, number>>;

export type SlabType = "none" | "magnetic" | "forge" | "museum" | "acrylic" | "crystal" | "gallery";
export type EffectName = "none" | "diamond" | "lightning" | "rainbow" | "crystal" | "holographic" | "laser" | "flame" | "galaxy";
export type RarityName = "base" | "silver" | "gold" | "neon" | "rwb" | "black";

/** Renderer-facing card state (normalized). */
export interface RendererState {
  slabType: SlabType;
  effect: EffectName;
  rarity: RarityName;
  effectIntensity: number;
  cardThickness: boolean;
  motionOn: boolean;
  name: string;
  gradeValue: string;
  [key: string]: unknown;
}

/**
 * Clamp and default-fill a raw state object so every field the renderer
 * touches is safe to read.
 */
export declare function normalizeRendererState(input?: Record<string, unknown>): RendererState;

/** Returns the hex edge color for a given rarity. */
export declare function cardEdgeColor(rarity: RarityName): number;
