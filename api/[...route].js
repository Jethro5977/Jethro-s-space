const crypto = require("node:crypto");
const { del, get, head, list, put, BlobNotFoundError } = require("@vercel/blob");
const sharp = require("sharp");
const featuredCard = require("../server/featured-card.json");
const playerRegistry = require("../data/player-registry.json");
const seedMediaDocument = require("../data/player-media.json");

const CARD_PREFIX = "shared-cards/";
const MEDIA_META_PREFIX = "player-media/meta/";
const MEDIA_FILE_PREFIX = "player-media/files/";
const MEDIA_AUDIT_PREFIX = "player-media/audit/";
const MAX_BODY_SIZE = 6 * 1024 * 1024;
const MAX_THUMBNAIL_CHARS = 600_000;
const MAX_FULLSTATE_CHARS = 2_000_000;
const MAX_AUTHOR_LENGTH = 24;
const THUMBNAIL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const ID_REGEX = /^[a-z0-9_]+$/;
const PLAYER_ID_REGEX = /^nba_[0-9]+$/;
const MEDIA_ID_REGEX = /^pm_[a-z0-9_]+$/;
const MEDIA_CATEGORIES = new Set(["game_action", "training", "media_day", "milestone", "commemorative", "celebration", "profile"]);
const UPLOAD_DATA_REGEX = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_MEDIA_UPLOAD_BYTES = 3 * 1024 * 1024;

// Allow the client’s existing maximum payload while keeping the API’s own 4 MB guard.
const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

function json(res, status, data) {
  res.status(status).json(data);
}

function configureResponse(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token");
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

function findPlayerById(playerId) {
  return Object.values(playerRegistry).find((player) => player.playerId === playerId) || null;
}

function mediaMetaPath(mediaId) {
  return MEDIA_ID_REGEX.test(mediaId) ? `${MEDIA_META_PREFIX}${mediaId}.json` : null;
}

function mediaFilePath(mediaId, extension) {
  return MEDIA_ID_REGEX.test(mediaId) ? `${MEDIA_FILE_PREFIX}${mediaId}.${extension}` : null;
}

function isLicenseCurrentlyValid(asset) {
  if (asset.status !== "published" || asset.licenseStatus !== "valid") return false;
  if (!Array.isArray(asset.usageScope) || !asset.usageScope.includes("web_display")) return false;
  if (!asset.licenseExpiresAt) return true;
  return new Date(asset.licenseExpiresAt).getTime() > Date.now();
}

function publicMedia(asset) {
  const staticCard = asset.variants?.card;
  const staticThumb = asset.variants?.thumb;
  return {
    mediaId: asset.mediaId,
    playerId: asset.playerId,
    category: asset.category,
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    title: asset.title || "Player media",
    capturedAt: asset.capturedAt || null,
    season: asset.season || null,
    teamAtCapture: asset.teamAtCapture || null,
    opponent: asset.opponent || null,
    momentId: asset.momentId || null,
    provider: asset.provider,
    creditLine: asset.creditLine,
    photographer: asset.photographer || null,
    licenseStatus: asset.licenseStatus,
    fallback: false,
    cardUrl: staticCard || `/api/player-media/${asset.mediaId}/file?variant=card`,
    thumbUrl: staticThumb || `/api/player-media/${asset.mediaId}/file?variant=thumb`,
  };
}

function fallbackMedia(player) {
  const mediaId = `pm_fallback_${player.nbaId}`;
  return {
    mediaId,
    playerId: player.playerId,
    category: "headshot_fallback",
    tags: ["fallback"],
    title: "Official headshot compatibility fallback",
    capturedAt: null,
    season: null,
    teamAtCapture: player.team,
    opponent: null,
    momentId: null,
    provider: "nba_cdn",
    creditLine: "NBA CDN · temporary compatibility fallback",
    photographer: null,
    licenseStatus: "fallback_review_required",
    fallback: true,
    cardUrl: `/api/player-media/${mediaId}/file?variant=card`,
    thumbUrl: `/api/player-media/${mediaId}/file?variant=thumb`,
  };
}

async function readMediaMeta(mediaId) {
  const seeded = seedMediaDocument.assets.find((asset) => asset.mediaId === mediaId);
  if (seeded) return seeded;
  requireStorage();
  const pathname = mediaMetaPath(mediaId);
  if (!pathname) throw Object.assign(new Error("Invalid media id"), { status: 400 });
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (result.statusCode !== 200 || !result.stream) throw Object.assign(new Error("Media not found"), { status: 404 });
    return JSON.parse(await new Response(result.stream).text());
  } catch (error) {
    if (isMissingBlob(error)) throw Object.assign(new Error("Media not found"), { status: 404 });
    throw error;
  }
}

async function listStoredMedia() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return [];
  const assets = [];
  let cursor;
  do {
    const page = await list({ prefix: MEDIA_META_PREFIX, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const mediaId = blob.pathname.slice(MEDIA_META_PREFIX.length, -".json".length);
      try { assets.push(await readMediaMeta(mediaId)); } catch (error) { console.error("Unable to read media metadata", mediaId, error); }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return assets;
}

async function listAllMedia() {
  return [...seedMediaDocument.assets, ...await listStoredMedia()];
}

async function appendMediaAudit(entry) {
  requireStorage();
  const auditId = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  return put(`${MEDIA_AUDIT_PREFIX}${auditId}.json`, JSON.stringify({
    schemaVersion: 1,
    auditId,
    occurredAt: new Date().toISOString(),
    ...entry,
  }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json; charset=utf-8",
  });
}

function requireMediaAdmin(req) {
  const expected = process.env.PLAYER_MEDIA_ADMIN_TOKEN || "";
  if (!expected) throw Object.assign(new Error("PLAYER_MEDIA_ADMIN_TOKEN is not configured"), { status: 503 });
  const supplied = String(req.headers["x-admin-token"] || "");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
}

function parseUploadedImage(dataUrl) {
  const match = String(dataUrl || "").match(UPLOAD_DATA_REGEX);
  if (!match) throw Object.assign(new Error("Only PNG, JPEG, and WebP data URLs are supported"), { status: 400 });
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_MEDIA_UPLOAD_BYTES) throw Object.assign(new Error("Image must be between 1 byte and 3 MB"), { status: 413 });
  const magicValid = match[1] === "png"
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === "jpeg"
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9
      : buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!magicValid) throw Object.assign(new Error("Image content does not match its MIME type"), { status: 400 });
  return { buffer, extension: match[1] === "jpeg" ? "jpg" : match[1], mime: `image/${match[1]}` };
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

function handleListPlayers(req, res) {
  const url = new URL(req.url, "http://vercel.local");
  const active = url.searchParams.get("active");
  const team = String(url.searchParams.get("team") || "").toUpperCase();
  let players = Object.values(playerRegistry);
  if (active === "true") players = players.filter((player) => player.active === true);
  if (team) players = players.filter((player) => player.team === team);
  players.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return json(res, 200, { players, total: players.length });
}

function handleGetPlayer(res, playerId) {
  const player = findPlayerById(playerId);
  if (!player) return json(res, 404, { error: "Player not found" });
  return json(res, 200, { player });
}

async function handleListPlayerMedia(req, res, playerId) {
  const player = findPlayerById(playerId);
  if (!player) return json(res, 404, { error: "Player not found" });
  const url = new URL(req.url, "http://vercel.local");
  const category = String(url.searchParams.get("category") || "");
  if (category && !MEDIA_CATEGORIES.has(category) && category !== "headshot_fallback") {
    return json(res, 400, { error: "Invalid media category" });
  }
  const assets = (await listAllMedia())
    .filter((asset) => asset.playerId === playerId && isLicenseCurrentlyValid(asset))
    .filter((asset) => !category || asset.category === category)
    .sort((a, b) => Number(Boolean(b.teamAtCapture === player.team)) - Number(Boolean(a.teamAtCapture === player.team)))
    .map(publicMedia);
  if (!category || category === "headshot_fallback") assets.push(fallbackMedia(player));
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=240");
  return json(res, 200, { playerId, media: assets, total: assets.length, fallbackOnly: assets.every((asset) => asset.fallback) });
}

async function handleGetMedia(res, mediaId) {
  if (mediaId.startsWith("pm_fallback_")) {
    const player = Object.values(playerRegistry).find((item) => `pm_fallback_${item.nbaId}` === mediaId);
    if (!player) return json(res, 404, { error: "Media not found" });
    return json(res, 200, { media: fallbackMedia(player) });
  }
  const asset = await readMediaMeta(mediaId);
  if (!isLicenseCurrentlyValid(asset)) return json(res, 404, { error: "Media is unavailable or not licensed for display" });
  return json(res, 200, { media: publicMedia(asset) });
}

async function handleGetMediaFile(req, res, mediaId) {
  if (mediaId.startsWith("pm_fallback_")) {
    const player = Object.values(playerRegistry).find((item) => `pm_fallback_${item.nbaId}` === mediaId);
    if (!player) return json(res, 404, { error: "Media not found" });
    const variant = new URL(req.url, "http://vercel.local").searchParams.get("variant") === "thumb" ? "260x190" : "1040x760";
    const upstream = await fetch(`https://cdn.nba.com/headshots/nba/latest/${variant}/${player.nbaId}.png`);
    if (!upstream.ok) return json(res, 502, { error: "Fallback image provider unavailable" });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.status(200).send(buffer);
  }
  const asset = await readMediaMeta(mediaId);
  if (!isLicenseCurrentlyValid(asset)) return json(res, 404, { error: "Media is unavailable or not licensed for display" });
  const variant = new URL(req.url, "http://vercel.local").searchParams.get("variant") === "thumb" ? "thumb" : "card";
  if (asset.variants?.[variant]) return res.redirect(302, asset.variants[variant]);
  const pathname = asset.blobPaths?.[variant];
  if (!pathname) return json(res, 404, { error: "Media variant not found" });
  const result = await get(pathname, { access: "private", useCache: true });
  if (result.statusCode !== 200 || !result.stream) return json(res, 404, { error: "Media file not found" });
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  res.setHeader("Content-Type", asset.variantMimeTypes?.[variant] || asset.mimeType || "application/octet-stream");
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("ETag", `\"${asset.sha256}\"`);
  return res.status(200).send(buffer);
}

async function handleAdminMediaUpload(req, res) {
  requireMediaAdmin(req);
  requireStorage();
  const rawBody = JSON.stringify(req.body || "");
  if (rawBody.length > MAX_BODY_SIZE) return json(res, 413, { error: "Payload too large" });
  let body;
  try { body = parseBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
  const player = findPlayerById(String(body.playerId || ""));
  if (!player) return json(res, 400, { error: "Unknown playerId" });
  if (!MEDIA_CATEGORIES.has(body.category)) return json(res, 400, { error: "Invalid category" });
  if (body.rightsConfirmed !== true) return json(res, 400, { error: "rightsConfirmed=true is required" });
  const usageScope = Array.isArray(body.usageScope) ? body.usageScope.filter((item) => typeof item === "string") : [];
  if (!usageScope.includes("web_display")) return json(res, 400, { error: "usageScope must include web_display" });
  if (!String(body.provider || "").trim() || !String(body.creditLine || "").trim()) {
    return json(res, 400, { error: "provider and creditLine are required" });
  }
  if (!body.capturedAt || !body.teamAtCapture) return json(res, 400, { error: "capturedAt and teamAtCapture are required" });
  if (!body.licenseReference) return json(res, 400, { error: "licenseReference is required" });
  if (!body.sourceUrl && !body.providerAssetId) return json(res, 400, { error: "sourceUrl or providerAssetId is required" });
  if (body.licenseExpiresAt && new Date(body.licenseExpiresAt).getTime() <= Date.now()) {
    return json(res, 400, { error: "The supplied license is already expired" });
  }
  const image = parseUploadedImage(body.imageDataUrl);
  const sourceImage = sharp(image.buffer, { failOn: "warning" });
  const imageMetadata = await sourceImage.metadata();
  if (!imageMetadata.width || !imageMetadata.height) return json(res, 400, { error: "Image dimensions could not be read" });
  if (Math.max(imageMetadata.width, imageMetadata.height) < 1200) {
    return json(res, 400, { error: "Image long edge must be at least 1200 pixels" });
  }
  const [cardBuffer, thumbBuffer] = await Promise.all([
    sharp(image.buffer).rotate().resize(900, 1260, { fit: "cover", position: "centre" }).webp({ quality: 86 }).toBuffer(),
    sharp(image.buffer).rotate().resize(360, 504, { fit: "cover", position: "centre" }).webp({ quality: 78 }).toBuffer(),
  ]);
  const sha256 = crypto.createHash("sha256").update(image.buffer).digest("hex");
  const existing = await listAllMedia();
  if (existing.some((asset) => asset.sha256 === sha256)) return json(res, 409, { error: "Duplicate image hash" });
  if (body.providerAssetId && existing.some((asset) => asset.provider === body.provider && asset.providerAssetId === body.providerAssetId)) {
    return json(res, 409, { error: "Duplicate provider asset id" });
  }
  const mediaId = `pm_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const originalPath = `${MEDIA_FILE_PREFIX}original/${mediaId}.${image.extension}`;
  const cardPath = `${MEDIA_FILE_PREFIX}card/${mediaId}.webp`;
  const thumbPath = `${MEDIA_FILE_PREFIX}thumb/${mediaId}.webp`;
  await Promise.all([
    put(originalPath, image.buffer, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: image.mime }),
    put(cardPath, cardBuffer, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "image/webp" }),
    put(thumbPath, thumbBuffer, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "image/webp" }),
  ]);
  const now = new Date().toISOString();
  const asset = {
    schemaVersion: 1,
    mediaId,
    playerId: player.playerId,
    category: body.category,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string").slice(0, 20) : [],
    title: String(body.title || `${player.displayName} media`).slice(0, 120),
    capturedAt: body.capturedAt || null,
    season: body.season || null,
    teamAtCapture: String(body.teamAtCapture || player.team).toUpperCase().slice(0, 4),
    opponent: body.opponent || null,
    gameId: body.gameId || null,
    momentId: body.momentId || null,
    provider: String(body.provider).slice(0, 60),
    providerAssetId: body.providerAssetId ? String(body.providerAssetId).slice(0, 120) : null,
    sourceUrl: body.sourceUrl ? String(body.sourceUrl).slice(0, 500) : null,
    photographer: body.photographer ? String(body.photographer).slice(0, 120) : null,
    creditLine: String(body.creditLine).slice(0, 180),
    licenseStatus: "valid",
    licenseType: String(body.licenseType || "direct_upload").slice(0, 60),
    licenseReference: String(body.licenseReference).slice(0, 300),
    usageScope,
    licenseExpiresAt: body.licenseExpiresAt || null,
    mimeType: image.mime,
    variantMimeTypes: { original: image.mime, card: "image/webp", thumb: "image/webp" },
    blobPaths: { original: originalPath, card: cardPath, thumb: thumbPath },
    sha256,
    width: imageMetadata.width,
    height: imageMetadata.height,
    focalPoint: body.focalPoint || { x: 0.5, y: 0.5 },
    subjectBbox: body.subjectBbox || null,
    matchConfidence: 1,
    status: "published",
    reviewedBy: "admin-token",
    reviewedAt: now,
    createdAt: now,
  };
  await put(mediaMetaPath(mediaId), JSON.stringify(asset), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json; charset=utf-8",
  });
  await appendMediaAudit({ actor: "admin-token", action: "upload_and_publish", mediaId, reason: "Authorized administrator upload" });
  return json(res, 201, { media: publicMedia(asset) });
}

async function handleAdminMediaRevoke(req, res, mediaId) {
  requireMediaAdmin(req);
  requireStorage();
  const body = parseBody(req);
  const reason = String(body.reason || "").trim();
  if (!reason) return json(res, 400, { error: "A revoke reason is required" });
  if (seedMediaDocument.assets.some((asset) => asset.mediaId === mediaId)) {
    return json(res, 409, { error: "Seed assets must be changed through repository review" });
  }
  const existing = await readMediaMeta(mediaId);
  const next = { ...existing, status: "revoked", revokedAt: new Date().toISOString(), revokeReason: reason.slice(0, 300) };
  await put(mediaMetaPath(mediaId), JSON.stringify(next), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
  await appendMediaAudit({ actor: "admin-token", action: "revoke", mediaId, reason: reason.slice(0, 300) });
  return json(res, 200, { revoked: true, mediaId });
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
  const rewrittenId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const rewrittenView = Array.isArray(req.query.view) ? req.query.view[0] : req.query.view;
  try {
    if (parts.length === 1 && parts[0] === "health" && req.method === "GET") return await handleHealth(res);
    if (parts.length === 1 && parts[0] === "players" && req.method === "GET") return handleListPlayers(req, res);
    if (parts.length === 2 && parts[0] === "players" && PLAYER_ID_REGEX.test(parts[1]) && req.method === "GET") return handleGetPlayer(res, parts[1]);
    if (parts.length === 3 && parts[0] === "players" && PLAYER_ID_REGEX.test(parts[1]) && parts[2] === "media" && req.method === "GET") {
      return await handleListPlayerMedia(req, res, parts[1]);
    }
    if (parts.length === 2 && parts[0] === "player-media" && req.method === "GET") return await handleGetMedia(res, parts[1]);
    if (parts.length === 3 && parts[0] === "player-media" && parts[2] === "file" && req.method === "GET") {
      return await handleGetMediaFile(req, res, parts[1]);
    }
    if (parts.length === 3 && parts[0] === "admin" && parts[1] === "player-media" && parts[2] === "upload" && req.method === "POST") {
      return await handleAdminMediaUpload(req, res);
    }
    if (parts.length === 4 && parts[0] === "admin" && parts[1] === "player-media" && parts[3] === "revoke" && req.method === "POST") {
      return await handleAdminMediaRevoke(req, res, parts[2]);
    }
    if (parts.length === 1 && parts[0] === "cards" && rewrittenId && rewrittenView === "thumbnail" && req.method === "GET") {
      return await handleGetThumbnail(res, rewrittenId);
    }
    if (parts.length === 1 && parts[0] === "cards" && rewrittenId && req.method === "GET") {
      return await handleGetCard(res, rewrittenId);
    }
    if (parts.length === 1 && parts[0] === "cards" && rewrittenId && req.method === "DELETE") {
      return await handleDeleteCard(req, res, rewrittenId);
    }
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
