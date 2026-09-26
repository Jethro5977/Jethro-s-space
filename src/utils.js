// Card Builder — Utility functions & DOM helpers

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export { clamp };

export const refs = {
  cardScene: $("#cardScene"),
  slabShell: $("#slabShell"),
  card3d: $("#card3d"),
  cardFront: $("#cardFront"),
  cardBack: $("#cardBack"),
  motionBtn: $("#motionBtn"),
  flipBtn: $("#flipBtn"),
  resetViewBtn: $("#resetViewBtn"),
  zoomOutBtn: $("#zoomOutBtn"),
  zoomInBtn: $("#zoomInBtn"),
  rotateLeftBtn: $("#rotateLeftBtn"),
  rotateRightBtn: $("#rotateRightBtn"),
  photoInput: $("#photoInput"),
  logoInput: $("#logoInput"),
  projectInput: $("#projectInput"),
  exportCanvas: $("#exportCanvas"),
  exportProgress: $("#exportProgress span"),
  toast: $("#toast"),
  saveState: $("#saveState"),
  signatureCanvas: $("#signatureCanvas"),
  foilMaskCanvas: $("#foilMaskCanvas"),
  cardThicknessToggle: $("#cardThicknessToggle"),
  customFoilToggle: $("#customFoilToggle")
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export { esc, compactText };

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { hashString, mulberry32 };

function safeFilename(value) {
  return compactText(value, "custom_card").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "_").slice(0, 48);
}

let toastTimer = 0;
function showToast(message, type = "info") {
  refs.toast.textContent = message;
  refs.toast.dataset.type = type;
  refs.toast.classList.remove("show");
  void refs.toast.offsetWidth;
  refs.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => refs.toast.classList.remove("show"), 2200);
}

export { safeFilename, showToast };

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export { downloadBlob };

function fitCanvasText(ctx, text, maxWidth, startSize, minSize, weight, family) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= Math.max(1, startSize * 0.035);
  } while (size > minSize);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  lines.forEach((line, index) => ctx.fillText(index === maxLines - 1 && words.join(" ").length > lines.join(" ").length ? `${line}...` : line, x, y + index * lineHeight));
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadCanvasImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function hexWithAlpha(color, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export { fitCanvasText, wrapCanvasText, roundedRectPath, loadCanvasImage, hexWithAlpha };

function adjustColor(hex, amount) {
  const number = parseInt(hex.slice(1), 16);
  const red = clamp(((number >> 16) & 255) + amount, 0, 255);
  const green = clamp(((number >> 8) & 255) + amount, 0, 255);
  const blue = clamp((number & 255) + amount, 0, 255);
  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export { adjustColor, sleep };
