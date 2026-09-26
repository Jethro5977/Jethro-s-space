// Card Builder — Signature system
import { SHOWCASE_SIGNATURE_SOURCE } from "./constants.js";
import { $, $$, refs, clamp, loadCanvasImage, showToast } from "./utils.js";
import { state, isSafeUploadImage, queueAutosave } from "./state.js";
import { app } from "./app-core.js";

export let sigCtx = null;
export let sigDrawing = false;
export let sigHasInk = false;
export let pendingSigImage = null;
export let pendingSigMaskDataURL = null;

function syncSignatureModeUI() {
  const isUpload = state.signatureMode === "upload";
  refs.signatureCanvas.hidden = isUpload;
  $("#signatureUploadBlock").hidden = !isUpload;
  $("#signatureColorRow").hidden = isUpload;
  $("#signatureDrawActions").hidden = isUpload;
  $$("#signaturePanel [data-sig-mode]").forEach((button) => {
    const active = button.dataset.sigMode === state.signatureMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function bindSignaturePad() {
  const canvas = refs.signatureCanvas;
  sigCtx = canvas.getContext("2d", { willReadFrequently: true });
  sigCtx.lineJoin = "round";
  sigCtx.lineCap = "round";
  sigCtx.lineWidth = 4;
  sigCtx.strokeStyle = "#ffffff";

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    sigDrawing = true;
    sigHasInk = true;
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    sigCtx.beginPath();
    sigCtx.moveTo(point.x, point.y);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!sigDrawing) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    sigCtx.lineTo(point.x, point.y);
    sigCtx.stroke();
  });
  const endSignature = (event) => {
    sigDrawing = false;
    if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", endSignature);
  canvas.addEventListener("pointercancel", endSignature);

  $("#signatureClearBtn").addEventListener("click", () => {
    sigCtx.clearRect(0, 0, canvas.width, canvas.height);
    sigHasInk = false;
    state.signatureData = null;
    app.render();
    showToast("签名已清除", "info");
  });
  $("#signatureApplyBtn").addEventListener("click", () => {
    state.signatureData = sigHasInk ? canvas.toDataURL("image/png") : null;
    app.render();
    showToast(state.signatureData ? "签名已应用" : "请先绘制签名", state.signatureData ? "success" : "warning");
  });
  $$("#signatureColorRow [data-sig-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.signatureColor = button.dataset.sigColor;
      app.render();
    });
  });

  $$("#signaturePanel [data-sig-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.signatureMode = button.dataset.sigMode === "upload" ? "upload" : "draw";
      syncSignatureModeUI();
      queueAutosave();
    });
  });

  ["signatureX", "signatureY", "signatureScale"].forEach((id) => {
    $("#" + id).addEventListener("input", (event) => {
      state[id] = id === "signatureScale" ? Number(event.target.value) / 100 : Number(event.target.value);
      app.render();
    });
  });
  $("#signaturePlacementBack").addEventListener("change", (event) => {
    state.signaturePlacement = event.target.checked ? "back" : "front";
    app.render();
  });

  sigCtx.strokeStyle = "#ffffff";
}

function bindSignatureUpload() {
  $("#signaturePhotoBtn").addEventListener("click", () => $("#signaturePhotoInput").click());

  $("#signaturePhotoInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isSafeUploadImage(file) || file.size > 16 * 1024 * 1024) {
      event.target.value = "";
      showToast("签名仅支持 16 MB 以内的 PNG、JPEG 或 WebP 图片", "warning");
      return;
    }
    try {
      const image = await loadImageFromFile(file);
      pendingSigImage = image;
      drawSmallPreview($("#sigRawPreview"), image, false);
      refreshSignatureExtraction();
    } catch (error) {
      console.warn("Signature photo load error", error);
      showToast("无法读取图片", "error");
    }
  });

  $("#sigThresholdSlider").addEventListener("input", (event) => {
    state.signatureThreshold = Number(event.target.value);
    $("#sigThresholdOut").textContent = String(state.signatureThreshold);
    refreshSignatureExtraction();
    queueAutosave();
  });

  $("#sigInvertToggle").addEventListener("change", (event) => {
    state.signatureInvert = event.target.checked;
    refreshSignatureExtraction();
    queueAutosave();
  });

  $("#sigUploadApplyBtn").addEventListener("click", () => {
    if (!pendingSigMaskDataURL) {
      showToast("请先选择一张签名照片", "warning");
      return;
    }
    state.signatureData = pendingSigMaskDataURL;
    state.signatureMode = "upload";
    app.render();
    showToast("签名已提取并应用", "success");
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function refreshSignatureExtraction() {
  if (!pendingSigImage) return;
  pendingSigMaskDataURL = extractSignatureMask(pendingSigImage, state.signatureThreshold, state.signatureInvert);
  if (!pendingSigMaskDataURL) {
    const previewContext = $("#sigMaskPreview").getContext("2d");
    previewContext.clearRect(0, 0, 200, 100);
    return;
  }
  const preview = new Image();
  preview.onload = () => drawSmallPreview($("#sigMaskPreview"), preview, true);
  preview.src = pendingSigMaskDataURL;
}

function extractSignatureMask(sourceImage, threshold, invert) {
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / sourceImage.width);
  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const workContext = work.getContext("2d", { willReadFrequently: true });
  workContext.drawImage(sourceImage, 0, 0, width, height);

  const imageData = workContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    const ink = invert ? luminance - threshold : threshold - luminance;
    const alpha = clamp(Math.round(ink * 2.2), 0, 255);
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = alpha;

    if (alpha > 15) {
      const pixelIndex = index / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  workContext.putImageData(imageData, 0, 0);
  const padding = 6;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
  const crop = document.createElement("canvas");
  crop.width = cropWidth;
  crop.height = cropHeight;
  crop.getContext("2d").drawImage(work, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return crop.toDataURL("image/png");
}

function drawSmallPreview(canvas, image, showChecker) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (showChecker) {
    const size = 8;
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        context.fillStyle = ((x / size + y / size) % 2 === 0) ? "#28282e" : "#1a1a1f";
        context.fillRect(x, y, size, size);
      }
    }
  }
  const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
}

async function syncSignaturePadFromState() {
  if (!sigCtx) return;
  const source = state.signatureData;
  sigCtx.clearRect(0, 0, refs.signatureCanvas.width, refs.signatureCanvas.height);
  sigHasInk = Boolean(source);
  if (!source) return;
  try {
    const image = await loadCanvasImage(source);
    if (state.signatureData !== source) return;
    sigCtx.drawImage(image, 0, 0, refs.signatureCanvas.width, refs.signatureCanvas.height);
  } catch (error) {
    console.warn("Unable to restore signature pad", error);
  }
}

async function hydrateShowcaseSignatureAsset() {
  if (state.signatureData !== SHOWCASE_SIGNATURE_SOURCE) return;
  try {
    const image = await loadCanvasImage(SHOWCASE_SIGNATURE_SOURCE);
    const extracted = extractSignatureMask(image, state.signatureThreshold, false);
    if (!extracted || state.signatureData !== SHOWCASE_SIGNATURE_SOURCE) return;
    state.signatureData = extracted;
    state.signatureMode = "upload";
    app.render();
  } catch (error) {
    console.warn("Unable to prepare the showcase signature", error);
  }
}


// Register on app-core
app.syncSignatureModeUI = syncSignatureModeUI;
app.syncSignaturePadFromState = syncSignaturePadFromState;

export {
  hydrateShowcaseSignatureAsset,
  syncSignatureModeUI, bindSignaturePad, bindSignatureUpload,
  loadImageFromFile, refreshSignatureExtraction, extractSignatureMask,
  drawSmallPreview
};
