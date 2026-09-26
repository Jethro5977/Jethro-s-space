// Card Builder — State management
import {
  STORAGE_KEY, PROJECT_VERSION, DEFAULT_STATE, SHOWCASE_PLAYER_IMAGE,
  SHOWCASE_TEAM_LOGO, SHOWCASE_SIGNATURE_IMAGE, SHOWCASE_SIGNATURE_SOURCE,
  SAFE_IMAGE_DATA_URL, SAFE_SIGNATURE_ASSET_URL, SAFE_UPLOAD_IMAGE_TYPES,
  TRUSTED_IMAGE_HOSTS, STYLE_META, EFFECT_META, RARITY_META, POSITION_MAP,
  TEAM_PRESETS, NBA_PLAYERS_DB, FIELD_IDS, SIGNATURE_COLOR_MAP
} from "./constants.js";
import { clamp, compactText, hashString, refs, showToast } from "./utils.js";

let PLAYER_REGISTRY_LOADED = false;
function setPlayerRegistryLoaded(val) { PLAYER_REGISTRY_LOADED = val; }
export { PLAYER_REGISTRY_LOADED, setPlayerRegistryLoaded };

function normalizeEffectIntensity(effect, value) {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? clamp(numeric, 0, 100) : 64;
  if (effect === "galaxy") return Math.min(safeValue, 10);
  if (effect === "crystal") return 32;
  if (effect === "diamond") return 18;
  return safeValue;
}

export { normalizeEffectIntensity };

function normalizePositionName(value) {
  const v = String(value || "").trim().toUpperCase();
  return POSITION_MAP[v] || v.replace(/\s+/g, " ");
}

function validatePlayerMeta(card) {
  const warnings = [];
  const registry = window.PLAYER_REGISTRY || {};
  const state = card && card.fullState ? card.fullState : (card || {});
  const playerName = String(state.playerName || (card && card.name) || "").trim();
  const key = playerName.toLowerCase().trim();
  const authoritative = registry[key];

  if (!authoritative) {
    warnings.push({ level: "info", msg: `未在球员库中找到 "${playerName}"，无法核对基础信息` });
    return warnings;
  }
  const cardTeam = String(state.teamAbbr || (card && card.team) || "").toUpperCase().trim();
  if (cardTeam && cardTeam !== authoritative.team) {
    warnings.push({ level: "error", msg: `队伍不符：卡片=${cardTeam}，官方=${authoritative.team}` });
  }
  const cardPosition = normalizePositionName(state.playerPosition);
  if (cardPosition && cardPosition !== authoritative.position) {
    warnings.push({ level: "warn", msg: `位置不符：卡片=${cardPosition}，官方=${authoritative.position}` });
  }
  if (authoritative.portraitVerified === false) {
    warnings.push({ level: "warn", msg: "配图未经人工确认" });
  }
  return warnings;
}

export { normalizePositionName, validatePlayerMeta };

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export { cloneDefaultState };

function isSafeDataImage(value) {
  return typeof value === "string" && SAFE_IMAGE_DATA_URL.test(value);
}

function isSafeSignatureImage(value) {
  return isSafeDataImage(value) || SAFE_SIGNATURE_ASSET_URL.test(value) || value === SHOWCASE_SIGNATURE_IMAGE || value === SHOWCASE_SIGNATURE_SOURCE;
}

function sanitizeMediaStateText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isSafeCardImage(value) {
  if (isSafeDataImage(value)) return true;
  if ([SHOWCASE_PLAYER_IMAGE, SHOWCASE_TEAM_LOGO].includes(value)) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      || (url.protocol === "https:" && TRUSTED_IMAGE_HOSTS.has(url.hostname));
  } catch {
    return false;
  }
}

function isSafeUploadImage(file) {
  return Boolean(file && SAFE_UPLOAD_IMAGE_TYPES.has(file.type));
}

export { isSafeDataImage, isSafeSignatureImage, sanitizeMediaStateText, isSafeCardImage, isSafeUploadImage };

function normalizeState(candidate) {
  const normalized = { ...cloneDefaultState(), ...candidate };
  const defaults = cloneDefaultState();
  const seededPlayer = NBA_PLAYERS_DB.find((player) => player.name === String(normalized.playerName || "").trim().toUpperCase());
  if (!candidate.playerId) normalized.playerId = seededPlayer?.playerId || "";
  if (!candidate.playerMediaId && normalized.playerId !== DEFAULT_STATE.playerId) {
    normalized.playerMediaId = "";
    normalized.playerImageCategory = "";
    normalized.playerImageCredit = "";
    normalized.playerImageCapturedAt = "";
    normalized.playerImageTeamAtCapture = "";
    normalized.playerImageLicenseSnapshot = "";
  }
  // Older drafts may contain explicit nulls, which override object-spread
  // defaults. Restore only absent values so valid DIY input stays untouched.
  FIELD_IDS.forEach((field) => {
    if (normalized[field] == null) normalized[field] = defaults[field];
  });
  normalized.version = PROJECT_VERSION;
  normalized.badges = Array.isArray(candidate.badges) ? candidate.badges.filter((item) => typeof item === "string") : [];
  if (!STYLE_META[normalized.style]) normalized.style = "prism";
  if (!EFFECT_META[normalized.effect]) normalized.effect = "none";
  if (!RARITY_META[normalized.rarity]) normalized.rarity = "base";
  if (!["cutout", "fullart"].includes(normalized.imageMode)) normalized.imageMode = "cutout";
  if (!["none", "magnetic", "forge", "museum", "acrylic", "crystal", "gallery"].includes(normalized.slabType)) normalized.slabType = "none";
  if (!["solid", "stripe", "sash"].includes(normalized.jerseyStyle)) normalized.jerseyStyle = "solid";
  normalized.cardThickness = candidate.cardThickness !== false;
  normalized.playerImg = isSafeCardImage(normalized.playerImg) ? normalized.playerImg : null;
  normalized.playerId = sanitizeMediaStateText(normalized.playerId, 48);
  normalized.playerMediaId = sanitizeMediaStateText(normalized.playerMediaId, 80);
  normalized.playerImageCategory = sanitizeMediaStateText(normalized.playerImageCategory, 32);
  normalized.playerImageCredit = sanitizeMediaStateText(normalized.playerImageCredit, 180);
  normalized.playerImageCapturedAt = sanitizeMediaStateText(normalized.playerImageCapturedAt, 40);
  normalized.playerImageTeamAtCapture = sanitizeMediaStateText(normalized.playerImageTeamAtCapture, 8).toUpperCase();
  normalized.playerImageLicenseSnapshot = sanitizeMediaStateText(normalized.playerImageLicenseSnapshot, 80);
  normalized.logoImg = isSafeCardImage(normalized.logoImg) ? normalized.logoImg : null;
  normalized.signatureData = isSafeSignatureImage(normalized.signatureData) ? normalized.signatureData : null;
  normalized.signatureColor = ["gold", "silver", "black", "white", "blue"].includes(normalized.signatureColor) ? normalized.signatureColor : "gold";
  normalized.signatureMode = normalized.signatureMode === "upload" ? "upload" : "draw";
  normalized.signatureThreshold = clamp(Number(normalized.signatureThreshold) || 128, 60, 220);
  normalized.signatureInvert = Boolean(normalized.signatureInvert);
  normalized.viewScale = clamp(Number(normalized.viewScale) || 1, 0.6, 1.6);
  normalized.signaturePlacement = normalized.signaturePlacement === "back" ? "back" : "front";
  normalized.signatureScale = clamp(Number(normalized.signatureScale) || 1, 0.5, 1.5);
  normalized.signatureX = clamp(Number(normalized.signatureX) || 50, 8, 92);
  normalized.signatureY = clamp(Number(normalized.signatureY) || 78, 12, 92);
  normalized.customFoilMask = isSafeDataImage(normalized.customFoilMask) ? normalized.customFoilMask : null;
  normalized.customFoilOn = Boolean(normalized.customFoilOn);
  normalized.effectIntensity = normalizeEffectIntensity(normalized.effect, normalized.effectIntensity);
  normalized.logoScale = clamp(Number(normalized.logoScale) || 100, 80, 135);
  const preset = TEAM_PRESETS[normalized.teamPreset];
  if (!preset || preset.name !== normalized.teamName || preset.abbr !== normalized.teamAbbr || preset.primary !== normalized.colorPrimary || preset.secondary !== normalized.colorSecondary) {
    normalized.teamPreset = "";
  }
  normalized.photoScale = clamp(Number(normalized.photoScale) || 100, 70, 170);
  normalized.photoX = clamp(Number(normalized.photoX) || 0, -50, 50);
  normalized.photoY = clamp(Number(normalized.photoY) || 0, -50, 50);
  normalized.rotX = Number(normalized.rotX) || 0;
  normalized.rotY = Number(normalized.rotY) || 0;
  normalized.autoRotY = 0;
  normalized.flipped = false;
  return normalized;
}

export { normalizeState };

function repairShowcaseDefaults(candidate) {
  const isShowcaseCard = String(candidate.playerName || "").toUpperCase() === "COOPER FLAGG"
    && String(candidate.teamAbbr || "").toUpperCase() === "DAL"
    && ["2", "32"].includes(String(candidate.playerNumber || ""));
  if (!isShowcaseCard) return candidate;

  const statFields = ["statGP", "statPPG", "statRPG", "statAPG", "statFG", "stat3P"];
  const statsAreEmpty = statFields.every((field) => {
    const value = String(candidate[field] ?? "").trim();
    return !value || Number(value) === 0;
  });
  return {
    ...candidate,
    logoImg: candidate.logoImg || SHOWCASE_TEAM_LOGO,
    signatureData: !candidate.signatureData || candidate.signatureData === SHOWCASE_SIGNATURE_IMAGE
      ? SHOWCASE_SIGNATURE_SOURCE
      : candidate.signatureData,
    // Repair the short-lived first showcase preset that shipped with 1.5 APG.
    statAPG: Number(candidate.statAPG) === 1.5 ? DEFAULT_STATE.statAPG : candidate.statAPG,
    ...(statsAreEmpty ? Object.fromEntries(statFields.map((field) => [field, DEFAULT_STATE[field]])) : {})
  };
}

export { repairShowcaseDefaults };

function loadInitialState() {
  const query = new URLSearchParams(window.location.search);
  // The root URL is the public gallery entry point. Keep the editable local
  // draft available behind an explicit query instead of replacing the homepage card.
  if (query.get("draft") !== "1") return cloneDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultState();
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return cloneDefaultState();
    return normalizeState(repairShowcaseDefaults({ ...cloneDefaultState(), ...saved }));
  } catch (error) {
    console.warn("Unable to load saved project", error);
    return cloneDefaultState();
  }
}

export { loadInitialState };

export let state = loadInitialState();

export function setState(newState) {
  state = newState;
}

export function getState() {
  return state;
}

function getData() {
  return {
    ...state,
    name: compactText(state.playerName, "PLAYER NAME"),
    number: compactText(state.playerNumber, "00"),
    pos: compactText(state.playerPosition, "SF"),
    posFull: POSITION_MAP[state.playerPosition] || compactText(state.playerPosition, "PLAYER"),
    team: compactText(state.teamName, "CUSTOM TEAM"),
    abbr: compactText(state.teamAbbr, "TEAM").toUpperCase().slice(0, 4),
    season: compactText(state.cardSeason, "2023-24"),
    c1: state.colorPrimary,
    c2: state.colorSecondary,
    height: compactText(state.playerHeight),
    weight: compactText(state.playerWeight),
    hometown: compactText(state.playerHometown),
    draft: compactText(state.playerDraft),
    gp: compactText(state.statGP, "0"),
    ppg: compactText(state.statPPG, "0.0"),
    rpg: compactText(state.statRPG, "0.0"),
    apg: compactText(state.statAPG, "0.0"),
    fg: compactText(state.statFG, "0.0"),
    tp: compactText(state.stat3P, "0.0"),
    cardNum: compactText(state.cardNum, "OPEN"),
    cardId: compactText(state.cardId, "CB-000"),
    bio: compactText(state.playerBio, "Custom player profile."),
    styleMeta: STYLE_META[state.style],
    effectMeta: EFFECT_META[state.effect],
    rarityMeta: RARITY_META[state.rarity]
  };
}

export { getData };

// projectSignature — moved here to avoid render<->effects circular dep
function projectSignature() {
  return JSON.stringify({
    style: state.style,
    effect: state.effect,
    effectIntensity: state.effectIntensity,
    rarity: state.rarity,
    imageMode: state.imageMode,
    badges: state.badges,
    playerName: state.playerName,
    teamAbbr: state.teamAbbr,
    teamPreset: state.teamPreset,
    jerseyStyle: state.jerseyStyle,
    cardNum: state.cardNum,
    cardThickness: state.cardThickness,
    signatureMode: state.signatureMode,
    signaturePlacement: state.signaturePlacement,
    signatureScale: state.signatureScale,
    signatureX: state.signatureX,
    signatureY: state.signatureY,
    signatureHash: hashString(state.signatureData || ""),
    customFoilOn: state.customFoilOn,
    customFoilHash: hashString(state.customFoilMask || "")
  });
}

export { projectSignature };

let saveTimer = 0;

function queueAutosave() {
  refs.saveState.textContent = "未保存";
  refs.saveState.classList.remove("saved");
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => persistLocal(true), 850);
}

function persistLocal(silent) {
  const payload = { ...state, autoRotY: 0, rotX: 0, rotY: 0, flipped: false };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    refs.saveState.textContent = "已保存";
    refs.saveState.classList.add("saved");
    if (!silent) showToast("项目已保存到本机", "success");
  } catch (error) {
    console.warn("Unable to save complete project", error);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, playerImg: null, logoImg: null }));
      refs.saveState.textContent = "已保存（不含图片）";
      if (!silent) showToast("图片较大，字段和设计配置已保存", "success");
    } catch (fallbackError) {
      refs.saveState.textContent = "保存失败";
      if (!silent) showToast("本机存储空间不足", "error");
    }
  }
}


export { queueAutosave, persistLocal };
