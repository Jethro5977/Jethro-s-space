// Card Builder — Player quick access & image loading
import { NBA_PLAYERS_DB, TEAM_PRESETS, NBA_CDN, NBA_TEAM_IDS } from "./constants.js";
import { $, $$, refs, showToast } from "./utils.js";
import {
  state, setState, normalizeState, isSafeUploadImage, isSafeDataImage,
  isSafeCardImage, sanitizeMediaStateText, queueAutosave
} from "./state.js";
import { app } from "./app-core.js";

const AUTO_LIBRARY_LOGO_CACHE = new Map();

function bindPlayerQuickAccess() {
  const input = $("#playerQuickInput");
  const list = $("#playerQuickList");
  const applyButton = $("#playerQuickApplyBtn");
  const mediaButton = $("#playerQuickMediaBtn");
  const status = $("#playerQuickStatus");
  if (!input || !list || !applyButton || !mediaButton || !status) return;

  list.replaceChildren(...NBA_PLAYERS_DB.map((player) => {
    const option = document.createElement("option");
    option.value = player.name;
    option.label = `${player.abbr} · #${player.number} · ${player.position}`;
    return option;
  }));
  status.textContent = `已接入 ${NBA_PLAYERS_DB.length} 位球员资料，精选影像同步中`;

  const applySelectedPlayer = () => {
    const requestedName = String(input.value || "").trim().toUpperCase();
    const player = NBA_PLAYERS_DB.find((candidate) => candidate.name === requestedName);
    if (!player) {
      status.textContent = "未找到该球员，请从输入建议中选择";
      status.classList.add("is-error");
      showToast("未找到该球员，请从列表中选择", "warning");
      input.focus();
      return null;
    }

    setState(applyPlayerFacts({
      ...state,
      playerImg: null,
      logoImg: null,
    }, player));
    input.value = player.name;
    status.textContent = `${player.name} · ${player.abbr} · #${player.number}`;
    status.classList.remove("is-error");
    app.hydrateInputs?.();
    app.render?.();
    showToast(`${player.name} 资料已应用`, "success");
    return player;
  };

  applyButton.addEventListener("click", applySelectedPlayer);
  mediaButton.addEventListener("click", () => {
    const requestedName = String(input.value || "").trim().toUpperCase();
    const player = NBA_PLAYERS_DB.find((candidate) => candidate.name === requestedName);
    if (!player) {
      status.textContent = "未找到该球员，请从输入建议中选择";
      status.classList.add("is-error");
      showToast("未找到该球员，请从列表中选择", "warning");
      input.focus();
      return;
    }
    // Apply player facts but preserve current photo so the card doesn't go blank
    const preservedImg = state.playerImg;
    const preservedLogo = state.logoImg;
    setState(applyPlayerFacts({ ...state, playerImg: null, logoImg: null }, player));
    if (!state.playerImg && preservedImg) state.playerImg = preservedImg;
    if (!state.logoImg && preservedLogo) state.logoImg = preservedLogo;
    input.value = player.name;
    status.textContent = `${player.name} · ${player.abbr} · #${player.number}`;
    status.classList.remove("is-error");
    app.hydrateInputs?.();
    app.render?.();
    $("#playerMediaOpenBtn")?.click();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applySelectedPlayer();
  });
  input.addEventListener("input", () => {
    status.textContent = "按 Enter 或点击“应用资料”";
    status.classList.remove("is-error");
  });
}

function activateTab(name, { reveal = false } = {}) {
  let activePanel = null;
  $$(".tab-btn").forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.id === `tab-${name}`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
    if (active) activePanel = panel;
  });
  if (reveal && activePanel) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    activePanel.scrollIntoView({ behavior, block: "start" });
  }
}

function readImageFile(event, key) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!isSafeUploadImage(file)) {
    showToast("仅支持 PNG、JPEG 或 WebP 图片", "warning");
    event.target.value = "";
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showToast("图片不能超过 16 MB", "warning");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state[key] = reader.result;
    if (key === "playerImg") {
      state.imageMode = state.imageMode || "cutout";
      clearPlayerMediaSelection();
    }
    app.render?.();
    showToast(key === "playerImg" ? "球员照片已更新" : "球队 Logo 已更新", "success");
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  state.playerImg = null;
  clearPlayerMediaSelection();
  refs.photoInput.value = "";
  app.render?.();
}

function clearPlayerMediaSelection() {
  state.playerMediaId = "";
  state.playerImageCategory = "";
  state.playerImageCredit = "";
  state.playerImageCapturedAt = "";
  state.playerImageTeamAtCapture = "";
  state.playerImageLicenseSnapshot = "";
}

function removeLogo() {
  state.logoImg = null;
  refs.logoInput.value = "";
  app.render?.();
}



function applyPlayerFacts(cardState, player) {
  const presetKey = Object.keys(TEAM_PRESETS).find((key) => TEAM_PRESETS[key].abbr === player.abbr) || "";
  return normalizeState({
    ...cardState,
    playerName: player.name,
    playerId: player.playerId,
    playerMediaId: "",
    playerImageCategory: "",
    playerImageCredit: "",
    playerImageCapturedAt: "",
    playerImageTeamAtCapture: "",
    playerImageLicenseSnapshot: "",
    playerNumber: player.number,
    playerPosition: player.position,
    teamName: player.team,
    teamAbbr: player.abbr,
    colorPrimary: player.primary,
    colorSecondary: player.secondary,
    playerHeight: player.height,
    playerWeight: player.weight,
    playerHometown: player.hometown,
    playerDraft: player.draft,
    cardSeason: player.season,
    statGP: player.gp,
    statPPG: player.ppg,
    statRPG: player.rpg,
    statAPG: player.apg,
    statFG: player.fg,
    stat3P: player.tp,
    playerBio: player.bio,
    teamPreset: presetKey,
    // Auto-built player cards must not inherit the Cooper Flagg showcase
    // signature. The raw (un-extracted) source photo is fully opaque, so
    // rendering it here produced a solid black box over the portrait.
    signatureData: null
  });
}

function loadRemoteImageAsDataUrl(url, options = {}) {
  const {
    timeoutMs = 5500,
    maxWidth = 520,
    maxHeight = 420,
    mimeType = "image/webp",
    quality = 0.78
  } = options;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };
    const timer = window.setTimeout(() => {
      image.src = "";
      finish(null);
    }, timeoutMs);

    image.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL(mimeType, quality);
        finish(isSafeDataImage(dataUrl) ? dataUrl : null);
      } catch (error) {
        console.warn("Remote image could not be stored", url, error);
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = url;
  });
}

async function fetchPlayerHeadshot(player) {
  const settings = { maxWidth: 520, maxHeight: 380, quality: 0.76 };
  const nbaImage = await loadRemoteImageAsDataUrl(NBA_CDN.headshot(player.nbaId), settings);
  if (nbaImage) return nbaImage;
  const espnImage = await loadRemoteImageAsDataUrl(NBA_CDN.espnHeadshot(player.espnId), settings);
  if (!espnImage) console.warn(`No headshot available for ${player.name}`);
  return espnImage;
}

async function fetchTeamLogo(player) {
  if (!NBA_TEAM_IDS[player.logoCode]) return null;
  if (AUTO_LIBRARY_LOGO_CACHE.has(player.logoCode)) return AUTO_LIBRARY_LOGO_CACHE.get(player.logoCode);
  const settings = { maxWidth: 160, maxHeight: 160, quality: 0.76 };
  const request = (async () => {
    const nbaLogo = await loadRemoteImageAsDataUrl(NBA_CDN.logo(player.logoCode), settings);
    if (nbaLogo) return nbaLogo;
    return loadRemoteImageAsDataUrl(NBA_CDN.espnLogo(player.abbr), settings);
  })();
  AUTO_LIBRARY_LOGO_CACHE.set(player.logoCode, request);
  return request;
}

export {
  bindPlayerQuickAccess, applyPlayerFacts, activateTab,
  readImageFile, removePhoto, clearPlayerMediaSelection, removeLogo,
  loadRemoteImageAsDataUrl, fetchPlayerHeadshot, fetchTeamLogo
};
