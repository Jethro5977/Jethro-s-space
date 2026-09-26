# @card-builder/renderer

Embeddable Three.js 3D renderer for collectible trading cards. Renders cards inside acrylic slab enclosures with PBR materials, holographic foil effects, and pointer-driven tilt interaction.

The package owns **only** its supplied canvas and host element. It never queries the DOM or reads host-application global state; product state, card texture rendering, and view persistence are the caller's responsibility via a `bridge` object.

## Install

```bash
npm install @card-builder/renderer three
```

`three` (`^0.185.1`) is a **peer dependency**. ESM leaves Three.js and its addons external. UMD bundles the required addons and expects the core namespace in `globalThis.THREE`; modern Three.js no longer ships `build/three.min.js`.

## Quick start (one-liner)

Display any image as a 3D holographic card in three lines:

```js
import { fromImage } from "@card-builder/renderer";

const card = fromImage(
  document.querySelector("#preview"),
  "https://example.com/my-card.jpg",
  { state: { effect: "holographic", rarity: "gold", slabType: "acrylic" } }
);

// Later:
card.destroy();
```

`fromImage` creates a canvas and a default bridge. The image loads asynchronously, with a gradient fallback on failure; cross-origin images must permit CORS. `ready` reports WebGL readiness, not completion of image loading. Double-click flips the camera. Embeds ignore application-global events by default. `destroy()` removes a canvas created by the helper, and preserves a supplied canvas.

## Advanced usage (custom bridge)

```js
import { createCardRenderer } from "@card-builder/renderer";

const renderer = createCardRenderer({
  host: document.querySelector("#preview"),
  canvas: document.querySelector("#preview canvas"),
  bridge: {
    getState() { return myCardState; },
    setView(v) { myCardState.view = { ...myCardState.view, ...v }; },
    flip()     { myCardState.view.rotY = ((myCardState.view.rotY || 0) + 180) % 360; },
    async renderCardCanvas(side, w, h) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      await drawMyCard(c.getContext("2d"), side);
      return c;
    },
  },
});

// Push state updates
renderer.setState({ effect: "holographic", rarity: "gold", slabType: "acrylic" });

// High-res export (after the caller's image/texture loading has completed)
const exportCanvas = renderer.captureCanvas(2400, 3200);

// Cleanup
renderer.destroy();
```

## CDN usage (no bundler)

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/",
    "@card-builder/renderer": "https://cdn.jsdelivr.net/npm/@card-builder/renderer/dist/card-renderer.esm.js"
  }
}
</script>
<script type="module">
  import { fromImage } from "@card-builder/renderer";
  fromImage(document.querySelector("#card"), "./my-card.jpg");
</script>
```

Or with a classic `<script>` tag (UMD):

```html
<script type="module">
  import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";
  globalThis.THREE = THREE;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@card-builder/renderer/dist/card-renderer.umd.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  CardBuilderRenderer.fromImage(document.querySelector("#card"), "./my-card.jpg");
</script>
```

## API

### `fromImage(container, imageUrl, options?): CardRenderer`

Creates a canvas, loads an image asynchronously, and returns a renderer.

| Option | Type | Description |
|---|---|---|
| `container` | `HTMLElement` | Host element to render into |
| `imageUrl` | `string` | Card-front image URL or data-URI |
| `options.canvas` | `HTMLCanvasElement` | Existing canvas (created if omitted) |
| `options.state` | `Partial<RendererState>` | Initial state overrides |
| `options.autoListen` | `boolean` | Defaults to `false` for isolated embeds |
| `options.status`, `runtime`, `eventTarget`, `documentTarget` | See below | Forwarded to `createCardRenderer` |

### `createDefaultBridge(imageUrl, initialState?, options?): RendererBridge`

Build a bridge from a single image URL — handles front/back rendering, flip, and view sync. Use when you want `fromImage`'s convenience but need to pass the bridge to `createCardRenderer` yourself.

`options.documentTarget` injects the document used for off-screen canvases and images. `initialState.view` contains camera angles in degrees and zoom. `flip()` changes `view.rotY`; front/back textures keep their identities. When using this bridge directly, apply its updated view with `renderer.setView(bridge.getState().view)` after programmatic flips.

### `createCardRenderer(options): CardRenderer`

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | `HTMLElement` | *required* | Container the renderer sizes itself to |
| `canvas` | `HTMLCanvasElement` | *required* | WebGL output canvas |
| `status` | `HTMLElement \| null` | `null` | Element for status text updates |
| `bridge` | `RendererBridge` | *required* | Callbacks connecting to host app |
| `runtime` | `RendererRuntime` | `globalThis` | Injected browser timers, media query, ResizeObserver |
| `eventTarget` | `EventTarget` | `runtime` | Target for custom events |
| `documentTarget` | `Document` | `runtime.document` | Document for off-screen canvases |
| `autoListen` | `boolean` | `true` | Listen for `cardbuilder:state`/`cardbuilder:view` events |

### `RendererBridge`

| Method | Signature | Purpose |
|---|---|---|
| `getState` | `() => RendererState & { view?: ViewState }` | Return initial card state and camera view |
| `setView` | `(view: ViewState) => void` | Receive camera changes from OrbitControls |
| `flip` | `() => void` | Request card flip on double-click |
| `renderCardCanvas` | `(side, w, h) => Promise<Canvas>` | Render a 2D card face texture |

### `CardRenderer` (returned object)

| Member | Description |
|---|---|
| `ready` | `true` after WebGL init, `false` after `destroy()` |
| `setState(state)` | Merge partial state (triggers slab rebuild if `slabType` changed); host texture state remains the caller's responsibility |
| `setView(view)` | Merge camera changes (`{ rotX, rotY, viewScale, motionOn }`) |
| `resize()` | Force resize (normally automatic via ResizeObserver) |
| `rebuild()` | Tear down and rebuild the slab shell |
| `captureCanvas(w, h)` | Return a 2D canvas snapshot using the existing WebGL context and restore the preview size; no extra WebGL context is allocated |
| `getHoverTiltState()` | Read hover-tilt spring state for debugging |
| `destroy()` | Release all WebGL resources and listeners |

## Submodule exports

The package exposes internal modules for advanced use cases:

```js
// Spring physics (useful for custom animations)
import { advanceSpring } from "@card-builder/renderer/spring";

// GLSL shader sources (for custom materials)
import { holoFragmentShader } from "@card-builder/renderer/shaders";

// Procedural texture generators (for custom card art)
import { createScratchCanvas, mulberry32 } from "@card-builder/renderer/textures";

// Config constants
import { CARD_DIMENSIONS, SLAB_CONFIGS, HOLO_EFFECT_MODES } from "@card-builder/renderer/config";
```

## Slab types

| Type | Description |
|---|---|
| `none` | Raw card, no enclosure |
| `magnetic` | Thin magnetic case |
| `forge` | Mid-depth display case |
| `museum` | Warm-tinted exhibition case |
| `acrylic` | Full acrylic slab (default) |
| `crystal` | Ultra-clear thin crystal case |
| `gallery` | Deep gallery-style enclosure |

## Effects

`none` · `diamond` · `lightning` · `rainbow` · `crystal` · `holographic` · `laser` · `flame` · `galaxy`

Each maps to a WebGL shader mode with pointer-driven foil interaction.

## TypeScript

Full type declarations ship with the package. No `@types` package needed.

## Development

```bash
cd packages/renderer
npm install
npm test          # Build + run unit tests
npm run build     # Build ESM + UMD bundles in dist/
```

From the repository root, `npm run test:renderer:browser` builds and runs the same real WebGL consumer against source, ESM and UMD. The app's import map uses `src/index.js`, while package resolution uses `dist/card-renderer.esm.js`; both are verified. Run `npm pack --dry-run --workspace @card-builder/renderer` to inspect the publication manifest.

## Commercial licensing & support

For integration support or custom slab types/effects, contact [jethroyu5977@gmail.com](mailto:jethroyu5977@gmail.com) or [Jethro5977 on GitHub](https://github.com/Jethro5977).

## License

MIT
