// Card Builder — 3D card interaction & animation loop
import { $, refs, clamp } from "./utils.js";
import { state, getData, queueAutosave } from "./state.js";
import { app } from "./app-core.js";
import { drawCardToCanvas } from "./export.js";

export let isDragging = false;
export let isPointerInside = false;
export let idleRotX = 0;
export let motionElapsed = 0;
export let dragStart = { x: 0, y: 0, rotX: 0, rotY: 0 };
let previousFrame = performance.now();

function bindCardInteraction() {
  refs.cardScene.addEventListener("pointerenter", () => {
    isPointerInside = true;
  });

  refs.cardScene.addEventListener("pointerdown", (event) => {
    isDragging = true;
    refs.cardScene.setPointerCapture(event.pointerId);
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      rotX: state.rotX + idleRotX,
      rotY: state.rotY + state.autoRotY,
      pointerType: event.pointerType,
      horizontalSwipe: false
    };
    state.autoRotY = 0;
    idleRotX = 0;
  });

  refs.cardScene.addEventListener("pointermove", (event) => {
    const rect = refs.cardScene.getBoundingClientRect();
    const mx = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const my = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    refs.card3d.style.setProperty("--mx", `${mx}%`);
    refs.card3d.style.setProperty("--my", `${my}%`);
    refs.card3d.style.setProperty("--rainbow-angle", `${mx * 3.6}deg`);
    refs.slabShell.style.setProperty("--mx", `${mx}%`);
    refs.slabShell.style.setProperty("--my", `${my}%`);
    if (!isDragging) return;
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    if (dragStart.pointerType === "touch") {
      if (!dragStart.horizontalSwipe && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        dragStart.horizontalSwipe = true;
      }
      if (dragStart.horizontalSwipe) return;
    }
    state.rotY = dragStart.rotY + deltaX * 0.42;
    state.rotX = clamp(dragStart.rotX - deltaY * 0.34, -85, 85);
    applyRotation();
  });

  const endDrag = (event) => {
    if (!isDragging) return;
    isDragging = false;
    const shouldNavigate = event?.type !== "pointercancel"
      && dragStart.pointerType === "touch"
      && dragStart.horizontalSwipe
      && Math.abs(event.clientX - dragStart.x) >= 50;
    if (event?.pointerId !== undefined && refs.cardScene.hasPointerCapture(event.pointerId)) {
      refs.cardScene.releasePointerCapture(event.pointerId);
    }
    if (shouldNavigate) {
      app.navigateLibraryCard?.(event.clientX < dragStart.x ? 1 : -1);
    }
  };
  refs.cardScene.addEventListener("pointerup", endDrag);
  refs.cardScene.addEventListener("pointercancel", endDrag);
  refs.cardScene.addEventListener("pointerleave", () => {
    isPointerInside = false;
    if (!state.motionOn) {
      [refs.card3d, refs.slabShell].forEach((node) => {
        node.style.setProperty("--mx", "50%");
        node.style.setProperty("--my", "45%");
      });
    }
  });
  refs.cardScene.addEventListener("dblclick", flipCard);
  refs.cardScene.addEventListener("wheel", (event) => {
    event.preventDefault();
    adjustZoom(event.deltaY > 0 ? -0.1 : 0.1);
  }, { passive: false });
}

function applyRotation() {
  const flip = state.flipped ? 180 : 0;
  const totalRotX = state.rotX + idleRotX;
  const totalRotY = state.rotY + state.autoRotY + flip;
  const normalizedY = ((totalRotY % 360) + 360) % 360;
  const renderRotY = Math.abs(normalizedY - 90) < 0.001 ? totalRotY - 4.5 : Math.abs(normalizedY - 270) < 0.001 ? totalRotY + 4.5 : totalRotY;
  refs.slabShell.style.transform = `scale3d(${state.viewScale}, ${state.viewScale}, ${state.viewScale}) rotateX(${totalRotX}deg) rotateY(${renderRotY}deg)`;

  const relativeY = totalRotY - flip;
  const wrappedY = ((relativeY + 180) % 360 + 360) % 360 - 180;
  const tiltX = clamp(totalRotX / 85, -1, 1);
  const tiltY = clamp(wrappedY / 45, -1, 1);
  const glintAngle = 180 + tiltY * 70 + tiltX * 30;
  const glintPosition = 50 - tiltY * 13;

  [refs.card3d, refs.slabShell].forEach((node) => {
    node.style.setProperty("--tilt-x", tiltX.toFixed(3));
    node.style.setProperty("--tilt-y", tiltY.toFixed(3));
    node.style.setProperty("--glint-angle", `${glintAngle}deg`);
    node.style.setProperty("--glint-position", `${glintPosition}%`);
    node.style.setProperty("--sig-shine-x", `${50 + tiltY * 32}%`);
    node.style.setProperty("--sig-shine-y", `${50 + tiltX * 32}%`);
    node.style.setProperty("--parallax-x", `${tiltY * 18}px`);
    node.style.setProperty("--parallax-y", `${tiltX * -18}px`);
  });
  refs.card3d.classList.toggle("is-tilted", Math.abs(tiltX) + Math.abs(tiltY) > 0.06);
  const faceAngle = ((totalRotY % 360) + 360) % 360;
  const showingBack = faceAngle > 90 && faceAngle < 270;
  const edgeAngle = Math.min(Math.abs(faceAngle - 90), Math.abs(faceAngle - 270));
  refs.slabShell.classList.toggle("is-quarter-edge", edgeAngle < 0.001);
  const isEdgeView = edgeAngle < 15;
  const isTopView = Math.abs(totalRotX) > 60;
  // Fade card front/back and slab surfaces to prevent edge-on bleed-through artifacts.
  // At angles very close to 90°/270°, the flat faces compress to a thin bright strip
  // that shows through the acrylic side. Fade them out so the solid side dominates.
  const faceFade = clamp((edgeAngle - 3) / 8, 0, 1);
  refs.card3d.style.setProperty("--face-opacity", faceFade.toFixed(3));
  refs.slabShell.style.setProperty("--surface-opacity", faceFade.toFixed(3));
  $("#viewSideLabel").textContent = isTopView ? "TOP / LIVE" : isEdgeView ? "EDGE / LIVE" : showingBack ? "BACK / LIVE" : "FRONT / LIVE";
  window.dispatchEvent(new CustomEvent("cardbuilder:view", {
    detail: {
      rotX: totalRotX,
      rotY: totalRotY,
      viewScale: state.viewScale,
      motionOn: state.motionOn
    }
  }));
}

function adjustZoom(delta) {
  state.viewScale = clamp(Math.round((state.viewScale + delta) * 10) / 10, 0.6, 1.6);
  app.updateInterface(getData());
  applyRotation();
  queueAutosave();
}

function rotateView(delta) {
  state.motionOn = false;
  state.autoRotY = 0;
  idleRotX = 0;
  state.rotY = Math.round((state.rotY + delta) / 90) * 90;
  app.updateInterface(getData());
  applyRotation();
  queueAutosave();
}

function flipCard() {
  state.flipped = !state.flipped;
  app.updateInterface(getData());
  applyRotation();
}

function toggleMotion() {
  state.motionOn = !state.motionOn;
  if (!state.motionOn) {
    state.autoRotY = 0;
    idleRotX = 0;
    applyRotation();
  }
  app.updateInterface(getData());
  queueAutosave();
}

function resetView() {
  state.rotX = 0;
  state.rotY = 0;
  state.autoRotY = 0;
  idleRotX = 0;
  motionElapsed = 0;
  state.flipped = false;
  state.viewScale = 1;
  app.updateInterface(getData());
  applyRotation();
}

async function renderThreeCardCanvas(side, width = 900, height = 1260) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  await drawCardToCanvas(context, getData(), side === "back" ? "back" : "front", 0, 0, width, height);
  return canvas;
}

function setThreePreviewView(nextView = {}) {
  const displayedRotY = Number(nextView.rotY);
  if (Number.isFinite(displayedRotY)) state.rotY = displayedRotY - (state.flipped ? 180 : 0);
  const nextRotX = Number(nextView.rotX);
  if (Number.isFinite(nextRotX)) state.rotX = clamp(nextRotX, -85, 85);
  const nextScale = Number(nextView.viewScale);
  if (Number.isFinite(nextScale)) state.viewScale = clamp(nextScale, 0.6, 1.6);
  if (typeof nextView.motionOn === "boolean") state.motionOn = nextView.motionOn;
  state.autoRotY = 0;
  idleRotX = 0;
  app.updateInterface(getData());
  applyRotation();
  queueAutosave();
}

function getThreePreviewState() {
  const d = getData();
  return {
    ...d,
    slabType: state.slabType,
    cardThickness: state.cardThickness,
    gradeValue: state.gradeValue,
    motionOn: state.motionOn,
    view: {
      rotX: state.rotX + idleRotX,
      rotY: state.rotY + state.autoRotY + (state.flipped ? 180 : 0),
      viewScale: state.viewScale
    }
  };
}


function animate(now) {
  const delta = Math.min(40, now - previousFrame);
  previousFrame = now;
  if (state.motionOn && !isDragging) {
    motionElapsed += delta;
    state.autoRotY = Math.sin(motionElapsed * 0.00048) * 26;
    idleRotX = Math.sin(motionElapsed * 0.00072) * 4.2;
    if (!isPointerInside) {
      const lightX = 50 + Math.sin(motionElapsed * 0.00055) * 24;
      const lightY = 44 + Math.cos(motionElapsed * 0.00048) * 10;
      [refs.card3d, refs.slabShell].forEach((node) => {
        node.style.setProperty("--mx", `${lightX}%`);
        node.style.setProperty("--my", `${lightY}%`);
      });
    }
  }
  if (!isDragging) applyRotation();
  const angle = (now * 0.018) % 360;
  refs.card3d.style.setProperty("--rainbow-angle", `${angle}deg`);
  requestAnimationFrame(animate);
}



// Register on app-core
app.applyRotation = applyRotation;

export {
  bindCardInteraction, applyRotation, adjustZoom, rotateView,
  flipCard, toggleMotion, resetView, setThreePreviewView,
  getThreePreviewState, renderThreeCardCanvas, animate
};
