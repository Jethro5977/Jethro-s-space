import type { RendererState } from "./config.js";
import type { RendererBridge, CardRenderer, CardRendererOptions } from "./index.js";

export interface DefaultBridgeOptions {
  documentTarget?: Document;
}

export interface FromImageOptions extends Omit<CardRendererOptions, "host" | "canvas" | "bridge"> {
  canvas?: HTMLCanvasElement;
  state?: Partial<RendererState>;
}

/**
 * Create a minimal bridge that renders a static image on the card front.
 * Suitable for quick demos and embedding.
 *
 * @param imageUrl      URL or data-URI for the card-front image.
 * @param initialState  Optional state overrides (effect, rarity, slabType, …).
 */
export declare function createDefaultBridge(
  imageUrl: string,
  initialState?: Partial<RendererState>,
  options?: DefaultBridgeOptions
): RendererBridge;

/**
 * One-liner: create a renderer that displays a single image in a 3D card.
 *
 * @param container  Host element to render into.
 * @param imageUrl   Card-front image URL.
 * @param options    Optional canvas and state overrides.
 */
export declare function fromImage(
  container: HTMLElement,
  imageUrl: string,
  options?: FromImageOptions
): CardRenderer;
