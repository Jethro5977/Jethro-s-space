// Card Builder — Canvas card and slab drawing primitives
import {
  clamp, compactText, hashString, mulberry32,
  hexWithAlpha, loadCanvasImage, roundedRectPath, fitCanvasText,
  wrapCanvasText
} from "./utils.js";
import { state, projectSignature } from "./state.js";
import { drawMaskedExportEffect } from "./export-effects.js";

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas export failed")), "image/png");
  });
}

async function drawCardToCanvas(ctx, d, side, x, y, width, height) {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, Math.max(8, width * 0.026));
  ctx.clip();
  if (side === "back") await drawBackCanvas(ctx, d, x, y, width, height);
  else await drawFrontCanvas(ctx, d, x, y, width, height);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rarityStroke(d.rarity);
  ctx.lineWidth = Math.max(5, width * 0.012);
  roundedRectPath(ctx, x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth, Math.max(6, width * 0.024));
  ctx.stroke();
  ctx.restore();
}

async function drawFrontCanvas(ctx, d, x, y, width, height) {
  const random = mulberry32(hashString(projectSignature()));
  drawFrontBackground(ctx, d, x, y, width, height, random);
  if (state.playerImg) {
    const image = await loadCanvasImage(state.playerImg);
    drawPlayerImage(ctx, image, d, x, y, width, height);
  } else {
    drawPlaceholderCanvas(ctx, d, x, y, width, height);
  }
  if (state.imageMode === "fullart") {
    const shade = ctx.createLinearGradient(0, y + height * 0.42, 0, y + height);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(0.58, "rgba(0,0,0,.34)");
    shade.addColorStop(1, state.style === "heritage" ? "rgba(238,229,210,.92)" : "rgba(0,0,0,.90)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, width, height);
    drawFrontPattern(ctx, d, x, y, width, height, random, 0.23);
  }
  drawUniformPatternCanvas(ctx, d, x, y, width, height);
  drawRarityCanvas(ctx, d, x, y, width, height);
  drawBaseFoilCanvas(ctx, x, y, width, height);
  await drawMaskedExportEffect(ctx, d, x, y, width, height, random, 1, "front");
  await drawFrontTypography(ctx, d, x, y, width, height);
  drawCanvasBadges(ctx, d, x, y, width, height);
  await drawSignatureCanvas(ctx, x, y, width, height, "front");
}

function drawFrontBackground(ctx, d, x, y, width, height, random) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  if (state.style === "heritage") {
    gradient.addColorStop(0, "#f1e8d5");
    gradient.addColorStop(1, "#d7c7aa");
  } else if (state.style === "optic") {
    gradient.addColorStop(0, "#f8f8f4");
    gradient.addColorStop(0.48, "#c7d0d4");
    gradient.addColorStop(1, d.c2);
  } else if (state.style === "tactical") {
    gradient.addColorStop(0, d.c1);
    gradient.addColorStop(0.47, d.c1);
    gradient.addColorStop(0.48, "#15171d");
    gradient.addColorStop(0.54, "#15171d");
    gradient.addColorStop(0.55, d.c2);
    gradient.addColorStop(1, d.c2);
  } else if (state.style === "select") {
    gradient.addColorStop(0, "#111319");
    gradient.addColorStop(0.48, d.c1);
    gradient.addColorStop(1, d.c2);
  } else {
    gradient.addColorStop(0, d.c1);
    gradient.addColorStop(0.54, "#11141b");
    gradient.addColorStop(1, d.c2);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  drawFrontPattern(ctx, d, x, y, width, height, random, 0.72);
}

function drawFrontPattern(ctx, d, x, y, width, height, random, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  if (state.style === "heritage") {
    ctx.strokeStyle = d.c1;
    ctx.lineWidth = width * 0.008;
    ctx.strokeRect(x + width * 0.035, y + height * 0.025, width * 0.93, height * 0.95);
    ctx.strokeStyle = hexWithAlpha(d.c2, 0.72);
    ctx.lineWidth = width * 0.003;
    ctx.strokeRect(x + width * 0.05, y + height * 0.04, width * 0.90, height * 0.92);
    for (let i = 0; i < 520; i += 1) {
      ctx.fillStyle = `rgba(90,64,40,${0.025 + random() * 0.04})`;
      ctx.fillRect(x + random() * width, y + random() * height, 1 + random() * 2, 1 + random() * 2);
    }
  } else if (state.style === "mosaic") {
    const size = width / 8;
    for (let row = -1; row < 12; row += 1) {
      for (let col = -1; col < 9; col += 1) {
        ctx.strokeStyle = col % 2 === row % 2 ? hexWithAlpha(d.c2, 0.55) : "rgba(255,255,255,.16)";
        ctx.lineWidth = width * 0.004;
        ctx.strokeRect(x + col * size, y + row * size, size, size);
      }
    }
  } else if (state.style === "select") {
    ctx.strokeStyle = "rgba(244,196,78,.42)";
    ctx.lineWidth = width * 0.008;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.58, width * (0.27 + i * 0.09), height * (0.20 + i * 0.065), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (state.style === "optic") {
    ctx.strokeStyle = hexWithAlpha(d.c1, 0.34);
    ctx.lineWidth = width * 0.005;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(x + width * 0.55, y + height * 0.43, width * (0.18 + i * 0.09), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 54; i += 1) {
      const px = x + random() * width;
      const py = y + random() * height;
      const size = width * (0.06 + random() * 0.18);
      ctx.fillStyle = random() > 0.55 ? hexWithAlpha(d.c2, 0.18) : "rgba(255,255,255,.09)";
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size, py + size * 0.66);
      ctx.lineTo(px - size, py + size * 0.36);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPlayerImage(ctx, image, d, x, y, width, height) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  const fullartFilters = {
    prism: "saturate(1.24) contrast(1.20) brightness(.93)",
    tactical: "saturate(.66) contrast(1.42) brightness(.84) sepia(.10)",
    heritage: "saturate(.34) sepia(.42) contrast(1.05) brightness(1.08)",
    mosaic: "saturate(1.38) contrast(1.22) brightness(.92) hue-rotate(-5deg)",
    select: "saturate(.92) contrast(1.34) brightness(.80) sepia(.14)",
    optic: "saturate(.72) contrast(1.18) brightness(1.12)"
  };
  if (state.imageMode === "fullart") ctx.filter = fullartFilters[state.style] || "saturate(1.08) contrast(1.12)";
  else if (state.style === "tactical") ctx.filter = "saturate(.72) contrast(1.3)";
  else if (state.style === "heritage") ctx.filter = "saturate(.38) sepia(.34) contrast(1.05)";
  else ctx.filter = "saturate(1.08) contrast(1.12)";
  const extraScale = state.photoScale / 100;
  if (state.imageMode === "fullart") {
    const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * extraScale;
    const drawWidth = image.naturalWidth * baseScale;
    const drawHeight = image.naturalHeight * baseScale;
    const dx = x + (width - drawWidth) / 2 + state.photoX / 100 * width * 0.48;
    const dy = y + (height - drawHeight) / 2 + state.photoY / 100 * height * 0.48;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  } else {
    const areaWidth = width * 0.88;
    const areaHeight = height * 0.73;
    const baseScale = Math.min(areaWidth / image.naturalWidth, areaHeight / image.naturalHeight) * extraScale;
    const drawWidth = image.naturalWidth * baseScale;
    const drawHeight = image.naturalHeight * baseScale;
    const dx = x + (width - drawWidth) / 2 + state.photoX / 100 * width * 0.36;
    // 照片整体上移约 5%：避免签名/底部信息遮挡人像（photoY 滑块仍可微调）
    const dy = y + height * 0.11 + (areaHeight - drawHeight) + state.photoY / 100 * height * 0.28;
    ctx.shadowColor = "rgba(0,0,0,.46)";
    ctx.shadowBlur = width * 0.04;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawPlaceholderCanvas(ctx, d, x, y, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = state.style === "heritage" || state.style === "optic" ? "#172236" : "#ffffff";
  ctx.lineWidth = width * 0.009;
  const cx = x + width * 0.5;
  const cy = y + height * 0.43;
  ctx.beginPath();
  ctx.ellipse(cx, cy - height * 0.16, width * 0.07, height * 0.055, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy + height * 0.08, width * 0.18, height * 0.22, -0.08, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + width * 0.22, cy + height * 0.13, width * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

async function drawFrontTypography(ctx, d, x, y, width, height) {
  const lightText = state.style !== "heritage";
  const primaryText = lightText ? "#ffffff" : "#151a21";
  const mutedText = lightText ? "rgba(255,255,255,.72)" : "rgba(21,26,33,.68)";
  const pad = width * 0.05;
  ctx.save();
  if (state.style === "optic") {
    ctx.shadowColor = "rgba(0,0,0,.88)";
    ctx.shadowBlur = width * 0.018;
    ctx.shadowOffsetY = width * 0.008;
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = primaryText;
  ctx.font = `800 ${width * 0.027}px ui-monospace, monospace`;
  ctx.fillText(d.styleMeta.series, x + pad, y + height * 0.055);
  ctx.textAlign = "right";
  ctx.fillText(d.season, x + width - pad, y + height * 0.055);
  ctx.textAlign = "left";

  if (state.style === "tactical") {
    ctx.fillStyle = "#15171d";
    ctx.beginPath();
    ctx.arc(x + pad + width * 0.06, y + height * 0.18, width * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d7ad45";
    ctx.lineWidth = width * 0.012;
    ctx.stroke();
    ctx.fillStyle = "#f4d478";
    ctx.font = `900 ${width * 0.07}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(d.number, x + pad + width * 0.06, y + height * 0.193);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = hexWithAlpha(lightText ? "#ffffff" : d.c1, 0.20);
    ctx.font = `900 ${width * 0.20}px sans-serif`;
    ctx.fillText(d.number, x + pad, y + height * 0.25);
  }

  const copyY = y + height * 0.815;
  if (state.style === "heritage") {
    ctx.fillStyle = "rgba(238,229,210,.90)";
    ctx.fillRect(x + pad, copyY - height * 0.03, width - pad * 2, height * 0.145);
  }
  ctx.fillStyle = lightText ? "rgba(0,0,0,.42)" : "rgba(255,255,255,.38)";
  ctx.fillRect(x + pad, copyY - height * 0.006, width * 0.30, height * 0.025);
  ctx.fillStyle = primaryText;
  ctx.font = `800 ${width * 0.028}px ui-monospace, monospace`;
  ctx.fillText(d.posFull, x + pad * 1.25, copyY + height * 0.014);
  fitCanvasText(ctx, d.name.toUpperCase(), width - pad * 2, width * 0.096, width * 0.052, 950, "sans-serif");
  ctx.fillText(d.name.toUpperCase(), x + pad, copyY + height * 0.087);
  ctx.fillStyle = mutedText;
  ctx.font = `700 ${width * 0.026}px ui-monospace, monospace`;
  ctx.fillText(`${d.team} / ${d.pos} / #${d.number}`, x + pad, copyY + height * 0.123);
  ctx.font = `700 ${width * 0.021}px ui-monospace, monospace`;
  ctx.fillText(d.cardId, x + pad, y + height - pad * 0.75);
  ctx.textAlign = "right";
  ctx.fillText(d.cardNum, x + width - pad, y + height - pad * 0.75);
  ctx.restore();
  await drawCanvasLogo(ctx, d, x + width - pad - width * 0.10, y + height * 0.085, width * 0.10, width * 0.10, primaryText);
}

async function drawCanvasLogo(ctx, d, x, y, width, height, textColor) {
  ctx.save();
  ctx.strokeStyle = textColor;
  ctx.lineWidth = Math.max(2, width * 0.035);
  ctx.strokeRect(x, y, width, height);
  if (state.logoImg) {
    try {
      const logo = await loadCanvasImage(state.logoImg);
      const scale = Math.min(width * 0.82 / logo.naturalWidth, height * 0.82 / logo.naturalHeight) * (state.logoScale / 100);
      ctx.drawImage(logo, x + (width - logo.naturalWidth * scale) / 2, y + (height - logo.naturalHeight * scale) / 2, logo.naturalWidth * scale, logo.naturalHeight * scale);
    } catch (error) {
      drawLogoLetters(ctx, d.abbr, x, y, width, height, textColor);
    }
  } else {
    drawLogoLetters(ctx, d.abbr, x, y, width, height, textColor);
  }
  ctx.restore();
}

function drawLogoLetters(ctx, letters, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${width * 0.30}px ui-monospace, monospace`;
  ctx.fillText(letters, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawCanvasBadges(ctx, d, x, y, width, height) {
  const scale = width / 300;
  const rackIds = state.badges.filter((id) => ["rc", "mvp", "allstar", "champion"].includes(id));
  rackIds.forEach((id, index) => {
    const labels = { rc: "RC", mvp: "MVP", allstar: "ALL STAR", champion: "CHAMP" };
    const colors = { rc: "#d83e3e", mvp: "#d8ab34", allstar: "#dfe5e8", champion: "#173d2e" };
    const bx = x + width - 66 * scale;
    const by = y + (70 + index * 29) * scale;
    ctx.fillStyle = colors[id];
    ctx.fillRect(bx, by, 48 * scale, 22 * scale);
    ctx.fillStyle = id === "mvp" || id === "allstar" ? "#111" : "#fff";
    ctx.font = `900 ${7 * scale}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(labels[id], bx + 24 * scale, by + 14 * scale);
  });
  ctx.fillStyle = "rgba(5,10,18,.78)";
  ctx.fillRect(x + 14 * scale, y + 58 * scale, 72 * scale, 22 * scale);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${7.5 * scale}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`NO. ${d.cardNum}`, x + 50 * scale, y + 72 * scale);
  if (state.badges.includes("auto")) {
    ctx.save();
    ctx.translate(x + 20 * scale, y + height - 112 * scale);
    ctx.rotate(-0.07);
    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.font = `italic ${17 * scale}px cursive`;
    ctx.textAlign = "left";
    ctx.fillText(d.name, 0, 0);
    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(0, 5 * scale);
    ctx.lineTo(170 * scale, 5 * scale);
    ctx.stroke();
    ctx.restore();
  }
  if (state.badges.includes("patch")) {
    const px = x + width - 68 * scale;
    const py = y + height - 171 * scale;
    ctx.fillStyle = d.c1;
    ctx.fillRect(px, py, 49 * scale, 49 * scale);
    ctx.strokeStyle = "#e7e0d5";
    ctx.lineWidth = 4 * scale;
    ctx.strokeRect(px, py, 49 * scale, 49 * scale);
  }
  ctx.textAlign = "left";
}

function drawUniformPatternCanvas(ctx, d, x, y, width, height) {
  if (state.jerseyStyle === "solid") return;
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, width * 0.026);
  ctx.clip();
  ctx.globalCompositeOperation = "overlay";
  if (state.jerseyStyle === "stripe") {
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, width * 0.0032);
    const gap = width * 0.06;
    for (let px = x - gap; px < x + width + gap; px += gap) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + height);
      ctx.stroke();
    }
  } else if (state.jerseyStyle === "sash") {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x - width * 0.08, y + height * 0.45);
    ctx.lineTo(x + width * 0.13, y + height * 0.30);
    ctx.lineTo(x + width * 1.08, y + height * 0.72);
    ctx.lineTo(x + width * 0.87, y + height * 0.87);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = d.c2;
    ctx.lineWidth = width * 0.012;
    ctx.beginPath();
    ctx.moveTo(x, y + height * 0.40);
    ctx.lineTo(x + width, y + height * 0.84);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRarityCanvas(ctx, d, x, y, width, height) {
  if (state.rarity === "base") return;
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, width * 0.026);
  ctx.clip();
  let gradient;
  if (state.rarity === "silver") {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.24;
    gradient = ctx.createLinearGradient(x, y + height, x + width, y);
    gradient.addColorStop(0, "#8eaab4");
    gradient.addColorStop(0.48, "#ffffff");
    gradient.addColorStop(1, "#91d6e6");
  } else if (state.rarity === "gold") {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.30;
    gradient = ctx.createLinearGradient(x, y + height, x + width, y);
    gradient.addColorStop(0, "#8f5d0f");
    gradient.addColorStop(0.48, "#ffe48d");
    gradient.addColorStop(1, "#c98916");
  } else if (state.rarity === "neon") {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.28;
    gradient = ctx.createRadialGradient(x + width * 0.5, y + height * 0.48, 0, x + width * 0.5, y + height * 0.48, width * 0.72);
    gradient.addColorStop(0, "#d9ffd1");
    gradient.addColorStop(0.34, "#39ff14");
    gradient.addColorStop(1, "rgba(57,255,20,0)");
  } else if (state.rarity === "rwb") {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.26;
    gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, "#e33039");
    gradient.addColorStop(0.48, "#ffffff");
    gradient.addColorStop(1, "#2b67dd");
  } else if (state.rarity === "black") {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0,.48)";
    ctx.fillRect(x, y, width, height);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.20;
    gradient = ctx.createLinearGradient(x, y + height, x + width, y);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.5, "#e4bd59");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
  }
  if (gradient) {
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

function drawBaseFoilCanvas(ctx, x, y, width, height) {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, width * 0.026);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = state.motionOn ? 0.30 : 0.16;
  const sheen = ctx.createLinearGradient(x - width * 0.15, y + height, x + width * 1.12, y);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.39, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.50, "rgba(255,255,255,0.82)");
  sheen.addColorStop(0.56, "rgba(89,213,224,0.32)");
  sheen.addColorStop(0.69, "rgba(255,255,255,0.04)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

async function drawSignatureCanvas(ctx, x, y, width, height, side) {
  if (!state.signatureData || state.signaturePlacement !== side) return;
  const maskImage = await loadCanvasImage(state.signatureData);
  const signatureWidth = width * 0.40 * state.signatureScale;
  const signatureHeight = signatureWidth * (maskImage.height / maskImage.width);
  const drawX = x + width * (state.signatureX / 100) - signatureWidth / 2;
  const drawY = y + height * (state.signatureY / 100) - signatureHeight / 2;
  const offscreen = document.createElement("canvas");
  offscreen.width = Math.max(1, Math.round(signatureWidth));
  offscreen.height = Math.max(1, Math.round(signatureHeight));
  const offscreenContext = offscreen.getContext("2d");
  offscreenContext.drawImage(maskImage, 0, 0, offscreen.width, offscreen.height);

  // 防止不透明签名照片（白底黑字或黑底白字）在 Canvas 导出里变成实心黑块：
  // 若来源几乎不透明，先按背景亮度方向提取墨迹 alpha；
  // 若已经是透明底遮罩（如 extractSignatureMask 的产物），直接使用其 alpha。
  const alphaProbe = offscreenContext.getImageData(0, 0, offscreen.width, offscreen.height);
  const alphaProbePixels = alphaProbe.data;
  let opaqueCount = 0;
  let lightCount = 0;
  let darkCount = 0;
  let probeSamples = 0;
  for (let i = 3; i < alphaProbePixels.length; i += 16) {
    probeSamples += 1;
    if (alphaProbePixels[i] > 200) {
      opaqueCount += 1;
      const luminance = 0.299 * alphaProbePixels[i - 3] + 0.587 * alphaProbePixels[i - 2] + 0.114 * alphaProbePixels[i - 1];
      if (luminance > 155) lightCount += 1;
      if (luminance < 100) darkCount += 1;
    }
  }
  if (probeSamples > 0 && opaqueCount / probeSamples > 0.5) {
    const imageData = offscreenContext.getImageData(0, 0, offscreen.width, offscreen.height);
    const pixels = imageData.data;
    const threshold = clamp(Number(state.signatureThreshold) || 156, 60, 220);
    // 黑底白字 → 提取亮部；白底黑字 → 提取暗部；透明遮罩不进入此分支
    const invert = darkCount > lightCount;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
      const ink = invert ? luminance - threshold : threshold - luminance;
      const alpha = clamp(Math.round(ink * 2.2), 0, 255);
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = alpha;
    }
    offscreenContext.putImageData(imageData, 0, 0);
  }

  offscreenContext.globalCompositeOperation = "source-in";

  if (state.signatureColor === "gold" || state.signatureColor === "silver") {
    const gradient = offscreenContext.createLinearGradient(0, 0, offscreen.width, offscreen.height);
    const stops = state.signatureColor === "gold"
      ? [[0, "#5c4216"], [0.18, "#d9ad4e"], [0.36, "#fff3c4"], [0.5, "#f4dfa0"], [0.66, "#a9812f"], [0.82, "#f4dfa0"], [1, "#5c4216"]]
      : [[0, "#4a5058"], [0.18, "#b9c2cc"], [0.36, "#ffffff"], [0.5, "#d9dee5"], [0.66, "#7d848c"], [0.82, "#d9dee5"], [1, "#4a5058"]];
    stops.forEach(([position, color]) => gradient.addColorStop(position, color));
    offscreenContext.fillStyle = gradient;
  } else {
    offscreenContext.fillStyle = state.signatureColor === "white" ? "#f7f7f7" : state.signatureColor === "blue" ? "#1764c6" : "#111318";
  }
  offscreenContext.fillRect(0, 0, offscreen.width, offscreen.height);
  ctx.drawImage(offscreen, drawX, drawY, signatureWidth, signatureHeight);
}

async function drawBackCanvas(ctx, d, x, y, width, height) {
  const light = !["tactical", "select"].includes(state.style);
  const bg = state.style === "heritage" ? "#eee5d2" : state.style === "tactical" ? "#17191f" : state.style === "select" ? "#17151a" : "#edf0f1";
  const text = light ? "#15191f" : "#f0f1f2";
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, width, height);
  const pad = width * 0.055;
  const left = x + pad;
  const right = x + width - pad;
  ctx.strokeStyle = d.c1;
  ctx.lineWidth = width * 0.008;
  ctx.beginPath();
  ctx.moveTo(left, y + height * 0.095);
  ctx.lineTo(right, y + height * 0.095);
  ctx.stroke();
  ctx.fillStyle = d.c1;
  ctx.fillRect(left, y + height * 0.038, width * 0.18, height * 0.035);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${width * 0.022}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(d.cardId, left + width * 0.09, y + height * 0.061);
  ctx.fillStyle = text;
  ctx.font = `800 ${width * 0.024}px ui-monospace, monospace`;
  ctx.fillText(`${d.styleMeta.name} / ${d.season}`, x + width * 0.5, y + height * 0.061);
  await drawCanvasLogo(ctx, d, right - width * 0.10, y + height * 0.025, width * 0.10, width * 0.10, text);
  ctx.textAlign = "center";
  fitCanvasText(ctx, d.name.toUpperCase(), width * 0.82, width * 0.075, width * 0.045, 950, "sans-serif");
  ctx.fillStyle = text;
  ctx.fillText(d.name.toUpperCase(), x + width * 0.5, y + height * 0.16);
  ctx.fillStyle = d.c1;
  ctx.fillRect(x + width * 0.34, y + height * 0.177, width * 0.32, height * 0.032);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${width * 0.021}px ui-monospace, monospace`;
  ctx.fillText(`${d.posFull} / #${d.number}`, x + width * 0.5, y + height * 0.199);
  ctx.textAlign = "left";
  ctx.fillStyle = hexWithAlpha(text, 0.80);
  ctx.font = `500 ${width * 0.026}px sans-serif`;
  wrapCanvasText(ctx, d.bio, left, y + height * 0.245, width - pad * 2, height * 0.033, 4);

  const profile = [
    ["TEAM", d.team], ["HEIGHT", d.height], ["POSITION", d.pos],
    ["WEIGHT", d.weight], ["HOMETOWN", d.hometown], ["DRAFT", d.draft]
  ];
  const profileY = y + height * 0.405;
  const cellW = (width - pad * 2) / 2;
  const cellH = height * 0.065;
  ctx.strokeStyle = hexWithAlpha(text, 0.52);
  ctx.lineWidth = width * 0.002;
  profile.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cx = left + col * cellW;
    const cy = profileY + row * cellH;
    ctx.strokeRect(cx, cy, cellW, cellH);
    ctx.fillStyle = hexWithAlpha(text, 0.54);
    ctx.font = `700 ${width * 0.017}px ui-monospace, monospace`;
    ctx.fillText(label, cx + width * 0.015, cy + cellH * 0.36);
    ctx.fillStyle = text;
    fitCanvasText(ctx, String(value), cellW - width * 0.03, width * 0.024, width * 0.015, 700, "sans-serif");
    ctx.fillText(String(value), cx + width * 0.015, cy + cellH * 0.75);
  });

  const statsY = y + height * 0.655;
  ctx.fillStyle = d.c1;
  ctx.fillRect(left, statsY, width - pad * 2, height * 0.045);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${width * 0.022}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${d.season} SEASON STATS`, x + width / 2, statsY + height * 0.030);
  const stats = [[d.gp,"GP"],[d.ppg,"PPG"],[d.rpg,"RPG"],[d.apg,"APG"],[d.fg,"FG%"],[d.tp,"3P%"]];
  const statW = (width - pad * 2) / 6;
  stats.forEach(([value,label], index) => {
    const sx = left + index * statW;
    ctx.strokeStyle = hexWithAlpha(text, 0.58);
    ctx.strokeRect(sx, statsY + height * 0.045, statW, height * 0.11);
    ctx.fillStyle = text;
    ctx.font = `900 ${width * 0.042}px sans-serif`;
    ctx.fillText(String(value), sx + statW / 2, statsY + height * 0.102);
    ctx.fillStyle = hexWithAlpha(text, 0.58);
    ctx.font = `700 ${width * 0.017}px ui-monospace, monospace`;
    ctx.fillText(label, sx + statW / 2, statsY + height * 0.135);
  });
  ctx.fillStyle = hexWithAlpha(text, 0.52);
  ctx.font = `700 ${width * 0.017}px ui-monospace, monospace`;
  ctx.fillText(`CARD BUILDER / ${d.team} / ${d.cardNum} / CUSTOM EDITION`, x + width / 2, y + height * 0.94);
  ctx.textAlign = "left";
  await drawMaskedExportEffect(ctx, d, x, y, width, height, mulberry32(hashString(`${projectSignature()}-back-export`)), 0.5, "back");
  await drawSignatureCanvas(ctx, x, y, width, height, "back");
}

function drawSlabBackground(ctx, width, height, d) {
  ctx.fillStyle = "#090b0e";
  ctx.fillRect(0, 0, width, height);
  const grid = 120;
  ctx.strokeStyle = "rgba(89,213,224,.08)";
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= width; gx += grid) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
  }
  for (let gy = 0; gy <= height; gy += grid) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
  }
  const isAcrylic = state.slabType === "acrylic";
  const isCrystal = state.slabType === "crystal";
  const isGallery = state.slabType === "gallery";
  const slabGradient = ctx.createLinearGradient(300, 100, 2100, 3100);
  slabGradient.addColorStop(0, isAcrylic || isCrystal ? "rgba(235,249,255,.24)" : isGallery ? "rgba(223,229,238,.17)" : "rgba(225,245,255,.18)");
  slabGradient.addColorStop(0.52, isAcrylic || isCrystal ? "rgba(190,220,235,.075)" : isGallery ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.035)");
  const lastStop =
    state.slabType === "museum" ? "rgba(244,196,78,.18)" :
    isAcrylic ? "rgba(160,215,235,.16)" :
    isCrystal ? "rgba(200,230,255,.20)" :
    isGallery ? "rgba(180,195,215,.14)" :
    "rgba(89,213,224,.11)";
  slabGradient.addColorStop(1, lastStop);
  ctx.fillStyle = slabGradient;
  roundedRectPath(ctx, 300, 100, 1800, 3000, 44);
  ctx.fill();
  ctx.strokeStyle = state.slabType === "museum" ? "rgba(244,196,78,.68)" : isAcrylic ? "rgba(236,250,255,.76)" : "rgba(225,245,255,.52)";
  ctx.lineWidth = isAcrylic ? 14 : 9;
  ctx.stroke();
  ctx.strokeStyle = isAcrylic ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.15)";
  ctx.lineWidth = isAcrylic ? 6 : 3;
  roundedRectPath(ctx, 340, 140, 1720, 2920, 32);
  ctx.stroke();
  if (isAcrylic) {
    ctx.strokeStyle = "rgba(90,145,170,.26)";
    ctx.lineWidth = 10;
    roundedRectPath(ctx, 366, 166, 1668, 2868, 22);
    ctx.stroke();
  }
}

function drawAcrylicSlabOverlay(ctx, width, height) {
  const shellX = 300;
  const shellY = 100;
  const shellWidth = 1800;
  const shellHeight = 3000;
  ctx.save();
  roundedRectPath(ctx, shellX, shellY, shellWidth, shellHeight, 44);
  ctx.clip();

  ctx.globalCompositeOperation = "screen";
  const reflection = ctx.createLinearGradient(280, 180, 1940, 2860);
  reflection.addColorStop(0, "rgba(255,255,255,.30)");
  reflection.addColorStop(0.18, "rgba(235,249,255,.04)");
  reflection.addColorStop(0.46, "rgba(255,255,255,.16)");
  reflection.addColorStop(0.54, "rgba(255,255,255,.025)");
  reflection.addColorStop(1, "rgba(167,223,245,.12)");
  ctx.fillStyle = reflection;
  ctx.fillRect(shellX, shellY, shellWidth, shellHeight);

  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(410, 160);
  ctx.lineTo(1100, 160);
  ctx.lineTo(2020, 2550);
  ctx.stroke();

  let seed = 481516;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.lineCap = "round";
  for (let index = 0; index < 34; index += 1) {
    const x = 390 + random() * 1620;
    const y = 220 + random() * 2700;
    const length = 34 + random() * 190;
    const rise = -8 + random() * 16;
    ctx.strokeStyle = random() > 0.48 ? "rgba(255,255,255,.075)" : "rgba(69,102,119,.075)";
    ctx.lineWidth = random() > 0.78 ? 2.8 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y + rise);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSlabLabel(ctx, d, x, y, width, height) {
  if (state.slabType === "crystal") return;
  ctx.fillStyle = "rgba(7,9,12,.88)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = state.slabType === "museum" ? "#f4c44e" : "#59d5e0";
  ctx.lineWidth = 10;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#b9c0c6";
  ctx.font = `800 ${width * 0.033}px ui-monospace, monospace`;
  ctx.fillText("CARD BUILDER // AUTHENTIC", x + 55, y + 92);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${width * 0.050}px sans-serif`;
  fitCanvasText(ctx, d.name, width * 0.62, width * 0.050, width * 0.031, 900, "sans-serif");
  ctx.fillText(d.name, x + 55, y + 174);
  ctx.fillStyle = "#7f8992";
  ctx.font = `700 ${width * 0.022}px ui-monospace, monospace`;
  ctx.fillText(`${d.styleMeta.name} / ${d.cardNum}`, x + 55, y + 232);
  ctx.fillStyle = state.slabType === "museum" ? "#f4c44e" : "#59d5e0";
  ctx.font = `950 ${height * 0.48}px sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(compactText(state.gradeValue, "10"), x + width - 60, y + height * 0.68);
  ctx.font = `800 ${width * 0.022}px ui-monospace, monospace`;
  ctx.fillText(Number(state.gradeValue) >= 9.5 ? "GEM MINT" : "AUTHENTIC", x + width - 60, y + height * 0.88);
  ctx.textAlign = "left";
}

function rarityStroke(rarity) {
  return {
    base: "rgba(255,255,255,.48)",
    silver: "#dcecf2",
    gold: "#f4c44e",
    neon: "#39ff14",
    rwb: "#f2f0e8",
    black: "#dfb84e"
  }[rarity] || "rgba(255,255,255,.48)";
}


// Also used by three-preview.js via window global
function renderThreeCardCanvas(ctx, d, side, x, y, w, h) {
  return drawCardToCanvas(ctx, d, side, x, y, w, h);
}

export {
  canvasToBlob, drawCardToCanvas, renderThreeCardCanvas,
  drawFrontBackground, drawFrontPattern, drawPlayerImage, drawPlaceholderCanvas,
  drawLogoLetters, drawCanvasBadges, drawUniformPatternCanvas, drawRarityCanvas,
  drawBaseFoilCanvas, drawSlabBackground, drawAcrylicSlabOverlay,
  drawSlabLabel, rarityStroke
};
