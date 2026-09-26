// Card Builder — Canvas-only card effect painters
import { clamp, loadCanvasImage, roundedRectPath } from "./utils.js";
import { state } from "./state.js";
import { buildLightningPath, strokePath } from "./effects.js";

const EFFECT_PAINTERS = Object.freeze({
  diamond: drawDiamond,
  rainbow: drawRainbow,
  crystal: drawCrystal,
  holographic: drawHolographic,
  laser: drawLaser,
  lightning: drawLightning,
  flame: drawFlame,
  galaxy: drawGalaxy
});

export function drawExportEffect(ctx, _data, x, y, width, height, random, opacityScale = 1) {
  const intensity = clamp(Number(state.effectIntensity) / 100, 0, 1) * opacityScale;
  const painter = EFFECT_PAINTERS[state.effect];
  if (!painter || intensity <= 0) return;

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, width * 0.026);
  ctx.clip();
  ctx.globalAlpha = intensity;
  painter(ctx, x, y, width, height, random, intensity);
  ctx.restore();
}

export async function drawMaskedExportEffect(ctx, data, x, y, width, height, random, opacityScale, side) {
  if (side !== "front" || !state.customFoilOn || !state.customFoilMask || state.effect === "none") {
    drawExportEffect(ctx, data, x, y, width, height, random, opacityScale);
    return;
  }
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  drawExportEffect(layerCtx, data, 0, 0, width, height, random, opacityScale);
  const mask = await loadCanvasImage(state.customFoilMask);
  layerCtx.save();
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.drawImage(mask, 0, 0, width, height);
  layerCtx.restore();
  ctx.drawImage(layer, x, y, width, height);
}

function drawDiamond(ctx, x, y, width, height, random) {
  for (let index = 0; index < 320; index += 1) {
    const px = x + random() * width;
    const py = y + random() * height;
    const size = width * (0.001 + random() * 0.0038);
    ctx.fillStyle = random() > 0.82 ? "rgba(255,214,94,.84)" : "rgba(255,255,255,.86)";
    ctx.fillRect(px - size / 2, py - size * 2, size, size * 4);
    ctx.fillRect(px - size * 2, py - size / 2, size * 4, size);
  }
}

function drawRainbow(ctx, x, y, width, height, _random, intensity) {
  const gradient = createRainbowGradient(ctx, x, y, width, height);
  ctx.globalAlpha = 0.28 * intensity;
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

function createRainbowGradient(ctx, x, y, width, height) {
  if (typeof ctx.createConicGradient === "function") {
    const gradient = ctx.createConicGradient(0.3, x + width * 0.52, y + height * 0.45);
    const colors = ["#f00", "#ff8a00", "#ffef00", "#31d843", "#00e9ff", "#176cff", "#8c31ff", "#f00"];
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    return gradient;
  }
  const fallback = ctx.createLinearGradient(x, y, x + width, y + height);
  fallback.addColorStop(0, "#ff4050");
  fallback.addColorStop(0.5, "#2fe6df");
  fallback.addColorStop(1, "#7d42ff");
  return fallback;
}

function drawCrystal(ctx, x, y, width, height, random, intensity) {
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 32; index += 1) drawCrystalFacet(ctx, x, y, width, height, random);
  ctx.globalAlpha = 0.14 * intensity;
  const bandGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  bandGradient.addColorStop(0, "transparent");
  bandGradient.addColorStop(0.3, "rgba(100,200,255,.4)");
  bandGradient.addColorStop(0.4, "rgba(255,255,255,.5)");
  bandGradient.addColorStop(0.5, "rgba(180,140,255,.3)");
  bandGradient.addColorStop(0.7, "transparent");
  ctx.fillStyle = bandGradient;
  ctx.fillRect(x, y, width, height);
}

function drawCrystalFacet(ctx, x, y, width, height, random) {
  const cx = x + random() * width;
  const cy = y + random() * height;
  const radius = width * (0.08 + random() * 0.18);
  const sides = 3 + Math.floor(random() * 4);
  ctx.beginPath();
  for (let point = 0; point < sides; point += 1) {
    const angle = point / sides * Math.PI * 2 + random() * 0.5;
    const distance = radius * (0.7 + random() * 0.3);
    const px = cx + Math.cos(angle) * distance;
    const py = cy + Math.sin(angle) * distance;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  const hue = 190 + random() * 60;
  gradient.addColorStop(0, `hsla(${hue},80%,70%,.16)`);
  gradient.addColorStop(1, `hsla(${hue + 30},60%,80%,.06)`);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = width * 0.0015;
  ctx.stroke();
}

function drawHolographic(ctx, x, y, width, height, _random, intensity) {
  drawHolographicWedges(ctx, x + width * 0.5, y + height * 0.5, Math.hypot(width, height) * 0.5, [0, 30, 60, 120, 180, 240, 300, 360], 0.22 * intensity);
  ctx.save();
  ctx.globalAlpha = 0.08 * intensity;
  for (let lineY = y; lineY < y + height; lineY += 3) {
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(x, lineY, width, 1);
  }
  ctx.restore();
}

function drawHolographicWedges(ctx, cx, cy, radius, hues, alpha) {
  for (let index = 0; index < hues.length - 1; index += 1) {
    const start = (hues[index] / 360) * Math.PI * 2 - Math.PI;
    const end = (hues[index + 1] / 360) * Math.PI * 2 - Math.PI;
    ctx.save();
    ctx.globalCompositeOperation = "color-dodge";
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsla(${hues[index]},90%,55%,1)`;
    ctx.fill();
    ctx.restore();
  }
}

function drawLaser(ctx, x, y, width, height, _random, intensity) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.12 * intensity;
  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.lineWidth = width * 0.001;
  const step = width * 0.02;
  for (let offset = -height; offset < width + height; offset += step) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset - height, y + height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset + height, y + height);
    ctx.stroke();
  }
  ctx.restore();
  drawSpectrumWedges(ctx, x + width * 0.5, y + height * 0.5, Math.hypot(width, height) * 0.5, [340, 30, 60, 150, 200, 270, 340], 0.18 * intensity, "85%,50%");
}

function drawSpectrumWedges(ctx, cx, cy, radius, hues, alpha, saturationLightness) {
  for (let index = 0; index < hues.length - 1; index += 1) {
    const start = (index / (hues.length - 1)) * Math.PI * 2 - Math.PI;
    const end = ((index + 1) / (hues.length - 1)) * Math.PI * 2 - Math.PI;
    ctx.save();
    ctx.globalCompositeOperation = "color-dodge";
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsla(${hues[index]},${saturationLightness},1)`;
    ctx.fill();
    ctx.restore();
  }
}

function drawLightning(ctx, x, y, width, height, random, intensity) {
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 4; index += 1) {
    const hue = 230 + random() * 72;
    const startX = x + width * (0.15 + random() * 0.70);
    const endX = x + width * (0.15 + random() * 0.70);
    const path = buildLightningPath(startX, y - height * 0.02, endX, y + height * 1.02, 5, random, [], width * 0.20);
    strokeLightningLayer(ctx, path, hue, width, intensity, 0.54, 0.016, 0.045, "92%,72%,.72", 72);
    strokeLightningLayer(ctx, path, hue, width, intensity, 0.94, 0.0045, 0.018, "45%,97%,.98", 92);
  }
}

function strokeLightningLayer(ctx, path, hue, width, intensity, alpha, lineWidth, blur, color, shadowLightness) {
  ctx.save();
  ctx.globalAlpha = alpha * intensity;
  ctx.strokeStyle = `hsla(${hue},${color})`;
  ctx.lineWidth = width * lineWidth;
  ctx.shadowColor = `hsla(${hue},100%,${shadowLightness}%,.92)`;
  ctx.shadowBlur = width * blur;
  strokePath(ctx, path);
  ctx.restore();
}

function drawFlame(ctx, x, y, width, height, random) {
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 170; index += 1) {
    const px = x + random() * width;
    const py = y + height * (0.62 + random() * 0.40);
    const radius = width * (0.008 + random() * 0.035);
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, "rgba(255,225,100,.72)");
    gradient.addColorStop(0.48, "rgba(255,93,12,.42)");
    gradient.addColorStop(1, "rgba(255,40,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGalaxy(ctx, x, y, width, height, random) {
  const gradient = ctx.createRadialGradient(x + width * 0.47, y + height * 0.42, 0, x + width * 0.47, y + height * 0.42, width * 0.65);
  gradient.addColorStop(0, "rgba(206,102,255,.36)");
  gradient.addColorStop(0.32, "rgba(55,105,235,.28)");
  gradient.addColorStop(1, "rgba(8,4,23,.65)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  for (let index = 0; index < 260; index += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.28 + random() * 0.62})`;
    const size = width * (0.001 + random() * 0.003);
    ctx.fillRect(x + random() * width, y + random() * height, size, size);
  }
}
