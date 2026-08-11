import assert from "node:assert/strict";
import test from "node:test";
import apiCore from "../shared-api-core.cjs";

const registry = {
  "test player": { playerId: "nba_100", displayName: "Test Player", team: "TST", active: true, nbaId: "100" },
  "inactive player": { playerId: "nba_200", displayName: "Inactive Player", team: "OLD", active: false, nbaId: "200" },
};

const thumbnail = "data:image/png;base64,iVBORw0KGgo=";

test("shared API core creates a sanitized card record from valid input", () => {
  const result = apiCore.createCardRecord({
    author: "<Ada>",
    card: { name: "<MVP>", team: "tst", thumbnail, fullState: { playerName: "Test Player", teamAbbr: "TST" } },
  }, registry, 123);

  assert.equal(result.status, 201);
  assert.match(result.record.id, /^sc_/);
  assert.equal(result.record.author, "&lt;Ada&gt;");
  assert.equal(result.record.card.name, "&lt;MVP&gt;");
  assert.equal(result.record.createdAt, 123);
  assert.equal(result.token.length, 64);
});

test("shared API core rejects invalid publishing input consistently", () => {
  const badThumbnail = apiCore.createCardRecord({ card: { thumbnail: "nope", fullState: {} } }, registry);
  const badTeam = apiCore.createCardRecord({
    card: { name: "Test Player", team: "WRONG", thumbnail, fullState: { playerName: "Test Player", teamAbbr: "WRONG" } },
  }, registry);

  assert.deepEqual(badThumbnail, { status: 400, error: "Invalid thumbnail format" });
  assert.equal(badTeam.error, "Team mismatch with official registry: WRONG !== TST");
});

test("shared API core resolves direct and Vercel-rewritten paths to the same routes", () => {
  const direct = apiCore.resolveApiRoute({ method: "GET", pathname: "/api/cards/sc_demo/thumbnail" });
  const rewritten = apiCore.resolveApiRoute({
    method: "GET",
    pathname: "/api/cards",
    query: new URLSearchParams({ id: "sc_demo", view: "thumbnail" }),
  });
  const playerMedia = apiCore.resolveApiRoute({ method: "GET", pathname: "/api/players/nba_100/media" });

  assert.deepEqual(direct, { name: "card-thumbnail", id: "sc_demo" });
  assert.deepEqual(rewritten, direct);
  assert.deepEqual(playerMedia, { name: "player-media-list", playerId: "nba_100" });
});

test("shared API core sorts cards and filters players with one contract", () => {
  const sorted = apiCore.sortPublicCards([
    { id: "new", featured: false, createdAt: 20 },
    { id: "featured", featured: true, createdAt: 1 },
    { id: "old", featured: false, createdAt: 10 },
  ]);
  const players = apiCore.filterPlayers(registry, new URLSearchParams({ active: "true", team: "TST" }));

  assert.deepEqual(sorted.map((card) => card.id), ["featured", "new", "old"]);
  assert.deepEqual(players.map((player) => player.playerId), ["nba_100"]);
});
