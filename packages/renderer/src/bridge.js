/**
 * Convenience helpers for quick integration.
 *
 * `createDefaultBridge` builds a minimal bridge from a single image URL so
 * that callers can display a 3D card without implementing all four callbacks
 * from scratch.  `fromImage` wraps it further into a one-liner.
 *
 * @module bridge
 */

import { createCardRenderer } from "./index.js";
import { normalizeRendererState } from "./config.js";

/**
 * Create a minimal bridge that renders a static image on the card front and
 * a plain dark back.  Suitable for quick demos and embedding.
 *
 * @param {string} imageUrl  URL (or data-URI) for the card-front image.
 * @param {Partial<import("./config.js").RendererState>} [initialState]
 *        Optional initial state overrides (effect, rarity, slabType, …).
 * @returns {import("./index.js").RendererBridge}
 */
export function createDefaultBridge(imageUrl, initialState = {}, { documentTarget = globalThis.document } = {}) {
  const state = normalizeRendererState({
    slabType: "acrylic",
    effect: "holographic",
    rarity: "base",
    effectIntensity: 60,
    name: "CUSTOM CARD",
    gradeValue: "10",
    motionOn: false,
    cardThickness: true,
    ...initialState
  });
  const view = { rotX: 0, rotY: 0, viewScale: 1, motionOn: state.motionOn, ...initialState.view };

  let loadedImage = null;
  let imageLoading = null;

  function loadImage() {
    if (imageLoading) return imageLoading;
    imageLoading = new Promise((resolve, reject) => {
      const img = documentTarget.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => { loadedImage = img; resolve(img); };
      img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
      img.src = imageUrl;
    });
    return imageLoading;
  }

  return {
    getState() {
      return { ...state, view: { ...view } };
    },

    setView(update) {
      Object.assign(view, update);
      if (typeof update.motionOn === "boolean") state.motionOn = update.motionOn;
    },

    flip() {
      view.rotY = ((Number(view.rotY) || 0) + 180) % 360;
      view.motionOn = false;
      state.motionOn = false;
    },

    async renderCardCanvas(side, width, height) {
      const canvas = documentTarget.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (side === "front") {
        // Draw the card-front image, covering the canvas.
        try {
          const img = loadedImage || await loadImage();
          const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
          const sw = img.naturalWidth * scale;
          const sh = img.naturalHeight * scale;
          ctx.drawImage(img, (width - sw) / 2, (height - sh) / 2, sw, sh);
        } catch {
          // Fall back to a gradient placeholder.
          const g = ctx.createLinearGradient(0, 0, width, height);
          g.addColorStop(0, "#392866");
          g.addColorStop(1, "#b68b36");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Simple dark back.
        const g = ctx.createLinearGradient(0, 0, width, height);
        g.addColorStop(0, "#0a0a1a");
        g.addColorStop(0.5, "#141428");
        g.addColorStop(1, "#0a0a1a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = Math.max(1, width * 0.004);
        const inset = width * 0.05;
        ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = `600 ${Math.round(width * 0.035)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText("CARD BUILDER", width / 2, height / 2);
      }

      return canvas;
    }
  };
}

/**
 * One-liner: create a renderer that displays a single image in a 3D card.
 *
 * Automatically creates a `<canvas>` inside `container` if none is provided.
 *
 * @param {HTMLElement} container  Host element to render into.
 * @param {string} imageUrl       Card-front image URL.
 * @param {object} [options]
 * @param {HTMLCanvasElement} [options.canvas]  Existing canvas (created if omitted).
 * @param {Partial<import("./config.js").RendererState>} [options.state]  Initial state overrides.
 * @returns {import("./index.js").CardRenderer}
 */
export function fromImage(container, imageUrl, options = {}) {
  if (!container?.appendChild) throw new TypeError("fromImage requires a container element");
  const documentTarget = options.documentTarget || container.ownerDocument || globalThis.document;
  const runtime = options.runtime || documentTarget.defaultView || globalThis;
  const ownsCanvas = !options.canvas;
  let canvas = options.canvas;
  if (!canvas) {
    canvas = documentTarget.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);
  }

  const bridge = createDefaultBridge(imageUrl, options.state, { documentTarget });
  try {
    const renderer = createCardRenderer({
      ...options, autoListen: options.autoListen ?? false,
      runtime, documentTarget, host: container, canvas, bridge
    });
    return Object.freeze({
      ...renderer,
      get ready() { return renderer.ready; },
      destroy() {
        renderer.destroy();
        if (ownsCanvas) canvas.remove();
      }
    });
  } catch (error) {
    if (ownsCanvas) canvas.remove();
    throw error;
  }
}
