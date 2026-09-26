import type { RendererState, SlabType, EffectName, RarityName } from "./config.js";

// Re-exports from submodules
export type { RendererState, SlabType, EffectName, RarityName } from "./config.js";
export { CARD_DIMENSIONS, HOLO_EFFECT_MODES, SLAB_CONFIGS, cardEdgeColor, normalizeRendererState } from "./config.js";
export { advanceSpring, advancePointerSpring } from "./spring.js";
export type { SpringConfig, SpringResult, Point2D } from "./spring.js";
export { holoVertexShader, holoFragmentShader, HOLO_UNIFORMS_DEFAULTS } from "./shaders.js";
export { mulberry32, createScratchCanvas, createPlaceholderCanvas, createLabelCanvas, getCardTextureSize } from "./textures.js";
export type { CanvasFactory } from "./textures.js";
export { createDefaultBridge, fromImage } from "./bridge.js";
export type { DefaultBridgeOptions, FromImageOptions } from "./bridge.js";

/** View parameters for camera positioning. */
export interface ViewState {
  rotX?: number;
  rotY?: number;
  viewScale?: number;
  motionOn?: boolean;
}

/**
 * Bridge object that the host application must provide.
 * The renderer never queries the DOM or reads host-application global state —
 * all product data flows through these callbacks.
 */
export interface RendererBridge {
  /** Return the current card state for initial render. */
  getState(): RendererState & { view?: ViewState };

  /** Push a view change back to the host (e.g. after OrbitControls drag). */
  setView(view: ViewState): void;

  /** Request the host to flip the card. */
  flip(): void;

  /**
   * Render one face of the card to a canvas for texture upload.
   * @returns A canvas element with the rendered card face.
   */
  renderCardCanvas(side: "front" | "back", width: number, height: number): Promise<HTMLCanvasElement>;
}

/** Browser capabilities used by the renderer. Pass a custom object for tests or embedded runtimes. */
export interface RendererRuntime {
  document?: Document;
  devicePixelRatio?: number;
  matchMedia?: (query: string) => Pick<MediaQueryList, "matches">;
  setTimeout: Window["setTimeout"];
  clearTimeout: Window["clearTimeout"];
  performance?: Pick<Performance, "now">;
  AbortController: typeof AbortController;
  ResizeObserver?: typeof ResizeObserver;
}

/** Options for {@link createCardRenderer}. */
export interface CardRendererOptions {
  /** Container element that the renderer sizes itself to. */
  host: HTMLElement;

  /** The `<canvas>` element for WebGL output. */
  canvas: HTMLCanvasElement;

  /** Optional element whose `textContent` receives status strings. */
  status?: HTMLElement | null;

  /** Bridge callbacks connecting the renderer to host application state. */
  bridge: RendererBridge;

  /**
   * Browser capabilities used by the renderer.
   * @default globalThis
   */
  runtime?: RendererRuntime;

  /**
   * Event target for `cardbuilder:state` / `cardbuilder:view` events.
   * @default runtime
   */
  eventTarget?: EventTarget;

  /**
   * Document reference for creating off-screen canvases and textures.
   * @default runtime.document
   */
  documentTarget?: Document;

  /**
   * Whether to automatically listen for `cardbuilder:state` and
   * `cardbuilder:view` custom events on `eventTarget`.
   * @default true
   */
  autoListen?: boolean;
}

/** Hover-tilt inspection state (read-only). */
export interface HoverTiltState {
  active: boolean;
  targetActive: boolean;
  pointer: { x: number; y: number };
  rotation: { x: number; y: number };
  scale: number;
}

/** Hover-tilt spring configuration (exported for tests). */
export declare const HOVER_TILT_CONFIG: Readonly<{
  rotation: number;
  scale: number;
  exitDelay: number;
  enterSpring: Readonly<{ stiffness: number; damping: number }>;
  exitSpring: Readonly<{ stiffness: number; damping: number }>;
  activationSpring: Readonly<{ stiffness: number; damping: number }>;
  deactivationSpring: Readonly<{ stiffness: number; damping: number }>;
}>;

/** The object returned by {@link createCardRenderer}. */
export interface CardRenderer {
  /** `true` once WebGL initialisation succeeds and before `destroy()`. */
  readonly ready: boolean;

  /** Merge a partial card-state update into the current renderer state. */
  setState(state: Partial<RendererState>): void;

  /** Reposition the camera to match a view state. */
  setView(view: ViewState): void;

  /** Force a resize pass (normally automatic via ResizeObserver). */
  resize(): void;

  /** Tear down and rebuild the slab shell from current state. */
  rebuild(): void;

  /**
   * Render the current scene to an off-screen canvas at the given size.
   * Useful for high-res PNG export.
   */
  captureCanvas(width: number, height: number): HTMLCanvasElement;

  /** Read the current hover-tilt spring state for debugging or tests. */
  getHoverTiltState(): HoverTiltState;

  /**
   * Destroy the renderer, releasing all WebGL resources, observers and
   * event listeners. The instance is unusable after this call.
   */
  destroy(): void;
}

/**
 * Create an isolated 3D card renderer.
 *
 * The renderer owns only its supplied canvas and host element. Product state,
 * card texture rendering and view persistence remain responsibilities of the
 * `bridge` object provided by the host application.
 *
 * @example
 * ```js
 * import { createCardRenderer } from "@card-builder/renderer";
 *
 * const renderer = createCardRenderer({
 *   host: document.querySelector("#preview"),
 *   canvas: document.querySelector("canvas"),
 *   bridge: {
 *     getState: () => myAppState,
 *     setView: (v) => Object.assign(myAppState, v),
 *     flip: () => toggleFlip(),
 *     renderCardCanvas: (side, w, h) => drawCard(side, w, h),
 *   },
 * });
 * ```
 */
export declare function createCardRenderer(options: CardRendererOptions): CardRenderer;
