import fs from "node:fs/promises";
import vm from "node:vm";

const appSource = await fs.readFile(new URL("../app.js", import.meta.url), "utf8");
const rowsMatch = appSource.match(/const NBA_PLAYER_ROWS = (\[[\s\S]*?\n\]);/);
if (!rowsMatch) throw new Error("NBA_PLAYER_ROWS was not found in app.js");

const rows = vm.runInNewContext(rowsMatch[1]);
const canonicalName = (value) => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z]/gi, "")
  .toLowerCase();

const seenNames = new Set();
const seenNbaIds = new Set();
const seenEspnIds = new Set();
const failures = [];

if (rows.length !== 28) failures.push(`Expected 28 players, found ${rows.length}`);

for (const row of rows) {
  const [name,,,,,,,,,,,,,,,,,,, nbaId,, espnId] = row;
  const duplicateChecks = [
    [seenNames, name, "name"],
    [seenNbaIds, nbaId, "NBA ID"],
    [seenEspnIds, espnId, "ESPN ID"]
  ];
  for (const [set, value, label] of duplicateChecks) {
    if (set.has(value)) failures.push(`${name}: duplicate ${label} ${value}`);
    set.add(value);
  }

  try {
    const [espnResponse, nbaImageResponse] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}`),
      fetch(`https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`)
    ]);
    const athlete = espnResponse.ok ? (await espnResponse.json()).athlete : null;
    const espnMatches = athlete && canonicalName(athlete.displayName) === canonicalName(name);
    const nbaImageMatches = nbaImageResponse.ok
      && String(nbaImageResponse.headers.get("content-type")).startsWith("image/");

    if (!espnMatches) failures.push(`${name}: ESPN ID ${espnId} resolves to ${athlete?.displayName || "no player"}`);
    if (!nbaImageMatches) failures.push(`${name}: NBA headshot ${nbaId} returned ${nbaImageResponse.status}`);
    console.log(`${espnMatches && nbaImageMatches ? "PASS" : "FAIL"}  ${name}`);
  } catch (error) {
    failures.push(`${name}: network audit failed (${error.message})`);
    console.log(`FAIL  ${name}`);
  }
}

if (failures.length) {
  console.error("\nPlayer data audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`\nAll ${rows.length} player identities and image endpoints passed.`);
}
