#!/usr/bin/env node
/**
 * Card Builder Shared Library Server
 *
 * 按 docs/PRD_共享卡牌库_Codex_Spec.md（v2.0）实现：
 *  - 零第三方依赖（仅 Node 内置模块），ESM（.mjs）
 *  - 单端口同时提供静态资源与 /api
 *  - 无用户系统：昵称 + 发布 token（仅存 SHA-256 哈希）
 *  - 数据存 server/data/cards/*.json，便于备份与迁移
 */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { URL } from "node:url";

const PORT = parseInt(process.env.PORT, 10) || 4174;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data", "cards");
const MAX_BODY_SIZE = 4 * 1024 * 1024; // 4 MB
const MAX_THUMBNAIL_CHARS = 600_000;
const MAX_FULLSTATE_CHARS = 2_000_000;
const MAX_AUTHOR_LENGTH = 24;
const THUMBNAIL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const REGISTRY_PATH = path.join(PROJECT_ROOT, "data", "player-registry.json");

// 启动时自动创建数据目录
fs.mkdirSync(DATA_DIR, { recursive: true });
seedFeaturedCard();

// 官方展示卡：首次启动时写入共享库，保证所有访客打开页面即可检视预设卡
function seedFeaturedCard() {
  const source = path.join(__dirname, "featured-card.json");
  const target = path.join(DATA_DIR, "sc_featured_showcase.json");
  if (fs.existsSync(target)) return false;
  if (!fs.existsSync(source)) {
    console.warn("[featured] server/featured-card.json 不存在，跳过官方展示卡");
    return false;
  }
  try {
    fs.copyFileSync(source, target);
    console.log("[featured] 官方展示卡已写入共享库");
    return true;
  } catch (error) {
    console.warn("[featured] 写入官方展示卡失败:", error.message);
    return false;
  }
}

// 球员基础信息注册表（权威白名单，与 data/player-registry.json 一致）
function loadPlayerRegistry() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const PLAYER_REGISTRY = loadPlayerRegistry();

function reportPlayerRegistry() {
  const entries = Object.values(PLAYER_REGISTRY).filter((entry) => entry && typeof entry === "object");
  const unverified = entries.filter((entry) => entry.portraitVerified !== true).length;
  const byDisplay = new Map();
  for (const entry of entries) {
    const key = String(entry.displayName || entry.name || "").toLowerCase().trim();
    if (!key) continue;
    const value = `${entry.team}|${entry.position}`;
    if (!byDisplay.has(key)) byDisplay.set(key, new Set());
    byDisplay.get(key).add(value);
  }
  let conflicts = 0;
  for (const values of byDisplay.values()) {
    if (values.size > 1) conflicts += 1;
  }
  console.log(`[player-registry] loaded ${entries.length} players`);
  console.log(`[player-registry] ${unverified} players with portraitVerified=false → NEEDS REVIEW`);
  console.log(`[player-registry] ${conflicts} conflicts detected`);
  for (const [key, values] of byDisplay) {
    if (values.size > 1) console.log(`[CONFLICT] ${key}: ${[...values].join(" / ")}`);
  }
}

const SERVER_POSITION_MAP = {
  PG: "POINT GUARD",
  SG: "SHOOTING GUARD",
  SF: "SMALL FORWARD",
  PF: "POWER FORWARD",
  C: "CENTER",
};

function validateServerPlayerMeta(card) {
  const full = card.fullState || {};
  const playerName = String(full.playerName || card.name || "").trim().toLowerCase();
  const authoritative = PLAYER_REGISTRY[playerName];
  if (!authoritative) return null;
  const cardTeam = String(full.teamAbbr || card.team || "").toUpperCase().trim();
  if (cardTeam && cardTeam !== authoritative.team) {
    return `Team mismatch with official registry: ${cardTeam} !== ${authoritative.team}`;
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function generateId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex");
  return `sc_${ts}_${rand}`;
}

function generateTokenPair() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function safePath(dir, filename) {
  const resolved = path.resolve(dir, filename);
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
    return null;
  }
  return resolved;
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

async function handleListCards(req, res) {
  const files = await fsp.readdir(DATA_DIR);
  const cards = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fsp.readFile(path.join(DATA_DIR, f), "utf-8");
      const record = JSON.parse(raw);
      cards.push({
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
      });
    } catch {
      /* 跳过损坏文件 */
    }
  }
  cards.sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return Boolean(a.featured) ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  return json(res, 200, { cards });
}

async function handlePublishCard(req, res) {
  const raw = await readBody(req);
  let body;
  try {
    body = JSON.parse(raw);
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

  const rawAuthor = (body.author || "").trim();
  if (rawAuthor.length > MAX_AUTHOR_LENGTH) return json(res, 400, { error: "Author name too long" });
  const author = escapeHtml(rawAuthor).slice(0, MAX_AUTHOR_LENGTH) || "匿名";
  const id = generateId();
  const { token, tokenHash } = generateTokenPair();

  const record = {
    schemaVersion: 1,
    id,
    author,
    createdAt: Date.now(),
    tokenHash,
    card: {
      ...card,
      sharedId: id,
      name: escapeHtml((card.name || "").slice(0, 100)),
      team: escapeHtml((card.team || "").slice(0, 10)),
    },
  };

  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: "Invalid id" });
  await fsp.writeFile(filePath, JSON.stringify(record, null, 2), "utf-8");

  return json(res, 201, { id, token, card: record.card });
}

async function handleGetCard(req, res, id) {
  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: "Invalid id" });
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    const record = JSON.parse(raw);
    return json(res, 200, {
      id: record.id,
      author: record.author,
      createdAt: record.createdAt,
      card: record.card,
    });
  } catch (err) {
    if (err.code === "ENOENT") return json(res, 404, { error: "Card not found" });
    console.error("Get card error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}

async function handleGetThumbnail(req, res, id) {
  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: "Invalid id" });
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    const record = JSON.parse(raw);
    const dataUrl = record.card.thumbnail;
    const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
    if (!match) return json(res, 500, { error: "Invalid stored thumbnail" });
    const [, format, b64] = match;
    const buf = Buffer.from(b64, "base64");
    const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": buf.length,
      "Cache-Control": "public, max-age=86400",
    });
    res.end(buf);
  } catch (err) {
    if (err.code === "ENOENT") return json(res, 404, { error: "Card not found" });
    console.error("Get thumbnail error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}

async function handleDeleteCard(req, res, id, token) {
  if (!token) return json(res, 403, { error: "Token required" });
  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: "Invalid id" });
  let raw;
  try {
    raw = await fsp.readFile(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return json(res, 404, { error: "Card not found" });
    console.error("Delete read error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
  const record = JSON.parse(raw);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  if (hash !== record.tokenHash) return json(res, 403, { error: "Token mismatch" });
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    console.error("Delete unlink error:", err);
    return json(res, 500, { error: "Failed to delete card" });
  }
  return json(res, 200, { deleted: true });
}

async function handleApi(req, res, url, pathname) {
  try {
    if (pathname === "/api/health" && req.method === "GET") {
      const files = await fsp.readdir(DATA_DIR);
      const count = files.filter((f) => f.endsWith(".json")).length;
      return json(res, 200, { status: "ok", count });
    }

    if (pathname === "/api/cards" && req.method === "GET") {
      return handleListCards(req, res);
    }

    if (pathname === "/api/cards" && req.method === "POST") {
      return handlePublishCard(req, res);
    }

    const thumbMatch = pathname.match(/^\/api\/cards\/([a-z0-9_]+)\/thumbnail$/);
    if (thumbMatch && req.method === "GET") {
      return handleGetThumbnail(req, res, thumbMatch[1]);
    }

    const detailMatch = pathname.match(/^\/api\/cards\/([a-z0-9_]+)$/);
    if (detailMatch && req.method === "GET") {
      return handleGetCard(req, res, detailMatch[1]);
    }

    if (detailMatch && req.method === "DELETE") {
      const token = url.searchParams.get("token") || "";
      return handleDeleteCard(req, res, detailMatch[1], token);
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("API error:", err);
    json(res, err.status || 500, { error: err.message || "Internal server error" });
  }
}

async function serveStatic(req, res, pathname) {
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(PROJECT_ROOT, pathname);
  if (!filePath.startsWith(PROJECT_ROOT + path.sep) && filePath !== PROJECT_ROOT) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      // 开发期：HTML/JS/CSS 不缓存，避免浏览器继续使用旧代码
      "Cache-Control": [".html", ".js", ".mjs", ".css"].includes(ext) ? "no-cache" : "public, max-age=3600",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers（局域网访问）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, url, pathname);
  }

  return serveStatic(req, res, pathname);
}

const server = http.createServer(handleRequest);
reportPlayerRegistry();
server.listen(PORT, "0.0.0.0", () => {
  console.log("Card Builder server running at:");
  console.log(`  → Local:   http://127.0.0.1:${PORT}/`);
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const cfg of iface || []) {
      if (cfg.family === "IPv4" && !cfg.internal) {
        console.log(`  → Network: http://${cfg.address}:${PORT}/`);
      }
    }
  }
});
