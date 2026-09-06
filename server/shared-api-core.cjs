// Shared Library API contract — portable across the local Node server and Vercel.
const crypto = require("node:crypto");

const CARD_ID_REGEX = /^[a-z0-9_]+$/;
const PLAYER_ID_REGEX = /^nba_[0-9]+$/;
const MEDIA_ID_REGEX = /^pm_[a-z0-9_]+$/;
const THUMBNAIL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const LIMITS = Object.freeze({
  bodyBytes: 4 * 1024 * 1024,
  thumbnailChars: 600_000,
  fullStateChars: 2_000_000,
  authorLength: 24,
});

function escapeHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function generateCardId() {
  return `sc_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function generateTokenPair() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function findPlayerById(registry, playerId) {
  return Object.values(registry).find((player) => player.playerId === playerId) || null;
}

function validatePlayerMeta(card, registry) {
  const fullState = card.fullState || {};
  const playerName = String(fullState.playerName || card.name || "").trim().toLowerCase();
  const authoritative = registry[playerName];
  if (!authoritative) return null;
  const cardTeam = String(fullState.teamAbbr || card.team || "").toUpperCase().trim();
  return cardTeam && cardTeam !== authoritative.team
    ? `Team mismatch with official registry: ${cardTeam} !== ${authoritative.team}`
    : null;
}

function createCardRecord(body, registry, now = Date.now()) {
  const card = body?.card;
  if (!card || typeof card !== "object") return failure(400, "Missing card data");
  if (typeof card.thumbnail !== "string") return failure(400, "Missing thumbnail");
  if (!THUMBNAIL_REGEX.test(card.thumbnail)) return failure(400, "Invalid thumbnail format");
  if (card.thumbnail.length > LIMITS.thumbnailChars) return failure(400, "Thumbnail too large");
  if (card.fullState == null) return failure(400, "Missing fullState");
  if (JSON.stringify(card.fullState).length > LIMITS.fullStateChars) return failure(400, "fullState too large");

  const playerMetaError = validatePlayerMeta(card, registry);
  if (playerMetaError) return failure(400, playerMetaError);

  const rawAuthor = String(body.author || "").trim();
  if (rawAuthor.length > LIMITS.authorLength) return failure(400, "Author name too long");

  const id = generateCardId();
  const { token, tokenHash } = generateTokenPair();
  return {
    status: 201,
    token,
    record: {
      schemaVersion: 1,
      id,
      author: escapeHtml(rawAuthor).slice(0, LIMITS.authorLength) || "匿名",
      createdAt: now,
      tokenHash,
      card: {
        ...card,
        sharedId: id,
        name: escapeHtml(String(card.name || "").slice(0, 100)),
        team: escapeHtml(String(card.team || "").slice(0, 10)),
      },
    },
  };
}

function publicCardListItem(record) {
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

function sortPublicCards(cards) {
  return cards.sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return Boolean(a.featured) ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

function filterPlayers(registry, searchParams) {
  const team = String(searchParams.get("team") || "").toUpperCase();
  let players = Object.values(registry);
  if (searchParams.get("active") === "true") players = players.filter((player) => player.active === true);
  if (team) players = players.filter((player) => player.team === team);
  return players.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function decodeThumbnail(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!match) return null;
  const [, format, base64] = match;
  return {
    buffer: Buffer.from(base64, "base64"),
    mime: format === "jpeg" ? "image/jpeg" : `image/${format}`,
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

function resolveApiRoute({ method, pathname, query = new URLSearchParams() }) {
  const parts = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const id = queryValue(query, "id");
  const view = queryValue(query, "view");
  const playerId = queryValue(query, "playerId");
  const mediaId = queryValue(query, "mediaId");
  const isGet = method === "GET";

  if (isGet && parts.length === 1 && parts[0] === "health") return { name: "health" };
  if (parts.length === 1 && parts[0] === "cards" && isGet && id && view === "thumbnail") return { name: "card-thumbnail", id };
  if (parts.length === 1 && parts[0] === "cards" && isGet && id) return { name: "card-detail", id };
  if (parts.length === 1 && parts[0] === "cards" && method === "DELETE" && id) return { name: "card-delete", id };
  if (parts.length === 1 && parts[0] === "cards" && isGet) return { name: "card-list" };
  if (parts.length === 1 && parts[0] === "cards" && method === "POST") return { name: "card-publish" };
  if (parts.length === 3 && parts[0] === "cards" && parts[2] === "thumbnail" && isGet) return { name: "card-thumbnail", id: parts[1] };
  if (parts.length === 2 && parts[0] === "cards" && isGet) return { name: "card-detail", id: parts[1] };
  if (parts.length === 2 && parts[0] === "cards" && method === "DELETE") return { name: "card-delete", id: parts[1] };

  if (parts.length === 1 && parts[0] === "players" && isGet && playerId && view === "media") return { name: "player-media-list", playerId };
  if (parts.length === 1 && parts[0] === "players" && isGet && playerId) return { name: "player-detail", playerId };
  if (parts.length === 1 && parts[0] === "players" && isGet) return { name: "player-list" };
  if (parts.length === 3 && parts[0] === "players" && PLAYER_ID_REGEX.test(parts[1]) && parts[2] === "media" && isGet) return { name: "player-media-list", playerId: parts[1] };
  if (parts.length === 2 && parts[0] === "players" && PLAYER_ID_REGEX.test(parts[1]) && isGet) return { name: "player-detail", playerId: parts[1] };

  if (parts.length === 1 && parts[0] === "player-media" && isGet && mediaId && view === "file") return { name: "media-file", mediaId };
  if (parts.length === 1 && parts[0] === "player-media" && method === "POST" && mediaId && view === "admin-revoke") return { name: "media-revoke", mediaId };
  if (parts.length === 1 && parts[0] === "player-media" && method === "POST" && view === "admin-upload") return { name: "media-upload" };
  if (parts.length === 1 && parts[0] === "player-media" && isGet && mediaId) return { name: "media-detail", mediaId };
  if (parts.length === 2 && parts[0] === "player-media" && isGet) return { name: "media-detail", mediaId: parts[1] };
  if (parts.length === 3 && parts[0] === "player-media" && parts[2] === "file" && isGet) return { name: "media-file", mediaId: parts[1] };
  if (parts.length === 3 && parts[0] === "admin" && parts[1] === "player-media" && parts[2] === "upload" && method === "POST") return { name: "media-upload" };
  if (parts.length === 4 && parts[0] === "admin" && parts[1] === "player-media" && parts[3] === "revoke" && method === "POST") return { name: "media-revoke", mediaId: parts[2] };
  return null;
}

function queryValue(query, key) {
  const value = query instanceof URLSearchParams ? query.get(key) : query[key];
  return Array.isArray(value) ? value[0] : value;
}

function failure(status, error) {
  return { status, error };
}

module.exports = {
  CARD_ID_REGEX,
  PLAYER_ID_REGEX,
  MEDIA_ID_REGEX,
  THUMBNAIL_REGEX,
  LIMITS,
  createCardRecord,
  decodeThumbnail,
  escapeHtml,
  fallbackMedia,
  filterPlayers,
  findPlayerById,
  hashToken,
  publicCardListItem,
  resolveApiRoute,
  sortPublicCards,
};
