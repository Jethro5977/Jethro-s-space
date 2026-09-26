// Card Builder — PNG export orchestration
import { refs, downloadBlob, safeFilename, showToast } from "./utils.js";
import { state, getData } from "./state.js";
import {
  canvasToBlob,
  drawAcrylicSlabOverlay,
  drawCardToCanvas,
  drawSlabBackground,
  drawSlabLabel
} from "./export-canvas.js";

export async function exportCard(mode) {
  const exportButton = document.querySelector(`.export-btn[data-export="${mode}"]`);
  exportButton?.classList.add("exporting");
  const data = getData();
  showToast(`正在生成 ${mode.toUpperCase()} 图像...`, "info");
  refs.exportProgress.style.width = "12%";

  try {
    await document.fonts.ready;
    const canvas = await createExportCanvas(mode, data);
    refs.exportProgress.style.width = "86%";
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, `${safeFilename(data.name)}_${state.style}_${mode.replace("front-hd", "front_hd")}.png`);
    refs.exportProgress.style.width = "100%";
    showToast("PNG 已生成", "success");
    markExportComplete(exportButton);
  } catch (error) {
    console.error(error);
    showToast("导出失败，请重新尝试", "error");
  } finally {
    exportButton?.classList.remove("exporting");
    window.setTimeout(() => { refs.exportProgress.style.width = "0"; }, 900);
  }
}

async function createExportCanvas(mode, data) {
  if (mode === "3d-preview") return captureThreePreview();
  if (mode === "spread") return createSpreadCanvas(data);
  if (mode === "slab") return createSlabCanvas(data);
  return createCardCanvas(mode, data);
}

function captureThreePreview() {
  if (!window.cardBuilderThree?.captureCanvas) throw new Error("Three.js preview is not ready");
  return window.cardBuilderThree.captureCanvas(2400, 3200);
}

async function createSpreadCanvas(data) {
  const canvas = document.createElement("canvas");
  canvas.width = 3000;
  canvas.height = 2100;
  const context = canvas.getContext("2d");
  context.fillStyle = "#0b0d10";
  context.fillRect(0, 0, canvas.width, canvas.height);
  refs.exportProgress.style.width = "30%";
  await drawCardToCanvas(context, data, "front", 0, 0, 1500, 2100);
  refs.exportProgress.style.width = "62%";
  await drawCardToCanvas(context, data, "back", 1500, 0, 1500, 2100);
  return canvas;
}

async function createSlabCanvas(data) {
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 3200;
  const context = canvas.getContext("2d");
  drawSlabBackground(context, canvas.width, canvas.height, data);
  refs.exportProgress.style.width = "35%";
  await drawCardToCanvas(context, data, "front", 450, 620, 1500, 2100);
  if (state.slabType === "acrylic") drawAcrylicSlabOverlay(context, canvas.width, canvas.height);
  drawSlabLabel(context, data, 450, 210, 1500, 300);
  return canvas;
}

async function createCardCanvas(mode, data) {
  const highDefinition = mode === "front-hd";
  const canvas = document.createElement("canvas");
  canvas.width = highDefinition ? 2100 : 1500;
  canvas.height = highDefinition ? 2940 : 2100;
  await drawCardToCanvas(canvas.getContext("2d"), data, mode === "back" ? "back" : "front", 0, 0, canvas.width, canvas.height);
  return canvas;
}

function markExportComplete(button) {
  button?.classList.remove("exporting");
  button?.classList.add("export-done");
  window.setTimeout(() => button?.classList.remove("export-done"), 700);
}
