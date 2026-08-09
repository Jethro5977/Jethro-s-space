const crypto = require("node:crypto");
const { del, get, head, list, put, BlobNotFoundError } = require("@vercel/blob");
const featuredCard = require("../server/featured-card.json");
const playerRegistry = require("../data/player-registry.json");

const CARD_PREFIX = "shared-cards/";
const MAX_BODY_SIZE = 4 * 1024 * 1024;
const MAX_THUMBNAIL_CHARS = 600_000;
const MAX_FULLSTATE_CHARS = 2_000_000;
const MAX_AUTHOR_LENGTH = 24;
const THUMBNAIL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const ID_REGEX = /^[a-z0-9_]+$/;

// Allow the client’s existing maximum payload while keeping the API’s own 4 MB guard.
const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

function json(res, status, data) {
  res.status(status).json(data);
}

function configureResponse(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function escapeHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function isMissingBlob(error) {
  return error instanceof BlobNotFoundError || error?.name === "BlobNotFoundError";
}

function storagePath(id) {
  if (!ID_REGEX.test(id)) return null;
  return `${CARD_PREFIX}${id}.json`;
}

function requireStorage() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    const error = new Error("Vercel Blob is not connected. Add a Blob store to this project first.");
    error.status = 503;
    throw error;
  }
}

async function readRecord(id) {
  requireStorage();
  const pathname = storagePath(id);
  if (!pathname) {
    const error = new Error("Invalid id");
    error.status = 400;
    throw error;
  }
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (result.statusCode !== 200 || !result.stream) {
      const error = new Error("Card not found");
      error.status = 404;
      throw error;
    }
    const raw = await new Response(result.stream).text();
    return JSON.parse(raw);
  } catch (error) {
    if (isMissingBlob(error)) {
      error.status = 404;
      error.message = "Card not found";
    }
    throw error;
  }
}

async function writeRecord(record) {
  requireStorage();
  return put(storagePath(record.id), JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
}

async function ensureFeaturedCard() {
  requireStorage();
  const pathname = storagePath(featuredCard.id);
  try {
    await head(pathname);
    return false;
  } catch (error) {
    if (!isMissingBlob(error)) throw error;
  }
  await writeRecord(featuredCard);
  return true;
}

function generateId() {
  return `sc_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function generateTokenPair() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function validateServerPlayerMeta(card) {
  const full = card.fullState || {};
  const playerName = String(full.playerName || card.name || "").trim().toLowerCase();
  const authoritative = playerRegistry[playerName];
  if (!authoritative) return null;
  const cardTeam = String(full.teamAbbr || card.team || "").toUpperCase().trim();
  if (cardTeam && cardTeam !== authoritative.team) {
    return `Team mismatch with official registry: ${cardTeam} !== ${authoritative.team}`;
  }
  return null;
}

function parseBody(req) {
  if (req.body == null) return {};
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
  if (typeof req.body === "string") return JSON.parse(req.body);
  if (typeof req.body === "object") return req.body;
  return {};
}

function publicListItem(record) {
  return {
    id: record.id,
    author: record.author,
    createdAt: record.createdAt,
    featured: Boolean(record.featured),
    card: {
      id: record.card.id,
      name: record.card.name,
      team: record.card.team,
      style: record.card.style,
      effect: record.card.effect,
      rarity: record.card.rarity,
      slabType: record.card.slabType,
      badges: record.card.badges,
      thumbnailUrl: `/api/cards/${record.id}/thumbnail`,
    },
  };
}

async function listRecords() {
  requireStorage();
  await ensureFeaturedCard();
  const records = [];
  let cursor;
  do {
    const page = await list({ prefix: CARD_PREFIX, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const id = blob.pathname.slice(CARD_PREFIX.length, -".json".length);
      try {
        records.push(await readRecord(id));
      } catch (error) {
        if (error.status !== 404) console.error("Unable to read shared card", blob.pathname, error);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return records;
}

async function handleListCards(res) {
  const cards = (await listRecords()).map(publicListItem);
  cards.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  return json(res, 200, { cards });
}

async function handlePublishCard(req, res) {
  const rawBody = JSON.stringify(req.body || "");
  if (rawBody.length > MAX_BODY_SIZE) return json(res, 413, { error: "Payload too large" });

  let body;
  try {
    body = parseBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }
  const { card } = body;
  if (!card || typeof card !== "object") return json(res, 400, { error: "Missing card data" });
  if (typeof card.thumbnail !== "string") return json(res, 400, { error: "Missing thumbnail" });
  if (!THUMBNAIL_REGEX.test(card.thumbnail)) return json(res, 400, { error: "Invalid thumbnail format" });
  if (card.thumbnail.length > MAX_THUMBNAIL_CHARS) return json(res, 400, { error: "Thumbnail too large" });
  if (card.fullState == null) return json(res, 400, { error: "Missing fullState" });
  if (JSON.stringify(card.fullState).length > MAX_FULLSTATE_CHARS) return json(res, 400, { error: "fullState too large" });
  const playerMetaError = validateServerPlayerMeta(card);
  if (playerMetaError) return json(res, 400, { error: playerMetaError });

  const rawAuthor = String(body.author || "").trim();
  if (rawAuthor.length > MAX_AUTHOR_LENGTH) return json(res, 400, { error: "Author name too long" });
  const id = generateId();
  const { token, tokenHash } = generateTokenPair();
  const record = {
    schemaVersion: 1,
    id,
    author: escapeHtml(rawAuthor).slice(0, MAX_AUTHOR_LENGTH) || "匿名",
    createdAt: Date.now(),
    tokenHash,
    card: {
      ...card,
      sharedId: id,
      name: escapeHtml(String(card.name || "").slice(0, 100)),
      team: escapeHtml(String(card.team || "").slice(0, 10)),
    },
  };

  await writeRecord(record);
  return json(res, 201, { id, token, card: record.card });
}

async function handleGetCard(res, id) {
  const record = await readRecord(id);
  return json(res, 200, { id: record.id, author: record.author, createdAt: record.createdAt, card: record.card });
}

async function handleGetThumbnail(res, id) {
  const record = await readRecord(id);
  const match = String(record.card.thumbnail || "").match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!match) return json(res, 500, { error: "Invalid stored thumbnail" });
  const [, format, base64] = match;
  const image = Buffer.from(base64, "base64");
  res.setHeader("Content-Type", format === "jpeg" ? "image/jpeg" : `image/${format}`);
  res.setHeader("Content-Length", image.length);
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(200).send(image);
}

async function handleDeleteCard(req, res, id) {
  const token = new URL(req.url, "http://vercel.local").searchParams.get("token") || "";
  if (!token) return json(res, 403, { error: "Token required" });
  const record = await readRecord(id);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash !== record.tokenHash) return json(res, 403, { error: "Token mismatch" });
  await del(storagePath(id));
  return json(res, 200, { deleted: true });
}

async function handleHealth(res) {
  const records = await listRecords();
  return json(res, 200, { status: "ok", count: records.length, storage: "vercel-blob" });
}

async function handler(req, res) {
  configureResponse(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const pathname = new URL(req.url, "http://vercel.local").pathname;
  const parts = pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);
  try {
    if (parts.length === 1 && parts[0] === "health" && req.method === "GET") return await handleHealth(res);
    if (parts.length === 1 && parts[0] === "cards" && req.method === "GET") return await handleListCards(res);
    if (parts.length === 1 && parts[0] === "cards" && req.method === "POST") return await handlePublishCard(req, res);
    if (parts.length === 3 && parts[0] === "cards" && parts[2] === "thumbnail" && req.method === "GET") return await handleGetThumbnail(res, parts[1]);
    if (parts.length === 2 && parts[0] === "cards" && req.method === "GET") return await handleGetCard(res, parts[1]);
    if (parts.length === 2 && parts[0] === "cards" && req.method === "DELETE") return await handleDeleteCard(req, res, parts[1]);
    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("Vercel shared-library API error:", error);
    return json(res, error.status || 500, { error: error.message || "Internal server error" });
  }
}

module.exports = handler;
module.exports.config = config;
