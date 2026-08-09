import fs from "node:fs/promises";
import vm from "node:vm";

const APP_URL = new URL("../app.js", import.meta.url);
const REGISTRY_URL = new URL("../data/player-registry.json", import.meta.url);
const appSource = await fs.readFile(APP_URL, "utf8");
const fieldsMatch = appSource.match(/const NBA_PLAYER_FIELDS = (\[[\s\S]*?\n\]);/);
const rowsMatch = appSource.match(/const NBA_PLAYER_ROWS = (\[[\s\S]*?\n\]);/);

if (!fieldsMatch || !rowsMatch) throw new Error("NBA player seed data was not found in app.js");

const fields = vm.runInNewContext(fieldsMatch[1]);
const rows = vm.runInNewContext(rowsMatch[1]);
const positionNames = {
  PG: "POINT GUARD",
  SG: "SHOOTING GUARD",
  SF: "SMALL FORWARD",
  PF: "POWER FORWARD",
  C: "CENTER",
};
const titleCase = (value) => String(value).toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());

const registry = Object.fromEntries(rows.map((row) => {
  const player = Object.fromEntries(fields.map((field, index) => [field, row[index]]));
  const key = player.name.toLowerCase();
  return [key, {
    playerId: `nba_${player.nbaId}`,
    name: titleCase(player.name),
    displayName: player.name,
    aliases: [],
    active: true,
    team: player.abbr,
    teamName: player.team,
    positionCode: player.position,
    position: positionNames[player.position] || player.position,
    jerseyNumber: String(player.number),
    nbaId: String(player.nbaId),
    espnId: String(player.espnId),
    sportradarId: null,
    sourceUrl: "https://www.nba.com/players",
    identityStatus: "needs_review",
    verifiedAt: null,
    portrait: player.name === "COOPER FLAGG" ? "assets/cooper-flagg-home.png" : null,
    portraitVerified: false,
  }];
}));

await fs.writeFile(REGISTRY_URL, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Synced ${Object.keys(registry).length} players to data/player-registry.json`);
