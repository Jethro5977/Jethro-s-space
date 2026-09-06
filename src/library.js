// Card Builder — Card library, achievements & auto-build
import {
  LIBRARY_STORAGE_KEY, LIBRARY_ASSET_DB_NAME, LIBRARY_ASSET_STORE,
  LIBRARY_MAX_CARDS, STYLE_META, EFFECT_META, RARITY_META,
  TEAM_PRESETS, NBA_PLAYERS_DB, NBA_CDN, NBA_TEAM_IDS,
  KNOWN_LIBRARY_SOURCES, AUTO_LIBRARY_SOURCE, AUTO_LIBRARY_DATA_VERSION,
  CURATED_LIBRARY_URL, CURATED_SHOWCASE_SOURCE, CURATED_PLAYER_MEDIA_SOURCE,
  DEFAULT_STATE, SHOWCASE_PLAYER_IMAGE, SHOWCASE_TEAM_LOGO
} from "./constants.js";
import {
  $, $$, refs, clamp, downloadBlob, loadCanvasImage, adjustColor,
  sleep, hashString, mulberry32, showToast
} from "./utils.js";
import {
  state, setState, normalizeState, isSafeDataImage, isSafeCardImage,
  getData, cloneDefaultState, setPlayerRegistryLoaded
} from "./state.js";
import { app } from "./app-core.js";
import {
  applyPlayerFacts, clearPlayerMediaSelection, fetchPlayerHeadshot,
  fetchTeamLogo, loadRemoteImageAsDataUrl
} from "./player-data.js";
import { drawCardToCanvas } from "./export.js";

export let currentPreviewLibraryCardId = "curated_showcase_cooper_flagg";
export let libraryFilterState = { rarity: "all", style: "all", slab: "all", favOnly: false };
export let compareMode = false;
export let compareSelections = [];
let libraryReturnFocus = null;
let autoBuildHideTimer = 0;
let lastLibraryTouchAction = null;

const PRESET_CARD_COLORS = [
  "#552583", "#1d428a", "#ce1141", "#007a33", "#00538c",
  "#98002e", "#1d1160", "#00471b", "#0e2240", "#17171b"
];

const ACHIEVEMENTS = [
  { id: "first_card", code: "01", name: "FIRST PULL", desc: "保存第一张卡到卡牌库", check: (lib) => lib.cards.length >= 1 },
  { id: "collector_10", code: "10", name: "STARTER PACK", desc: "收集 10 张卡片", check: (lib) => lib.cards.length >= 10 },
  { id: "collector_50", code: "50", name: "SERIOUS COLLECTOR", desc: "收集 50 张卡片", check: (lib) => lib.cards.length >= 50 },
  { id: "collector_100", code: "100", name: "MUSEUM CURATOR", desc: "收集 100 张卡片", check: (lib) => lib.cards.length >= 100 },
  { id: "all_styles", code: "S6", name: "STYLE MASTER", desc: "集齐全部 6 种卡面系列", check: (lib) => hasEveryValue(lib, "style", Object.keys(STYLE_META)) },
  { id: "all_rarities", code: "R6", name: "RAINBOW COMPLETE", desc: "集齐全部 6 种稀有度", check: (lib) => hasEveryValue(lib, "rarity", Object.keys(RARITY_META)) },
  { id: "gold_5", code: "G5", name: "GOLD RUSH", desc: "拥有 5 张 GOLD 卡", check: (lib) => countBy(lib, "rarity", "gold") >= 5 },
  { id: "black_1", code: "1/1", name: "ONE OF ONE", desc: "拥有 BLACK 1/1 卡", check: (lib) => countBy(lib, "rarity", "black") >= 1 },
  { id: "neon_3", code: "N3", name: "NEON NIGHTS", desc: "拥有 3 张 NEON 卡", check: (lib) => countBy(lib, "rarity", "neon") >= 3 },
  { id: "all_slabs", code: "C7", name: "CASE COLLECTOR", desc: "集齐全部 7 种卡壳", check: (lib) => hasEveryValue(lib, "slabType", ["none", "magnetic", "forge", "museum", "acrylic", "crystal", "gallery"]) },
  { id: "acrylic_3", code: "A3", name: "ICE COLD", desc: "拥有 3 张厚亚克力封装卡", check: (lib) => countBy(lib, "slabType", "acrylic") >= 3 },
  { id: "slabbed_10", code: "C10", name: "SEALED VAULT", desc: "拥有 10 张封装卡", check: (lib) => lib.cards.filter((card) => card.slabType !== "none").length >= 10 },
  { id: "all_effects", code: "FX", name: "SPECIAL FX", desc: "集齐全部 7 种卡面特效", check: (lib) => hasEveryValue(lib, "effect", Object.keys(EFFECT_META)) },
  { id: "team_5", code: "T5", name: "TEAM BUILDER", desc: "收集 5 个不同球队", check: (lib) => new Set(lib.cards.map((card) => card.team)).size >= 5 },
  { id: "same_player_5", code: "P5", name: "SUPERFAN", desc: "同一球员拥有 5 个版本", check: (lib) => maxNameCount(lib.cards) >= 5 },
  { id: "rookie_card", code: "RC", name: "ROOKIE SPOTLIGHT", desc: "拥有带 RC 徽章的卡片", check: (lib) => lib.cards.some((card) => card.badges.includes("rc")) },
  { id: "auto_card", code: "AU", name: "AUTOGRAPH HUNTER", desc: "拥有带 AUTO 徽章的卡片", check: (lib) => lib.cards.some((card) => card.badges.includes("auto")) },
  { id: "favorite_5", code: "F5", name: "FAVORITES", desc: "收藏 5 张喜爱的卡片", check: (lib) => lib.cards.filter((card) => card.favorite).length >= 5 },
  { id: "daily_3", code: "D3", name: "DAILY GRINDER", desc: "单日内制作 3 张卡片", check: (lib) => cardsCreatedToday(lib.cards) >= 3 },
  { id: "complete_set", code: "ALL", name: "COMPLETIONIST", desc: "解锁其他所有成就", check: (lib) => ACHIEVEMENTS.filter((item) => item.id !== "complete_set").every((item) => lib.achievements[item.id]) }
];



function generateCardId() {
  return `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyLibrary() {
  return { cards: [], achievements: {}, stats: { packsOpened: 0 } };
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return createEmptyLibrary();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cards)) return createEmptyLibrary();
    return {
      cards: parsed.cards.slice(0, LIBRARY_MAX_CARDS).map(normalizeLibraryCard).filter(Boolean),
      achievements: parsed.achievements && typeof parsed.achievements === "object" ? parsed.achievements : {},
      stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : { packsOpened: 0 }
    };
  } catch (error) {
    console.warn("Library load failed", error);
    return createEmptyLibrary();
  }
}

function normalizeLibraryCard(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const fullState = normalizeState(candidate.fullState && typeof candidate.fullState === "object" ? candidate.fullState : candidate);
  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : generateCardId(),
    name: String(candidate.name || fullState.playerName || "UNTITLED").slice(0, 80),
    team: String(candidate.team || fullState.teamAbbr || "N/A").slice(0, 12),
    style: STYLE_META[candidate.style] ? candidate.style : fullState.style,
    effect: EFFECT_META[candidate.effect] ? candidate.effect : fullState.effect,
    rarity: RARITY_META[candidate.rarity] ? candidate.rarity : fullState.rarity,
    slabType: ["none", "magnetic", "forge", "museum", "acrylic", "crystal", "gallery"].includes(candidate.slabType) ? candidate.slabType : fullState.slabType,
    badges: Array.isArray(candidate.badges) ? candidate.badges.filter((badge) => typeof badge === "string").slice(0, 12) : [...fullState.badges],
    thumbnail: isSafeCardImage(candidate.thumbnail) ? candidate.thumbnail : createLibraryPlaceholder(fullState),
    fullState,
    createdAt: Number.isFinite(Number(candidate.createdAt)) ? Number(candidate.createdAt) : Date.now(),
    favorite: Boolean(candidate.favorite),
    source: KNOWN_LIBRARY_SOURCES.has(candidate.source) ? candidate.source : "manual",
    sourcePlayerId: candidate.sourcePlayerId ? String(candidate.sourcePlayerId) : "",
    sourceDataVersion: Number.isFinite(Number(candidate.sourceDataVersion)) ? Number(candidate.sourceDataVersion) : 0
  };
}

function createLibraryPlaceholder(cardState) {
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 252;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, cardState.colorPrimary || "#252934");
  gradient.addColorStop(1, cardState.colorSecondary || "#101218");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,.34)";
  context.lineWidth = 3;
  context.strokeRect(12, 12, 156, 228);
  context.fillStyle = "rgba(255,255,255,.72)";
  context.font = "700 12px sans-serif";
  context.textAlign = "center";
  context.fillText(String(cardState.teamAbbr || "CARD").slice(0, 8), 90, 56);
  context.fillStyle = "#ffffff";
  context.font = "800 15px sans-serif";
  context.fillText(String(cardState.playerName || "UNTITLED").slice(0, 18), 90, 204);
  return canvas.toDataURL("image/jpeg", 0.64);
}

async function saveLibraryResilient(library) {
  const payload = {
    cards: library.cards.slice(0, LIBRARY_MAX_CARDS),
    achievements: library.achievements || {},
    stats: library.stats || { packsOpened: 0 }
  };
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Library save failed; retrying with smaller thumbnails", error);
  }

  try {
    const compressedCards = await Promise.all(payload.cards.map(async (card) => ({
      ...card,
      thumbnail: card.thumbnail ? await compressThumbnail(card.thumbnail) : null
    })));
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ ...payload, cards: compressedCards }));
    library.cards = compressedCards;
    return true;
  } catch (error) {
    console.warn("Compressed library save failed", error);
  }

  // Keep originals outside localStorage when the library grows beyond its quota.
  // IndexedDB has room for source-quality uploads, while localStorage keeps only card metadata.
  try {
    const assetBackedCards = await Promise.all(payload.cards.map(offloadLibraryCardImages));
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ ...payload, cards: assetBackedCards }));
    library.cards = assetBackedCards;
    return true;
  } catch (error) {
    console.warn("Asset-backed library save failed", error);
  }

  // Last-resort fallback for browsers where IndexedDB is unavailable.
  try {
    const compactedCards = await Promise.all(payload.cards.map(async (card) => ({
      ...card,
      thumbnail: card.thumbnail ? await compressThumbnail(card.thumbnail) : null,
      fullState: {
        ...card.fullState,
        playerImg: await compactStoredImage(card.fullState?.playerImg, 1080, 1350, 0.88),
        logoImg: await compactStoredImage(card.fullState?.logoImg, 180, 180, 0.82)
      }
    })));
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ ...payload, cards: compactedCards }));
    library.cards = compactedCards;
    return true;
  } catch (error) {
    console.warn("Compact library save failed; keeping text-only card snapshots", error);
  }

  try {
    const minimalCards = payload.cards.map((card) => ({
      ...card,
      thumbnail: null,
      fullState: { ...card.fullState, playerImg: null, logoImg: null }
    }));
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ ...payload, cards: minimalCards }));
    library.cards = minimalCards;
    showToast("已保存卡片资料，部分图片将在下次联网时重新加载", "success");
    return true;
  } catch (error) {
    console.warn("Minimal library save failed", error);
    showToast("卡牌库存储空间不足，请先导出并移除部分卡片", "error");
    return false;
  }
}

function openLibraryAssetDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = window.indexedDB.open(LIBRARY_ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LIBRARY_ASSET_STORE)) {
        database.createObjectStore(LIBRARY_ASSET_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open image library"));
  });
}

async function writeLibraryImageAsset(id, dataUrl) {
  const database = await openLibraryAssetDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(LIBRARY_ASSET_STORE, "readwrite");
      transaction.objectStore(LIBRARY_ASSET_STORE).put({ id, dataUrl, updatedAt: Date.now() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Unable to store image asset"));
      transaction.onabort = () => reject(transaction.error || new Error("Image asset transaction aborted"));
    });
  } finally {
    database.close();
  }
}

async function readLibraryImageAsset(id) {
  if (!id) return null;
  const database = await openLibraryAssetDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(LIBRARY_ASSET_STORE, "readonly");
      const request = transaction.objectStore(LIBRARY_ASSET_STORE).get(id);
      request.onsuccess = () => resolve(isSafeDataImage(request.result?.dataUrl) ? request.result.dataUrl : null);
      request.onerror = () => reject(request.error || new Error("Unable to read image asset"));
    });
  } finally {
    database.close();
  }
}

async function offloadLibraryCardImages(card) {
  const fullState = { ...card.fullState };
  for (const field of ["playerImg", "logoImg"]) {
    const image = fullState[field];
    if (!isSafeDataImage(image)) continue;
    const assetId = `${card.id}:${field}`;
    await writeLibraryImageAsset(assetId, image);
    fullState[`${field}AssetId`] = assetId;
    fullState[field] = null;
  }
  return { ...card, fullState };
}

async function restoreLibraryCardImages(cardState) {
  const restored = {};
  for (const field of ["playerImg", "logoImg"]) {
    if (isSafeDataImage(cardState[field]) || !cardState[`${field}AssetId`]) continue;
    restored[field] = await readLibraryImageAsset(cardState[`${field}AssetId`]);
  }
  return restored;
}

async function compressThumbnail(dataUrl) {
  const image = await loadCanvasImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 252;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.55);
}

async function compactStoredImage(dataUrl, maxWidth, maxHeight, quality) {
  if (!isSafeDataImage(dataUrl)) return null;
  try {
    const image = await loadCanvasImage(dataUrl);
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compacted = canvas.toDataURL("image/webp", quality);
    return isSafeDataImage(compacted) ? compacted : null;
  } catch (error) {
    console.warn("Stored image compaction failed", error);
    return null;
  }
}

async function saveToLibrary() {
  document.querySelectorAll("#saveToLibraryBtn, #saveToLibraryMainBtn").forEach((btn) => {
    btn.classList.add("saving");
    setTimeout(() => btn.classList.remove("saving"), 650);
  });
  const library = loadLibrary();
  if (library.cards.length >= LIBRARY_MAX_CARDS) {
    showToast(`卡牌库已满，上限 ${LIBRARY_MAX_CARDS} 张`, "warning");
    return;
  }

  showToast("正在生成卡牌快照...", "info");
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 504;
  const context = canvas.getContext("2d");
  const data = getData();
  await drawCardToCanvas(context, data, "front", 0, 0, canvas.width, canvas.height);

  const fullState = JSON.parse(JSON.stringify({
    ...state,
    rotX: 0,
    rotY: 0,
    autoRotY: 0,
    flipped: false,
    viewScale: 1,
    motionOn: true
  }));
  let card = normalizeLibraryCard({
    id: generateCardId(),
    name: state.playerName,
    team: state.teamAbbr,
    style: state.style,
    effect: state.effect,
    rarity: state.rarity,
    slabType: state.slabType,
    badges: [...state.badges],
    thumbnail: canvas.toDataURL("image/jpeg", 0.74),
    fullState,
    createdAt: Date.now(),
    favorite: false
  });
  // Keep upload originals outside the JSON payload from the first save. This
  // avoids the legacy low-resolution fallback when browser storage fills up.
  try {
    card = await offloadLibraryCardImages(card);
  } catch (error) {
    console.warn("Could not create an IndexedDB image copy", error);
  }

  library.cards.unshift(card);
  const unlocks = checkAchievements(library);
  if (!await saveLibraryResilient(library)) return;
  updateLibraryDrawer();
  updateBackgroundMosaic();
  announceAchievements(unlocks);
  showToast(`${state.playerName} 已保存到卡牌库`, "success");
}



const AUTO_LIBRARY_POOLS = {
  style: ["prism", "tactical", "heritage", "mosaic", "select", "optic"],
  effect: ["none", "none", "none", "diamond", "lightning", "rainbow", "crystal", "holographic", "laser", "flame", "galaxy"],
  rarity: ["base", "base", "base", "base", "silver", "silver", "gold", "neon", "rwb", "black"],
  slabType: ["none", "none", "magnetic", "magnetic", "forge", "museum", "acrylic", "crystal", "gallery"],
  jerseyStyle: ["solid", "stripe", "sash"]
};
const AUTO_LIBRARY_LOGO_CACHE = new Map();

function shuffleValues(values) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function buildBalancedPool(values, count) {
  const result = [];
  while (result.length < count) result.push(...shuffleValues(values));
  return result.slice(0, count);
}

function createAutoBuildPlan(count) {
  return Object.fromEntries(Object.entries(AUTO_LIBRARY_POOLS).map(([key, values]) => [key, buildBalancedPool(values, count)]));
}

function pickRandomBadges(player, rarity) {
  const badges = [];
  if (player.isRookie) badges.push("rc");
  if (rarity !== "base" && Math.random() > 0.3) badges.push("numbered");
  if (Number.parseFloat(player.ppg) >= 25 && Math.random() > 0.4) badges.push("allstar");
  if (Math.random() > 0.75) badges.push("auto");
  if (Math.random() > 0.85) badges.push("mvp");
  return [...new Set(badges)];
}


function createPlayerCardState(player, plan, index) {
  const style = plan.style[index];
  const effect = plan.effect[index];
  const rarity = plan.rarity[index];
  const slabType = plan.slabType[index];
  const serialMax = rarity === "black" ? 1 : rarity === "gold" ? 10 : rarity === "neon" ? 75 : rarity === "rwb" ? 49 : 199;
  const serial = rarity === "black" ? "1/1" : `${Math.ceil(Math.random() * serialMax)}/${serialMax}`;
  const grade = rarity === "black" ? "10" : rarity === "gold" ? "9.5" : String(8 + Math.floor(Math.random() * 5) * 0.5);

  return applyPlayerFacts({
    ...cloneDefaultState(),
    style,
    effect,
    effectIntensity: effect === "none" ? 80 : effect === "lightning" ? 20 : 60 + Math.floor(Math.random() * 31),
    rarity,
    slabType,
    badges: pickRandomBadges(player, rarity),
    imageMode: "cutout",
    gradeValue: grade,
    cardNum: serial,
    cardId: `CB-${String(Math.ceil(Math.random() * 999)).padStart(3, "0")}`,
    jerseyStyle: plan.jerseyStyle[index],
    playerImg: null,
    logoImg: null,
    cardThickness: true,
    motionOn: true,
    rotX: 0,
    rotY: 0,
    autoRotY: 0,
    flipped: false,
    viewScale: 1
  }, player);
}

async function createAutoLibraryThumbnail(cardState) {
  const previousState = state;
  try {
    setState(normalizeState(cardState));
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 504;
    const context = canvas.getContext("2d");
    await drawCardToCanvas(context, getData(), "front", 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.62);
  } catch (error) {
    console.warn(`Thumbnail generation failed for ${cardState.playerName}`, error);
    return createLibraryPlaceholder(cardState);
  } finally {
    setState(previousState);
  }
}


function migrateLegacyAutoLibrary(library) {
  const rosterNames = new Set(NBA_PLAYERS_DB.map((player) => player.name));
  const legacyCards = library.cards.filter((card) => card.source === "manual"
    && card.sourceDataVersion === 0
    && rosterNames.has(card.name.trim().toUpperCase()));
  const legacyNames = new Set(legacyCards.map((card) => card.name.trim().toUpperCase()));

  // Early V7 builds omitted source metadata. A near-complete roster is a strong
  // enough fingerprint to migrate the batch without touching ordinary DIY cards.
  if (legacyNames.size < 20) return { migrated: 0, consolidated: 0 };

  const migratedIds = new Set();
  for (const player of NBA_PLAYERS_DB) {
    const legacy = legacyCards.find((card) => card.name.trim().toUpperCase() === player.name);
    if (!legacy) continue;
    legacy.source = AUTO_LIBRARY_SOURCE;
    legacy.sourcePlayerId = player.nbaId;
    legacy.sourceDataVersion = 0;
    migratedIds.add(legacy.id);
  }

  let consolidated = 0;
  library.cards = library.cards.filter((card) => {
    if (migratedIds.has(card.id)) return true;
    const name = card.name.trim().toUpperCase();
    if (!rosterNames.has(name) || card.source !== AUTO_LIBRARY_SOURCE) return true;
    consolidated += 1;
    return false;
  });
  return { migrated: migratedIds.size, consolidated };
}

function isShowcaseLibraryCard(card) {
  return card?.source === CURATED_SHOWCASE_SOURCE
    || card?.id === "curated_showcase_cooper_flagg"
    || card?.fullState?.playerMediaId === "pm_project_cooper_flagg_showcase";
}

async function installCuratedLibrary() {
  const library = loadLibrary();
  const legacyMigration = migrateLegacyAutoLibrary(library);
  const initialCards = [...library.cards];
  const withoutInitialBatch = library.cards.filter((card) => card.source !== AUTO_LIBRARY_SOURCE);
  const removedInitial = library.cards.length - withoutInitialBatch.length;

  let seedCards = [];
  try {
    const response = await fetch(CURATED_LIBRARY_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Curated library request failed (${response.status})`);
    const payload = await response.json();
    seedCards = Array.isArray(payload?.cards)
      ? payload.cards.map(normalizeLibraryCard).filter(Boolean)
      : [];
  } catch (error) {
    console.warn("Curated library load failed", error);
  }

  if (seedCards.length) {
    const seedIds = new Set(seedCards.map((card) => card.id));
    const existingShowcase = withoutInitialBatch.find(isShowcaseLibraryCard);
    const existingById = new Map(withoutInitialBatch.map((card) => [card.id, card]));
    // 被移出精选库的托管卡（curated-player-media）必须随种子清理，
    // 只保留用户自己保存的 DIY 卡与官方展示卡。
    const userCards = withoutInitialBatch.filter((card) =>
      !seedIds.has(card.id)
      && card.source !== CURATED_PLAYER_MEDIA_SOURCE
      && !isShowcaseLibraryCard(card)
    );
    const hydratedSeed = seedCards.map((card) => {
      const existing = card.source === CURATED_SHOWCASE_SOURCE ? existingShowcase : existingById.get(card.id);
      return existing
        ? { ...card, favorite: existing.favorite, createdAt: existing.createdAt || card.createdAt }
        : card;
    });
    library.cards = [...hydratedSeed, ...userCards].slice(0, LIBRARY_MAX_CARDS);
  } else {
    library.cards = withoutInitialBatch;
  }

  const beforeSignature = initialCards.map((card) => `${card.id}:${card.source}:${card.sourceDataVersion}`).join("|");
  const afterSignature = library.cards.map((card) => `${card.id}:${card.source}:${card.sourceDataVersion}`).join("|");
  const changed = beforeSignature !== afterSignature
    || legacyMigration.migrated > 0
    || legacyMigration.consolidated > 0;
  if (changed) {
    library.achievements = {};
    checkAchievements(library);
    await saveLibraryResilient(library);
  }
  const curatedMediaCount = library.cards.filter((card) => card.source === CURATED_PLAYER_MEDIA_SOURCE).length;
  return { library, removedInitial, curatedCount: seedCards.length, curatedMediaCount, changed };
}

async function autoBuildLibrary(progressCallback) {
  const library = loadLibrary();
  const legacyMigration = migrateLegacyAutoLibrary(library);
  const createTasks = [];
  const repairTasks = [];
  let alreadyCurrent = 0;

  for (const player of NBA_PLAYERS_DB) {
    const playerName = player.name.trim().toUpperCase();
    const existingIndex = library.cards.findIndex((card) => card.source === AUTO_LIBRARY_SOURCE
      && (card.sourcePlayerId === player.nbaId || card.name.trim().toUpperCase() === playerName));
    if (existingIndex === -1) {
      createTasks.push({ type: "create", player, libraryIndex: -1 });
      continue;
    }
    const existing = library.cards[existingIndex];
    const factsChanged = existing.sourcePlayerId !== player.nbaId
      || existing.name.trim().toUpperCase() !== playerName
      || existing.team !== player.abbr
      || existing.fullState.playerNumber !== player.number
      || existing.fullState.cardSeason !== player.season;
    if (existing.sourceDataVersion < AUTO_LIBRARY_DATA_VERSION || factsChanged) {
      repairTasks.push({ type: "repair", player, libraryIndex: existingIndex });
    } else {
      alreadyCurrent += 1;
    }
  }

  const capacity = Math.max(0, LIBRARY_MAX_CARDS - library.cards.length);
  const queuedCreates = createTasks.slice(0, capacity);
  const queue = [...repairTasks, ...queuedCreates];

  if (!queue.length) {
    return {
      created: 0,
      repaired: 0,
      skipped: alreadyCurrent,
      total: 0,
      partial: createTasks.length > 0,
      consolidated: legacyMigration.consolidated
    };
  }

  const originalState = JSON.parse(JSON.stringify(state));
  const plan = createAutoBuildPlan(queue.length);
  let created = 0;
  let repaired = 0;
  let persistedCreated = 0;
  let persistedRepaired = 0;

  try {
    for (let index = 0; index < queue.length; index++) {
      const task = queue[index];
      const player = task.player;
      progressCallback?.(created + repaired, queue.length, player.name, "assets");
      const existingCard = task.type === "repair" ? library.cards[task.libraryIndex] : null;
      const cardState = existingCard
        ? applyPlayerFacts(existingCard.fullState, player)
        : createPlayerCardState(player, plan, index);
      // Cap lightning intensity so the effect doesn't obscure the portrait
      if (cardState.effect === "lightning" && cardState.effectIntensity > 20) {
        cardState.effectIntensity = 20;
      }
      const [playerImg, logoImg] = await Promise.all([
        fetchPlayerHeadshot(player),
        fetchTeamLogo(player)
      ]);
      cardState.playerImg = playerImg;
      cardState.logoImg = logoImg;

      progressCallback?.(created + repaired, queue.length, player.name, "render");
      const thumbnail = await createAutoLibraryThumbnail(cardState);
      let card = normalizeLibraryCard({
        ...(existingCard || {}),
        id: existingCard?.id || generateCardId(),
        name: cardState.playerName,
        team: cardState.teamAbbr,
        style: cardState.style,
        effect: cardState.effect,
        rarity: cardState.rarity,
        slabType: cardState.slabType,
        badges: [...cardState.badges],
        thumbnail,
        fullState: cardState,
        createdAt: existingCard?.createdAt || Date.now() + index,
        favorite: existingCard?.favorite || false,
        source: AUTO_LIBRARY_SOURCE,
        sourcePlayerId: player.nbaId,
        sourceDataVersion: AUTO_LIBRARY_DATA_VERSION
      });
      try {
        card = await offloadLibraryCardImages(card);
      } catch (error) {
        console.warn("Could not create an IndexedDB image copy", error);
      }

      if (existingCard) {
        library.cards[task.libraryIndex] = card;
        repaired += 1;
      } else {
        library.cards.push(card);
        created += 1;
      }
      const completed = created + repaired;
      progressCallback?.(completed, queue.length, player.name, "saved");

      if (completed % 5 === 0 || completed === queue.length) {
        const unlocks = checkAchievements(library);
        if (!await saveLibraryResilient(library)) {
          const storageError = new Error("Library storage quota reached");
          storageError.persistedCreated = persistedCreated;
          storageError.persistedRepaired = persistedRepaired;
          throw storageError;
        }
        persistedCreated = created;
        persistedRepaired = repaired;
        announceAchievements(unlocks);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
  } finally {
    setState(normalizeState(originalState));
    app.hydrateInputs();
    app.render();
    updateLibraryDrawer();
    updateBackgroundMosaic();
  }

  return {
    created: persistedCreated,
    repaired: persistedRepaired,
    skipped: alreadyCurrent,
    total: queue.length,
    partial: queuedCreates.length < createTasks.length,
    consolidated: legacyMigration.consolidated
  };
}


function resolvePreviewLibraryIndex(cards) {
  if (!cards.length) return -1;
  let index = cards.findIndex((card) => card.id === currentPreviewLibraryCardId);
  if (index < 0 && state.playerMediaId) {
    index = cards.findIndex((card) => card.fullState?.playerMediaId === state.playerMediaId);
  }
  return index < 0 ? 0 : index;
}

function updatePreviewNavigationUI(library = loadLibrary()) {
  const cards = library.cards || [];
  const index = resolvePreviewLibraryIndex(cards);
  if (index >= 0) currentPreviewLibraryCardId = cards[index].id;
  const position = $("#previewCardPosition");
  const prev = $("#previewPrevBtn");
  const next = $("#previewNextBtn");
  if (position) position.textContent = cards.length ? `${index + 1} / ${cards.length}` : "0 / 0";
  [prev, next].forEach((button) => {
    if (button) button.disabled = cards.length < 2;
  });
}

async function navigateLibraryCard(direction) {
  const library = loadLibrary();
  const cards = library.cards || [];
  if (cards.length < 2) return;
  const index = resolvePreviewLibraryIndex(cards);
  const nextIndex = (index + direction + cards.length) % cards.length;
  await loadFromLibrary(cards[nextIndex].id, { closeDrawer: false, notify: false });
}

async function loadFromLibrary(cardId, options = {}) {
  const { closeDrawer = true, notify = true } = options;
  const card = loadLibrary().cards.find((item) => item.id === cardId);
  if (!card) {
    showToast("未找到该卡片", "warning");
    return;
  }
  currentPreviewLibraryCardId = card.id;
  setState(normalizeState(card.fullState));
  app.hydrateInputs();
  app.render();
  updatePreviewNavigationUI();
  if (closeDrawer) closeLibraryDrawer();
  if (notify) showToast(`已加载 ${card.name}`, "success");

  try {
    const restoredImages = await restoreLibraryCardImages(card.fullState);
    if (!Object.values(restoredImages).some(Boolean)) return;
    setState(normalizeState({ ...state, ...restoredImages }));
    app.hydrateInputs();
    app.render();
    updatePreviewNavigationUI();
  } catch (error) {
    console.warn("Unable to restore source-quality library images", error);
  }
}

async function removeFromLibrary(cardId) {
  if (!window.confirm("确定从卡牌库中移除这张卡片？")) return;
  const library = loadLibrary();
  library.cards = library.cards.filter((card) => card.id !== cardId);
  if (!await saveLibraryResilient(library)) return;
  updateLibraryDrawer();
  updateBackgroundMosaic();
  showToast("卡片已从库中移除", "success");
}

async function toggleFavorite(cardId) {
  const library = loadLibrary();
  const card = library.cards.find((item) => item.id === cardId);
  if (!card) return;
  card.favorite = !card.favorite;
  const unlocks = checkAchievements(library);
  if (!await saveLibraryResilient(library)) return;
  updateLibraryDrawer();
  announceAchievements(unlocks);
}



function exportLibrary() {
  const library = loadLibrary();
  if (!library.cards.length) {
    showToast("卡牌库为空", "warning");
    return;
  }
  downloadBlob(new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }), `card_library_${Date.now()}.json`);
  showToast(`已导出 ${library.cards.length} 张卡片`, "success");
}

function importLibrary(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.cards)) throw new Error("Invalid library format");
      const library = loadLibrary();
      const existingIndexes = new Map(library.cards.map((card, index) => [card.id, index]));
      let added = 0;
      let updated = 0;
      for (const candidate of imported.cards) {
        const card = normalizeLibraryCard(candidate);
        if (!card) continue;
        const existingIndex = existingIndexes.get(card.id);
        if (existingIndex !== undefined) {
          const existing = library.cards[existingIndex];
          const incomingVersion = Number(card.sourceDataVersion || 0);
          const existingVersion = Number(existing.sourceDataVersion || 0);
          if (incomingVersion > existingVersion) {
            library.cards[existingIndex] = {
              ...card,
              favorite: Boolean(existing.favorite || card.favorite)
            };
            updated += 1;
          }
          continue;
        }
        if (library.cards.length >= LIBRARY_MAX_CARDS) break;
        library.cards.push(card);
        existingIndexes.set(card.id, library.cards.length - 1);
        added += 1;
      }
      const unlocks = checkAchievements(library);
      if (await saveLibraryResilient(library)) {
        updateLibraryDrawer();
        updateBackgroundMosaic();
        announceAchievements(unlocks);
        showToast(`已导入 ${added} 张新卡片，更新 ${updated} 张卡片`, "success");
      }
    } catch (error) {
      console.warn("Library import failed", error);
      showToast("卡牌库文件格式无效", "error");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function openLibraryDrawer() {
  const drawer = $("#libraryDrawer");
  if (!drawer.contains(document.activeElement)) libraryReturnFocus = document.activeElement;
  updateLibraryDrawer();
  drawer.inert = false;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  $("#libraryOverlay").classList.add("visible");
  $("#libraryCloseBtn").focus();
}

function closeLibraryDrawer() {
  const drawer = $("#libraryDrawer");
  const returnFocus = libraryReturnFocus;
  libraryReturnFocus = null;
  if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
    returnFocus.focus({ preventScroll: true });
  }
  drawer.classList.remove("open");
  drawer.inert = true;
  drawer.setAttribute("aria-hidden", "true");
  $("#libraryOverlay").classList.remove("visible");
  compareMode = false;
  compareSelections = [];
}

function updateLibraryDrawer() {
  const library = loadLibrary();
  const grid = $("#libraryGrid");
  if (!grid) return;
  let cards = [...library.cards];
  if (libraryFilterState.rarity !== "all") cards = cards.filter((card) => card.rarity === libraryFilterState.rarity);
  if (libraryFilterState.style !== "all") cards = cards.filter((card) => card.style === libraryFilterState.style);
  if (libraryFilterState.slab !== "all") cards = cards.filter((card) => card.slabType === libraryFilterState.slab);
  if (libraryFilterState.favOnly) cards = cards.filter((card) => card.favorite);

  $("#libraryCount").textContent = `${library.cards.length} ${library.cards.length === 1 ? "CARD" : "CARDS"}`;
  if (!cards.length) {
    grid.innerHTML = `<div class="library-empty"><strong>CB</strong><span>${library.cards.length ? "没有符合筛选条件的卡片" : "制作卡片后点击心形按钮保存到库中"}</span></div>`;
    updateAchievementsUI(library);
    return;
  }

  grid.innerHTML = cards.map((card) => `
    <article class="library-card ${compareMode ? "select-mode" : ""} ${compareSelections.includes(card.id) ? "selected-for-compare" : ""}" data-card-id="${escapeHtml(card.id)}" data-rarity="${escapeHtml(card.rarity)}" data-state-name="${escapeHtml(card.fullState.playerName)}" data-badges="${escapeHtml(card.badges.join(","))}" data-has-player-image="${Boolean(card.fullState.playerImg)}" data-has-team-logo="${Boolean(card.fullState.logoImg)}">
      ${card.thumbnail ? `<img src="${escapeHtml(card.thumbnail)}" alt="${escapeHtml(card.name)}" loading="lazy">` : `<div class="library-card-placeholder">CB</div>`}
      <button class="library-card-open" type="button" data-load-id="${escapeHtml(card.id)}" aria-label="加载 ${escapeHtml(card.name)}"></button>
      <button class="library-card-fav ${card.favorite ? "is-fav" : ""}" type="button" data-fav-id="${escapeHtml(card.id)}" title="${card.favorite ? "取消收藏" : "加入收藏"}" aria-label="${card.favorite ? "取消收藏" : "加入收藏"}">&#9733;</button>
      <div class="library-card-actions"><button class="library-card-action" type="button" data-delete-id="${escapeHtml(card.id)}" title="删除卡片" aria-label="删除 ${escapeHtml(card.name)}">&#215;</button></div>
      <div class="library-card-info"><div class="library-card-name">${escapeHtml(card.name)}</div><div class="library-card-meta">${escapeHtml(card.team)} / ${escapeHtml(RARITY_META[card.rarity]?.name || card.rarity)}</div></div>
    </article>
  `).join("");
  requestAnimationFrame(() => {
    grid.querySelectorAll(".library-card").forEach((card, index) => {
      const delay = Math.min(index * 50, 1500);
      card.style.opacity = "0";
      card.style.transform = "translateY(16px) scale(0.96)";
      card.style.transition = "none";
      requestAnimationFrame(() => {
        card.style.transition = `opacity 320ms cubic-bezier(0.22,0.61,0.36,1) ${delay}ms, transform 320ms cubic-bezier(0.22,0.61,0.36,1) ${delay}ms`;
        card.style.opacity = "1";
        card.style.transform = "translateY(0) scale(1)";
      });
    });
  });
  updateAchievementsUI(library);
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function getLibraryGridAction(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return null;

  const loadButton = target.closest("[data-load-id]");
  if (loadButton && !compareMode) return { type: "load", id: loadButton.dataset.loadId };

  const favoriteButton = target.closest("[data-fav-id]");
  if (favoriteButton) return { type: "favorite", id: favoriteButton.dataset.favId };

  const deleteButton = target.closest("[data-delete-id]");
  if (deleteButton) return { type: "delete", id: deleteButton.dataset.deleteId };

  const card = target.closest(".library-card");
  if (!card) return null;
  return { type: compareMode ? "compare" : "load", id: card.dataset.cardId };
}

function activateLibraryGridItem(event) {
  const action = getLibraryGridAction(event);
  if (!action?.id) return false;

  const now = performance.now();
  const isDuplicateTouchClick = event.type === "click"
    && lastLibraryTouchAction
    && lastLibraryTouchAction.type === action.type
    && lastLibraryTouchAction.id === action.id
    && now - lastLibraryTouchAction.at < 700;
  if (isDuplicateTouchClick) return true;

  if (event.type === "pointerup" && event.pointerType === "touch") {
    lastLibraryTouchAction = { ...action, at: now };
  }

  if (action.type === "load") {
    loadFromLibrary(action.id);
    return true;
  }
  if (action.type === "favorite") {
    event.stopPropagation();
    toggleFavorite(action.id);
    return true;
  }
  if (action.type === "delete") {
    event.stopPropagation();
    removeFromLibrary(action.id);
    return true;
  }

  compareSelections = compareSelections.includes(action.id)
    ? compareSelections.filter((id) => id !== action.id)
    : [...compareSelections, action.id].slice(0, 2);
  if (compareSelections.length === 2) {
    openCompare(compareSelections[0], compareSelections[1]);
    return true;
  }
  updateLibraryDrawer();
  showToast(`已选择 ${compareSelections.length} / 2 张卡片`, "info");
  return true;
}

function bindLibraryEvents() {
  $("#libraryToggleBtn")?.addEventListener("click", openLibraryDrawer);
  $("#openLibraryBtn")?.addEventListener("click", openLibraryDrawer);
  $("#libraryCloseBtn")?.addEventListener("click", closeLibraryDrawer);
  $("#libraryOverlay")?.addEventListener("click", closeLibraryDrawer);
  $("#saveToLibraryBtn")?.addEventListener("click", saveToLibrary);
  $("#saveToLibraryMainBtn")?.addEventListener("click", saveToLibrary);
  $("#libraryExportBtn")?.addEventListener("click", exportLibrary);
  $("#libraryImportBtn")?.addEventListener("click", () => $("#libraryImportInput").click());
  $("#libraryImportInput")?.addEventListener("change", importLibrary);

  [["libraryFilterRarity", "rarity"], ["libraryFilterStyle", "style"], ["libraryFilterSlab", "slab"]].forEach(([id, key]) => {
    $(`#${id}`)?.addEventListener("change", (event) => {
      libraryFilterState[key] = event.target.value;
      updateLibraryDrawer();
    });
  });
  $("#libraryFilterFav")?.addEventListener("click", () => {
    libraryFilterState.favOnly = !libraryFilterState.favOnly;
    $("#libraryFilterFav").classList.toggle("active", libraryFilterState.favOnly);
    $("#libraryFilterFav").setAttribute("aria-pressed", String(libraryFilterState.favOnly));
    updateLibraryDrawer();
  });

  const libraryGrid = $("#libraryGrid");
  libraryGrid?.addEventListener("click", activateLibraryGridItem);
  libraryGrid?.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch" || event.button !== 0) return;
    if (activateLibraryGridItem(event)) event.preventDefault();
  });
}

function updateBackgroundMosaic() {
  const stage = $("#stage");
  if (!stage) return;
  stage.querySelector(".stage-mosaic-bg")?.remove();
  const cards = loadLibrary().cards.filter((card) => card.thumbnail);
  const mosaic = document.createElement("div");
  mosaic.className = "stage-mosaic-bg";
  mosaic.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 35; index += 1) {
    if (cards.length) {
      const image = document.createElement("img");
      image.src = cards[index % cards.length].thumbnail;
      image.alt = "";
      image.loading = "lazy";
      mosaic.appendChild(image);
    } else {
      const tile = document.createElement("div");
      const color = PRESET_CARD_COLORS[index % PRESET_CARD_COLORS.length];
      tile.className = "stage-mosaic-tile";
      tile.style.setProperty("--tile-a", color);
      tile.style.setProperty("--tile-b", adjustColor(color, -34));
      mosaic.appendChild(tile);
    }
  }
  stage.insertBefore(mosaic, stage.firstChild);
}

function startCompareMode() {
  if (loadLibrary().cards.length < 2) {
    showToast("卡牌库中至少需要 2 张卡片才能进行对比", "warning");
    return;
  }
  compareMode = true;
  compareSelections = [];
  openLibraryDrawer();
  showToast("请在卡牌库中选择两张卡片进行对比", "info");
}

function openCompare(idA, idB) {
  const library = loadLibrary();
  const cardA = library.cards.find((card) => card.id === idA);
  const cardB = library.cards.find((card) => card.id === idB);
  if (!cardA || !cardB) return;
  closeLibraryDrawer();
  const compare = $("#cardCompare");
  compare.hidden = false;
  $("#compareSlotA .compare-card-frame").innerHTML = libraryCardImage(cardA);
  $("#compareSlotB .compare-card-frame").innerHTML = libraryCardImage(cardB);

  const statsA = extractCompareStats(cardA);
  const statsB = extractCompareStats(cardB);
  const keys = [["ppg", "PPG"], ["rpg", "RPG"], ["apg", "APG"], ["fg", "FG%"], ["tp", "3P%"], ["gp", "GP"]];
  let winsA = 0;
  let winsB = 0;
  const renderStats = (stats, other, target, side) => {
    const rows = keys.map(([key, label]) => {
      const value = Number.parseFloat(stats[key]) || 0;
      const otherValue = Number.parseFloat(other[key]) || 0;
      const result = value > otherValue ? "winner" : value < otherValue ? "loser" : "tie";
      if (result === "winner") side === "a" ? winsA += 1 : winsB += 1;
      return `<div class="compare-stat-row ${result}"><span class="compare-stat-label">${label}</span><span class="compare-stat-value">${escapeHtml(stats[key])}</span></div>`;
    }).join("");
    $(target).innerHTML = `<div class="compare-player"><strong>${escapeHtml(stats.name)}</strong><span>${escapeHtml(stats.team)} / ${escapeHtml(STYLE_META[stats.style]?.name || stats.style)}</span></div>${rows}`;
  };
  renderStats(statsA, statsB, "#compareStatsA", "a");
  renderStats(statsB, statsA, "#compareStatsB", "b");
  if (winsA === winsB) $("#compareResult").textContent = `DRAW ${winsA} - ${winsB}`;
  else {
    const winner = winsA > winsB ? cardA : cardB;
    $("#compareResult").innerHTML = `<strong>${escapeHtml(winner.name)}</strong> WINS ${Math.max(winsA, winsB)} - ${Math.min(winsA, winsB)}`;
  }
  $("#compareCloseBtn").focus();
}

function libraryCardImage(card) {
  return card.thumbnail ? `<img src="${escapeHtml(card.thumbnail)}" alt="${escapeHtml(card.name)}">` : `<div class="library-card-placeholder">CB</div>`;
}

function extractCompareStats(card) {
  const data = normalizeState(card.fullState);
  return { name: data.playerName, team: data.teamAbbr, style: data.style, ppg: data.statPPG || "0", rpg: data.statRPG || "0", apg: data.statAPG || "0", fg: data.statFG || "0", tp: data.stat3P || "0", gp: data.statGP || "0" };
}

function closeCompare() {
  $("#cardCompare").hidden = true;
}

function hasEveryValue(library, key, expected) {
  const values = new Set(library.cards.map((card) => card[key]));
  return expected.every((value) => values.has(value));
}

function countBy(library, key, value) {
  return library.cards.filter((card) => card[key] === value).length;
}

function maxNameCount(cards) {
  const counts = new Map();
  cards.forEach((card) => counts.set(card.name, (counts.get(card.name) || 0) + 1));
  return Math.max(0, ...counts.values());
}

function cardsCreatedToday(cards) {
  const today = new Date().toDateString();
  return cards.filter((card) => new Date(card.createdAt).toDateString() === today).length;
}

function checkAchievements(library) {
  library.achievements ||= {};
  const unlocks = [];
  ACHIEVEMENTS.forEach((achievement) => {
    if (achievement.id === "complete_set" || library.achievements[achievement.id]) return;
    if (achievement.check(library)) {
      library.achievements[achievement.id] = Date.now();
      unlocks.push(achievement);
    }
  });
  const completion = ACHIEVEMENTS.find((item) => item.id === "complete_set");
  if (!library.achievements[completion.id] && completion.check(library)) {
    library.achievements[completion.id] = Date.now();
    unlocks.push(completion);
  }
  return unlocks;
}

function announceAchievements(achievements) {
  achievements.forEach((achievement, index) => {
    window.setTimeout(() => showToast(`成就解锁: ${achievement.name}`, "success"), index * 950);
  });
}

function updateAchievementsUI(library = loadLibrary()) {
  const grid = $("#achievementsGrid");
  const progress = $("#achievementsProgress");
  if (!grid || !progress) return;
  const unlocked = ACHIEVEMENTS.filter((achievement) => library.achievements[achievement.id]).length;
  progress.textContent = `${unlocked} / ${ACHIEVEMENTS.length}`;
  grid.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const isUnlocked = Boolean(library.achievements[achievement.id]);
    return `<div class="achievement-badge ${isUnlocked ? "unlocked" : "locked"}" title="${escapeHtml(`${achievement.name}: ${achievement.desc}`)}"><span>${escapeHtml(achievement.code)}</span></div>`;
  }).join("");
}

async function runAutoBuildFromUI() {
  const button = $("#autoBuildBtn");
  const progressWrap = $("#autoBuildProgress");
  const fill = $("#autoBuildFill");
  const status = $("#autoBuildStatus");
  const percent = $("#autoBuildPercent");
  const progressBar = $(".auto-build-bar", progressWrap);
  const label = $("span", button);
  if (!button || button.disabled) return;
  window.clearTimeout(autoBuildHideTimer);

  const updateProgress = (done, total, playerName, phase) => {
    const value = total ? Math.round((done / total) * 100) : 0;
    const phaseLabel = phase === "assets" ? "下载头像与 Logo" : phase === "render" ? "渲染卡面" : "已写入卡牌库";
    fill.style.width = `${value}%`;
    percent.textContent = `${value}%`;
    progressBar.setAttribute("aria-valuenow", String(value));
    status.textContent = `${done}/${total} · ${phaseLabel} · ${playerName}`;
  };

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  label.textContent = "正在生成球星卡...";
  progressWrap.hidden = false;
  fill.style.width = "0%";
  percent.textContent = "0%";
  status.textContent = "正在检查现有收藏...";

  try {
    const result = await autoBuildLibrary(updateProgress);
    fill.style.width = "100%";
    percent.textContent = "100%";
    progressBar.setAttribute("aria-valuenow", "100");
    if (result.created > 0 || result.repaired > 0) {
      const parts = [];
      if (result.created) parts.push(`新增 ${result.created} 张`);
      if (result.repaired) parts.push(`修复 ${result.repaired} 张`);
      if (result.consolidated) parts.push(`合并重复 ${result.consolidated} 张`);
      if (result.skipped) parts.push(`已有 ${result.skipped} 张`);
      if (result.partial) parts.push("卡牌库空间不足");
      status.textContent = `完成 · ${parts.join(" · ")}`;
      showToast(`球星卡校验完成：${parts.slice(0, 2).join("，")}`, "info");
      window.setTimeout(openLibraryDrawer, 700);
    } else if (result.partial) {
      status.textContent = "卡牌库空间不足，未添加新卡";
      showToast("卡牌库已满，请先导出并移除部分卡片", "warning");
    } else {
      status.textContent = `${NBA_PLAYERS_DB.length} 位球星资料与图片均为最新版校验数据`;
      showToast("球星卡资料校验通过", "success");
      window.setTimeout(openLibraryDrawer, 500);
    }
  } catch (error) {
    console.error("Auto library build failed", error);
    const persistedCreated = Number(error.persistedCreated) || 0;
    const persistedRepaired = Number(error.persistedRepaired) || 0;
    const persisted = persistedCreated + persistedRepaired;
    status.textContent = persisted ? `存储空间不足 · 已处理 ${persisted} 张` : "生成失败，请重试";
    showToast(persisted ? `已处理 ${persisted} 张，剩余卡片可稍后续建` : "自动建库失败", persisted ? "success" : "error");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    label.textContent = `校验 / 建库 · ${NBA_PLAYERS_DB.length} 位 NBA 球星`;
    autoBuildHideTimer = window.setTimeout(() => {
      progressWrap.hidden = true;
    }, 4500);
  }
}

function bindV6Events() {
  bindLibraryEvents();
  $("#previewPrevBtn")?.addEventListener("click", () => navigateLibraryCard(-1));
  $("#previewNextBtn")?.addEventListener("click", () => navigateLibraryCard(1));
  $("#packOpenBtn")?.addEventListener("click", () => app.openPackExperience());
  $("#packMiniBtn")?.addEventListener("click", () => app.openPackExperience());
  $("#cardCompareBtn")?.addEventListener("click", startCompareMode);
  $("#compareCloseBtn")?.addEventListener("click", closeCompare);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("#packOpening").hidden) app.closePackExperience();
    if (!$("#cardCompare").hidden) closeCompare();
    if ($("#libraryDrawer").classList.contains("open")) closeLibraryDrawer();
  });
}

async function initializeV6() {
  bindV6Events();
  updateBackgroundMosaic();
  try {
    const response = await fetch("data/player-registry.json");
    if (response.ok) {
      window.PLAYER_REGISTRY = await response.json();
      setPlayerRegistryLoaded(true);
    } else {
      window.PLAYER_REGISTRY = {};
    }
  } catch (error) {
    console.warn("Player registry load failed", error);
    window.PLAYER_REGISTRY = {};
  }
  const curated = await installCuratedLibrary();
  const library = curated.library;
  const quickStatus = $("#playerQuickStatus");
  if (quickStatus) {
    quickStatus.textContent = `已接入 ${curated.curatedMediaCount} 张精选影像与 ${NBA_PLAYERS_DB.length} 位球员资料`;
    quickStatus.classList.remove("is-error");
  }
  const unlocks = checkAchievements(library);
  if (unlocks.length) await saveLibraryResilient(library);
  updateLibraryDrawer();
  updatePreviewNavigationUI(library);
  if (curated.removedInitial > 0) {
    showToast(`已移除 ${curated.removedInitial} 张初始卡，精选卡库已更新`, "success");
  }
}

// Register on app-core
app.loadLibrary = loadLibrary;
app.saveLibraryResilient = saveLibraryResilient;
app.updateLibraryDrawer = updateLibraryDrawer;
app.updatePreviewNavigationUI = updatePreviewNavigationUI;
app.updateAchievementsUI = updateAchievementsUI;
app.navigateLibraryCard = navigateLibraryCard;
app.updateBackgroundMosaic = updateBackgroundMosaic;
app.escapeHtml = escapeHtml;
app.initializeV6 = initializeV6;
app.bindV6Events = bindV6Events;

export {
  loadLibrary, normalizeLibraryCard, createLibraryPlaceholder,
  openLibraryAssetDatabase, exportLibrary, importLibrary,
  openLibraryDrawer, closeLibraryDrawer, updateLibraryDrawer,
  bindLibraryEvents, updateBackgroundMosaic, startCompareMode,
  openCompare, extractCompareStats, closeCompare,
  checkAchievements, announceAchievements, updateAchievementsUI,
  escapeHtml, libraryCardImage, generateCardId, createEmptyLibrary,
  updatePreviewNavigationUI, resolvePreviewLibraryIndex,
  migrateLegacyAutoLibrary, isShowcaseLibraryCard,
  shuffleValues, buildBalancedPool, createAutoBuildPlan,
  pickRandomBadges, createPlayerCardState, bindV6Events, initializeV6,
  PRESET_CARD_COLORS, ACHIEVEMENTS
};
