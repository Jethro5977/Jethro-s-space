// Card Builder — Card effect engine
import { state, projectSignature } from "./state.js";
import { $, $$, refs, clamp, hashString, mulberry32 } from "./utils.js";
import { app } from "./app-core.js";

export let effectToken = 0;
export let effectIntervals = [];

function clearEffectLayers() {
  effectToken += 1;
  effectIntervals.forEach((id) => clearInterval(id));
  effectIntervals = [];
  $$(".effect-layer", refs.cardFront).forEach((node) => node.remove());
  $$(".effect-layer", refs.cardBack).forEach((node) => node.remove());
}

function applyEffect(effectName) {
  const frontRoot = $(".card-design", refs.cardFront);
  const backRoot = $(".card-design", refs.cardBack);
  if (!frontRoot || !backRoot || effectName === "none") return;
  const seed = hashString(`${projectSignature()}-${effectName}`);
  switch (effectName) {
    case "diamond":
      createDiamondSparkle(frontRoot, 220, seed, false);
      createDiamondSparkle(backRoot, 90, seed + 3, true);
      break;
    case "lightning":
      createLightningEffect(frontRoot, seed, false);
      createLightningEffect(backRoot, seed + 7, true);
      break;
    case "rainbow":
      createRainbowEffect(frontRoot, false);
      createRainbowEffect(backRoot, true);
      break;
    case "crystal":
      createCrystalEffect(frontRoot, seed, false);
      createCrystalEffect(backRoot, seed + 11, true);
      break;
    case "holographic":
      createHolographicEffect(frontRoot, false);
      createHolographicEffect(backRoot, true);
      break;
    case "laser":
      createLaserEffect(frontRoot, false);
      createLaserEffect(backRoot, true);
      break;
    case "flame":
      createFlameEffect(frontRoot, seed);
      createBackGlow(backRoot, "linear-gradient(0deg,rgba(255,69,0,.48),transparent 48%)");
      break;
    case "galaxy":
      createGalaxyEffect(frontRoot, seed);
      createBackGlow(backRoot, "radial-gradient(circle at 50% 42%,rgba(132,70,210,.38),rgba(8,4,23,.18) 50%,transparent 76%)");
      break;
    default:
      break;
  }
  const intensity = clamp(Number(state.effectIntensity) / 100, 0, 1);
  $$(".effect-layer", frontRoot).forEach((layer) => { layer.style.opacity = String(intensity); });
  $$(".effect-layer", backRoot).forEach((layer) => { layer.style.opacity = String(intensity * 0.5); });
  applyCustomFoilMask(frontRoot);
}

function applyCustomFoilMask(frontRoot) {
  if (!state.customFoilOn || !state.customFoilMask) return;
  $$(".effect-layer", frontRoot).forEach((layer) => {
    layer.style.maskImage = `url("${state.customFoilMask}")`;
    layer.style.webkitMaskImage = `url("${state.customFoilMask}")`;
    layer.style.maskSize = "100% 100%";
    layer.style.webkitMaskSize = "100% 100%";
    layer.style.maskRepeat = "no-repeat";
    layer.style.webkitMaskRepeat = "no-repeat";
  });
}

function createDiamondSparkle(target, count, seed, isBack) {
  const random = mulberry32(seed);
  const layer = document.createElement("div");
  layer.className = `effect-layer sparkle-layer${isBack ? " effect-back" : ""}`;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    const colorRoll = random();
    sparkle.style.left = `${random() * 100}%`;
    sparkle.style.top = `${random() * 100}%`;
    sparkle.style.setProperty("--size", `${1 + random() * 2.4}px`);
    sparkle.style.setProperty("--duration", `${1.4 + random() * 2.0}s`);
    sparkle.style.setProperty("--delay", `${random() * -3.5}s`);
    sparkle.style.setProperty("--spark-color", colorRoll > 0.94 ? "#c0f0ff" : colorRoll > 0.78 ? "#ffd45e" : "#ffffff");
    fragment.appendChild(sparkle);
  }
  layer.appendChild(fragment);
  target.appendChild(layer);
}

function createRainbowEffect(target, isBack) {
  const layer = document.createElement("div");
  layer.className = `effect-layer rainbow-layer${isBack ? " effect-back" : ""}`;
  target.appendChild(layer);
}

function createCrystalEffect(target, seed, isBack) {
  const random = mulberry32(seed);
  const palette = [
    ["#40c8ff", "#80e0ff"], ["#a080ff", "#c8b0ff"], ["#ffffff", "#c0e8ff"],
    ["#60d8f0", "#a0ecff"], ["#b090ff", "#d0c0ff"], ["#70e0ff", "#b0f0ff"]
  ];
  const defs = [];
  const polygons = [];
  for (let i = 0; i < 32; i += 1) {
    const cx = random() * 300;
    const cy = random() * 420;
    const radius = 28 + random() * 60;
    const sides = 3 + Math.floor(random() * 4);
    const points = [];
    for (let point = 0; point < sides; point += 1) {
      const angle = (point / sides) * Math.PI * 2 + random() * 0.5;
      const r = radius * (0.7 + random() * 0.3);
      points.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
    }
    const colors = palette[i % palette.length];
    const gradId = `cg${i}`;
    const angle = random() * 360;
    defs.push(`<linearGradient id="${gradId}" gradientTransform="rotate(${angle.toFixed(0)},0.5,0.5)"><stop offset="0%" stop-color="${colors[0]}" stop-opacity="${(0.15 + random() * 0.12).toFixed(2)}"/><stop offset="100%" stop-color="${colors[1]}" stop-opacity="${(0.04 + random() * 0.06).toFixed(2)}"/></linearGradient>`);
    polygons.push(`<polygon points="${points.join(" ")}" fill="url(#${gradId})" stroke="rgba(255,255,255,.18)" stroke-width="0.5"/>`);
    if (random() > 0.5) {
      const highlight = `<polygon points="${points.join(" ")}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="0.3" stroke-dasharray="3,6" stroke-dashoffset="${(random() * 10).toFixed(0)}"/>`;
      polygons.push(highlight);
    }
  }
  const layer = document.createElement("div");
  layer.className = `effect-layer crystal-layer${isBack ? " effect-back" : ""}`;
  layer.innerHTML = `<svg viewBox="0 0 300 420" aria-hidden="true"><defs>${defs.join("")}</defs>${polygons.join("")}</svg>`;
  target.appendChild(layer);
}

function createHolographicEffect(target, isBack) {
  const layer = document.createElement("div");
  layer.className = `effect-layer holographic-layer${isBack ? " effect-back" : ""}`;
  target.appendChild(layer);
  const glare = document.createElement("div");
  glare.className = `effect-layer holographic-glare${isBack ? " effect-back" : ""}`;
  target.appendChild(glare);
}

function createLaserEffect(target, isBack) {
  const layer = document.createElement("div");
  layer.className = `effect-layer laser-layer${isBack ? " effect-back" : ""}`;
  const grid = document.createElement("div");
  grid.className = "laser-grid";
  const spectrum = document.createElement("div");
  spectrum.className = "laser-spectrum";
  const scanline = document.createElement("div");
  scanline.className = "laser-scanline";
  layer.appendChild(grid);
  layer.appendChild(spectrum);
  layer.appendChild(scanline);
  target.appendChild(layer);
}

function setupEffectCanvas(className, isBack) {
  const canvas = document.createElement("canvas");
  canvas.className = `effect-layer ${className}${isBack ? " effect-back" : ""}`;
  canvas.width = 600;
  canvas.height = 840;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  return { canvas, ctx };
}

function createLightningEffect(target, seed, isBack) {
  const { canvas, ctx } = setupEffectCanvas("lightning-layer", isBack);
  canvas.style.transform = "translate(var(--parallax-x, 0px), var(--parallax-y, 0px)) scale(1.06)";
  canvas.style.mixBlendMode = "screen";
  target.appendChild(canvas);
  const token = effectToken;
  const random = mulberry32(seed);
  const boltCount = 3 + Math.floor(random() * 2);
  let bolts = [];
  let frame = 0;

  function regenerateBolts() {
    bolts = Array.from({ length: boltCount }, () => ({
      path: buildLightningPath(45 + random() * 210, -8, 45 + random() * 210, 428, 5, random),
      hue: 230 + random() * 72,
      baseAlpha: (isBack ? 0.20 : 0.36) + random() * (isBack ? 0.15 : 0.24),
      flicker: random() * Math.PI * 2
    }));
  }

  regenerateBolts();
  const draw = () => {
    if (token !== effectToken) return;
    frame += 1;
    ctx.clearRect(0, 0, 300, 420);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    bolts.forEach((bolt) => {
      const pulse = 0.62 + 0.38 * Math.sin(frame * 0.055 + bolt.flicker);
      const spike = random() < 0.018 ? 0.58 : 0;
      const alpha = Math.min(1, bolt.baseAlpha * pulse + spike);

      ctx.save();
      ctx.globalAlpha = alpha * 0.72;
      ctx.shadowColor = `hsla(${bolt.hue},100%,72%,${alpha})`;
      ctx.shadowBlur = isBack ? 11 : 19;
      ctx.strokeStyle = `hsla(${bolt.hue},92%,72%,${alpha * 0.72})`;
      ctx.lineWidth = isBack ? 3.2 : 5;
      strokePath(ctx, bolt.path);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = `hsla(${bolt.hue},100%,92%,${alpha})`;
      ctx.shadowBlur = isBack ? 5 : 9;
      ctx.strokeStyle = `hsla(${bolt.hue},45%,97%,${alpha})`;
      ctx.lineWidth = isBack ? 0.9 : 1.45;
      strokePath(ctx, bolt.path);
      ctx.restore();
    });
    ctx.restore();
    if (frame % 90 === 0) regenerateBolts();
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

function strokePath(ctx, points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.stroke();
}

function buildLightningPath(startX, startY, endX, endY, depth, random, points = [], jitter = 60) {
  if (!points.length) points.push({ x: startX, y: startY });
  if (depth <= 0) {
    points.push({ x: endX, y: endY });
    return points;
  }
  const midX = (startX + endX) / 2 + (random() - 0.5) * (jitter / depth) * 4;
  const midY = (startY + endY) / 2 + (random() - 0.5) * jitter * 0.34;
  buildLightningPath(startX, startY, midX, midY, depth - 1, random, points, jitter);
  buildLightningPath(midX, midY, endX, endY, depth - 1, random, points, jitter);
  return points;
}

function createFlameEffect(target, seed) {
  const { canvas, ctx } = setupEffectCanvas("flame-layer", false);
  target.appendChild(canvas);
  const token = effectToken;
  const random = mulberry32(seed);
  const particles = Array.from({ length: 115 }, () => makeFlameParticle(random, true));
  let previous = performance.now();
  const animateFlames = (now) => {
    if (token !== effectToken) return;
    const dt = Math.min(0.04, (now - previous) / 1000);
    previous = now;
    ctx.clearRect(0, 0, 300, 420);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createLinearGradient(0, 420, 0, 270);
    glow.addColorStop(0, "rgba(255,69,0,.35)");
    glow.addColorStop(1, "rgba(255,180,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 250, 300, 170);
    for (const particle of particles) {
      particle.life -= dt;
      if (particle.life <= 0) Object.assign(particle, makeFlameParticle(random, false));
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const lifeRatio = particle.life / particle.maxLife;
      const radius = particle.size * Math.max(0.08, lifeRatio);
      const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
      gradient.addColorStop(0, `rgba(255,235,130,${0.78 * lifeRatio})`);
      gradient.addColorStop(0.45, `rgba(255,120,20,${0.58 * lifeRatio})`);
      gradient.addColorStop(1, "rgba(255,45,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    requestAnimationFrame(animateFlames);
  };
  requestAnimationFrame(animateFlames);
}

function makeFlameParticle(random, initial) {
  const edge = random() < 0.28;
  const x = edge ? (random() < 0.5 ? random() * 28 : 272 + random() * 28) : random() * 300;
  const maxLife = 1.0 + random() * 1.6;
  return {
    x,
    y: initial ? 270 + random() * 150 : 416 + random() * 22,
    vx: (random() - 0.5) * 23,
    vy: -(38 + random() * 76),
    size: 5 + random() * 12,
    life: initial ? random() * maxLife : maxLife,
    maxLife
  };
}

function createGalaxyEffect(target, seed) {
  const tint = document.createElement("div");
  tint.className = "effect-layer galaxy-tint";
  target.appendChild(tint);
  const { canvas, ctx } = setupEffectCanvas("galaxy-layer", false);
  target.appendChild(canvas);
  const random = mulberry32(seed);
  const stars = Array.from({ length: 210 }, () => ({
    x: random() * 300,
    y: random() * 420,
    size: 0.35 + random() * 1.65,
    phase: random() * Math.PI * 2,
    speed: 0.5 + random() * 1.7
  }));
  const token = effectToken;
  const started = performance.now();
  const animateGalaxy = (now) => {
    if (token !== effectToken) return;
    const time = (now - started) / 1000;
    ctx.clearRect(0, 0, 300, 420);
    ctx.save();
    ctx.translate(150, 210);
    ctx.rotate(time * 0.018);
    ctx.translate(-150, -210);
    for (const star of stars) {
      const alpha = 0.26 + (Math.sin(time * star.speed + star.phase) + 1) * 0.31;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    const arm = ctx.createRadialGradient(145, 205, 2, 145, 205, 130);
    arm.addColorStop(0, "rgba(255,255,255,.20)");
    arm.addColorStop(0.2, "rgba(205,102,255,.12)");
    arm.addColorStop(0.56, "rgba(62,122,255,.06)");
    arm.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = arm;
    ctx.fillRect(0, 0, 300, 420);
    ctx.restore();
    requestAnimationFrame(animateGalaxy);
  };
  requestAnimationFrame(animateGalaxy);
}

function createBackGlow(target, background) {
  const layer = document.createElement("div");
  layer.className = "effect-layer effect-back";
  layer.style.background = background;
  target.appendChild(layer);
}


// Register on app-core
app.applyEffect = applyEffect;
app.clearEffectLayers = clearEffectLayers;

export {
  clearEffectLayers, applyEffect, applyCustomFoilMask,
  createDiamondSparkle, createRainbowEffect, createCrystalEffect,
  createHolographicEffect, createLaserEffect, setupEffectCanvas,
  createLightningEffect, strokePath, buildLightningPath,
  createFlameEffect, makeFlameParticle, createGalaxyEffect, createBackGlow
};
