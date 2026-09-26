// Card Builder — Constants & Configuration
// Extracted from app.js for ES module architecture

const STORAGE_KEY = "card-builder-project-v3";
const LIBRARY_STORAGE_KEY = "card-builder-library-v1";
const LIBRARY_ASSET_DB_NAME = "card-builder-library-assets-v1";
const LIBRARY_ASSET_STORE = "images";
const LIBRARY_MAX_CARDS = 200;
const PROJECT_VERSION = 7;
const AUTO_LIBRARY_SOURCE = "auto-nba-v7";
const AUTO_LIBRARY_DATA_VERSION = 4;
const CURATED_LIBRARY_URL = "data/curated-library.json?v=6";
const CURATED_SHOWCASE_SOURCE = "curated-showcase-v1";
const CURATED_PLAYER_MEDIA_SOURCE = "curated-player-media-v1";
const KNOWN_LIBRARY_SOURCES = new Set(["manual", AUTO_LIBRARY_SOURCE, CURATED_SHOWCASE_SOURCE, CURATED_PLAYER_MEDIA_SOURCE]);
const SHOWCASE_PLAYER_IMAGE = "assets/cooper-flagg-home.png";
const SHOWCASE_TEAM_LOGO = "assets/dallas-mavericks-logo.svg";
const SHOWCASE_SIGNATURE_IMAGE = "assets/cooper-flagg-showcase-signature.svg";
const SHOWCASE_SIGNATURE_SOURCE = "assets/cooper-flagg-signature-source.png";
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|webp|jpeg);base64,/i;
const SAFE_SIGNATURE_ASSET_URL = /^assets\/signatures\/[a-z0-9][a-z0-9._-]*\.(?:png|webp)$/i;
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
  playerId: "nba_1642843",
  playerMediaId: "pm_project_cooper_flagg_showcase",
  playerImageCategory: "profile",
  playerImageCredit: "Card Builder project asset",
  playerImageCapturedAt: null,
  playerImageTeamAtCapture: "DAL",
  playerImageLicenseSnapshot: "review_required",
  logoImg: SHOWCASE_TEAM_LOGO,
  logoScale: 100,
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

function normalizeEffectIntensity(effect, value) {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 64;
  if (effect === "galaxy") return Math.min(safeValue, 10);
  if (effect === "crystal") return 32;
  if (effect === "diamond") return 18;
  return safeValue;
}

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

const NBA_PLAYER_FIELDS = [
  "name", "number", "position", "team", "abbr", "primary", "secondary", "height", "weight",
  "hometown", "draft", "season", "gp", "ppg", "rpg", "apg", "fg", "tp", "bio", "nbaId",
  "logoCode", "espnId"
];

const NBA_PLAYER_ROWS = [
  ["SHAI GILGEOUS-ALEXANDER", "2", "PG", "OKLAHOMA CITY THUNDER", "OKC", "#007AC1", "#EF6100", "6'6\"", "195 LB", "TORONTO, ON, CANADA", "2018 / ROUND 1 / PICK 11", "2025-26", "68", "31.1", "4.3", "6.6", "55.3", "38.6", "2024-25 MVP and scoring champion. An elite two-way creator with silky mid-range craft and lockdown perimeter defense.", "1628983", "thunder", "4278073"],
  ["GIANNIS ANTETOKOUNMPO", "7", "PF", "MIAMI HEAT", "MIA", "#98002E", "#F9A01B", "6'11\"", "243 LB", "ATHENS, GREECE", "2013 / ROUND 1 / PICK 15", "2025-26", "36", "27.6", "9.8", "5.4", "62.4", "33.3", "A two-time MVP and NBA champion whose downhill power, length and playmaking make him one of basketball's defining two-way forces. Miami acquired him in June 2026.", "203507", "heat", "3032977"],
  ["BAM ADEBAYO", "13", "C", "MIAMI HEAT", "MIA", "#98002E", "#F9A01B", "6'9\"", "255 LB", "NEWARK, NEW JERSEY", "2017 / ROUND 1 / PICK 14", "2025-26", "73", "20.1", "10.0", "3.2", "44.2", "31.8", "A versatile Miami cornerstone who anchors elite defenses, switches across positions and adds screening, passing and interior scoring on offense.", "1628389", "heat", "4066261"],
  ["NIKOLA JOKIC", "15", "C", "DENVER NUGGETS", "DEN", "#0E2240", "#FEC524", "6'11\"", "284 LB", "SOMBOR, SERBIA", "2014 / ROUND 2 / PICK 41", "2025-26", "65", "27.7", "12.9", "10.7", "56.9", "38.0", "Three-time MVP with generational passing vision, orchestrating Denver's offense with surgical precision from the center position.", "203999", "nuggets", "3112335"],
  ["LUKA DONCIC", "77", "PG", "LOS ANGELES LAKERS", "LAL", "#552583", "#FDB927", "6'7\"", "230 LB", "LJUBLJANA, SLOVENIA", "2018 / ROUND 1 / PICK 3", "2025-26", "64", "33.5", "7.7", "8.3", "47.6", "36.6", "A generational playmaker with an unguardable step-back three, elite shot creation and exceptional court vision.", "1629029", "lakers", "3945274"],
  ["ANTHONY EDWARDS", "5", "SG", "MINNESOTA TIMBERWOLVES", "MIN", "#0C2340", "#236192", "6'4\"", "225 LB", "ATLANTA, GEORGIA", "2020 / ROUND 1 / PICK 1", "2025-26", "61", "28.8", "5.0", "3.7", "48.9", "39.9", "An explosive two-way guard who pairs thunderous athleticism with rapidly improving perimeter shooting.", "1630162", "timberwolves", "4594268"],
  ["JAYSON TATUM", "0", "SF", "BOSTON CELTICS", "BOS", "#007A33", "#BA9653", "6'8\"", "210 LB", "ST. LOUIS, MISSOURI", "2017 / ROUND 1 / PICK 3", "2025-26", "16", "21.8", "10.0", "5.3", "41.1", "32.9", "A championship cornerstone and elite three-level scorer who returned from an Achilles tear to play 16 games in 2025-26.", "1628369", "celtics", "4065648"],
  ["KEVIN DURANT", "7", "SF", "HOUSTON ROCKETS", "HOU", "#CE1141", "#000000", "6'10\"", "240 LB", "WASHINGTON, D.C.", "2007 / ROUND 1 / PICK 2", "2025-26", "78", "26.0", "5.5", "4.8", "52.0", "41.3", "An all-time great scorer who joined Houston in a record seven-team 2025 offseason deal, bringing length, handle and feathery touch to the Rockets' young core.", "201142", "rockets", "3202"],
  ["STEPHEN CURRY", "30", "PG", "GOLDEN STATE WARRIORS", "GSW", "#1D428A", "#FFC72C", "6'2\"", "185 LB", "AKRON, OHIO", "2009 / ROUND 1 / PICK 7", "2025-26", "43", "26.6", "3.6", "4.7", "46.8", "39.3", "The greatest shooter ever, a four-time champion whose range and off-ball movement transformed modern basketball.", "201939", "warriors", "3975"],
  ["LEBRON JAMES", "23", "SF", "PHILADELPHIA 76ERS", "PHI", "#006BB6", "#ED174C", "6'9\"", "250 LB", "AKRON, OHIO", "2003 / ROUND 1 / PICK 1", "2025-26", "60", "20.9", "6.1", "7.2", "51.5", "31.7", "The NBA's all-time scoring leader and a four-time champion, pairing elite court vision with transition power and remarkable longevity. He signed with Philadelphia in July 2026.", "2544", "76ers", "1966"],
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
  ["KLAY THOMPSON", "31", "SG", "DALLAS MAVERICKS", "DAL", "#00538C", "#BBC4CA", "6'6\"", "215 LB", "LOS ANGELES, CALIFORNIA", "2011 / ROUND 1 / PICK 11", "2025-26", "69", "11.7", "2.1", "1.4", "39.3", "38.3", "One of the greatest shooters in NBA history and a four-time champion whose lightning release and off-ball movement defined Golden State's dynasty; now a veteran wing in Dallas.", "202691", "mavericks", "6475"],
  ["P.J. WASHINGTON", "25", "PF", "DALLAS MAVERICKS", "DAL", "#00538C", "#BBC4CA", "6'7\"", "230 LB", "LOUISVILLE, KENTUCKY", "2019 / ROUND 1 / PICK 12", "2025-26", "56", "14.2", "7.0", "1.8", "45.0", "32.5", "A versatile two-way forward whose rim pressure, switchable defense and corner shooting make him a rugged playoff wing for Dallas.", "1629023", "mavericks", "4278078"],
  ["JAMES HARDEN", "1", "PG", "CLEVELAND CAVALIERS", "CLE", "#860038", "#FDBB30", "6'5\"", "220 LB", "LOS ANGELES, CALIFORNIA", "2009 / ROUND 1 / PICK 3", "2025-26", "70", "23.6", "4.8", "8.0", "43.4", "37.5", "A former MVP and masterful floor general who joined Cleveland in a February 2026 trade, pairing crafty playmaking with elite court vision.", "201935", "cavaliers", "3992"]
];

const NBA_PLAYERS_DB = NBA_PLAYER_ROWS.map((row) => Object.fromEntries(NBA_PLAYER_FIELDS.map((field, index) => [field, row[index]])))
  .map((player) => ({ ...player, playerId: `nba_${player.nbaId}`, isRookie: player.name === "COOPER FLAGG" }));

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

export {
  STORAGE_KEY, LIBRARY_STORAGE_KEY, LIBRARY_ASSET_DB_NAME, LIBRARY_ASSET_STORE,
  LIBRARY_MAX_CARDS, PROJECT_VERSION, AUTO_LIBRARY_SOURCE, AUTO_LIBRARY_DATA_VERSION,
  CURATED_LIBRARY_URL, CURATED_SHOWCASE_SOURCE, CURATED_PLAYER_MEDIA_SOURCE,
  KNOWN_LIBRARY_SOURCES, SHOWCASE_PLAYER_IMAGE, SHOWCASE_TEAM_LOGO,
  SHOWCASE_SIGNATURE_IMAGE, SHOWCASE_SIGNATURE_SOURCE,
  SAFE_IMAGE_DATA_URL, SAFE_SIGNATURE_ASSET_URL, SAFE_UPLOAD_IMAGE_TYPES, TRUSTED_IMAGE_HOSTS,
  DEFAULT_STATE, STYLE_META, EFFECT_META, RARITY_META, POSITION_MAP,
  SIGNATURE_COLOR_MAP, TEAM_PRESETS,
  NBA_PLAYER_FIELDS, NBA_PLAYER_ROWS, NBA_PLAYERS_DB, NBA_TEAM_IDS, NBA_CDN,
  FIELD_IDS
};
