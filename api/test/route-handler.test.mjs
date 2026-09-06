import assert from "node:assert/strict";
import test from "node:test";
import vercelHandler from "../[...route].js";

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end(value) { this.body = value; return this; },
  };
}

test("Vercel handler uses the shared route contract for direct player paths", async () => {
  const response = createResponse();
  await vercelHandler({
    method: "GET",
    url: "/api/players?active=true&team=OKC",
    query: {},
    headers: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.players.length > 0);
  assert.ok(response.body.players.every((player) => player.active && player.team === "OKC"));
});

test("Vercel handler uses the same route contract after a rewrite", async () => {
  const response = createResponse();
  await vercelHandler({
    method: "GET",
    url: "/api/players",
    query: { playerId: "nba_1628983" },
    headers: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.player.playerId, "nba_1628983");
});
