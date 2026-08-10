import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inboxDirectory = path.join(root, "assets", "player-media", "inbox");
const privateRoot = path.join(root, ".local", "player-media");
const cardDirectory = path.join(privateRoot, "card");
const thumbDirectory = path.join(privateRoot, "thumb");
const curatedRoot = path.join(root, "assets", "player-media", "curated");
const curatedCardDirectory = path.join(curatedRoot, "card");
const curatedThumbDirectory = path.join(curatedRoot, "thumb");
const importDirectory = path.join(root, ".local", "card-library");
const publicLogoDirectory = path.join(root, "assets", "team-logos");
const curatedLibraryPath = path.join(root, "data", "curated-library.json");
const manifestPath = path.join(root, "data", "player-media-manual-review.json");
const registryPath = path.join(root, "data", "player-registry.json");
const publicMediaPath = path.join(root, "data", "player-media.json");
const featuredCardPath = path.join(root, "server", "featured-card.json");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
const publicMedia = JSON.parse(await fs.readFile(publicMediaPath, "utf8"));
const featuredCard = JSON.parse(await fs.readFile(featuredCardPath, "utf8"));

const teamMeta = {
  DAL: { name: "DALLAS MAVERICKS", primary: "#00538C", secondary: "#BBC4CA" },
  GSW: { name: "GOLDEN STATE WARRIORS", primary: "#1D428A", secondary: "#FFC72C" },
  MIN: { name: "MINNESOTA TIMBERWOLVES", primary: "#0C2340", secondary: "#236192" },
  NYK: { name: "NEW YORK KNICKS", primary: "#006BB6", secondary: "#F58426" },
  WAS: { name: "WASHINGTON WIZARDS", primary: "#E31837", secondary: "#002B5C" },
  ATL: { name: "ATLANTA HAWKS", primary: "#E03A3E", secondary: "#C1D32F" },
  MIA: { name: "MIAMI HEAT", primary: "#98002E", secondary: "#F9A01B" },
  DET: { name: "DETROIT PISTONS", primary: "#C8102E", secondary: "#1D42BA" },
  LAL: { name: "LOS ANGELES LAKERS", primary: "#552583", secondary: "#FDB927" },
  HOU: { name: "HOUSTON ROCKETS", primary: "#CE1141", secondary: "#000000" },
  OKC: { name: "OKLAHOMA CITY THUNDER", primary: "#007AC1", secondary: "#EF6100" },
  PHI: { name: "PHILADELPHIA 76ERS", primary: "#006BB6", secondary: "#ED174C" },
  BOS: { name: "BOSTON CELTICS", primary: "#007A33", secondary: "#BA9653" },
  BKN: { name: "BROOKLYN NETS", primary: "#000000", secondary: "#FFFFFF" },
  CHA: { name: "CHARLOTTE HORNETS", primary: "#1D1160", secondary: "#00788C" },
  CHI: { name: "CHICAGO BULLS", primary: "#CE1141", secondary: "#000000" },
  CLE: { name: "CLEVELAND CAVALIERS", primary: "#860038", secondary: "#FDBB30" },
  DEN: { name: "DENVER NUGGETS", primary: "#0E2240", secondary: "#FEC524" },
  IND: { name: "INDIANA PACERS", primary: "#002D62", secondary: "#FDBB30" },
  MEM: { name: "MEMPHIS GRIZZLIES", primary: "#5D76A9", secondary: "#EAAA00" },
  MIL: { name: "MILWAUKEE BUCKS", primary: "#00471B", secondary: "#EEE1C6" },
  NOP: { name: "NEW ORLEANS PELICANS", primary: "#0C2340", secondary: "#C8102E" },
  PHX: { name: "PHOENIX SUNS", primary: "#1D1160", secondary: "#E56020" },
  POR: { name: "PORTLAND TRAIL BLAZERS", primary: "#E03A3E", secondary: "#000000" },
  SAC: { name: "SACRAMENTO KINGS", primary: "#5A2D81", secondary: "#63727A" },
  SAS: { name: "SAN ANTONIO SPURS", primary: "#000000", secondary: "#C4CED4" },
  TOR: { name: "TORONTO RAPTORS", primary: "#CE1141", secondary: "#A1A1A4" },
  UTA: { name: "UTAH JAZZ", primary: "#002B5C", secondary: "#F9A01B" },
  USA: { name: "USA BASKETBALL", primary: "#002868", secondary: "#BF0A30" }
};

const teamLogoFiles = {
  DAL: "MAVS.png",
  GSW: "GSW.png",
  MIN: "Minnesota Timberwolves.png",
  WAS: "WIZARDS.png",
  ATL: "HAWS.png",
  MIA: "Miami Heat.png",
  DET: " Detroit Pistons .png",
  LAL: "lakers.png",
  HOU: "Houston Rockets.png",
  OKC: "Oklahoma City Thunder.png",
  PHI: "Philadelphia 76ers .png",
  BOS: "Boston Celtics.png",
  BKN: "Brooklyn Nets .png",
  CHA: " Charlotte Hornets.png",
  CHI: "Chicago Bulls.png",
  CLE: " Cleveland Cavaliers.png",
  DEN: "Denver Nuggets.png",
  IND: "Pacers.png",
  MEM: "Memphis Grizzlies.png",
  MIL: " Milwaukee Bucks.png",
  NOP: "New Orleans Pelicans.png",
  PHX: "SUNS.png",
  POR: "Portland Trail Blazers.png",
  SAC: "acramento Kings.png",
  SAS: "San Antonio Spurs .png",
  TOR: "Raptors.png",
  UTA: "Utah Jazz .png"
};

const officialTeamLogoUrls = {
  ATL: "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
  BOS: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
  BKN: "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
  CHA: "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
  CHI: "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
  CLE: "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
  DAL: "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
  DEN: "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
  DET: "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
  GSW: "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
  HOU: "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
  IND: "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg",
  LAL: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
  MEM: "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
  MIA: "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
  MIL: "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
  MIN: "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
  NOP: "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
  NYK: "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
  OKC: "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
  PHI: "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
  PHX: "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
  POR: "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
  SAC: "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
  SAS: "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
  TOR: "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
  UTA: "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
  WAS: "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg"
};

// Verified against the 2025-26 rows already used by the in-app NBA player
// database. A transferred player keeps the current team/number while the back
// shows the complete season line across teams.
const playerProfiles = {
  "cooper flagg": {
    height: "6'9\"", weight: "205 LB", hometown: "NEWPORT, MAINE",
    draft: "2025 / ROUND 1 / PICK 1", season: "2025-26",
    gp: "70", ppg: "21.0", rpg: "6.7", apg: "4.5", fg: "46.8", tp: "29.5",
    bio: "The 2025 No. 1 pick delivered a strong Dallas rookie season, flashing elite passing instincts, versatile defense and a rapidly improving jumper.",
    sourceUrl: "https://www.nba.com/stats/player/1642843?Season=2025-26&SeasonType=Regular%20Season"
  },
  "stephen curry": {
    height: "6'2\"", weight: "185 LB", hometown: "AKRON, OHIO",
    draft: "2009 / ROUND 1 / PICK 7", season: "2025-26",
    gp: "43", ppg: "26.6", rpg: "3.6", apg: "4.7", fg: "46.8", tp: "39.3",
    bio: "The greatest shooter ever, a four-time champion whose range and off-ball movement transformed modern basketball.",
    sourceUrl: "https://www.nba.com/stats/player/201939?Season=2025-26&SeasonType=Regular%20Season"
  },
  "anthony edwards": {
    height: "6'4\"", weight: "225 LB", hometown: "ATLANTA, GEORGIA",
    draft: "2020 / ROUND 1 / PICK 1", season: "2025-26",
    gp: "61", ppg: "28.8", rpg: "5.0", apg: "3.7", fg: "48.9", tp: "39.9",
    bio: "An explosive two-way guard who pairs thunderous athleticism with rapidly improving perimeter shooting.",
    sourceUrl: "https://www.nba.com/stats/player/1630162?Season=2025-26&SeasonType=Regular%20Season"
  },
  "jalen brunson": {
    height: "6'2\"", weight: "190 LB", hometown: "BURLINGTON, NEW JERSEY",
    draft: "2018 / ROUND 2 / PICK 33", season: "2025-26",
    gp: "74", ppg: "26.0", rpg: "3.3", apg: "6.8", fg: "46.7", tp: "36.9",
    bio: "A second-round steal turned franchise cornerstone, thriving through footwork, strength and fearless mid-range shot making.",
    sourceUrl: "https://www.nba.com/stats/player/1628973?Season=2025-26&SeasonType=Regular%20Season"
  },
  "james harden": {
    height: "6'5\"", weight: "220 LB", hometown: "LOS ANGELES, CALIFORNIA",
    draft: "2009 / ROUND 1 / PICK 3", season: "2025-26",
    gp: "70", ppg: "23.6", rpg: "4.8", apg: "8.0", fg: "43.4", tp: "37.5",
    bio: "A former MVP and masterful floor general who joined Cleveland in a February 2026 trade, pairing crafty playmaking with elite court vision.",
    sourceUrl: "https://www.nba.com/player/201935/james-harden"
  },
  "giannis antetokounmpo": {
    height: "6'11\"", weight: "243 LB", hometown: "ATHENS, GREECE",
    draft: "2013 / ROUND 1 / PICK 15", season: "2025-26",
    gp: "36", ppg: "27.6", rpg: "9.8", apg: "5.4", fg: "62.4", tp: "33.3",
    bio: "A two-time MVP and NBA champion whose downhill power, length and playmaking make him one of basketball's defining two-way forces. Miami acquired him in June 2026.",
    sourceUrl: "https://www.nba.com/player/203507/giannis-antetokounmpo"
  },
  "bam adebayo": {
    height: "6'9\"", weight: "255 LB", hometown: "NEWARK, NEW JERSEY",
    draft: "2017 / ROUND 1 / PICK 14", season: "2025-26",
    gp: "73", ppg: "20.1", rpg: "10.0", apg: "3.2", fg: "44.2", tp: "31.8",
    bio: "A versatile Miami cornerstone who anchors elite defenses, switches across positions and adds screening, passing and interior scoring on offense.",
    sourceUrl: "https://www.nba.com/stats/player/1628389/traditional"
  },
  "kyrie irving": {
    height: "6'2\"", weight: "195 LB", hometown: "MELBOURNE, AUSTRALIA",
    draft: "2011 / ROUND 1 / PICK 1", season: "2025-26",
    gp: "50", ppg: "24.7", rpg: "4.8", apg: "4.6", fg: "47.3", tp: "40.1",
    bio: "A mesmerizing ball-handler and impossible finisher whose ambidextrous touch turns broken possessions into art. Out for the 2025-26 season with a knee injury; stats shown are from 2024-25.",
    sourceUrl: "https://www.nba.com/player/202681/kyrie-irving"
  },
  "klay thompson": {
    height: "6'6\"", weight: "215 LB", hometown: "LOS ANGELES, CALIFORNIA",
    draft: "2011 / ROUND 1 / PICK 11", season: "2025-26",
    gp: "69", ppg: "11.7", rpg: "2.1", apg: "1.4", fg: "39.3", tp: "38.3",
    bio: "One of the greatest shooters in NBA history and a four-time champion whose lightning release and off-ball movement defined Golden State's dynasty; now a veteran wing in Dallas.",
    sourceUrl: "https://www.nba.com/stats/player/202691?Season=2025-26&SeasonType=Regular%20Season"
  },
  "cade cunningham": {
    height: "6'6\"", weight: "220 LB", hometown: "ARLINGTON, TEXAS",
    draft: "2021 / ROUND 1 / PICK 1", season: "2025-26",
    gp: "64", ppg: "23.9", rpg: "5.5", apg: "9.9", fg: "46.1", tp: "34.2",
    bio: "A big, poised floor general with a complete scoring package and elite vision, leading Detroit's resurgence.",
    sourceUrl: "https://www.nba.com/stats/player/1630595?Season=2025-26&SeasonType=Regular%20Season"
  },
  "devin booker": {
    height: "6'5\"", weight: "206 LB", hometown: "GRAND RAPIDS, MICHIGAN",
    draft: "2015 / ROUND 1 / PICK 13", season: "2025-26",
    gp: "64", ppg: "26.1", rpg: "3.9", apg: "6.0", fg: "45.6", tp: "33.0",
    bio: "A lethal three-level scorer with silky footwork, elite shot-making and precise passing from either guard spot. Will wear No. 15 from 2026-27 in honor of his father.",
    sourceUrl: "https://www.nba.com/stats/player/1626164?Season=2025-26&SeasonType=Regular%20Season"
  },
  "pj washington": {
    height: "6'7\"", weight: "230 LB", hometown: "LOUISVILLE, KENTUCKY",
    draft: "2019 / ROUND 1 / PICK 12", season: "2025-26",
    gp: "56", ppg: "14.2", rpg: "7.0", apg: "1.8", fg: "45.0", tp: "32.5",
    bio: "A versatile two-way forward whose rim pressure, switchable defense and corner shooting make him a rugged playoff wing for Dallas.",
    sourceUrl: "https://www.nba.com/stats/player/1629023?Season=2025-26&SeasonType=Regular%20Season"
  },
  "luka doncic": {
    height: "6'7\"", weight: "230 LB", hometown: "LJUBLJANA, SLOVENIA",
    draft: "2018 / ROUND 1 / PICK 3", season: "2025-26",
    gp: "64", ppg: "33.5", rpg: "7.7", apg: "8.3", fg: "47.6", tp: "36.6",
    bio: "A generational playmaker with an unguardable step-back three, elite shot creation and exceptional court vision.",
    sourceUrl: "https://www.nba.com/stats/player/1629029?Season=2025-26&SeasonType=Regular%20Season"
  },
  "lebron james": {
    height: "6'9\"", weight: "250 LB", hometown: "AKRON, OHIO",
    draft: "2003 / ROUND 1 / PICK 1", season: "2025-26",
    gp: "60", ppg: "20.9", rpg: "6.1", apg: "7.2", fg: "51.5", tp: "31.7",
    bio: "The NBA's all-time scoring leader and a four-time champion, pairing elite court vision with transition power and remarkable longevity. He signed with Philadelphia in July 2026.",
    sourceUrl: "https://www.nba.com/player/2544/lebron-james"
  },
  "kevin durant": {
    height: "6'10\"", weight: "240 LB", hometown: "WASHINGTON, D.C.",
    draft: "2007 / ROUND 1 / PICK 2", season: "2025-26",
    gp: "78", ppg: "26.0", rpg: "5.5", apg: "4.8", fg: "52.0", tp: "41.3",
    bio: "An all-time great scorer whose rare length, handle and feathery touch let him create efficient offense from anywhere on the floor.",
    sourceUrl: "https://www.nba.com/player/201142/kevin-durant"
  },
  "tyrese maxey": {
    height: "6'2\"", weight: "200 LB", hometown: "DALLAS, TEXAS",
    draft: "2020 / ROUND 1 / PICK 21", season: "2025-26",
    gp: "70", ppg: "28.3", rpg: "4.1", apg: "6.6", fg: "46.2", tp: "36.7",
    bio: "A blazing-fast guard whose end-to-end speed, pull-up shooting and improving playmaking pressure every level of a defense.",
    sourceUrl: "https://www.nba.com/stats/player/1630178?Season=2025-26&SeasonType=Regular%20Season"
  },
  "shai gilgeous-alexander": {
    height: "6'6\"", weight: "195 LB", hometown: "TORONTO, ON, CANADA",
    draft: "2018 / ROUND 1 / PICK 11", season: "2025-26",
    gp: "68", ppg: "31.1", rpg: "4.3", apg: "6.6", fg: "55.3", tp: "38.6",
    bio: "An MVP-level two-way creator whose change of pace, mid-range craft and perimeter defense drive Oklahoma City's championship ambitions.",
    sourceUrl: "https://www.nba.com/stats/player/1628983?Season=2025-26&SeasonType=Regular%20Season"
  },
  "trae young": {
    height: "6'1\"", weight: "180 LB", hometown: "NORMAN, OKLAHOMA",
    draft: "2018 / ROUND 1 / PICK 5", season: "2025-26",
    gp: "15", ppg: "17.9", rpg: "2.0", apg: "8.0", fg: "45.8", tp: "33.8",
    bio: "An electric lead guard who creates offense from deep range with audacious passing, floaters and constant pick-and-roll pressure. Traded to Washington in January 2026.",
    sourceUrl: "https://www.nba.com/gamenotes/wizards.pdf"
  }
};

const escapeXml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const slugify = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const deterministicUnit = (seed) => Number.parseInt(crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) / 0xffffffff;

const deterministicPick = (seed, values) => values[Math.min(values.length - 1, Math.floor(deterministicUnit(seed) * values.length))];

function buildCardNumber(item, index) {
  if (item.cardNum) return item.cardNum;
  const pools = {
    base: [299, 299, 99],
    silver: [299, 99, 99, 25],
    gold: [99, 99, 25, 25, 20, 20, 15, 15, 1],
    neon: [99, 25, 20, 15],
    rwb: [99, 25, 20, 15],
    black: [1]
  };
  const denominator = deterministicPick(`${item.file}:denominator`, pools[item.rarity] || pools.base);
  const numerator = denominator === 1
    ? 1
    : 1 + Math.floor(deterministicUnit(`${item.file}:${index}:numerator`) * denominator);
  return `${numerator}/${denominator}`;
}

function buildSlabType(item, cardNum) {
  if (item.slabType) return item.slabType;
  const denominator = Number(cardNum.split("/")[1]) || 299;
  const weighted = denominator === 1
    ? ["gallery", "crystal", "museum", "acrylic"]
    : denominator <= 15
      ? ["gallery", "crystal", "museum", "acrylic", "magnetic"]
      : denominator <= 25
        ? ["gallery", "crystal", "museum", "acrylic", "magnetic", "forge"]
        : denominator <= 99
          ? ["gallery", "crystal", "museum", "acrylic", "magnetic", "forge", "none", "none"]
          : ["acrylic", "magnetic", "forge", "museum", "none", "none", "none", "none"];
  return deterministicPick(`${item.file}:slab`, weighted);
}

const effectIntensityFor = (effect) => ({
  galaxy: 10,
  crystal: 32,
  diamond: 18,
  lightning: 20
}[effect] ?? 64);

const toDataUrl = (buffer, mimeType) => `data:${mimeType};base64,${buffer.toString("base64")}`;

const logoCache = new Map();

async function loadTeamLogoData(teamCode) {
  if (logoCache.has(teamCode)) return logoCache.get(teamCode);
  const localFile = teamLogoFiles[teamCode];
  let sourceBuffer = null;

  if (localFile) {
    try {
      sourceBuffer = await fs.readFile(path.join(inboxDirectory, localFile));
    } catch {
      sourceBuffer = null;
    }
  }

  if (!sourceBuffer && officialTeamLogoUrls[teamCode]) {
    const response = await fetch(officialTeamLogoUrls[teamCode]);
    if (!response.ok) throw new Error(`Could not load ${teamCode} logo (${response.status})`);
    sourceBuffer = Buffer.from(await response.arrayBuffer());
  }

  if (!sourceBuffer) {
    try {
      sourceBuffer = await fs.readFile(path.join(publicLogoDirectory, `${teamCode}.webp`));
    } catch {
      sourceBuffer = null;
    }
  }

  if (!sourceBuffer) return null;
  const logoBuffer = await sharp(sourceBuffer)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  const dataUrl = toDataUrl(logoBuffer, "image/webp");
  logoCache.set(teamCode, dataUrl);
  return dataUrl;
}

async function makeThumbnail(cardBuffer, player, item, index) {
  const colors = teamMeta[item.teamAtCapture] || teamMeta[player.team] || { primary: "#161A24", secondary: "#6B7280" };
  const category = item.category.replaceAll("_", " ").toUpperCase();
  const title = item.title.toUpperCase();
  const titleLines = title.length > 34 ? [title.slice(0, 34), title.slice(34, 68)] : [title];
  const titleSvg = titleLines.map((line, lineIndex) => `<text x="24" y="${430 + lineIndex * 23}" fill="#fff" font-family="Arial, sans-serif" font-size="${lineIndex ? 15 : 18}" font-weight="800" letter-spacing="0.7">${escapeXml(line)}</text>`).join("");
  const overlay = Buffer.from(`<svg width="360" height="504" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.42" stop-color="#000" stop-opacity="0"/>
        <stop offset="0.78" stop-color="#000" stop-opacity="0.62"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.96"/>
      </linearGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="${colors.primary}"/><stop offset="1" stop-color="${colors.secondary}"/>
      </linearGradient>
    </defs>
    <rect width="360" height="504" fill="url(#fade)"/>
    <rect x="7" y="7" width="346" height="490" rx="13" fill="none" stroke="url(#edge)" stroke-width="6"/>
    <rect x="20" y="20" width="118" height="27" rx="7" fill="#070A11" fill-opacity="0.78" stroke="#fff" stroke-opacity="0.22"/>
    <text x="31" y="39" fill="#fff" font-family="Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1.3">${escapeXml(category)}</text>
    <text x="336" y="39" text-anchor="end" fill="#fff" font-family="Arial, sans-serif" font-size="12" font-weight="800">${String(index + 1).padStart(2, "0")}/${manifest.items.length}</text>
    ${titleSvg}
    <text x="24" y="486" fill="#fff" fill-opacity="0.72" font-family="Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="1.2">PRIVATE REVIEW • ${escapeXml(item.teamAtCapture || player.team)}</text>
  </svg>`);
  return sharp(cardBuffer).resize(360, 504, { fit: "cover" }).composite([{ input: overlay }]).jpeg({ quality: 76, chromaSubsampling: "4:2:0" }).toBuffer();
}

await fs.mkdir(cardDirectory, { recursive: true });
await fs.mkdir(thumbDirectory, { recursive: true });
await fs.mkdir(curatedCardDirectory, { recursive: true });
await fs.mkdir(curatedThumbDirectory, { recursive: true });
await fs.mkdir(importDirectory, { recursive: true });

const cards = [];
const curatedCards = [];
const homepageOrderById = new Map();
const catalogAssets = [];
const now = Date.parse("2026-08-09T13:20:00.000Z");

for (const [index, item] of manifest.items.entries()) {
  const player = registry[item.playerKey];
  if (!player) throw new Error(`Unknown playerKey: ${item.playerKey}`);
  const profile = playerProfiles[item.playerKey];
  if (!profile) throw new Error(`Missing verified profile: ${item.playerKey}`);
  const inputPath = path.join(inboxDirectory, item.file);
  const original = await fs.readFile(inputPath);
  const metadata = await sharp(original).metadata();
  const slug = `${slugify(player.name)}-${String(index + 1).padStart(2, "0")}-${slugify(item.category)}`;
  const cardFile = `${slug}-card.webp`;
  const thumbFile = `${slug}-thumb.jpg`;
  const imageMode = item.imageMode || "fullart";
  const cardBuffer = await sharp(original)
    .rotate()
    .resize(900, 1260, imageMode === "cutout"
      ? { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }
      : { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 84, smartSubsample: true })
    .toBuffer();
  const thumbBuffer = await makeThumbnail(cardBuffer, player, item, index);
  await Promise.all([
    fs.writeFile(path.join(cardDirectory, cardFile), cardBuffer),
    fs.writeFile(path.join(thumbDirectory, thumbFile), thumbBuffer),
    fs.writeFile(path.join(curatedCardDirectory, cardFile), cardBuffer),
    fs.writeFile(path.join(curatedThumbDirectory, thumbFile), thumbBuffer)
  ]);

  const mediaId = `pm_manual_${manifest.batchId.replaceAll("-", "_")}_${String(index + 1).padStart(2, "0")}`;
  const cardTeamCode = item.cardTeam || player.team;
  const activeTeam = teamMeta[cardTeamCode] || { name: player.teamName, primary: "#161A24", secondary: "#6B7280" };
  const logoImg = await loadTeamLogoData(cardTeamCode);
  const normalizedEffect = item.effect === "neon" ? "holographic" : item.effect;
  const cardNum = buildCardNumber(item, index);
  const fullState = {
    ...featuredCard.card.fullState,
    version: 7,
    style: item.style,
    effect: normalizedEffect,
    effectIntensity: item.effectIntensity ?? effectIntensityFor(normalizedEffect),
    rarity: item.rarity,
    slabType: buildSlabType(item, cardNum),
    badges: item.badges,
    imageMode,
    playerImg: toDataUrl(cardBuffer, "image/webp"),
    logoImg,
    logoScale: item.logoScale || 100,
    signatureData: item.signature?.asset ?? null,
    signatureColor: item.signature?.color ?? featuredCard.card.fullState.signatureColor,
    signatureMode: item.signature ? "upload" : featuredCard.card.fullState.signatureMode,
    signaturePlacement: item.signature?.placement ?? featuredCard.card.fullState.signaturePlacement,
    signatureScale: item.signature?.scale ?? featuredCard.card.fullState.signatureScale,
    signatureX: item.signature?.x ?? featuredCard.card.fullState.signatureX,
    signatureY: item.signature?.y ?? featuredCard.card.fullState.signatureY,
    customFoilMask: null,
    customFoilOn: false,
    playerId: player.playerId,
    playerMediaId: mediaId,
    playerImageCategory: item.category,
    playerImageCredit: "User-supplied image · source and rights pending",
    playerImageCapturedAt: item.capturedAt || "",
    playerImageTeamAtCapture: item.teamAtCapture,
    playerImageLicenseSnapshot: "review_required:user_upload",
    playerName: player.displayName,
    playerNumber: player.jerseyNumber,
    playerPosition: player.positionCode,
    teamName: activeTeam.name,
    teamAbbr: cardTeamCode,
    teamPreset: "",
    cardSeason: profile.season,
    colorPrimary: activeTeam.primary,
    colorSecondary: activeTeam.secondary,
    playerHeight: profile.height,
    playerWeight: profile.weight,
    playerHometown: profile.hometown,
    playerDraft: profile.draft,
    statGP: profile.gp,
    statPPG: profile.ppg,
    statRPG: profile.rpg,
    statAPG: profile.apg,
    statFG: profile.fg,
    stat3P: profile.tp,
    cardNum,
    cardId: `PM-${String(index + 1).padStart(3, "0")}`,
    playerBio: profile.bio,
    photoScale: item.photoScale ?? 100,
    photoX: item.photoX ?? 0,
    photoY: item.photoY ?? 0,
    flipped: false,
    motionOn: true,
    rotX: 0,
    rotY: 0,
    autoRotY: 0
  };

  const libraryCard = {
    id: `manual_${manifest.batchId}_${String(index + 1).padStart(2, "0")}`,
    name: player.displayName,
    team: cardTeamCode,
    style: fullState.style,
    effect: fullState.effect,
    rarity: fullState.rarity,
    slabType: fullState.slabType,
    badges: fullState.badges,
    thumbnail: toDataUrl(thumbBuffer, "image/jpeg"),
    fullState,
    createdAt: now + index,
    favorite: false,
    source: "manual",
    sourcePlayerId: player.nbaId,
    sourceDataVersion: manifest.sourceDataVersion || 1
  };
  cards.push(libraryCard);
  if (Number.isFinite(Number(item.homepageOrder))) homepageOrderById.set(libraryCard.id, Number(item.homepageOrder));
  curatedCards.push({
    ...libraryCard,
    thumbnail: `assets/player-media/curated/thumb/${thumbFile}`,
    fullState: {
      ...fullState,
      playerImg: `assets/player-media/curated/card/${cardFile}`
    },
    source: "curated-player-media-v1"
  });

  catalogAssets.push({
    mediaId,
    playerId: player.playerId,
    category: item.category,
    tags: [...item.tags, item.composition, "manual-review"],
    title: item.title,
    capturedAt: item.capturedAt || null,
    season: item.season || null,
    teamAtCapture: item.teamAtCapture,
    opponent: null,
    gameId: null,
    momentId: null,
    provider: "user_upload",
    providerAssetId: item.file,
    sourceUrl: null,
    photographer: null,
    creditLine: "User-supplied image · source and rights pending",
    licenseStatus: "review_required",
    licenseType: "unknown_user_upload",
    usageScope: ["web_display", "card_derivative"],
    licenseExpiresAt: null,
    variants: {
      card: `private://player-media/${manifest.batchId}/card/${cardFile}`,
      thumb: `private://player-media/${manifest.batchId}/thumb/${thumbFile}`
    },
    sha256: crypto.createHash("sha256").update(original).digest("hex"),
    width: metadata.width || null,
    height: metadata.height || null,
    focalPoint: { x: 0.5, y: 0.42 },
    subjectBbox: null,
    matchConfidence: item.matchConfidence,
    identityReview: "confirmed",
    composition: item.composition,
    factReference: item.factReference || null,
    playerCurrentTeam: player.team,
    playerStatsSeason: profile.season,
    playerStatsSourceUrl: profile.sourceUrl,
    status: "review_required",
    reviewedBy: manifest.reviewedBy,
    reviewedAt: manifest.reviewedAt
  });
}

const catalogIds = new Set(catalogAssets.map((asset) => asset.mediaId));
publicMedia.assets = [
  ...publicMedia.assets.filter((asset) => !catalogIds.has(asset.mediaId)),
  ...catalogAssets
];
publicMedia.updatedAt = manifest.reviewedAt;

const showcaseCard = {
  ...featuredCard.card,
  id: "curated_showcase_cooper_flagg",
  createdAt: Date.parse(featuredCard.createdAt) || now - 1,
  favorite: false,
  source: "curated-showcase-v1",
  sourcePlayerId: "1642843",
  sourceDataVersion: manifest.sourceDataVersion || 1
};
const byHomepageOrder = (a, b) => {
  const aOrder = homepageOrderById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const bOrder = homepageOrderById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
  return aOrder - bOrder || a.createdAt - b.createdAt;
};
const orderedCards = [...cards].sort(byHomepageOrder);
const orderedCuratedCards = [...curatedCards].sort(byHomepageOrder);
const curatedLibrary = {
  schemaVersion: manifest.schemaVersion || 1,
  batchId: manifest.batchId,
  updatedAt: manifest.reviewedAt,
  cards: [showcaseCard, ...orderedCuratedCards]
};

await Promise.all([
  fs.writeFile(publicMediaPath, `${JSON.stringify(publicMedia, null, 2)}\n`),
  fs.writeFile(path.join(privateRoot, "catalog.json"), `${JSON.stringify({ ...manifest, assets: catalogAssets }, null, 2)}\n`),
  fs.writeFile(path.join(importDirectory, `${manifest.batchId}-cards.json`), `${JSON.stringify({ cards: orderedCards, achievements: {}, stats: { packsOpened: 0 } })}\n`),
  fs.writeFile(curatedLibraryPath, `${JSON.stringify(curatedLibrary, null, 2)}\n`)
]);

console.log(`Processed ${cards.length} reviewed images.`);
console.log(`Private variants: ${privateRoot}`);
console.log(`Personal card-library import: ${path.join(importDirectory, `${manifest.batchId}-cards.json`)}`);
console.log(`Curated deploy library: ${curatedLibraryPath}`);
console.log("Public exposure: card derivatives only; original uploads remain private and review_required." );
