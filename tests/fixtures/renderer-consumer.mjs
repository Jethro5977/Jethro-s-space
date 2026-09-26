// The same host application consumes the source entry, npm ESM bundle, and
// classic-script UMD bundle. Three.js is local to avoid CDN-related test noise.
const format = new URL(location.href).searchParams.get("format") || "source";
const entries = {
  source: "/packages/renderer/src/index.js",
  esm: "/packages/renderer/dist/card-renderer.esm.js"
};

let rendererModule;
if (format === "umd") {
  globalThis.THREE = await import("three");
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/packages/renderer/dist/card-renderer.umd.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  rendererModule = globalThis.CardBuilderRenderer;
} else {
  rendererModule = await import(entries[format]);
}

const instances = new Map();
const imageCanvas = document.createElement("canvas");
imageCanvas.width = 300;
imageCanvas.height = 420;
const imageContext = imageCanvas.getContext("2d");
imageContext.fillStyle = "#dc302c";
imageContext.fillRect(0, 0, 300, 420);
imageContext.fillStyle = "#ffe790";
imageContext.fillRect(32, 40, 65, 300);
imageContext.fillStyle = "#31b6dd";
imageContext.beginPath();
imageContext.arc(202, 205, 61, 0, Math.PI * 2);
imageContext.fill();
const imageUrl = imageCanvas.toDataURL("image/png");

function create({ id, convenience = false, suppliedCanvas = false, image = imageUrl, state = {} }) {
  const host = document.createElement("section");
  host.id = id;
  host.className = "renderer-host";
  const status = document.createElement("output");
  status.className = "renderer-status";
  host.appendChild(status);
  document.querySelector("#consumers").appendChild(host);
  const initialState = {
    name: "PACKAGE CONTRACT",
    slabType: "gallery",
    rarity: "gold",
    effect: "laser",
    effectIntensity: 72,
    cardThickness: false,
    motionOn: false,
    view: { rotX: 0, rotY: 0, viewScale: 1 },
    ...state
  };
  const canvas = !convenience || suppliedCanvas ? document.createElement("canvas") : undefined;
  if (canvas) host.appendChild(canvas);

  const record = { host, status, canvas, api: null, bridge: null, textureCalls: 0, imageLoaded: false, viewCalls: [] };
  if (convenience) {
    const documentTarget = {
      defaultView: window,
      createElement(tag) {
        const element = document.createElement(tag);
        if (tag === "img") element.addEventListener("load", () => { record.imageLoaded = true; }, { once: true });
        return element;
      }
    };
    record.api = rendererModule.fromImage(host, image, { canvas, status, state: initialState, documentTarget });
    record.canvas = host.querySelector("canvas");
  } else {
    record.bridge = {
      getState: () => structuredClone(initialState),
      setView: (view) => {
        Object.assign(initialState.view, view);
        record.viewCalls.push({ ...view });
      },
      flip: () => { initialState.view.rotY += 180; },
      renderCardCanvas: async (side, width, height) => {
        const texture = document.createElement("canvas");
        texture.width = width;
        texture.height = height;
        const context = texture.getContext("2d");
        if (side === "front") context.drawImage(imageCanvas, 0, 0, width, height);
        else {
          context.fillStyle = "#14202a";
          context.fillRect(0, 0, width, height);
        }
        record.textureCalls += 1;
        return texture;
      }
    };
    record.api = rendererModule.createCardRenderer({ host, canvas, status, bridge: record.bridge, autoListen: false });
  }
  instances.set(id, record);
  return { ready: record.api.ready, status: status.textContent };
}

function read(id) {
  const record = instances.get(id);
  return {
    ready: record.api.ready,
    status: record.status.textContent,
    width: record.canvas.width,
    height: record.canvas.height,
    textureCalls: record.textureCalls,
    imageLoaded: record.imageLoaded,
    canvasConnected: record.canvas.isConnected,
    canvasCount: record.host.querySelectorAll("canvas").length,
    viewCalls: record.viewCalls
  };
}

globalThis.consumer = {
  format,
  exports: Object.keys(rendererModule).sort(),
  imageUrl,
  create,
  read,
  async settle() {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
  capture(id, width = 640, height = 960) {
    return instances.get(id).api.captureCanvas(width, height).toDataURL("image/png");
  },
  setState(id, state) { instances.get(id).api.setState(state); },
  setView(id, view) { instances.get(id).api.setView(view); },
  rebuild(id) { instances.get(id).api.rebuild(); },
  resize(id, width, height) {
    const record = instances.get(id);
    record.host.style.width = `${width}px`;
    record.host.style.height = `${height}px`;
    record.api.resize();
  },
  destroy(id) { instances.get(id).api.destroy(); },
  dispatchAppEvents() {
    window.dispatchEvent(new CustomEvent("cardbuilder:state", {
      detail: { slabType: "museum", rarity: "black", effect: "flame", effectIntensity: 99, name: "UNRELATED APP" }
    }));
    window.dispatchEvent(new CustomEvent("cardbuilder:view", {
      detail: { rotX: 45, rotY: 140, viewScale: 0.65 }
    }));
  }
};
document.documentElement.dataset.consumerReady = format;
