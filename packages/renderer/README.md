# @card-builder/renderer

Embeddable Three.js 3D card renderer extracted from [Card Builder](https://cardsbuilder.netlify.app). Renders NBA-style trading cards inside acrylic slab enclosures with PBR materials, holographic foil effects, and pointer-driven tilt interaction.

The package owns **only** its supplied canvas and host element. It never queries the DOM or reads host-application global state; product state, card texture rendering, and view persistence are the caller's responsibility via a `bridge` object.

## Install

```bash
npm install @card-builder/renderer three
```

`three` (≥ 0.185) is a **peer dependency**. The ESM bundle leaves Three.js external; the UMD bundle expects the `THREE` global supplied by the classic Three.js CDN script.

## Quick start

```js
import { createCardRenderer } from "@card-builder/renderer";

const renderer = createCardRenderer({
  host: document.querySelector("#preview"),
  canvas: document.querySelector("#preview canvas"),
  bridge: {
    getState() { return myCardState; },
    setView(v) { Object.assign(myCardState, v); },
    flip()     { myCardState.flipped = !myCardState.flipped; },
    async renderCardCanvas(side, w, h) {
      // Draw the 2D card face onto a canvas and return it
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      await drawMyCard(c.getContext("2d"), side);
      return c;
    },
  },
});

// Push state updates
renderer.setState({ effect: "holographic", rarity: "gold", slabType: "acrylic" });

// High-res export
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
  import { createCardRenderer } from "@card-builder/renderer";
  // ...
</script>
```

Or with a classic `<script>` tag (UMD):

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@card-builder/renderer/dist/card-renderer.umd.js"></script>
<script>
  const renderer = CardBuilderRenderer.createCardRenderer({ /* ... */ });
</script>
```

## API

### `createCardRenderer(options): CardRenderer`

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | `HTMLElement` | *required* | Container the renderer sizes itself to |
| `canvas` | `HTMLCanvasElement` | *required* | WebGL output canvas |
| `status` | `HTMLElement \| null` | `null` | Element for status text updates |
| `bridge` | `RendererBridge` | *required* | Callbacks connecting to host app |
| `runtime` | `RendererRuntime` | `globalThis` | Injected browser timers, media query, ResizeObserver and document capabilities |
| `eventTarget` | `EventTarget` | `runtime` | Target for custom events |
| `documentTarget` | `Document` | `runtime.document` | Document for off-screen canvases |
| `autoListen` | `boolean` | `true` | Listen for `cardbuilder:state`/`cardbuilder:view` events |

### `RendererBridge`

| Method | Signature | Purpose |
|---|---|---|
| `getState` | `() => RendererState` | Return initial card state |
| `setView` | `(view: ViewState) => void` | Receive camera changes from OrbitControls |
| `flip` | `() => void` | Request card flip on double-click |
| `renderCardCanvas` | `(side, w, h) => Promise<Canvas>` | Render a 2D card face texture |

### `CardRenderer` (returned object)

| Member | Description |
|---|---|
| `ready` | `true` after WebGL init, `false` after `destroy()` |
| `setState(state)` | Push new card state (triggers slab rebuild if `slabType` changed) |
| `setView(view)` | Reposition camera (`{ rotX, rotY, viewScale, motionOn }`) |
| `resize()` | Force resize (normally automatic via ResizeObserver) |
| `rebuild()` | Tear down and rebuild the slab shell |
| `captureCanvas(w, h)` | Render to an off-screen canvas at given dimensions |
| `getHoverTiltState()` | Read hover-tilt spring state for debugging |
| `destroy()` | Release all WebGL resources and listeners |

### Config exports

```js
import { CARD_DIMENSIONS, SLAB_CONFIGS, HOLO_EFFECT_MODES, cardEdgeColor, normalizeRendererState } from "@card-builder/renderer";
```

| Export | Description |
|---|---|
| `CARD_DIMENSIONS` | Card width/height/depth in world units |
| `SLAB_CONFIGS` | Physical configs for 7 slab types |
| `HOLO_EFFECT_MODES` | Effect name → shader mode index |
| `cardEdgeColor(rarity)` | Returns hex edge color for a rarity |
| `normalizeRendererState(input)` | Clamp/default a raw state object |

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

Full type declarations ship with the package (`src/index.d.ts`, `src/config.d.ts`). No `@types` package needed.

## Development

```bash
cd packages/renderer
npm install
npm test          # Run unit tests
npm run build     # Build ESM + UMD bundles in dist/
```

## Commercial licensing & support

Looking to embed this renderer in your own card platform, need custom slab types or effects, or want integration support? Reach out:

- **Email:** [jethroyu5977@gmail.com](mailto:jethroyu5977@gmail.com)
- **GitHub:** [github.com/Jethro5977](https://github.com/Jethro5977)

## License

MIT
