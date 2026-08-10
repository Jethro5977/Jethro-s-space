import fs from "node:fs/promises";

const registry = JSON.parse(await fs.readFile(new URL("../data/player-registry.json", import.meta.url), "utf8"));
const mediaDocument = JSON.parse(await fs.readFile(new URL("../data/player-media.json", import.meta.url), "utf8"));
const players = Object.values(registry);
const assets = Array.isArray(mediaDocument.assets) ? mediaDocument.assets : [];
const failures = [];
const categorySet = new Set(["game_action", "training", "media_day", "milestone", "commemorative", "celebration", "profile", "headshot_fallback"]);
const unique = (label, values) => {
  const seen = new Set();
  values.forEach((value) => {
    if (!value) failures.push(`${label} is missing`);
    else if (seen.has(value)) failures.push(`${label} is duplicated: ${value}`);
    seen.add(value);
  });
};

if (players.length !== 28) failures.push(`Expected 28 seed players, found ${players.length}`);
unique("playerId", players.map((player) => player.playerId));
unique("nbaId", players.map((player) => player.nbaId));
unique("espnId", players.map((player) => player.espnId));
unique("displayName", players.map((player) => player.displayName));

const playerIds = new Set(players.map((player) => player.playerId));
unique("mediaId", assets.map((asset) => asset.mediaId));
for (const asset of assets) {
  if (!playerIds.has(asset.playerId)) failures.push(`${asset.mediaId}: unknown playerId ${asset.playerId}`);
  if (!categorySet.has(asset.category)) failures.push(`${asset.mediaId}: invalid category ${asset.category}`);
  if (!asset.provider) failures.push(`${asset.mediaId}: provider is required`);
  if (!asset.creditLine) failures.push(`${asset.mediaId}: creditLine is required`);
  if (!asset.licenseStatus) failures.push(`${asset.mediaId}: licenseStatus is required`);
  if (!Array.isArray(asset.usageScope) || !asset.usageScope.includes("web_display")) {
    failures.push(`${asset.mediaId}: web_display usage scope is required`);
  }
  if (asset.status === "published" && asset.licenseStatus !== "valid") {
    failures.push(`${asset.mediaId}: published assets require licenseStatus=valid`);
  }
  if (asset.status === "published") {
    if (!asset.capturedAt) failures.push(`${asset.mediaId}: published assets require capturedAt`);
    if (!asset.teamAtCapture) failures.push(`${asset.mediaId}: published assets require teamAtCapture`);
    if (!asset.sourceUrl && !asset.providerAssetId) failures.push(`${asset.mediaId}: published assets require sourceUrl or providerAssetId`);
    if (!asset.licenseReference) failures.push(`${asset.mediaId}: published assets require licenseReference`);
    if (!asset.photographer && !asset.provider) failures.push(`${asset.mediaId}: published assets require photographer or provider`);
  }
  if (!asset.variants?.card || !asset.variants?.thumb) failures.push(`${asset.mediaId}: card/thumb variants are required`);
}

if (failures.length) {
  console.error("Player media audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Player media audit passed: ${players.length} players, ${assets.length} curated assets.`);
  const reviewed = players.filter((player) => player.identityStatus === "verified").length;
  console.log(`Identity review progress: ${reviewed}/${players.length} verified.`);
}
