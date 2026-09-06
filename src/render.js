// Card Builder — Card face rendering & UI sync
import {
  STYLE_META, EFFECT_META, RARITY_META, FIELD_IDS, SIGNATURE_COLOR_MAP,
  POSITION_MAP
} from "./constants.js";
import { $, $$, esc, compactText, refs, hashString } from "./utils.js";
import {
  state, getData, normalizeEffectIntensity, projectSignature, queueAutosave
} from "./state.js";
import { app } from "./app-core.js";
import { sigCtx } from "./signatures.js";

function photoTransformStyle(mode) {
  const scale = state.photoScale / 100;
  if (mode === "fullart") {
    return `transform:translate(${state.photoX * 0.45}px,${state.photoY * 0.45}px) scale(${scale});`;
  }
  return `transform:translate(calc(-50% + ${state.photoX * 0.65}px),${state.photoY * 0.65}px) scale(${scale});`;
}

function photoMarkup(d) {
  const modeClass = state.imageMode === "fullart" ? "fullart" : "cutout";
  if (state.playerImg) {
    return `<div class="photo-layer ${modeClass}"><img src="${esc(state.playerImg)}" alt="${esc(d.name)}" style="${photoTransformStyle(state.imageMode)}"></div>`;
  }
  return `<div class="photo-layer ${modeClass}">
    <div class="photo-placeholder" aria-hidden="true"><span class="head"></span><span class="body"></span><span class="ball"></span></div>
  </div>`;
}

function logoMarkup(d, className = "team-logo") {
  if (state.logoImg) {
    return `<div class="${className}"><img src="${esc(state.logoImg)}" alt="${esc(d.abbr)} logo" style="transform:scale(${state.logoScale / 100});"></div>`;
  }
  return `<div class="${className}">${esc(d.abbr)}</div>`;
}

function badgeMarkup(d) {
  if (!state.badges.length) return `<div class="badge-layer"></div>`;
  const rack = [];
  const labels = {
    rc: "RC",
    mvp: "MVP",
    allstar: "ALL STAR",
    champion: "CHAMP"
  };
  for (const id of ["rc", "mvp", "allstar", "champion"]) {
    if (state.badges.includes(id)) rack.push(`<span class="card-badge badge-${id}">${labels[id]}</span>`);
  }
  const auto = state.badges.includes("auto") ? `<span class="auto-badge">${esc(d.name)}</span>` : "";
  const patch = state.badges.includes("patch") ? `<span class="patch-badge">GAME WORN</span>` : "";
  return `<div class="badge-layer"><div class="badge-rack">${rack.join("")}</div>${auto}${patch}</div>`;
}

function signatureMarkup() {
  if (!state.signatureData) return "";
  const width = 40 * state.signatureScale;
  const baseStyle = `left:${state.signatureX}%;top:${state.signatureY}%;width:${width}%;`;
  if (state.signatureColor === "gold" || state.signatureColor === "silver") {
    const maskUrl = esc(state.signatureData);
    return `<span class="signature-foil-wrap signature-${state.signatureColor}" style="${baseStyle}">
      <img src="${maskUrl}" alt="自定义签名">
      <span class="signature-foil-shine" style="-webkit-mask-image:url('${maskUrl}');mask-image:url('${maskUrl}');"></span>
    </span>`;
  }
  // Keep the paper/background light so the existing multiply blend removes it.
  // The old brightness(0) filter turned an entire uploaded signature photo into
  // an opaque black rectangle on mobile and in restored library cards.
  const colorFilter = state.signatureColor === "blue"
    ? "drop-shadow(0 0 1.2px rgba(255,255,255,0.86)) drop-shadow(0 1px 1.5px rgba(0,0,0,0.88))"
    : state.signatureColor === "white" ? "brightness(1)" : "grayscale(1) contrast(1.35)";
  return `<img class="signature-layer signature-${state.signatureColor}" src="${esc(state.signatureData)}" alt="自定义签名" style="${baseStyle}filter:${colorFilter};">`;
}


function renderFront(d) {
  const nameSizeClass = d.name.length > 14 ? "player-name-xl" : d.name.length > 12 ? "player-name-lg" : "";
  const classes = [
    "card-design",
    `style-${state.style}`,
    `mode-${state.imageMode}`,
    `rarity-${state.rarity}`,
    `uniform-${state.jerseyStyle}`
  ].join(" ");
  return `<div class="${classes}" style="--c1:${esc(d.c1)};--c2:${esc(d.c2)}">
    <div class="base-bg"></div>
    <div class="style-pattern"></div>
    ${photoMarkup(d)}
    <div class="fullart-shade"></div>
    <div class="uniform-pattern"></div>
    <div class="card-topline"><span class="series-word">${esc(d.styleMeta.series)}</span><span>${esc(d.season)}</span></div>
    ${logoMarkup(d)}
    <div class="number-seal">${esc(d.number)}</div>
    <div class="player-copy">
      <span class="position">${esc(d.posFull)}</span>
      <h2 class="${nameSizeClass}">${esc(d.name)}</h2>
      <div class="team-line">${esc(d.team)} / ${esc(d.pos)} / #${esc(d.number)}</div>
    </div>
    <div class="serial-badge serial-badge-persistent">NO. ${esc(d.cardNum)}</div>
    <div class="card-footline"><span>${esc(d.cardId)}</span><span>${esc(d.cardNum)}</span></div>
    ${badgeMarkup(d)}
    <div class="base-foil"></div>
    ${state.signaturePlacement === "front" ? signatureMarkup() : ""}
  </div>`;
}

function renderBack(d) {
  const classes = ["card-design", "card-back-design", `back-${state.style}`, `rarity-${state.rarity}`].join(" ");
  return `<div class="${classes}" style="--c1:${esc(d.c1)};--c2:${esc(d.c2)}">
    <div class="back-shell">
      <div class="back-head">
        <div class="back-card-id">${esc(d.cardId)}</div>
        <div class="back-series">${esc(d.styleMeta.name)} / ${esc(d.season)}</div>
        ${logoMarkup(d, "back-logo")}
      </div>
      <div class="back-name">${esc(d.name)}</div>
      <div class="back-role">${esc(d.posFull)} / #${esc(d.number)}</div>
      <div class="back-bio">${esc(d.bio)}</div>
      <div class="back-profile">
        <div><span>TEAM</span><strong>${esc(d.abbr)}</strong></div>
        <div><span>HEIGHT</span><strong>${esc(d.height)}</strong></div>
        <div><span>POSITION</span><strong>${esc(d.pos)}</strong></div>
        <div><span>WEIGHT</span><strong>${esc(d.weight)}</strong></div>
        <div><span>HOMETOWN</span><strong>${esc(d.hometown)}</strong></div>
        <div><span>DRAFT</span><strong>${esc(d.draft)}</strong></div>
      </div>
      <div class="stats-title">${esc(d.season)} SEASON STATS</div>
      <div class="back-stats">
        <div><strong>${esc(d.gp)}</strong><span>GP</span></div>
        <div><strong>${esc(d.ppg)}</strong><span>PPG</span></div>
        <div><strong>${esc(d.rpg)}</strong><span>RPG</span></div>
        <div><strong>${esc(d.apg)}</strong><span>APG</span></div>
        <div><strong>${esc(d.fg)}</strong><span>FG%</span></div>
        <div><strong>${esc(d.tp)}</strong><span>3P%</span></div>
      </div>
      <div class="back-footer">CARD BUILDER / ${esc(d.team)} / ${esc(d.cardNum)} / CUSTOM EDITION</div>
    </div>
    ${state.signaturePlacement === "back" ? signatureMarkup() : ""}
  </div>`;
}

function render() {
  const d = getData();
  app.clearEffectLayers();
  document.documentElement.style.setProperty("--team-primary", d.c1);
  document.documentElement.style.setProperty("--team-secondary", d.c2);
  refs.cardFront.innerHTML = renderFront(d);
  refs.cardBack.innerHTML = renderBack(d);
  app.applyEffect(state.effect);
  updateInterface(d);
  app.applyRotation();
  queueAutosave();
  emitThreePreviewState(d);
}

function emitThreePreviewState(d = getData()) {
  window.dispatchEvent(new CustomEvent("cardbuilder:state", {
    detail: {
      ...d,
      slabType: state.slabType,
      cardThickness: state.cardThickness,
      gradeValue: state.gradeValue,
      motionOn: state.motionOn
    }
  }));
}


function updateInterface(d) {
  const styleKeys = Object.keys(STYLE_META);
  $$("[data-style]").forEach((button) => button.classList.toggle("active", button.dataset.style === state.style));
  $$("[data-effect]").forEach((button) => button.classList.toggle("active", button.dataset.effect === state.effect));
  $$("[data-rarity]").forEach((button) => button.classList.toggle("active", button.dataset.rarity === state.rarity));
  $$("[data-slab]").forEach((button) => button.classList.toggle("active", button.dataset.slab === state.slabType));
  $$("[data-image-mode]").forEach((button) => button.classList.toggle("active", button.dataset.imageMode === state.imageMode));
  $$("[data-badge]").forEach((button) => button.classList.toggle("active", state.badges.includes(button.dataset.badge)));

  $("#styleCount").textContent = `${String(styleKeys.indexOf(state.style) + 1).padStart(2, "0")} / ${String(styleKeys.length).padStart(2, "0")}`;
  $("#effectName").textContent = d.effectMeta.name;
  $("#rarityName").textContent = d.rarityMeta.name;
  const slabNameEl = $("#slabName");
  if (slabNameEl) slabNameEl.textContent = state.slabType === "none" ? "RAW" : state.slabType.toUpperCase();
  $("#imageModeName").textContent = state.imageMode.toUpperCase();
  $("#badgeCount").textContent = `${state.badges.length} SELECTED`;
  $("#teamColorCode").textContent = `${d.c1.toUpperCase()} / ${d.c2.toUpperCase()}`;
  $("#colorPrimaryOut").textContent = d.c1.toUpperCase();
  $("#colorSecondaryOut").textContent = d.c2.toUpperCase();
  $("#teamAbbrHead").textContent = d.abbr;
  $("#logoFallback").textContent = d.abbr;
  $("#seasonHead").textContent = d.season;
  $("#photoScaleOut").textContent = `${state.photoScale}%`;
  $("#photoXOut").textContent = String(state.photoX);
  $("#photoYOut").textContent = String(state.photoY);
  $("#effectIntensity").value = state.effectIntensity;
  $("#effectIntensityOut").textContent = `${state.effectIntensity}%`;
  $("#teamPreset").value = state.teamPreset;
  refs.cardThicknessToggle.checked = state.cardThickness;
  refs.customFoilToggle.checked = state.customFoilOn;
  $("#foilMaskStatus").textContent = state.customFoilMask ? (state.customFoilOn ? "已启用" : "已应用") : "未应用";
  $("#signatureStatus").textContent = state.signatureData ? (state.signaturePlacement === "back" ? "已应用 / 背面" : "已应用 / 正面") : "未应用";
  $("#signatureX").value = state.signatureX;
  $("#signatureY").value = state.signatureY;
  $("#signatureScale").value = Math.round(state.signatureScale * 100);
  $("#signatureXOut").textContent = `${state.signatureX}%`;
  $("#signatureYOut").textContent = `${state.signatureY}%`;
  $("#signatureScaleOut").textContent = `${Math.round(state.signatureScale * 100)}%`;
  $("#signaturePlacementBack").checked = state.signaturePlacement === "back";
  $("#signaturePlacementLabel").textContent = state.signaturePlacement === "back" ? "背面" : "正面";
  $$("#signatureColorRow [data-sig-color]").forEach((button) => button.classList.toggle("active", button.dataset.sigColor === state.signatureColor));
  app.syncSignatureModeUI?.();

  const photoPreview = $("#photoPreview");
  const logoPreview = $("#logoPreview");
  photoPreview.classList.toggle("has-image", Boolean(state.playerImg));
  logoPreview.classList.toggle("has-image", Boolean(state.logoImg));
  $("#photoPreviewImg").src = state.playerImg || "";
  $("#logoPreviewImg").src = state.logoImg || "";
  const mediaStatus = $("#playerMediaStatus");
  if (mediaStatus) {
    mediaStatus.textContent = state.playerMediaId
      ? `${state.playerImageCategory || "MEDIA"} · ${state.playerImageTeamAtCapture || "TEAM N/A"} · ${state.playerImageCredit || "SOURCE PENDING"}`
      : state.playerImg ? "用户上传 / 旧项目图片" : "尚未选择影像";
    mediaStatus.classList.toggle("is-fallback", state.playerImageCategory === "headshot_fallback");
  }

  refs.slabShell.className = `slab-shell slab-${state.slabType}`;
  refs.card3d.classList.toggle("no-thickness", !state.cardThickness);
  refs.card3d.dataset.rarity = state.rarity;
  $("#slabGradeValue").textContent = compactText(state.gradeValue, "10");
  $("#slabGradeName").textContent = Number(state.gradeValue) >= 9.5 ? "GEM MINT" : Number(state.gradeValue) >= 8 ? "MINT" : "AUTHENTIC";

  $("#infoPlayerLine").textContent = `${d.name} / ${d.pos} / #${d.number}`;
  $("#infoEdition").textContent = d.styleMeta.name;
  $("#infoCaseType").textContent = slabCaseName(state.slabType, d);
  $("#infoFinish").textContent = `${d.rarityMeta.name} / ${d.effectMeta.finish}`;
  $("#infoSerial").textContent = d.cardNum;
  $("#viewSideLabel").textContent = state.flipped ? "BACK / LIVE" : "FRONT / LIVE";
  refs.flipBtn.classList.toggle("active", state.flipped);
  refs.motionBtn.classList.toggle("active", state.motionOn);
  refs.zoomOutBtn.disabled = state.viewScale <= 0.6;
  refs.zoomInBtn.disabled = state.viewScale >= 1.6;
  $("#zoomLevel").value = `${Math.round(state.viewScale * 100)}%`;
  $("#zoomLevel").textContent = `${Math.round(state.viewScale * 100)}%`;
  refs.cardScene.classList.toggle("motion-active", state.motionOn);

  $("#summaryStyle").textContent = d.styleMeta.name;
  $("#summaryEffect").textContent = `${d.effectMeta.name} / ${state.effectIntensity}%`;
  $("#summaryRarity").textContent = d.rarityMeta.name;
  $("#summaryMode").textContent = state.imageMode.toUpperCase();
  $("#summaryBadges").textContent = state.badges.length ? state.badges.map((item) => item.toUpperCase()).join(" / ") : "NONE";
  $("#configHash").textContent = `CB-${hashString(projectSignature()).toString(16).toUpperCase().padStart(6, "0").slice(-6)}`;
}

function slabCaseName(type, d) {
  if (type === "none") return "RAW CARD";
  if (type === "forge") return `CARD BUILDER GRADED ${compactText(state.gradeValue, "10")}`;
  if (type === "museum") return "MUSEUM GOLD CASE";
  if (type === "acrylic") return "THICK CLEAR ACRYLIC";
  if (type === "crystal") return "CRYSTAL DISPLAY CASE";
  if (type === "gallery") return "GALLERY EXHIBITION CASE";
  return d.styleMeta.case;
}


function hydrateInputs() {
  FIELD_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (element && state[id] !== undefined) element.value = state[id];
  });
  const quickInput = $("#playerQuickInput");
  if (quickInput) quickInput.value = state.playerName || "";
  $("#photoScale").value = state.photoScale;
  $("#photoX").value = state.photoX;
  $("#photoY").value = state.photoY;
  $("#effectIntensity").value = state.effectIntensity;
  $("#teamPreset").value = state.teamPreset;
  refs.cardThicknessToggle.checked = state.cardThickness;
  refs.customFoilToggle.checked = state.customFoilOn;
  $("#signatureX").value = state.signatureX;
  $("#signatureY").value = state.signatureY;
  $("#signatureScale").value = Math.round(state.signatureScale * 100);
  $("#signaturePlacementBack").checked = state.signaturePlacement === "back";
  $("#sigThresholdSlider").value = state.signatureThreshold;
  $("#sigThresholdOut").textContent = String(state.signatureThreshold);
  $("#sigInvertToggle").checked = state.signatureInvert;
  if (sigCtx) sigCtx.strokeStyle = "#ffffff";
  app.syncSignatureModeUI?.();
  app.syncSignaturePadFromState?.();
  app.syncFoilMaskPadFromState?.();
}


// Register on app-core for cross-module access
app.render = render;
app.updateInterface = updateInterface;
app.hydrateInputs = hydrateInputs;

export {
  photoTransformStyle, photoMarkup, logoMarkup, badgeMarkup, signatureMarkup,
  renderFront, renderBack, render, emitThreePreviewState, updateInterface,
  slabCaseName, hydrateInputs
};
