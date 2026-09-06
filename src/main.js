// Card Builder — Application entry point
import "./constants.js";
import { $, $$, refs, showToast, downloadBlob, safeFilename } from "./utils.js";
import {
  state, setState, getData, normalizeState, cloneDefaultState,
  queueAutosave, persistLocal, normalizeEffectIntensity,
  isSafeUploadImage, isSafeDataImage, isSafeCardImage, sanitizeMediaStateText
} from "./state.js";
import {
  STYLE_META, EFFECT_META, RARITY_META, TEAM_PRESETS, FIELD_IDS,
  SHOWCASE_PLAYER_IMAGE, SHOWCASE_TEAM_LOGO, SIGNATURE_COLOR_MAP,
  PROJECT_VERSION, STORAGE_KEY, NBA_PLAYERS_DB
} from "./constants.js";
import { app } from "./app-core.js";
import {
  render, updateInterface, hydrateInputs, emitThreePreviewState
} from "./render.js";
import { applyEffect, clearEffectLayers } from "./effects.js";
import {
  bindSignaturePad, bindSignatureUpload, syncSignatureModeUI,
  hydrateShowcaseSignatureAsset
} from "./signatures.js";
import { bindFoilMaskPad } from "./foil.js";
import {
  bindCardInteraction, animate, flipCard, resetView, toggleMotion,
  adjustZoom, rotateView, getThreePreviewState, renderThreeCardCanvas,
  setThreePreviewView
} from "./interaction.js";
import {
  bindPlayerQuickAccess, activateTab, readImageFile,
  removePhoto, clearPlayerMediaSelection, removeLogo, loadRemoteImageAsDataUrl
} from "./player-data.js";
import {
  loadLibrary, openLibraryDrawer, closeLibraryDrawer,
  updateLibraryDrawer, updatePreviewNavigationUI,
  updateAchievementsUI, bindLibraryEvents, bindV6Events, initializeV6,
  exportLibrary, importLibrary
} from "./library.js";
import { openPackExperience } from "./pack-opening.js";
import { createRipple, flashColorOutput } from "./ui-polish.js";
import { exportCard, drawCardToCanvas } from "./export.js";

function downloadProjectFile() {
  const payload = JSON.stringify({ ...state, version: PROJECT_VERSION, autoRotY: 0, rotX: 0, rotY: 0, flipped: false }, null, 2);
  downloadBlob(new Blob([payload], { type: "application/json" }), `${safeFilename(state.playerName)}_card_project.json`);
  showToast("项目文件已下载", "success");
}

function importProjectFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      setState(normalizeState(imported));
      hydrateInputs();
      render();
      showToast("项目已导入", "success");
    } catch (error) {
      console.error(error);
      showToast("项目文件格式无效", "error");
    }
    refs.projectInput.value = "";
  };
  reader.readAsText(file);
}

function resetProject() {
  if (!window.confirm("重置当前球星卡项目？")) return;
  setState(cloneDefaultState());
  localStorage.removeItem(STORAGE_KEY);
  hydrateInputs();
  render();
  showToast("项目已重置", "info");
}



function bindInterface() {
  bindPlayerQuickAccess();

  const tabButtons = $$(".tab-btn");
  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab, { reveal: true }));
    button.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabButtons.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabButtons.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      const nextButton = tabButtons[nextIndex];
      activateTab(nextButton.dataset.tab, { reveal: true });
      nextButton.focus();
    });
  });

  $$("[data-style]").forEach((button) => {
    button.addEventListener("click", () => {
      state.style = button.dataset.style;
      render();
    });
  });

  $$("[data-effect]").forEach((button) => {
    button.addEventListener("click", () => {
      state.effect = button.dataset.effect;
      state.effectIntensity = normalizeEffectIntensity(state.effect, state.effectIntensity);
      render();
    });
  });

  $$("[data-rarity]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rarity = button.dataset.rarity;
      if (state.rarity !== "base" && !state.badges.includes("numbered")) state.badges.push("numbered");
      render();
    });
  });

  $$("[data-slab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.slabType = button.dataset.slab;
      render();
    });
  });

  $$("[data-image-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.imageMode = button.dataset.imageMode;
      render();
    });
  });

  $$("[data-badge]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.badge;
      state.badges = state.badges.includes(id) ? state.badges.filter((item) => item !== id) : [...state.badges, id];
      render();
    });
  });

  FIELD_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    const eventName = element.tagName === "SELECT" || element.type === "color" ? "change" : "input";
    element.addEventListener(eventName, () => {
      state[id] = element.value;
      if (id === "playerName") {
        const matched = NBA_PLAYERS_DB.find((player) => player.name === String(element.value).trim().toUpperCase());
        const nextPlayerId = matched?.playerId || "";
        if (state.playerId !== nextPlayerId) clearPlayerMediaSelection();
        state.playerId = nextPlayerId;
      }
      if (["teamName", "teamAbbr", "colorPrimary", "colorSecondary"].includes(id)) state.teamPreset = "";
      if (id === "colorPrimary") flashColorOutput($("#colorPrimaryOut"));
      if (id === "colorSecondary") flashColorOutput($("#colorSecondaryOut"));
      render();
    });
    if (eventName === "change" && element.type === "color") {
      element.addEventListener("input", () => {
        state[id] = element.value;
        state.teamPreset = "";
        if (id === "colorPrimary") flashColorOutput($("#colorPrimaryOut"));
        if (id === "colorSecondary") flashColorOutput($("#colorSecondaryOut"));
        render();
      });
    }
  });

  ["photoScale", "photoX", "photoY", "effectIntensity"].forEach((id) => {
    const element = document.getElementById(id);
    element.addEventListener("input", () => {
      state[id] = id === "effectIntensity"
        ? normalizeEffectIntensity(state.effect, element.value)
        : Number(element.value);
      render();
    });
  });

  $("#teamPreset").addEventListener("change", (event) => {
    state.teamPreset = event.target.value;
    const preset = TEAM_PRESETS[state.teamPreset];
    if (preset) {
      state.teamName = preset.name;
      state.teamAbbr = preset.abbr;
      state.colorPrimary = preset.primary;
      state.colorSecondary = preset.secondary;
      ["teamName", "teamAbbr", "colorPrimary", "colorSecondary"].forEach((id) => {
        document.getElementById(id).value = state[id];
      });
      flashColorOutput($("#colorPrimaryOut"));
      flashColorOutput($("#colorSecondaryOut"));
    }
    render();
  });

  $("#photoUploadBtn").addEventListener("click", () => refs.photoInput.click());
  $("#logoUploadBtn").addEventListener("click", () => refs.logoInput.click());
  $("#removePhotoBtn").addEventListener("click", removePhoto);
  $("#removeLogoBtn").addEventListener("click", removeLogo);
  refs.photoInput.addEventListener("change", (event) => readImageFile(event, "playerImg"));
  refs.logoInput.addEventListener("change", (event) => readImageFile(event, "logoImg"));

  refs.cardThicknessToggle.addEventListener("change", (event) => {
    state.cardThickness = event.target.checked;
    render();
  });

  refs.motionBtn.addEventListener("click", toggleMotion);
  refs.flipBtn.addEventListener("click", flipCard);
  refs.resetViewBtn.addEventListener("click", resetView);
  refs.zoomOutBtn.addEventListener("click", () => adjustZoom(-0.1));
  refs.zoomInBtn.addEventListener("click", () => adjustZoom(0.1));
  refs.rotateLeftBtn.addEventListener("click", () => rotateView(-90));
  refs.rotateRightBtn.addEventListener("click", () => rotateView(90));

  $("#saveProjectBtn").addEventListener("click", () => persistLocal(false));
  $("#saveLocalBtn").addEventListener("click", () => persistLocal(false));
  $("#loadProjectBtn").addEventListener("click", () => refs.projectInput.click());
  $("#importProjectBtn").addEventListener("click", () => refs.projectInput.click());
  $("#downloadProjectBtn").addEventListener("click", downloadProjectFile);
  $("#resetProjectBtn").addEventListener("click", resetProject);
  refs.projectInput.addEventListener("change", importProjectFile);

  $$("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportCard(button.dataset.export));
  });

  bindCardInteraction();
}


// === 共享库接口（PRD v2.0 §6）===
window.CardBuilder = window.CardBuilder || {};

// 接口 1：获取当前完整状态
window.CardBuilder.getFullState = function () {
  if (!state) return null;
  return {
    id: String(state.cardId || `cb_${Date.now().toString(36)}`),
    name: state.playerName || "UNTITLED",
    team: state.teamAbbr || "N/A",
    style: state.style,
    effect: state.effect,
    rarity: state.rarity,
    slabType: state.slabType,
    badges: Array.isArray(state.badges) ? [...state.badges] : [],
    fullState: JSON.parse(JSON.stringify({
      ...state,
      rotX: 0,
      rotY: 0,
      autoRotY: 0,
      flipped: false,
      viewScale: 1,
      motionOn: true,
    })),
  };
};

// 接口 2：生成当前卡面缩略图（data URL）
window.CardBuilder.captureThumbnail = async function (width = 360, height = 504, format = "image/jpeg") {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  await drawCardToCanvas(context, getData(), "front", 0, 0, width, height);
  return canvas.toDataURL(format, 0.74);
};

// 接口 3：加载完整状态到编辑器
window.CardBuilder.loadFullState = function (fullState) {
  if (!fullState || typeof fullState !== "object") return;
  setState(normalizeState(fullState));
  hydrateInputs();
  render();
};

// Player Media Library bridge. The separate selector module never mutates the
// editor's internal state directly, keeping old projects and manual uploads compatible.
window.CardBuilderMediaBridge = {
  getCurrentPlayer() {
    const key = String(state.playerName || "").trim().toLowerCase();
    const registered = window.PLAYER_REGISTRY?.[key];
    const seeded = NBA_PLAYERS_DB.find((player) => player.name.toLowerCase() === key);
    return {
      playerId: state.playerId || registered?.playerId || seeded?.playerId || "",
      displayName: registered?.displayName || seeded?.name || state.playerName || "",
      currentTeam: registered?.team || seeded?.abbr || state.teamAbbr || "",
      playerMediaId: state.playerMediaId || "",
    };
  },
  async applyMedia(media) {
    if (!media || typeof media !== "object" || !isSafeCardImage(media.cardUrl)) return false;
    const localImage = isSafeDataImage(media.cardUrl)
      ? media.cardUrl
      : await loadRemoteImageAsDataUrl(media.cardUrl, {
        timeoutMs: 8000,
        maxWidth: 900,
        maxHeight: 1260,
        mimeType: "image/webp",
        quality: 0.88,
      });
    if (!localImage) {
      showToast("影像加载失败，请稍后重试或使用上传照片", "warning");
      return false;
    }
    state.playerId = sanitizeMediaStateText(media.playerId, 48);
    state.playerMediaId = sanitizeMediaStateText(media.mediaId, 80);
    state.playerImageCategory = sanitizeMediaStateText(media.category, 32);
    state.playerImageCredit = sanitizeMediaStateText(media.creditLine, 180);
    state.playerImageCapturedAt = sanitizeMediaStateText(media.capturedAt, 40);
    state.playerImageTeamAtCapture = sanitizeMediaStateText(media.teamAtCapture, 8).toUpperCase();
    state.playerImageLicenseSnapshot = sanitizeMediaStateText(media.licenseStatus, 80);
    state.playerImg = localImage;
    state.imageMode = "fullart";
    hydrateInputs();
    render();
    showToast("球员影像已应用到卡牌", "success");
    return true;
  },
};



// ===== 3D PREVIEW BRIDGE =====
window.cardBuilder3D = {
  getState: getThreePreviewState,
  renderCardCanvas: renderThreeCardCanvas,
  setView: setThreePreviewView,
  flip: flipCard,
  reset: resetView,
  toggleMotion
};

// ===== BOOT SEQUENCE =====
bindSignaturePad();
bindSignatureUpload();
bindFoilMaskPad();
hydrateInputs();
bindInterface();
render();
hydrateShowcaseSignatureAsset();
requestAnimationFrame(animate);
initializeV6();

export { downloadProjectFile, importProjectFile, resetProject };
