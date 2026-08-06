"use strict";

const STORAGE_KEY = "card-builder-project-v3";
const LIBRARY_STORAGE_KEY = "card-builder-library-v1";
const LIBRARY_ASSET_DB_NAME = "card-builder-library-assets-v1";
const LIBRARY_ASSET_STORE = "images";
const LIBRARY_MAX_CARDS = 200;
const PROJECT_VERSION = 6;
const AUTO_LIBRARY_SOURCE = "auto-nba-v7";
const AUTO_LIBRARY_DATA_VERSION = 4;
const SHOWCASE_PLAYER_IMAGE = "assets/cooper-flagg-home.png";
const SHOWCASE_TEAM_LOGO = "assets/dallas-mavericks-logo.svg";
const SHOWCASE_SIGNATURE_IMAGE = "assets/cooper-flagg-showcase-signature.svg";
const SHOWCASE_SIGNATURE_SOURCE = "assets/cooper-flagg-signature-source.png";
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|webp|jpeg);base64,/i;
const SAFE_UPLOAD_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const TRUSTED_IMAGE_HOSTS = new Set(["cdn.nba.com", "a.espncdn.com"]);

const DEFAULT_STATE = {
  version: PROJECT_VERSION,
  style: "prism",
  effect: "lightning",
  effectIntensity: 13,
  cardThickness: true,
  signatureData: SHOWCASE_SIGNATURE_SOURCE,
  signatureColor: "black",
  signaturePlacement: "front",
  signatureScale: 1,
  signatureX: 50,
  signatureY: 62,
  signatureMode: "upload",
  signatureThreshold: 156,
  signatureInvert: false,
  viewScale: 1,
  customFoilMask: null,
  customFoilOn: false,
  rarity: "silver",
  imageMode: "fullart",
  badges: ["rc", "allstar"],
  slabType: "acrylic",
  jerseyStyle: "solid",
  teamPreset: "dal",
  playerImg: SHOWCASE_PLAYER_IMAGE,
  logoImg: SHOWCASE_TEAM_LOGO,
  photoScale: 100,
  photoX: 0,
  photoY: 0,
  playerName: "COOPER FLAGG",
  playerNumber: "32",
  playerPosition: "SF",
  gradeValue: "9",
  teamName: "DALLAS MAVERICKS",
  teamAbbr: "DAL",
  cardSeason: "2025-26",
  colorPrimary: "#00538C",
  colorSecondary: "#BBC4CA",
  playerHeight: "6'9\"",
  playerWeight: "205 LB",
  playerHometown: "NEWPORT, MAINE",
  playerDraft: "2025 / ROUND 1 / PICK 1",
  statGP: "70",
  statPPG: "21.0",
  statRPG: "6.7",
  statAPG: "4.5",
  statFG: "46.8",
  stat3P: "29.5",
  cardNum: "24/99",
  cardId: "CB-077",
  playerBio: "Dallas rookie showcase card. Versatile two-way forward with creative playmaking and confident shot creation.",
  flipped: false,
  motionOn: true,
  rotX: 0,
  rotY: 0,
  autoRotY: 0
};

const STYLE_META = {
  prism: { name: "PRIZM EDITION", series: "PRIZM // V01", case: "MAGNETIC ONE-TOUCH" },
  tactical: { name: "CHROME TACTICAL", series: "TACTICAL // T01", case: "SMOKE TACTICAL CASE" },
  heritage: { name: "HERITAGE EDITION", series: "HERITAGE // H01", case: "FROSTED TOP LOADER" },
  mosaic: { name: "MOSAIC EDITION", series: "MOSAIC // M01", case: "CLEAR EDGE CASE" },
  select: { name: "SELECT COURTSIDE", series: "SELECT // S01", case: "GOLD EDGE CASE" },
  optic: { name: "OPTIC EDITION", series: "OPTIC // O01", case: "OPTICAL CLEAR CASE" }
};

const EFFECT_META = {
  none: { name: "NONE", finish: "CLEAN BASE" },
  diamond: { name: "DIAMOND", finish: "DIAMOND SPARKLE" },
  lightning: { name: "LIGHTNING", finish: "LIGHTNING REFRACTION" },
  rainbow: { name: "RAINBOW", finish: "HOLOGRAPHIC RAINBOW" },
  crystal: { name: "ICE CRYSTAL", finish: "ICE CRYSTAL PRISM" },
  holographic: { name: "HOLOGRAPHIC", finish: "HOLO REFRACTOR" },
  laser: { name: "LASER", finish: "LASER DIFFRACTION" },
  flame: { name: "FLAME", finish: "FLAME AURA" },
  galaxy: { name: "GALAXY", finish: "GALAXY SWIRL" }
};

const RARITY_META = {
  base: { name: "BASE", suffix: "", serial: "OPEN" },
  silver: { name: "SILVER", suffix: "SILVER REFRACTOR", serial: "/199" },
  gold: { name: "GOLD", suffix: "GOLD REFRACTOR", serial: "/10" },
  neon: { name: "NEON GREEN", suffix: "NEON GREEN", serial: "/75" },
  rwb: { name: "RED WHITE BLUE", suffix: "RWB PARALLEL", serial: "/49" },
  black: { name: "BLACK FINITE", suffix: "BLACK FINITE", serial: "1/1" }
};

const POSITION_MAP = {
  PG: "POINT GUARD",
  SG: "SHOOTING GUARD",
  SF: "SMALL FORWARD",
  PF: "POWER FORWARD",
  C: "CENTER"
};

// 球员基础信息注册表（权威数据源：data/player-registry.json）
// 统一身份字段：name / team / position / jerseyNumber / portrait / portraitVerified
let PLAYER_REGISTRY_LOADED = false;

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

const SIGNATURE_COLOR_MAP = {
  gold: "#e8c766",
  silver: "#d9dde3",
  black: "#111318",
  white: "#f7f7f7"
};

const TEAM_PRESETS = {
  lal: { name: "LOS ANGELES LAKERS", abbr: "LAL", primary: "#552583", secondary: "#FDB927" },
  gsw: { name: "GOLDEN STATE WARRIORS", abbr: "GSW", primary: "#1D428A", secondary: "#FFC72C" },
  dal: { name: "DALLAS MAVERICKS", abbr: "DAL", primary: "#00538C", secondary: "#BBC4CA" },
  bos: { name: "BOSTON CELTICS", abbr: "BOS", primary: "#007A33", secondary: "#BA9653" },
  chi: { name: "CHICAGO BULLS", abbr: "CHI", primary: "#CE1141", secondary: "#000000" },
  mia: { name: "MIAMI HEAT", abbr: "MIA", primary: "#98002E", secondary: "#F9A01B" },
  bkn: { name: "BROOKLYN NETS", abbr: "BKN", primary: "#000000", secondary: "#FFFFFF" },
  phx: { name: "PHOENIX SUNS", abbr: "PHX", primary: "#1D1160", secondary: "#E56020" },
  mil: { name: "MILWAUKEE BUCKS", abbr: "MIL", primary: "#00471B", secondary: "#EEE1C6" },
  den: { name: "DENVER NUGGETS", abbr: "DEN", primary: "#0E2240", secondary: "#FEC524" },
  okc: { name: "OKLAHOMA CITY THUNDER", abbr: "OKC", primary: "#007AC1", secondary: "#EF6100" },
  min: { name: "MINNESOTA TIMBERWOLVES", abbr: "MIN", primary: "#0C2340", secondary: "#236192" },
  cle: { name: "CLEVELAND CAVALIERS", abbr: "CLE", primary: "#860038", secondary: "#FDBB30" },
  det: { name: "DETROIT PISTONS", abbr: "DET", primary: "#C8102E", secondary: "#1D42BA" },
  nyk: { name: "NEW YORK KNICKS", abbr: "NYK", primary: "#006BB6", secondary: "#F58426" },
  atl: { name: "ATLANTA HAWKS", abbr: "ATL", primary: "#E03A3E", secondary: "#C1D32F" },
  mem: { name: "MEMPHIS GRIZZLIES", abbr: "MEM", primary: "#5D76A9", secondary: "#12173F" },
  phi: { name: "PHILADELPHIA 76ERS", abbr: "PHI", primary: "#006BB6", secondary: "#ED174C" },
  sas: { name: "SAN ANTONIO SPURS", abbr: "SAS", primary: "#C4CED4", secondary: "#000000" },
  lac: { name: "LOS ANGELES CLIPPERS", abbr: "LAC", primary: "#C8102E", secondary: "#1D428A" },
  hou: { name: "HOUSTON ROCKETS", abbr: "HOU", primary: "#CE1141", secondary: "#000000" },
  was: { name: "WASHINGTON WIZARDS", abbr: "WAS", primary: "#E31837", secondary: "#002B5C" },
  por: { name: "PORTLAND TRAIL BLAZERS", abbr: "POR", primary: "#E03A3E", secondary: "#000000" }
};

// V7 player set. Rows keep the source data compact while exposing named fields to the builder.
const NBA_PLAYER_FIELDS = [
  "name", "number", "position", "team", "abbr", "primary", "secondary", "height", "weight",
  "hometown", "draft", "season", "gp", "ppg", "rpg", "apg", "fg", "tp", "bio", "nbaId",
  "logoCode", "espnId"
];

const NBA_PLAYER_ROWS = [
  ["SHAI GILGEOUS-ALEXANDER", "2", "PG", "OKLAHOMA CITY THUNDER", "OKC", "#007AC1", "#EF6100", "6'6\"", "195 LB", "TORONTO, ON, CANADA", "2018 / ROUND 1 / PICK 11", "2025-26", "68", "31.1", "4.3", "6.6", "55.3", "38.6", "2024-25 MVP and scoring champion. An elite two-way creator with silky mid-range craft and lockdown perimeter defense.", "1628983", "thunder", "4278073"],
  ["GIANNIS ANTETOKOUNMPO", "34", "PF", "MILWAUKEE BUCKS", "MIL", "#00471B", "#EEE1C6", "6'11\"", "243 LB", "ATHENS, GREECE", "2013 / ROUND 1 / PICK 15", "2025-26", "36", "27.6", "9.8", "5.4", "62.4", "33.3", "Two-time MVP and a dominant force in the paint, combining transition power with versatile defense and improving playmaking. Traded to the Miami Heat in June 2026 after an injury-shortened season.", "203507", "bucks", "3032977"],
  ["NIKOLA JOKIC", "15", "C", "DENVER NUGGETS", "DEN", "#0E2240", "#FEC524", "6'11\"", "284 LB", "SOMBOR, SERBIA", "2014 / ROUND 2 / PICK 41", "2025-26", "65", "27.7", "12.9", "10.7", "56.9", "38.0", "Three-time MVP with generational passing vision, orchestrating Denver's offense with surgical precision from the center position.", "203999", "nuggets", "3112335"],
  ["LUKA DONCIC", "77", "PG", "LOS ANGELES LAKERS", "LAL", "#552583", "#FDB927", "6'7\"", "230 LB", "LJUBLJANA, SLOVENIA", "2018 / ROUND 1 / PICK 3", "2025-26", "64", "33.5", "7.7", "8.3", "47.6", "36.6", "A generational playmaker with an unguardable step-back three, elite shot creation and exceptional court vision.", "1629029", "lakers", "3945274"],
  ["ANTHONY EDWARDS", "5", "SG", "MINNESOTA TIMBERWOLVES", "MIN", "#0C2340", "#236192", "6'4\"", "225 LB", "ATLANTA, GEORGIA", "2020 / ROUND 1 / PICK 1", "2025-26", "61", "28.8", "5.0", "3.7", "48.9", "39.9", "An explosive two-way guard who pairs thunderous athleticism with rapidly improving perimeter shooting.", "1630162", "timberwolves", "4594268"],
  ["JAYSON TATUM", "0", "SF", "BOSTON CELTICS", "BOS", "#007A33", "#BA9653", "6'8\"", "210 LB", "ST. LOUIS, MISSOURI", "2017 / ROUND 1 / PICK 3", "2025-26", "16", "21.8", "10.0", "5.3", "41.1", "32.9", "A championship cornerstone and elite three-level scorer who returned from an Achilles tear to play 16 games in 2025-26.", "1628369", "celtics", "4065648"],
  ["KEVIN DURANT", "7", "SF", "HOUSTON ROCKETS", "HOU", "#CE1141", "#000000", "6'10\"", "240 LB", "WASHINGTON, D.C.", "2007 / ROUND 1 / PICK 2", "2025-26", "78", "26.0", "5.5", "4.8", "52.0", "41.3", "An all-time great scorer who joined Houston in a record seven-team 2025 offseason deal, bringing length, handle and feathery touch to the Rockets' young core.", "201142", "rockets", "3202"],
  ["STEPHEN CURRY", "30", "PG", "GOLDEN STATE WARRIORS", "GSW", "#1D428A", "#FFC72C", "6'2\"", "185 LB", "AKRON, OHIO", "2009 / ROUND 1 / PICK 7", "2025-26", "43", "26.6", "3.6", "4.7", "46.8", "39.3", "The greatest shooter ever, a four-time champion whose range and off-ball movement transformed modern basketball.", "201939", "warriors", "3975"],
  ["LEBRON JAMES", "23", "SF", "LOS ANGELES LAKERS", "LAL", "#552583", "#FDB927", "6'9\"", "250 LB", "AKRON, OHIO", "2003 / ROUND 1 / PICK 1", "2025-26", "60", "20.9", "6.1", "7.2", "51.5", "31.7", "The all-time scoring leader and four-time champion, pairing elite court vision with transition power and remarkable longevity. Signed with the Philadelphia 76ers in July 2026.", "2544", "lakers", "1966"],
  ["VICTOR WEMBANYAMA", "1", "C", "SAN ANTONIO SPURS", "SAS", "#C4CED4", "#000000", "7'4\"", "235 LB", "LE CHESNAY, FRANCE", "2023 / ROUND 1 / PICK 1", "2025-26", "64", "25.0", "11.5", "3.1", "51.2", "34.9", "A generational rim protector with perimeter skill, redefining the center position through rare length and coordination.", "1641705", "spurs", "5104157"],
  ["DONOVAN MITCHELL", "45", "SG", "CLEVELAND CAVALIERS", "CLE", "#860038", "#FDBB30", "6'1\"", "215 LB", "ELMSFORD, NEW YORK", "2017 / ROUND 1 / PICK 13", "2025-26", "70", "27.9", "4.5", "5.7", "48.3", "36.4", "A dynamic scoring guard with explosive isolation creation, deep playoff experience and a fearless late-game approach.", "1628378", "cavaliers", "3908809"],
  ["CADE CUNNINGHAM", "2", "PG", "DETROIT PISTONS", "DET", "#C8102E", "#1D42BA", "6'6\"", "220 LB", "ARLINGTON, TEXAS", "2021 / ROUND 1 / PICK 1", "2025-26", "64", "23.9", "5.5", "9.9", "46.1", "34.2", "A big, poised floor general with a complete scoring package and elite vision, leading Detroit's resurgence.", "1630595", "pistons", "4432166"],
  ["JALEN BRUNSON", "11", "PG", "NEW YORK KNICKS", "NYK", "#006BB6", "#F58426", "6'2\"", "190 LB", "BURLINGTON, NEW JERSEY", "2018 / ROUND 2 / PICK 33", "2025-26", "74", "26.0", "3.3", "6.8", "46.7", "36.9", "A second-round steal turned franchise cornerstone, thriving through footwork, strength and fearless mid-range shot making.", "1628973", "knicks", "3934672"],
  ["TRAE YOUNG", "3", "PG", "WASHINGTON WIZARDS", "WAS", "#E31837", "#002B5C", "6'1\"", "164 LB", "NORMAN, OKLAHOMA", "2018 / ROUND 1 / PICK 5", "2025-26", "15", "17.9", "2.0", "8.0", "45.8", "33.8", "An electric lead guard who creates offense from deep range with audacious passing, floaters and constant pick-and-roll pressure. Traded to Washington in January 2026.", "1629027", "wizards", "4277905"],
  ["DEVIN BOOKER", "1", "SG", "PHOENIX SUNS", "PHX", "#1D1160", "#E56020", "6'5\"", "206 LB", "GRAND RAPIDS, MICHIGAN", "2015 / ROUND 1 / PICK 13", "2025-26", "64", "26.1", "3.9", "6.0", "45.6", "33.0", "A lethal three-level scorer with silky footwork, elite shot-making and precise passing from either guard spot. Will wear No. 15 from 2026-27 in honor of his father.", "1626164", "suns", "3136193"],
  ["JA MORANT", "12", "PG", "MEMPHIS GRIZZLIES", "MEM", "#5D76A9", "#12173F", "6'3\"", "174 LB", "DALZELL, SOUTH CAROLINA", "2019 / ROUND 1 / PICK 2", "2025-26", "20", "19.5", "3.3", "8.1", "41.0", "23.5", "A gravity-defying lead guard with explosive finishing, highlight-reel athleticism and inventive court vision. Traded to the Portland Trail Blazers in June 2026.", "1629630", "grizzlies", "4279888"],
  ["DAMIAN LILLARD", "0", "PG", "PORTLAND TRAIL BLAZERS", "POR", "#E03A3E", "#000000", "6'2\"", "195 LB", "OAKLAND, CALIFORNIA", "2012 / ROUND 1 / PICK 6", "2025-26", "58", "24.9", "4.7", "7.1", "44.8", "37.6", "A clutch performer with logo range who returned home to Portland, but missed the entire 2025-26 season rehabbing a torn Achilles. Stats shown are from 2024-25, his last season on the court.", "203081", "trailblazers", "6606"],
  ["KARL-ANTHONY TOWNS", "32", "C", "NEW YORK KNICKS", "NYK", "#006BB6", "#F58426", "6'11\"", "248 LB", "PISCATAWAY, NEW JERSEY", "2015 / ROUND 1 / PICK 1", "2025-26", "75", "20.1", "11.9", "3.0", "50.1", "36.8", "An elite stretch five who combines high-volume rebounding, interior scoring and rare shooting touch for his size.", "1626157", "knicks", "3136195"],
  ["ANTHONY DAVIS", "23", "PF", "WASHINGTON WIZARDS", "WAS", "#E31837", "#002B5C", "6'10\"", "253 LB", "CHICAGO, ILLINOIS", "2012 / ROUND 1 / PICK 1", "2025-26", "20", "20.4", "11.1", "2.8", "50.6", "27.0", "An elite two-way big who moved to Washington in a February 2026 three-team trade, combining scoring, rebounding, mobility and versatile rim protection.", "203076", "wizards", "6583"],
  ["TYRESE MAXEY", "0", "PG", "PHILADELPHIA 76ERS", "PHI", "#006BB6", "#ED174C", "6'2\"", "200 LB", "DALLAS, TEXAS", "2020 / ROUND 1 / PICK 21", "2025-26", "70", "28.3", "4.1", "6.6", "46.2", "36.7", "A blazing-fast guard whose end-to-end speed, pull-up shooting and improving playmaking pressure every level of a defense.", "1630178", "76ers", "4431678"],
  ["EVAN MOBLEY", "4", "PF", "CLEVELAND CAVALIERS", "CLE", "#860038", "#FDBB30", "7'0\"", "215 LB", "SAN DIEGO, CALIFORNIA", "2021 / ROUND 1 / PICK 3", "2025-26", "65", "18.2", "9.0", "3.6", "54.6", "29.7", "A defensive anchor with rare rim protection, perimeter mobility and an expanding offensive skill set.", "1630596", "cavaliers", "4432158"],
  ["JALEN WILLIAMS", "8", "SG", "OKLAHOMA CITY THUNDER", "OKC", "#007AC1", "#EF6100", "6'5\"", "211 LB", "HOUSTON, TEXAS", "2022 / ROUND 1 / PICK 12", "2025-26", "33", "17.1", "4.6", "5.5", "48.4", "29.9", "A smooth two-way connector who scores efficiently, passes creatively and defends across positions.", "1631114", "thunder", "4593803"],
  ["COOPER FLAGG", "32", "SF", "DALLAS MAVERICKS", "DAL", "#00538C", "#BBC4CA", "6'9\"", "205 LB", "NEWPORT, MAINE", "2025 / ROUND 1 / PICK 1", "2025-26", "70", "21.0", "6.7", "4.5", "46.8", "29.5", "The 2025 No. 1 pick delivered a strong Dallas rookie season, flashing elite passing instincts, versatile defense and a rapidly improving jumper.", "1642843", "mavericks", "5041939"],
  ["KYRIE IRVING", "11", "SG", "DALLAS MAVERICKS", "DAL", "#00538C", "#BBC4CA", "6'2\"", "195 LB", "MELBOURNE, AUSTRALIA", "2011 / ROUND 1 / PICK 1", "2025-26", "50", "24.7", "4.8", "4.6", "47.3", "40.1", "A mesmerizing ball-handler and impossible finisher whose ambidextrous touch turns broken possessions into art. Out for the 2025-26 season with a knee injury; stats shown are from 2024-25.", "202681", "mavericks", "6442"],
  ["JAMES HARDEN", "1", "PG", "CLEVELAND CAVALIERS", "CLE", "#860038", "#FDBB30", "6'5\"", "220 LB", "LOS ANGELES, CALIFORNIA", "2009 / ROUND 1 / PICK 3", "2025-26", "70", "23.6", "4.8", "8.0", "43.4", "37.5", "A former MVP and masterful floor general who joined Cleveland in a February 2026 trade, pairing crafty playmaking with elite court vision.", "201935", "cavaliers", "3992"]
];

const NBA_PLAYERS_DB = NBA_PLAYER_ROWS.map((row) => Object.fromEntries(NBA_PLAYER_FIELDS.map((field, index) => [field, row[index]])))
  .map((player) => ({ ...player, isRookie: player.name === "COOPER FLAGG" }));

const NBA_TEAM_IDS = {
  thunder: 1610612760, bucks: 1610612749, nuggets: 1610612743, lakers: 1610612747,
  timberwolves: 1610612750, celtics: 1610612738, suns: 1610612756, warriors: 1610612744,
  spurs: 1610612759, cavaliers: 1610612739, pistons: 1610612765, knicks: 1610612752,
  hawks: 1610612737, grizzlies: 1610612763, "76ers": 1610612755, mavericks: 1610612742,
  clippers: 1610612746, rockets: 1610612745, wizards: 1610612764, trailblazers: 1610612757
};

const NBA_CDN = {
  headshot: (nbaId) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`,
  logo: (teamSlug) => `https://cdn.nba.com/logos/nba/${NBA_TEAM_IDS[teamSlug]}/primary/L/logo.svg`,
  espnHeadshot: (espnId) => `https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png`,
  espnLogo: (abbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`
};

const FIELD_IDS = [
  "playerName", "playerNumber", "playerPosition", "gradeValue", "teamName", "teamAbbr",
  "cardSeason", "colorPrimary", "colorSecondary", "playerHeight", "playerWeight",
  "playerHometown", "playerDraft", "statGP", "statPPG", "statRPG", "statAPG",
  "statFG", "stat3P", "cardNum", "cardId", "playerBio", "slabType", "jerseyStyle"
];

let state = loadInitialState();
let effectToken = 0;
let effectIntervals = [];
let saveTimer = 0;
let toastTimer = 0;
let autoBuildHideTimer = 0;
let isDragging = false;
let isPointerInside = false;
let idleRotX = 0;
let motionElapsed = 0;
let dragStart = { x: 0, y: 0, rotX: 0, rotY: 0 };
let sigCtx = null;
let sigDrawing = false;
let sigHasInk = false;
let pendingSigImage = null;
let pendingSigMaskDataURL = null;
let foilCtx = null;
let foilPainting = false;
let foilBrush = 30;
let foilLastPoint = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const refs = {
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

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

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

function normalizeState(candidate) {
  const normalized = { ...cloneDefaultState(), ...candidate };
  const defaults = cloneDefaultState();
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
  normalized.logoImg = isSafeCardImage(normalized.logoImg) ? normalized.logoImg : null;
  normalized.signatureData = isSafeSignatureImage(normalized.signatureData) ? normalized.signatureData : null;
  normalized.signatureColor = ["gold", "silver", "black", "white"].includes(normalized.signatureColor) ? normalized.signatureColor : "gold";
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
  const effectIntensity = Number(normalized.effectIntensity);
  normalized.effectIntensity = Number.isFinite(effectIntensity) ? clamp(effectIntensity, 0, 100) : 80;
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

function isSafeDataImage(value) {
  return typeof value === "string" && SAFE_IMAGE_DATA_URL.test(value);
}

function isSafeSignatureImage(value) {
  return isSafeDataImage(value) || value === SHOWCASE_SIGNATURE_IMAGE || value === SHOWCASE_SIGNATURE_SOURCE;
}

function isSafeCardImage(value) {
  if (isSafeDataImage(value)) return true;
  if ([SHOWCASE_PLAYER_IMAGE, SHOWCASE_TEAM_LOGO].includes(value)) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isSafeUploadImage(file) {
  return Boolean(file && SAFE_UPLOAD_IMAGE_TYPES.has(file.type));
}

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
    return `<div class="${className}"><img src="${esc(state.logoImg)}" alt="${esc(d.abbr)} logo"></div>`;
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
  const colorFilter = state.signatureColor === "white" ? "brightness(1)" : "grayscale(1) contrast(1.35)";
  return `<img class="signature-layer signature-${state.signatureColor}" src="${esc(state.signatureData)}" alt="自定义签名" style="${baseStyle}filter:${colorFilter};">`;
}

function renderFront(d) {
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
      <h2>${esc(d.name)}</h2>
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
  clearEffectLayers();
  document.documentElement.style.setProperty("--team-primary", d.c1);
  document.documentElement.style.setProperty("--team-secondary", d.c2);
  refs.cardFront.innerHTML = renderFront(d);
  refs.cardBack.innerHTML = renderBack(d);
  applyEffect(state.effect);
  updateInterface(d);
  applyRotation();
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
  syncSignatureModeUI();

  const photoPreview = $("#photoPreview");
  const logoPreview = $("#logoPreview");
  photoPreview.classList.toggle("has-image", Boolean(state.playerImg));
  logoPreview.classList.toggle("has-image", Boolean(state.logoImg));
  $("#photoPreviewImg").src = state.playerImg || "";
  $("#logoPreviewImg").src = state.logoImg || "";

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

function hydrateInputs() {
  FIELD_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (element && state[id] !== undefined) element.value = state[id];
  });
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
  syncSignatureModeUI();
  syncSignaturePadFromState();
  syncFoilMaskPadFromState();
}

function syncSignatureModeUI() {
  const isUpload = state.signatureMode === "upload";
  refs.signatureCanvas.hidden = isUpload;
  $("#signatureUploadBlock").hidden = !isUpload;
  $("#signatureColorRow").hidden = isUpload;
  $("#signatureDrawActions").hidden = isUpload;
  $$("#signaturePanel [data-sig-mode]").forEach((button) => {
    const active = button.dataset.sigMode === state.signatureMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function bindSignaturePad() {
  const canvas = refs.signatureCanvas;
  sigCtx = canvas.getContext("2d", { willReadFrequently: true });
  sigCtx.lineJoin = "round";
  sigCtx.lineCap = "round";
  sigCtx.lineWidth = 4;
  sigCtx.strokeStyle = "#ffffff";

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    sigDrawing = true;
    sigHasInk = true;
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    sigCtx.beginPath();
    sigCtx.moveTo(point.x, point.y);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!sigDrawing) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    sigCtx.lineTo(point.x, point.y);
    sigCtx.stroke();
  });
  const endSignature = (event) => {
    sigDrawing = false;
    if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", endSignature);
  canvas.addEventListener("pointercancel", endSignature);

  $("#signatureClearBtn").addEventListener("click", () => {
    sigCtx.clearRect(0, 0, canvas.width, canvas.height);
    sigHasInk = false;
    state.signatureData = null;
    render();
    showToast("签名已清除");
  });
  $("#signatureApplyBtn").addEventListener("click", () => {
    state.signatureData = sigHasInk ? canvas.toDataURL("image/png") : null;
    render();
    showToast(state.signatureData ? "签名已应用" : "请先绘制签名");
  });
  $$("#signatureColorRow [data-sig-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.signatureColor = button.dataset.sigColor;
      render();
    });
  });

  $$("#signaturePanel [data-sig-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.signatureMode = button.dataset.sigMode === "upload" ? "upload" : "draw";
      syncSignatureModeUI();
      queueAutosave();
    });
  });

  ["signatureX", "signatureY", "signatureScale"].forEach((id) => {
    $("#" + id).addEventListener("input", (event) => {
      state[id] = id === "signatureScale" ? Number(event.target.value) / 100 : Number(event.target.value);
      render();
    });
  });
  $("#signaturePlacementBack").addEventListener("change", (event) => {
    state.signaturePlacement = event.target.checked ? "back" : "front";
    render();
  });

  sigCtx.strokeStyle = "#ffffff";
}

function bindSignatureUpload() {
  $("#signaturePhotoBtn").addEventListener("click", () => $("#signaturePhotoInput").click());

  $("#signaturePhotoInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isSafeUploadImage(file) || file.size > 16 * 1024 * 1024) {
      event.target.value = "";
      showToast("签名仅支持 16 MB 以内的 PNG、JPEG 或 WebP 图片");
      return;
    }
    try {
      const image = await loadImageFromFile(file);
      pendingSigImage = image;
      drawSmallPreview($("#sigRawPreview"), image, false);
      refreshSignatureExtraction();
    } catch (error) {
      console.warn("Signature photo load error", error);
      showToast("无法读取图片");
    }
  });

  $("#sigThresholdSlider").addEventListener("input", (event) => {
    state.signatureThreshold = Number(event.target.value);
    $("#sigThresholdOut").textContent = String(state.signatureThreshold);
    refreshSignatureExtraction();
    queueAutosave();
  });

  $("#sigInvertToggle").addEventListener("change", (event) => {
    state.signatureInvert = event.target.checked;
    refreshSignatureExtraction();
    queueAutosave();
  });

  $("#sigUploadApplyBtn").addEventListener("click", () => {
    if (!pendingSigMaskDataURL) {
      showToast("请先选择一张签名照片");
      return;
    }
    state.signatureData = pendingSigMaskDataURL;
    state.signatureMode = "upload";
    render();
    showToast("签名已提取并应用");
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function refreshSignatureExtraction() {
  if (!pendingSigImage) return;
  pendingSigMaskDataURL = extractSignatureMask(pendingSigImage, state.signatureThreshold, state.signatureInvert);
  if (!pendingSigMaskDataURL) {
    const previewContext = $("#sigMaskPreview").getContext("2d");
    previewContext.clearRect(0, 0, 200, 100);
    return;
  }
  const preview = new Image();
  preview.onload = () => drawSmallPreview($("#sigMaskPreview"), preview, true);
  preview.src = pendingSigMaskDataURL;
}

function extractSignatureMask(sourceImage, threshold, invert) {
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / sourceImage.width);
  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const workContext = work.getContext("2d", { willReadFrequently: true });
  workContext.drawImage(sourceImage, 0, 0, width, height);

  const imageData = workContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    const ink = invert ? luminance - threshold : threshold - luminance;
    const alpha = clamp(Math.round(ink * 2.2), 0, 255);
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = alpha;

    if (alpha > 15) {
      const pixelIndex = index / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  workContext.putImageData(imageData, 0, 0);
  const padding = 6;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
  const crop = document.createElement("canvas");
  crop.width = cropWidth;
  crop.height = cropHeight;
  crop.getContext("2d").drawImage(work, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return crop.toDataURL("image/png");
}

function drawSmallPreview(canvas, image, showChecker) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (showChecker) {
    const size = 8;
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        context.fillStyle = ((x / size + y / size) % 2 === 0) ? "#28282e" : "#1a1a1f";
        context.fillRect(x, y, size, size);
      }
    }
  }
  const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
}

async function syncSignaturePadFromState() {
  if (!sigCtx) return;
  const source = state.signatureData;
  sigCtx.clearRect(0, 0, refs.signatureCanvas.width, refs.signatureCanvas.height);
  sigHasInk = Boolean(source);
  if (!source) return;
  try {
    const image = await loadCanvasImage(source);
    if (state.signatureData !== source) return;
    sigCtx.drawImage(image, 0, 0, refs.signatureCanvas.width, refs.signatureCanvas.height);
  } catch (error) {
    console.warn("Unable to restore signature pad", error);
  }
}

async function hydrateShowcaseSignatureAsset() {
  if (state.signatureData !== SHOWCASE_SIGNATURE_SOURCE) return;
  try {
    const image = await loadCanvasImage(SHOWCASE_SIGNATURE_SOURCE);
    const extracted = extractSignatureMask(image, state.signatureThreshold, false);
    if (!extracted || state.signatureData !== SHOWCASE_SIGNATURE_SOURCE) return;
    state.signatureData = extracted;
    state.signatureMode = "upload";
    render();
  } catch (error) {
    console.warn("Unable to prepare the showcase signature", error);
  }
}

function bindFoilMaskPad() {
  const canvas = refs.foilMaskCanvas;
  foilCtx = canvas.getContext("2d", { willReadFrequently: true });
  foilCtx.lineCap = "round";
  foilCtx.lineJoin = "round";
  foilCtx.strokeStyle = "#fff";
  foilCtx.fillStyle = "#fff";

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  };
  const paintTo = (point) => {
    foilCtx.lineWidth = foilBrush * 2;
    foilCtx.beginPath();
    foilCtx.moveTo(foilLastPoint?.x ?? point.x, foilLastPoint?.y ?? point.y);
    foilCtx.lineTo(point.x, point.y);
    foilCtx.stroke();
    foilLastPoint = point;
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    foilPainting = true;
    foilLastPoint = null;
    canvas.setPointerCapture(event.pointerId);
    paintTo(pointFromEvent(event));
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!foilPainting) return;
    event.preventDefault();
    paintTo(pointFromEvent(event));
  });
  const endPainting = (event) => {
    foilPainting = false;
    foilLastPoint = null;
    if (event?.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", endPainting);
  canvas.addEventListener("pointercancel", endPainting);

  $("#foilBrushSize").addEventListener("input", (event) => {
    foilBrush = Number(event.target.value);
    $("#foilBrushSizeOut").textContent = String(foilBrush);
  });
  $("#foilMaskClearBtn").addEventListener("click", () => {
    fillFoilMaskCanvas("#000");
    state.customFoilMask = null;
    state.customFoilOn = false;
    refs.customFoilToggle.checked = false;
    render();
  });
  $("#foilMaskFillBtn").addEventListener("click", () => fillFoilMaskCanvas("#fff"));
  $("#foilMaskApplyBtn").addEventListener("click", () => {
    state.customFoilMask = createAlphaMaskDataUrl(canvas);
    state.customFoilOn = refs.customFoilToggle.checked;
    render();
    showToast("闪光蒙版已应用");
  });
  refs.customFoilToggle.addEventListener("change", (event) => {
    state.customFoilOn = event.target.checked;
    render();
  });
}

function fillFoilMaskCanvas(color) {
  if (!foilCtx) return;
  foilCtx.save();
  foilCtx.globalCompositeOperation = "source-over";
  foilCtx.fillStyle = color;
  foilCtx.fillRect(0, 0, refs.foilMaskCanvas.width, refs.foilMaskCanvas.height);
  foilCtx.restore();
}

function createAlphaMaskDataUrl(sourceCanvas) {
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const source = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const output = document.createElement("canvas");
  output.width = sourceCanvas.width;
  output.height = sourceCanvas.height;
  const outputCtx = output.getContext("2d");
  const mask = outputCtx.createImageData(output.width, output.height);
  for (let index = 0; index < source.data.length; index += 4) {
    const alpha = Math.max(source.data[index], source.data[index + 1], source.data[index + 2]);
    mask.data[index] = 255;
    mask.data[index + 1] = 255;
    mask.data[index + 2] = 255;
    mask.data[index + 3] = alpha;
  }
  outputCtx.putImageData(mask, 0, 0);
  return output.toDataURL("image/png");
}

async function syncFoilMaskPadFromState() {
  if (!foilCtx) return;
  const source = state.customFoilMask;
  fillFoilMaskCanvas("#000");
  if (!source) return;
  try {
    const image = await loadCanvasImage(source);
    if (state.customFoilMask !== source) return;
    foilCtx.drawImage(image, 0, 0, refs.foilMaskCanvas.width, refs.foilMaskCanvas.height);
  } catch (error) {
    console.warn("Unable to restore foil mask", error);
  }
}

function bindInterface() {
  $$(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
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
      if (["teamName", "teamAbbr", "colorPrimary", "colorSecondary"].includes(id)) state.teamPreset = "";
      render();
    });
    if (eventName === "change" && element.type === "color") {
      element.addEventListener("input", () => {
        state[id] = element.value;
        state.teamPreset = "";
        render();
      });
    }
  });

  ["photoScale", "photoX", "photoY", "effectIntensity"].forEach((id) => {
    const element = document.getElementById(id);
    element.addEventListener("input", () => {
      state[id] = Number(element.value);
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

function activateTab(name) {
  $$(".tab-btn").forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.id === `tab-${name}`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function readImageFile(event, key) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!isSafeUploadImage(file)) {
    showToast("仅支持 PNG、JPEG 或 WebP 图片");
    event.target.value = "";
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showToast("图片不能超过 16 MB");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state[key] = reader.result;
    if (key === "playerImg") state.imageMode = state.imageMode || "cutout";
    render();
    showToast(key === "playerImg" ? "球员照片已更新" : "球队 Logo 已更新");
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  state.playerImg = null;
  refs.photoInput.value = "";
  render();
}

function removeLogo() {
  state.logoImg = null;
  refs.logoInput.value = "";
  render();
}

function bindCardInteraction() {
  refs.cardScene.addEventListener("pointerenter", () => {
    isPointerInside = true;
  });

  refs.cardScene.addEventListener("pointerdown", (event) => {
    isDragging = true;
    refs.cardScene.setPointerCapture(event.pointerId);
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      rotX: state.rotX + idleRotX,
      rotY: state.rotY + state.autoRotY
    };
    state.autoRotY = 0;
    idleRotX = 0;
  });

  refs.cardScene.addEventListener("pointermove", (event) => {
    const rect = refs.cardScene.getBoundingClientRect();
    const mx = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const my = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    refs.card3d.style.setProperty("--mx", `${mx}%`);
    refs.card3d.style.setProperty("--my", `${my}%`);
    refs.card3d.style.setProperty("--rainbow-angle", `${mx * 3.6}deg`);
    refs.slabShell.style.setProperty("--mx", `${mx}%`);
    refs.slabShell.style.setProperty("--my", `${my}%`);
    if (!isDragging) return;
    state.rotY = dragStart.rotY + (event.clientX - dragStart.x) * 0.42;
    state.rotX = clamp(dragStart.rotX - (event.clientY - dragStart.y) * 0.34, -85, 85);
    applyRotation();
  });

  const endDrag = (event) => {
    if (!isDragging) return;
    isDragging = false;
    if (event?.pointerId !== undefined && refs.cardScene.hasPointerCapture(event.pointerId)) {
      refs.cardScene.releasePointerCapture(event.pointerId);
    }
  };
  refs.cardScene.addEventListener("pointerup", endDrag);
  refs.cardScene.addEventListener("pointercancel", endDrag);
  refs.cardScene.addEventListener("pointerleave", () => {
    isPointerInside = false;
    if (!state.motionOn) {
      [refs.card3d, refs.slabShell].forEach((node) => {
        node.style.setProperty("--mx", "50%");
        node.style.setProperty("--my", "45%");
      });
    }
  });
  refs.cardScene.addEventListener("dblclick", flipCard);
  refs.cardScene.addEventListener("wheel", (event) => {
    event.preventDefault();
    adjustZoom(event.deltaY > 0 ? -0.1 : 0.1);
  }, { passive: false });
}

function applyRotation() {
  const flip = state.flipped ? 180 : 0;
  const totalRotX = state.rotX + idleRotX;
  const totalRotY = state.rotY + state.autoRotY + flip;
  const normalizedY = ((totalRotY % 360) + 360) % 360;
  const renderRotY = Math.abs(normalizedY - 90) < 0.001 ? totalRotY - 4.5 : Math.abs(normalizedY - 270) < 0.001 ? totalRotY + 4.5 : totalRotY;
  refs.slabShell.style.transform = `scale3d(${state.viewScale}, ${state.viewScale}, ${state.viewScale}) rotateX(${totalRotX}deg) rotateY(${renderRotY}deg)`;

  const relativeY = totalRotY - flip;
  const wrappedY = ((relativeY + 180) % 360 + 360) % 360 - 180;
  const tiltX = clamp(totalRotX / 85, -1, 1);
  const tiltY = clamp(wrappedY / 45, -1, 1);
  const glintAngle = 180 + tiltY * 70 + tiltX * 30;
  const glintPosition = 50 - tiltY * 13;

  [refs.card3d, refs.slabShell].forEach((node) => {
    node.style.setProperty("--tilt-x", tiltX.toFixed(3));
    node.style.setProperty("--tilt-y", tiltY.toFixed(3));
    node.style.setProperty("--glint-angle", `${glintAngle}deg`);
    node.style.setProperty("--glint-position", `${glintPosition}%`);
    node.style.setProperty("--sig-shine-x", `${50 + tiltY * 32}%`);
    node.style.setProperty("--sig-shine-y", `${50 + tiltX * 32}%`);
    node.style.setProperty("--parallax-x", `${tiltY * 18}px`);
    node.style.setProperty("--parallax-y", `${tiltX * -18}px`);
  });
  refs.card3d.classList.toggle("is-tilted", Math.abs(tiltX) + Math.abs(tiltY) > 0.06);
  const faceAngle = ((totalRotY % 360) + 360) % 360;
  const showingBack = faceAngle > 90 && faceAngle < 270;
  const edgeAngle = Math.min(Math.abs(faceAngle - 90), Math.abs(faceAngle - 270));
  refs.slabShell.classList.toggle("is-quarter-edge", edgeAngle < 0.001);
  const isEdgeView = edgeAngle < 15;
  const isTopView = Math.abs(totalRotX) > 60;
  // Fade card front/back and slab surfaces to prevent edge-on bleed-through artifacts.
  // At angles very close to 90°/270°, the flat faces compress to a thin bright strip
  // that shows through the acrylic side. Fade them out so the solid side dominates.
  const faceFade = clamp((edgeAngle - 3) / 8, 0, 1);
  refs.card3d.style.setProperty("--face-opacity", faceFade.toFixed(3));
  refs.slabShell.style.setProperty("--surface-opacity", faceFade.toFixed(3));
  $("#viewSideLabel").textContent = isTopView ? "TOP / LIVE" : isEdgeView ? "EDGE / LIVE" : showingBack ? "BACK / LIVE" : "FRONT / LIVE";
  window.dispatchEvent(new CustomEvent("cardbuilder:view", {
    detail: {
      rotX: totalRotX,
      rotY: totalRotY,
      viewScale: state.viewScale,
      motionOn: state.motionOn
    }
  }));
}

function adjustZoom(delta) {
  state.viewScale = clamp(Math.round((state.viewScale + delta) * 10) / 10, 0.6, 1.6);
  updateInterface(getData());
  applyRotation();
  queueAutosave();
}

function rotateView(delta) {
  state.motionOn = false;
  state.autoRotY = 0;
  idleRotX = 0;
  state.rotY = Math.round((state.rotY + delta) / 90) * 90;
  updateInterface(getData());
  applyRotation();
  queueAutosave();
}

function flipCard() {
  state.flipped = !state.flipped;
  updateInterface(getData());
  applyRotation();
}

function toggleMotion() {
  state.motionOn = !state.motionOn;
  if (!state.motionOn) {
    state.autoRotY = 0;
    idleRotX = 0;
    applyRotation();
  }
  updateInterface(getData());
  queueAutosave();
}

function resetView() {
  state.rotX = 0;
  state.rotY = 0;
  state.autoRotY = 0;
  idleRotX = 0;
  motionElapsed = 0;
  state.flipped = false;
  state.viewScale = 1;
  updateInterface(getData());
  applyRotation();
}

async function renderThreeCardCanvas(side, width = 900, height = 1260) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  await drawCardToCanvas(context, getData(), side === "back" ? "back" : "front", 0, 0, width, height);
  return canvas;
}

function setThreePreviewView(nextView = {}) {
  const displayedRotY = Number(nextView.rotY);
  if (Number.isFinite(displayedRotY)) state.rotY = displayedRotY - (state.flipped ? 180 : 0);
  const nextRotX = Number(nextView.rotX);
  if (Number.isFinite(nextRotX)) state.rotX = clamp(nextRotX, -85, 85);
  const nextScale = Number(nextView.viewScale);
  if (Number.isFinite(nextScale)) state.viewScale = clamp(nextScale, 0.6, 1.6);
  if (typeof nextView.motionOn === "boolean") state.motionOn = nextView.motionOn;
  state.autoRotY = 0;
  idleRotX = 0;
  updateInterface(getData());
  applyRotation();
  queueAutosave();
}

function getThreePreviewState() {
  const d = getData();
  return {
    ...d,
    slabType: state.slabType,
    cardThickness: state.cardThickness,
    gradeValue: state.gradeValue,
    motionOn: state.motionOn,
    view: {
      rotX: state.rotX + idleRotX,
      rotY: state.rotY + state.autoRotY + (state.flipped ? 180 : 0),
      viewScale: state.viewScale
    }
  };
}

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
    if (!silent) showToast("项目已保存到本机");
  } catch (error) {
    console.warn("Unable to save complete project", error);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, playerImg: null, logoImg: null }));
      refs.saveState.textContent = "已保存（不含图片）";
      if (!silent) showToast("图片较大，字段和设计配置已保存");
    } catch (fallbackError) {
      refs.saveState.textContent = "保存失败";
      if (!silent) showToast("本机存储空间不足");
    }
  }
}

function downloadProjectFile() {
  const payload = JSON.stringify({ ...state, version: PROJECT_VERSION, autoRotY: 0, rotX: 0, rotY: 0, flipped: false }, null, 2);
  downloadBlob(new Blob([payload], { type: "application/json" }), `${safeFilename(state.playerName)}_card_project.json`);
  showToast("项目文件已下载");
}

function importProjectFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      state = normalizeState(imported);
      hydrateInputs();
      render();
      showToast("项目已导入");
    } catch (error) {
      console.error(error);
      showToast("项目文件格式无效");
    }
    refs.projectInput.value = "";
  };
  reader.readAsText(file);
}

function resetProject() {
  if (!window.confirm("重置当前球星卡项目？")) return;
  state = cloneDefaultState();
  localStorage.removeItem(STORAGE_KEY);
  hydrateInputs();
  render();
  showToast("项目已重置");
}

function safeFilename(value) {
  return compactText(value, "custom_card").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "_").slice(0, 48);
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => refs.toast.classList.remove("show"), 2200);
}

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

async function exportCard(mode) {
  const d = getData();
  showToast(`正在生成 ${mode.toUpperCase()} 图像...`);
  refs.exportProgress.style.width = "12%";
  try {
    await document.fonts.ready;
    let canvas;
    if (mode === "3d-preview") {
      if (!window.cardBuilderThree?.captureCanvas) throw new Error("Three.js preview is not ready");
      canvas = window.cardBuilderThree.captureCanvas(2400, 3200);
    } else if (mode === "spread") {
      canvas = document.createElement("canvas");
      canvas.width = 3000;
      canvas.height = 2100;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0b0d10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      refs.exportProgress.style.width = "30%";
      await drawCardToCanvas(ctx, d, "front", 0, 0, 1500, 2100);
      refs.exportProgress.style.width = "62%";
      await drawCardToCanvas(ctx, d, "back", 1500, 0, 1500, 2100);
    } else if (mode === "slab") {
      canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 3200;
      const ctx = canvas.getContext("2d");
      drawSlabBackground(ctx, canvas.width, canvas.height, d);
      refs.exportProgress.style.width = "35%";
      await drawCardToCanvas(ctx, d, "front", 450, 620, 1500, 2100);
      if (state.slabType === "acrylic") drawAcrylicSlabOverlay(ctx, canvas.width, canvas.height);
      drawSlabLabel(ctx, d, 450, 210, 1500, 300);
    } else {
      const hd = mode === "front-hd";
      canvas = document.createElement("canvas");
      canvas.width = hd ? 2100 : 1500;
      canvas.height = hd ? 2940 : 2100;
      const ctx = canvas.getContext("2d");
      await drawCardToCanvas(ctx, d, mode === "back" ? "back" : "front", 0, 0, canvas.width, canvas.height);
    }
    refs.exportProgress.style.width = "86%";
    const blob = await canvasToBlob(canvas);
    const suffix = mode.replace("front-hd", "front_hd");
    downloadBlob(blob, `${safeFilename(d.name)}_${state.style}_${suffix}.png`);
    refs.exportProgress.style.width = "100%";
    showToast("PNG 已生成");
  } catch (error) {
    console.error(error);
    showToast("导出失败，请重新尝试");
  } finally {
    setTimeout(() => { refs.exportProgress.style.width = "0"; }, 900);
  }
}

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
  const lightText = !["heritage", "optic"].includes(state.style);
  const primaryText = lightText ? "#ffffff" : "#151a21";
  const mutedText = lightText ? "rgba(255,255,255,.72)" : "rgba(21,26,33,.68)";
  const pad = width * 0.05;
  ctx.save();
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
  if (state.style === "optic" || state.style === "heritage") {
    ctx.fillStyle = state.style === "heritage" ? "rgba(238,229,210,.90)" : "rgba(247,247,243,.90)";
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
      const scale = Math.min(width * 0.82 / logo.naturalWidth, height * 0.82 / logo.naturalHeight);
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
    const by = y + (58 + index * 29) * scale;
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

function drawExportEffect(ctx, d, x, y, width, height, random, opacityScale = 1) {
  const intensity = clamp(Number(state.effectIntensity) / 100, 0, 1) * opacityScale;
  if (state.effect === "none" || intensity <= 0) return;
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, width * 0.026);
  ctx.clip();
  ctx.globalAlpha = intensity;
  if (state.effect === "diamond") {
    for (let i = 0; i < 320; i += 1) {
      const px = x + random() * width;
      const py = y + random() * height;
      const size = width * (0.001 + random() * 0.0038);
      ctx.fillStyle = random() > 0.82 ? "rgba(255,214,94,.84)" : "rgba(255,255,255,.86)";
      ctx.fillRect(px - size / 2, py - size * 2, size, size * 4);
      ctx.fillRect(px - size * 2, py - size / 2, size * 4, size);
    }
  } else if (state.effect === "rainbow") {
    let gradient;
    if (typeof ctx.createConicGradient === "function") {
      gradient = ctx.createConicGradient(0.3, x + width * 0.52, y + height * 0.45);
      ["#f00", "#ff8a00", "#ffef00", "#31d843", "#00e9ff", "#176cff", "#8c31ff", "#f00"].forEach((color, index, colors) => gradient.addColorStop(index / (colors.length - 1), color));
    } else {
      gradient = ctx.createLinearGradient(x, y, x + width, y + height);
      gradient.addColorStop(0, "#ff4050");
      gradient.addColorStop(0.5, "#2fe6df");
      gradient.addColorStop(1, "#7d42ff");
    }
    ctx.globalAlpha = 0.28 * intensity;
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  } else if (state.effect === "crystal") {
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 32; i += 1) {
      const cx = x + random() * width;
      const cy = y + random() * height;
      const radius = width * (0.08 + random() * 0.18);
      const sides = 3 + Math.floor(random() * 4);
      ctx.beginPath();
      for (let point = 0; point < sides; point += 1) {
        const angle = point / sides * Math.PI * 2 + random() * 0.5;
        const r = radius * (0.7 + random() * 0.3);
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      const hue = 190 + random() * 60;
      grad.addColorStop(0, `hsla(${hue},80%,70%,.16)`);
      grad.addColorStop(1, `hsla(${hue + 30},60%,80%,.06)`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = width * 0.0015;
      ctx.stroke();
    }
    // Prismatic light bands
    ctx.globalAlpha = 0.14 * intensity;
    const bandGrad = ctx.createLinearGradient(x, y, x + width, y + height);
    bandGrad.addColorStop(0, "transparent");
    bandGrad.addColorStop(0.3, "rgba(100,200,255,.4)");
    bandGrad.addColorStop(0.4, "rgba(255,255,255,.5)");
    bandGrad.addColorStop(0.5, "rgba(180,140,255,.3)");
    bandGrad.addColorStop(0.7, "transparent");
    ctx.fillStyle = bandGrad;
    ctx.fillRect(x, y, width, height);
  } else if (state.effect === "holographic") {
    // Holographic refractor: rainbow conic + scan lines
    const cx = x + width * 0.5;
    const cy = y + height * 0.5;
    const maxR = Math.sqrt(width * width + height * height) * 0.5;
    const hues = [0, 30, 60, 120, 180, 240, 300, 360];
    for (let i = 0; i < hues.length - 1; i += 1) {
      const a1 = (hues[i] / 360) * Math.PI * 2 - Math.PI;
      const a2 = (hues[i + 1] / 360) * Math.PI * 2 - Math.PI;
      ctx.save();
      ctx.globalCompositeOperation = "color-dodge";
      ctx.globalAlpha = 0.22 * intensity;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, a1, a2);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hues[i]},90%,55%,1)`;
      ctx.fill();
      ctx.restore();
    }
    // Scan lines
    ctx.save();
    ctx.globalAlpha = 0.08 * intensity;
    for (let ly = y; ly < y + height; ly += 3) {
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillRect(x, ly, width, 1);
    }
    ctx.restore();
  } else if (state.effect === "laser") {
    // Laser diffraction: cross-hatch grid + conic spectrum
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
    // Conic spectrum
    const lcx = x + width * 0.5;
    const lcy = y + height * 0.5;
    const lr = Math.sqrt(width * width + height * height) * 0.5;
    const laserHues = [340, 30, 60, 150, 200, 270, 340];
    for (let i = 0; i < laserHues.length - 1; i += 1) {
      const a1 = (i / (laserHues.length - 1)) * Math.PI * 2 - Math.PI;
      const a2 = ((i + 1) / (laserHues.length - 1)) * Math.PI * 2 - Math.PI;
      ctx.save();
      ctx.globalCompositeOperation = "color-dodge";
      ctx.globalAlpha = 0.18 * intensity;
      ctx.beginPath();
      ctx.moveTo(lcx, lcy);
      ctx.arc(lcx, lcy, lr, a1, a2);
      ctx.closePath();
      ctx.fillStyle = `hsla(${laserHues[i]},85%,50%,1)`;
      ctx.fill();
      ctx.restore();
    }
  } else if (state.effect === "lightning") {
    ctx.globalCompositeOperation = "screen";
    const boltCount = 4;
    for (let index = 0; index < boltCount; index += 1) {
      const hue = 230 + random() * 72;
      const path = buildLightningPath(
        x + width * (0.15 + random() * 0.70),
        y - height * 0.02,
        x + width * (0.15 + random() * 0.70),
        y + height * 1.02,
        5,
        random,
        [],
        width * 0.20
      );
      ctx.save();
      ctx.globalAlpha = 0.54 * intensity;
      ctx.strokeStyle = `hsla(${hue},92%,72%,.72)`;
      ctx.lineWidth = width * 0.016;
      ctx.shadowColor = `hsla(${hue},100%,72%,.92)`;
      ctx.shadowBlur = width * 0.045;
      strokePath(ctx, path);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.94 * intensity;
      ctx.strokeStyle = `hsla(${hue},45%,97%,.98)`;
      ctx.lineWidth = width * 0.0045;
      ctx.shadowColor = `hsla(${hue},100%,92%,.92)`;
      ctx.shadowBlur = width * 0.018;
      strokePath(ctx, path);
      ctx.restore();
    }
  } else if (state.effect === "flame") {
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 170; i += 1) {
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
  } else if (state.effect === "galaxy") {
    const gradient = ctx.createRadialGradient(x + width*.47, y + height*.42, 0, x + width*.47, y + height*.42, width*.65);
    gradient.addColorStop(0, "rgba(206,102,255,.36)");
    gradient.addColorStop(.32, "rgba(55,105,235,.28)");
    gradient.addColorStop(1, "rgba(8,4,23,.65)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x,y,width,height);
    for (let i = 0; i < 260; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${.28 + random()*.62})`;
      const size = width * (.001 + random()*.003);
      ctx.fillRect(x+random()*width,y+random()*height,size,size);
    }
  }
  ctx.restore();
}

async function drawMaskedExportEffect(ctx, d, x, y, width, height, random, opacityScale, side) {
  if (side !== "front" || !state.customFoilOn || !state.customFoilMask || state.effect === "none") {
    drawExportEffect(ctx, d, x, y, width, height, random, opacityScale);
    return;
  }
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext("2d");
  drawExportEffect(layerCtx, d, 0, 0, width, height, random, opacityScale);
  const mask = await loadCanvasImage(state.customFoilMask);
  layerCtx.save();
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.drawImage(mask, 0, 0, width, height);
  layerCtx.restore();
  ctx.drawImage(layer, x, y, width, height);
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
    offscreenContext.fillStyle = state.signatureColor === "white" ? "#f7f7f7" : "#111318";
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

let previousFrame = performance.now();
function animate(now) {
  const delta = Math.min(40, now - previousFrame);
  previousFrame = now;
  if (state.motionOn && !isDragging) {
    motionElapsed += delta;
    state.autoRotY = Math.sin(motionElapsed * 0.00048) * 26;
    idleRotX = Math.sin(motionElapsed * 0.00072) * 4.2;
    if (!isPointerInside) {
      const lightX = 50 + Math.sin(motionElapsed * 0.00055) * 24;
      const lightY = 44 + Math.cos(motionElapsed * 0.00048) * 10;
      [refs.card3d, refs.slabShell].forEach((node) => {
        node.style.setProperty("--mx", `${lightX}%`);
        node.style.setProperty("--my", `${lightY}%`);
      });
    }
  }
  if (!isDragging) applyRotation();
  const angle = (now * 0.018) % 360;
  refs.card3d.style.setProperty("--rainbow-angle", `${angle}deg`);
  requestAnimationFrame(animate);
}

// ============================================================
// V6 card library, pack opening, compare, and achievements
// ============================================================

let libraryFilterState = { rarity: "all", style: "all", slab: "all", favOnly: false };
let compareMode = false;
let compareSelections = [];
let packPhase = "sealed";
let packTearProgress = 0;
let packAbortController = null;
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
    thumbnail: isSafeDataImage(candidate.thumbnail) ? candidate.thumbnail : createLibraryPlaceholder(fullState),
    fullState,
    createdAt: Number.isFinite(Number(candidate.createdAt)) ? Number(candidate.createdAt) : Date.now(),
    favorite: Boolean(candidate.favorite),
    source: candidate.source === AUTO_LIBRARY_SOURCE ? AUTO_LIBRARY_SOURCE : "manual",
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
    showToast("已保存卡片资料，部分图片将在下次联网时重新加载");
    return true;
  } catch (error) {
    console.warn("Minimal library save failed", error);
    showToast("卡牌库存储空间不足，请先导出并移除部分卡片");
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
  const library = loadLibrary();
  if (library.cards.length >= LIBRARY_MAX_CARDS) {
    showToast(`卡牌库已满，上限 ${LIBRARY_MAX_CARDS} 张`);
    return;
  }

  showToast("正在生成卡牌快照...");
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
  showToast(`${state.playerName} 已保存到卡牌库`);
}

// ============================================================
// V7 automatic NBA library builder
// ============================================================

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

function applyPlayerFacts(cardState, player) {
  const presetKey = Object.keys(TEAM_PRESETS).find((key) => TEAM_PRESETS[key].abbr === player.abbr) || "";
  return normalizeState({
    ...cardState,
    playerName: player.name,
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

async function createAutoLibraryThumbnail(cardState) {
  const previousState = state;
  try {
    state = normalizeState(cardState);
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
    state = previousState;
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
    state = normalizeState(originalState);
    hydrateInputs();
    render();
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

async function loadFromLibrary(cardId) {
  const card = loadLibrary().cards.find((item) => item.id === cardId);
  if (!card) {
    showToast("未找到该卡片");
    return;
  }
  state = normalizeState(card.fullState);
  hydrateInputs();
  render();
  closeLibraryDrawer();
  showToast(`已加载 ${card.name}`);

  try {
    const restoredImages = await restoreLibraryCardImages(card.fullState);
    if (!Object.values(restoredImages).some(Boolean)) return;
    state = normalizeState({ ...state, ...restoredImages });
    hydrateInputs();
    render();
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
  showToast("卡片已从库中移除");
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
    showToast("卡牌库为空");
    return;
  }
  downloadBlob(new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }), `card_library_${Date.now()}.json`);
  showToast(`已导出 ${library.cards.length} 张卡片`);
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
      const existingIds = new Set(library.cards.map((card) => card.id));
      let added = 0;
      for (const candidate of imported.cards) {
        if (library.cards.length >= LIBRARY_MAX_CARDS) break;
        const card = normalizeLibraryCard(candidate);
        if (!card || existingIds.has(card.id)) continue;
        library.cards.push(card);
        existingIds.add(card.id);
        added += 1;
      }
      const unlocks = checkAchievements(library);
      if (await saveLibraryResilient(library)) {
        updateLibraryDrawer();
        updateBackgroundMosaic();
        announceAchievements(unlocks);
        showToast(`已导入 ${added} 张新卡片`);
      }
    } catch (error) {
      console.warn("Library import failed", error);
      showToast("卡牌库文件格式无效");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function openLibraryDrawer() {
  updateLibraryDrawer();
  $("#libraryDrawer").classList.add("open");
  $("#libraryDrawer").setAttribute("aria-hidden", "false");
  $("#libraryOverlay").classList.add("visible");
  $("#libraryCloseBtn").focus();
}

function closeLibraryDrawer() {
  $("#libraryDrawer").classList.remove("open");
  $("#libraryDrawer").setAttribute("aria-hidden", "true");
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
  showToast(`已选择 ${compareSelections.length} / 2 张卡片`);
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

function adjustColor(hex, amount) {
  const number = parseInt(hex.slice(1), 16);
  const red = clamp(((number >> 16) & 255) + amount, 0, 255);
  const green = clamp(((number >> 8) & 255) + amount, 0, 255);
  const blue = clamp((number & 255) + amount, 0, 255);
  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}

function openPackExperience() {
  const library = loadLibrary();
  if (library.cards.length < 3) {
    showToast("卡牌库中至少需要 3 张卡片才能体验拆包");
    return;
  }
  packAbortController?.abort();
  packAbortController = new AbortController();
  const signal = packAbortController.signal;
  const pack = $("#packOpening");
  const envelope = $("#packEnvelope");
  const tear = $("#packTear");
  const container = $("#packCards");
  const closeButton = $("#packCloseBtn");
  const cardCount = Math.min(library.cards.length, library.cards.length >= 5 ? 5 : 3);
  const rarityOrder = { base: 0, silver: 1, rwb: 2, neon: 3, gold: 4, black: 5 };
  const cards = [...library.cards].sort(() => Math.random() - 0.5).slice(0, cardCount).sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

  pack.hidden = false;
  packPhase = "sealed";
  packTearProgress = 0;
  $("#packSeries").textContent = STYLE_META[cards.at(-1).style]?.name || "CUSTOM EDITION";
  envelope.style.cssText = "";
  tear.style.height = "0";
  container.replaceChildren();
  container.style.display = "none";
  closeButton.classList.remove("visible");
  envelope.focus();

  let dragStartY = 0;
  const finishOpening = () => {
    if (["opened", "revealing", "done"].includes(packPhase)) return;
    packPhase = "opened";
    packTearProgress = 1;
    tear.style.height = "100%";
    revealPackCards(cards, envelope, container, closeButton);
  };
  envelope.addEventListener("pointerdown", (event) => {
    if (packPhase !== "sealed") return;
    dragStartY = event.clientY;
    packPhase = "tearing";
    envelope.setPointerCapture?.(event.pointerId);
  }, { signal });
  envelope.addEventListener("pointermove", (event) => {
    if (packPhase !== "tearing") return;
    packTearProgress = clamp((event.clientY - dragStartY) / 190, 0, 1);
    tear.style.height = `${packTearProgress * 100}%`;
    envelope.style.transform = `rotateZ(${packTearProgress * 1.8}deg)`;
    if (packTearProgress >= 0.98) finishOpening();
  }, { signal });
  envelope.addEventListener("pointerup", () => {
    if (packPhase !== "tearing") return;
    if (packTearProgress >= 0.72) finishOpening();
    else {
      packPhase = "sealed";
      packTearProgress = 0;
      tear.style.height = "0";
      envelope.style.transform = "";
    }
  }, { signal });
  envelope.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      finishOpening();
    }
  }, { signal });
  closeButton.addEventListener("click", closePackExperience, { signal });
}

async function revealPackCards(cards, envelope, container, closeButton) {
  envelope.style.transition = "opacity 0.38s ease, transform 0.38s ease";
  envelope.style.opacity = "0";
  envelope.style.transform = "scale(0.82) rotateZ(4deg)";
  await sleep(390);
  if (packPhase !== "opened") return;
  envelope.style.display = "none";
  container.style.display = "flex";
  container.innerHTML = cards.map((card, index) => `
    <button class="pack-card-slot rarity-${escapeHtml(card.rarity)}" type="button" data-pack-index="${index}" aria-label="翻开第 ${index + 1} 张卡">
      <span class="pack-card-inner"><span class="pack-card-face pack-card-face-front"><strong>CB</strong></span><span class="pack-card-face pack-card-face-back"><img src="${escapeHtml(card.thumbnail)}" alt="${escapeHtml(card.name)}"></span></span>
    </button>
  `).join("");
  packPhase = "revealing";
  let revealedCount = 0;
  container.querySelectorAll(".pack-card-slot").forEach((slot, index) => {
    slot.addEventListener("click", () => {
      const inner = slot.querySelector(".pack-card-inner");
      if (inner.classList.contains("revealed")) return;
      inner.classList.add("revealed");
      slot.setAttribute("aria-label", `${cards[index].name}，已翻开`);
      revealedCount += 1;
      if (["gold", "black", "neon"].includes(cards[index].rarity)) flashPackRarity(cards[index].rarity);
      if (revealedCount === cards.length) {
        packPhase = "done";
        closeButton.classList.add("visible");
        closeButton.focus();
      }
    }, { signal: packAbortController.signal });
  });
  const library = loadLibrary();
  library.stats.packsOpened = Number(library.stats.packsOpened || 0) + 1;
  await saveLibraryResilient(library);
}

function flashPackRarity(rarity) {
  const flash = document.createElement("div");
  flash.className = `pack-rarity-flash flash-${rarity}`;
  document.body.appendChild(flash);
  window.setTimeout(() => flash.remove(), 620);
}

function closePackExperience() {
  $("#packOpening").hidden = true;
  packPhase = "sealed";
  packAbortController?.abort();
  packAbortController = null;
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function startCompareMode() {
  if (loadLibrary().cards.length < 2) {
    showToast("卡牌库中至少需要 2 张卡片才能进行对比");
    return;
  }
  compareMode = true;
  compareSelections = [];
  openLibraryDrawer();
  showToast("请在卡牌库中选择两张卡片进行对比");
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
    window.setTimeout(() => showToast(`成就解锁: ${achievement.name}`), index * 950);
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
      showToast(`球星卡校验完成：${parts.slice(0, 2).join("，")}`);
      window.setTimeout(openLibraryDrawer, 700);
    } else if (result.partial) {
      status.textContent = "卡牌库空间不足，未添加新卡";
      showToast("卡牌库已满，请先导出并移除部分卡片");
    } else {
      status.textContent = "25 位球星资料与图片均为最新版校验数据";
      showToast("球星卡资料校验通过");
      window.setTimeout(openLibraryDrawer, 500);
    }
  } catch (error) {
    console.error("Auto library build failed", error);
    const persistedCreated = Number(error.persistedCreated) || 0;
    const persistedRepaired = Number(error.persistedRepaired) || 0;
    const persisted = persistedCreated + persistedRepaired;
    status.textContent = persisted ? `存储空间不足 · 已处理 ${persisted} 张` : "生成失败，请重试";
    showToast(persisted ? `已处理 ${persisted} 张，剩余卡片可稍后续建` : "自动建库失败");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    label.textContent = "校验 / 建库 · 25 位 NBA 球星";
    autoBuildHideTimer = window.setTimeout(() => {
      progressWrap.hidden = true;
    }, 4500);
  }
}

function bindV6Events() {
  bindLibraryEvents();
  $("#autoBuildBtn")?.addEventListener("click", runAutoBuildFromUI);
  $("#packOpenBtn")?.addEventListener("click", openPackExperience);
  $("#cardCompareBtn")?.addEventListener("click", startCompareMode);
  $("#compareCloseBtn")?.addEventListener("click", closeCompare);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("#packOpening").hidden) closePackExperience();
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
      PLAYER_REGISTRY_LOADED = true;
    } else {
      window.PLAYER_REGISTRY = {};
    }
  } catch (error) {
    console.warn("Player registry load failed", error);
    window.PLAYER_REGISTRY = {};
  }
  const library = loadLibrary();
  const unlocks = checkAchievements(library);
  if (unlocks.length) await saveLibraryResilient(library);
  updateLibraryDrawer();
}

window.cardBuilder3D = {
  getState: getThreePreviewState,
  renderCardCanvas: renderThreeCardCanvas,
  setView: setThreePreviewView,
  flip: flipCard,
  reset: resetView,
  toggleMotion
};

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
  state = normalizeState(fullState);
  hydrateInputs();
  render();
};

window.dispatchEvent(new CustomEvent("cardbuilder:bridge-ready"));

bindSignaturePad();
bindSignatureUpload();
bindFoilMaskPad();
hydrateInputs();
bindInterface();
render();
hydrateShowcaseSignatureAsset();
requestAnimationFrame(animate);
initializeV6();
