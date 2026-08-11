import { createCardRenderer } from "@card-builder/renderer";

const host = document.querySelector("#threeCardStage");
const canvas = document.querySelector("#threeCardCanvas");
const status = document.querySelector("#threeStatus");
let rendererInstance = null;
let bridgeWaitAttempts = 0;

bootWhenReady();
window.addEventListener("cardbuilder:bridge-ready", bootWhenReady, { once: true });
window.addEventListener("pagehide", destroyRenderer, { once: true });

function bootWhenReady() {
  if (rendererInstance || !host || !canvas) return;
  const bridge = window.cardBuilder3D;

  if (!bridge) {
    if (status) status.textContent = "LOADING 3D";
    bridgeWaitAttempts += 1;
    if (bridgeWaitAttempts <= 100) window.setTimeout(bootWhenReady, 50);
    else markUnavailable("3D LOAD FAILED");
    return;
  }

  try {
    rendererInstance = createCardRenderer({
      host,
      canvas,
      status,
      bridge,
      eventTarget: window,
      documentTarget: document
    });
    window.cardBuilderThree = createCompatibilityApi(rendererInstance);
  } catch (error) {
    console.error("Unable to start Card Builder renderer", error);
    markUnavailable("3D LOAD FAILED");
  }
}

function createCompatibilityApi(renderer) {
  return Object.freeze({
    captureCanvas: (...args) => renderer.captureCanvas(...args),
    rebuild: () => renderer.rebuild(),
    getHoverTiltState: () => renderer.getHoverTiltState(),
    destroy: destroyRenderer
  });
}

function destroyRenderer() {
  rendererInstance?.destroy();
  rendererInstance = null;
  delete window.cardBuilderThree;
}

function markUnavailable(message) {
  if (status) status.textContent = message;
  host?.classList.add("is-unavailable");
}
