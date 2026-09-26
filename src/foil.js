// Card Builder — Custom foil mask system
import { $, refs, loadCanvasImage, showToast } from "./utils.js";
import { state, isSafeDataImage, queueAutosave } from "./state.js";
import { app } from "./app-core.js";

export let foilCtx = null;
export let foilPainting = false;
export let foilBrush = 30;
export let foilLastPoint = null;

function bindFoilMaskPad() {
  const canvas = refs.foilMaskCanvas;
  foilCtx = canvas.getContext("2d", { willReadFrequently: true });
  foilCtx.lineCap = "round";
  foilCtx.lineJoin = "round";
  foilCtx.strokeStyle = "#fff";
  foilCtx.fillStyle = "#fff";

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };
  const paintTo = (point) => {
    foilCtx.lineWidth = foilBrush * 2;
    foilCtx.beginPath();
    foilCtx.moveTo(foilLastPoint?.x ?? point.x, foilLastPoint?.y ?? point.y);
    foilCtx.lineTo(point.x, point.y);
    foilCtx.stroke();
    foilLastPoint = point;
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    foilPainting = true;
    foilLastPoint = null;
    canvas.setPointerCapture(event.pointerId);
    paintTo(pointFromEvent(event));
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!foilPainting) return;
    event.preventDefault();
    paintTo(pointFromEvent(event));
  });
  const endPainting = (event) => {
    foilPainting = false;
    foilLastPoint = null;
    if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", endPainting);
  canvas.addEventListener("pointercancel", endPainting);

  $("#foilBrushSize").addEventListener("input", (event) => {
    foilBrush = Number(event.target.value);
    $("#foilBrushSizeOut").textContent = String(foilBrush);
  });
  $("#foilMaskClearBtn").addEventListener("click", () => {
    fillFoilMaskCanvas("#000");
    state.customFoilMask = null;
    state.customFoilOn = false;
    refs.customFoilToggle.checked = false;
    app.render();
  });
  $("#foilMaskFillBtn").addEventListener("click", () => fillFoilMaskCanvas("#fff"));
  $("#foilMaskApplyBtn").addEventListener("click", () => {
    state.customFoilMask = createAlphaMaskDataUrl(canvas);
    state.customFoilOn = refs.customFoilToggle.checked;
    app.render();
    showToast("闪光蒙版已应用", "success");
  });
  refs.customFoilToggle.addEventListener("change", (event) => {
    state.customFoilOn = event.target.checked;
    app.render();
  });
}

function fillFoilMaskCanvas(color) {
  if (!foilCtx) return;
  foilCtx.save();
  foilCtx.globalCompositeOperation = "source-over";
  foilCtx.fillStyle = color;
  foilCtx.fillRect(0, 0, refs.foilMaskCanvas.width, refs.foilMaskCanvas.height);
  foilCtx.restore();
}

function createAlphaMaskDataUrl(sourceCanvas) {
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const source = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const output = document.createElement("canvas");
  output.width = sourceCanvas.width;
  output.height = sourceCanvas.height;
  const outputCtx = output.getContext("2d");
  const mask = outputCtx.createImageData(output.width, output.height);
  for (let index = 0; index < source.data.length; index += 4) {
    const alpha = Math.max(source.data[index], source.data[index + 1], source.data[index + 2]);
    mask.data[index] = 255;
    mask.data[index + 1] = 255;
    mask.data[index + 2] = 255;
    mask.data[index + 3] = alpha;
  }
  outputCtx.putImageData(mask, 0, 0);
  return output.toDataURL("image/png");
}

async function syncFoilMaskPadFromState() {
  if (!foilCtx) return;
  const source = state.customFoilMask;
  fillFoilMaskCanvas("#000");
  if (!source) return;
  try {
    const image = await loadCanvasImage(source);
    if (state.customFoilMask !== source) return;
    foilCtx.drawImage(image, 0, 0, refs.foilMaskCanvas.width, refs.foilMaskCanvas.height);
  } catch (error) {
    console.warn("Unable to restore foil mask", error);
  }
}


// Register on app-core
app.syncFoilMaskPadFromState = syncFoilMaskPadFromState;

export {
  bindFoilMaskPad, fillFoilMaskCanvas, createAlphaMaskDataUrl, syncFoilMaskPadFromState
};
