# Codex 执行规范 — Card Builder 共享卡牌库（Shared Card Library）

| 项目 | 内容 |
| --- | --- |
| 产品 | Card Builder（DIY 3D 球星卡制作器，纯 Web / Three.js） |
| 文档版本 | v2.0（Codex 执行版） |
| 日期 | 2026-08-05 |
| 基线 | 原 PRD v1.0 |
| 目标读者 | Codex / AI Code Agent — 本文档提供足够精确的实现规范，使代码智能体可直接执行 |

---

## 0. 执行前须知（Codex 阅读指南）

### 0.1 文档结构

本文档按**实现顺序**组织，每个章节对应一个可独立提交的工作单元。请严格按 §1 → §2 → §3 → §4 → §5 → §6 → §7 的顺序执行，因为后续章节依赖前序成果。

### 0.2 硬性约束

| 约束 | 说明 |
| --- | --- |
| **零第三方依赖** | 服务端 `package.json` 的 `dependencies` 必须为空对象 `{}`。仅使用 Node.js 内置模块（`http`, `fs`, `path`, `crypto`, `url`）。不可使用 Express / Koa / Fastify 等框架 |
| **Node.js ≥ 18** | 使用 ESM（`.mjs` 扩展名或 `"type": "module"`）；可使用 `crypto.subtle` / `fs/promises` / `URL` 等 |
| **不使用 TypeScript** | 所有代码为纯 JavaScript |
| **不破坏现有功能** | 本地卡牌库（`localStorage` + `IndexedDB`）的保存、筛选、收藏、对比、导出导入必须全部保留 |
| **单端口** | `npm start` 启动一个 Node 进程，同端口提供静态资源和 API |
| **默认端口 4174** | 可通过 `PORT` 环境变量覆盖 |

### 0.3 现有项目文件结构（假设基线）

```
card-builder/
├── index.html              ← 主页面
├── app.js                  ← 主应用逻辑（编辑器 + 本地卡牌库）
├── three-preview.js        ← Three.js 3D 预览渲染
├── styles.css              ← 全部样式
├── package.json            ← 项目配置
├── assets/                 ← 静态素材（球员图、Logo 等）
│   ├── players/
│   ├── logos/
│   └── ...
└── audit-player-data.mjs   ← 球员数据审计脚本
```

### 0.4 本次新增 / 修改的文件清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `server/shared-server.mjs` | **新增** | 后端服务器（静态资源 + API） |
| `shared-library.js` | **新增** | 前端共享卡牌库模块 |
| `index.html` | **修改** | 新增抽屉双 Tab + 共享面板 + 检视弹层 HTML |
| `styles.css` | **修改** | 新增共享库相关样式 |
| `package.json` | **修改** | 更新 `scripts.start` + 新增 `scripts.check` |
| `app.js` | **修改** | 暴露编辑器接口供 `shared-library.js` 调用 |
| `server/data/cards/` | **新增** | 运行时自动创建的数据目录 |

---

## 1. 后端服务器（`server/shared-server.mjs`）

### 1.1 文件头部与模块导入

```javascript
// server/shared-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { URL } from 'node:url';
```

### 1.2 常量定义

```javascript
const PORT = parseInt(process.env.PORT, 10) || 4174;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data', 'cards');
const MAX_BODY_SIZE = 4 * 1024 * 1024; // 4 MB
const MAX_THUMBNAIL_CHARS = 600_000;
const MAX_FULLSTATE_CHARS = 2_000_000;
const MAX_AUTHOR_LENGTH = 24;
const THUMBNAIL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
```

### 1.3 启动时自动创建数据目录

```javascript
fs.mkdirSync(DATA_DIR, { recursive: true });
```

### 1.4 MIME 类型映射

```javascript
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};
```

### 1.5 工具函数

#### 1.5.1 读取请求体

```javascript
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
```

#### 1.5.2 JSON 响应

```javascript
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}
```

#### 1.5.3 生成 ID

```javascript
function generateId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `sc_${ts}_${rand}`;
}
```

#### 1.5.4 生成 Token + Hash

```javascript
function generateTokenPair() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}
```

#### 1.5.5 路径穿越防护

```javascript
function safePath(dir, filename) {
  const resolved = path.resolve(dir, filename);
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
    return null;
  }
  return resolved;
}
```

#### 1.5.6 HTML 转义（卡牌元数据存储前清洗）

```javascript
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### 1.6 API 路由实现

#### 1.6.1 路由分发逻辑

```javascript
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // --- CORS headers (for LAN access) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // --- API routes ---
  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, url, pathname);
  }

  // --- Static file serving ---
  return serveStatic(req, res, pathname);
}
```

#### 1.6.2 API 处理函数

```javascript
async function handleApi(req, res, url, pathname) {
  try {
    // GET /api/health
    if (pathname === '/api/health' && req.method === 'GET') {
      const files = await fsp.readdir(DATA_DIR);
      const count = files.filter(f => f.endsWith('.json')).length;
      return json(res, 200, { status: 'ok', count });
    }

    // GET /api/cards — 列表（元数据，不含 thumbnail / fullState）
    if (pathname === '/api/cards' && req.method === 'GET') {
      return handleListCards(req, res);
    }

    // POST /api/cards — 发布
    if (pathname === '/api/cards' && req.method === 'POST') {
      return handlePublishCard(req, res);
    }

    // GET /api/cards/:id/thumbnail — 缩略图
    const thumbMatch = pathname.match(/^\/api\/cards\/([a-z0-9_]+)\/thumbnail$/);
    if (thumbMatch && req.method === 'GET') {
      return handleGetThumbnail(req, res, thumbMatch[1]);
    }

    // GET /api/cards/:id — 完整详情
    const detailMatch = pathname.match(/^\/api\/cards\/([a-z0-9_]+)$/);
    if (detailMatch && req.method === 'GET') {
      return handleGetCard(req, res, detailMatch[1]);
    }

    // DELETE /api/cards/:id — 删除
    if (detailMatch && req.method === 'DELETE') {
      const token = url.searchParams.get('token') || '';
      return handleDeleteCard(req, res, detailMatch[1], token);
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('API error:', err);
    json(res, err.status || 500, { error: err.message || 'Internal server error' });
  }
}
```

#### 1.6.3 GET /api/cards — 列表

**响应格式：**
```json
{
  "cards": [
    {
      "id": "sc_xxx_yyy",
      "author": "小杰",
      "createdAt": 1780000000000,
      "card": {
        "id": "cb_...",
        "name": "LEBRON JAMES",
        "team": "LAL",
        "style": "prism",
        "effect": "lightning",
        "rarity": "gold",
        "slabType": "acrylic",
        "badges": ["allstar"],
        "thumbnailUrl": "/api/cards/sc_xxx_yyy/thumbnail"
      }
    }
  ]
}
```

**关键实现：列表接口不返回 `thumbnail`（base64 原文）和 `fullState`，只返回 `thumbnailUrl` 路径。**

```javascript
async function handleListCards(req, res) {
  const files = await fsp.readdir(DATA_DIR);
  const cards = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fsp.readFile(path.join(DATA_DIR, f), 'utf-8');
      const record = JSON.parse(raw);
      cards.push({
        id: record.id,
        author: record.author,
        createdAt: record.createdAt,
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
          // ⚠️ 不返回 thumbnail 和 fullState
        },
      });
    } catch { /* 跳过损坏文件 */ }
  }
  // 按 createdAt 倒序
  cards.sort((a, b) => b.createdAt - a.createdAt);
  return json(res, 200, { cards });
}
```

#### 1.6.4 POST /api/cards — 发布

**请求体格式：**
```json
{
  "author": "小杰",
  "card": {
    "id": "cb_xxx",
    "name": "LEBRON JAMES",
    "team": "LAL",
    "style": "prism",
    "effect": "lightning",
    "rarity": "gold",
    "slabType": "acrylic",
    "badges": ["allstar", "rc"],
    "thumbnail": "data:image/jpeg;base64,...",
    "fullState": { /* 完整项目快照 */ },
    "createdAt": 1780000000000
  }
}
```

**响应格式（201）：**
```json
{
  "id": "sc_xxx_yyy",
  "token": "64位hex字符串（仅此次返回，客户端需本地保存）",
  "card": { /* 同请求中的 card，外加 sharedId 字段 */ }
}
```

**校验规则（按顺序执行，任一失败返回 400）：**

| # | 校验 | 错误消息 |
|---|------|---------|
| 1 | `typeof body.card === 'object' && body.card !== null` | `"Missing card data"` |
| 2 | `typeof body.card.thumbnail === 'string'` | `"Missing thumbnail"` |
| 3 | `THUMBNAIL_REGEX.test(body.card.thumbnail)` | `"Invalid thumbnail format"` |
| 4 | `body.card.thumbnail.length <= MAX_THUMBNAIL_CHARS` | `"Thumbnail too large"` |
| 5 | `body.card.fullState != null` | `"Missing fullState"` |
| 6 | `JSON.stringify(body.card.fullState).length <= MAX_FULLSTATE_CHARS` | `"fullState too large"` |
| 7 | `author.length <= MAX_AUTHOR_LENGTH`（trim 后） | `"Author name too long"` |

```javascript
async function handlePublishCard(req, res) {
  const raw = await readBody(req);
  let body;
  try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { card } = body;
  if (!card || typeof card !== 'object') return json(res, 400, { error: 'Missing card data' });
  if (typeof card.thumbnail !== 'string') return json(res, 400, { error: 'Missing thumbnail' });
  if (!THUMBNAIL_REGEX.test(card.thumbnail)) return json(res, 400, { error: 'Invalid thumbnail format' });
  if (card.thumbnail.length > MAX_THUMBNAIL_CHARS) return json(res, 400, { error: 'Thumbnail too large' });
  if (card.fullState == null) return json(res, 400, { error: 'Missing fullState' });
  if (JSON.stringify(card.fullState).length > MAX_FULLSTATE_CHARS) return json(res, 400, { error: 'fullState too large' });

  const author = escapeHtml((body.author || '').trim()).slice(0, MAX_AUTHOR_LENGTH) || '匿名';
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
      name: escapeHtml((card.name || '').slice(0, 100)),
      team: escapeHtml((card.team || '').slice(0, 10)),
    },
  };

  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: 'Invalid id' });
  await fsp.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');

  return json(res, 201, { id, token, card: record.card });
}
```

#### 1.6.5 GET /api/cards/:id — 详情

```javascript
async function handleGetCard(req, res, id) {
  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: 'Invalid id' });
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    const record = JSON.parse(raw);
    // 不返回 tokenHash
    return json(res, 200, {
      id: record.id,
      author: record.author,
      createdAt: record.createdAt,
      card: record.card,
    });
  } catch {
    return json(res, 404, { error: 'Card not found' });
  }
}
```

#### 1.6.6 GET /api/cards/:id/thumbnail — 缩略图

```javascript
async function handleGetThumbnail(req, res, id) {
  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: 'Invalid id' });
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    const record = JSON.parse(raw);
    const dataUrl = record.card.thumbnail;
    // 解析 data URL → 二进制
    const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
    if (!match) return json(res, 500, { error: 'Invalid stored thumbnail' });
    const [, format, b64] = match;
    const buf = Buffer.from(b64, 'base64');
    const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=86400', // 缓存 1 天
    });
    res.end(buf);
  } catch {
    return json(res, 404, { error: 'Card not found' });
  }
}
```

#### 1.6.7 DELETE /api/cards/:id — 删除

```javascript
async function handleDeleteCard(req, res, id, token) {
  if (!token) return json(res, 403, { error: 'Token required' });
  const filePath = safePath(DATA_DIR, `${id}.json`);
  if (!filePath) return json(res, 400, { error: 'Invalid id' });
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    const record = JSON.parse(raw);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (hash !== record.tokenHash) return json(res, 403, { error: 'Token mismatch' });
    await fsp.unlink(filePath);
    return json(res, 200, { deleted: true });
  } catch {
    return json(res, 404, { error: 'Card not found' });
  }
}
```

### 1.7 静态资源服务

```javascript
async function serveStatic(req, res, pathname) {
  // 默认首页
  if (pathname === '/') pathname = '/index.html';

  // 安全：禁止 .. 穿越
  const filePath = path.join(PROJECT_ROOT, pathname);
  if (!filePath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error('Not a file');
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}
```

### 1.8 启动服务器

```javascript
const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Card Builder server running at:`);
  console.log(`  → Local:   http://127.0.0.1:${PORT}/`);
  // 打印局域网 IP
  const nets = await import('node:os').then(os => os.networkInterfaces());
  for (const iface of Object.values(nets)) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) {
        console.log(`  → Network: http://${cfg.address}:${PORT}/`);
      }
    }
  }
});
```

> **注意：** 由于顶层 `await` 在 ESM 中可用，上述 `await import()` 可直接使用。如果兼容性有问题，可改为同步方式 `require('os')` 或 `import os from 'node:os'` 放到文件顶部。推荐将 `os` 导入放到文件顶部更稳妥。

**最终推荐写法：**

```javascript
// 文件顶部添加：
import os from 'node:os';

// 启动部分改为：
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Card Builder server running at:`);
  console.log(`  → Local:   http://127.0.0.1:${PORT}/`);
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const cfg of (iface || [])) {
      if (cfg.family === 'IPv4' && !cfg.internal) {
        console.log(`  → Network: http://${cfg.address}:${PORT}/`);
      }
    }
  }
});
```

---

## 2. 前端共享库模块（`shared-library.js`）

### 2.1 模块职责

`shared-library.js` 是一个 IIFE 或挂载到 `window.SharedLibrary` 的模块，负责：

1. 调用 API 发布 / 获取 / 删除共享卡牌
2. 渲染共享卡牌网格
3. 管理筛选状态
4. 打开 / 关闭检视弹层
5. 管理 `localStorage` 中的昵称和删除 token

### 2.2 localStorage 键名

| 键 | 值 | 说明 |
|---|---|---|
| `cardbuilder_shared_author` | `string` | 用户昵称（≤24字符） |
| `cardbuilder_shared_tokens` | `JSON string: { [sharedId]: token }` | 每张已发布卡牌的删除 token 映射 |

### 2.3 核心 API 调用函数

```javascript
const API_BASE = ''; // 同源，无需前缀

async function apiListCards() {
  const res = await fetch(`${API_BASE}/api/cards`);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return (await res.json()).cards;
}

async function apiPublishCard(author, card) {
  const res = await fetch(`${API_BASE}/api/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, card }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Publish failed: ${res.status}`);
  }
  return res.json(); // { id, token, card }
}

async function apiGetCard(id) {
  const res = await fetch(`${API_BASE}/api/cards/${id}`);
  if (!res.ok) throw new Error(`Get failed: ${res.status}`);
  return res.json();
}

async function apiDeleteCard(id, token) {
  const res = await fetch(`${API_BASE}/api/cards/${id}?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Delete failed: ${res.status}`);
  }
  return res.json();
}
```

### 2.4 Token 管理

```javascript
function getTokens() {
  try { return JSON.parse(localStorage.getItem('cardbuilder_shared_tokens') || '{}'); }
  catch { return {}; }
}

function saveToken(sharedId, token) {
  const tokens = getTokens();
  tokens[sharedId] = token;
  localStorage.setItem('cardbuilder_shared_tokens', JSON.stringify(tokens));
}

function getToken(sharedId) {
  return getTokens()[sharedId] || null;
}

function removeToken(sharedId) {
  const tokens = getTokens();
  delete tokens[sharedId];
  localStorage.setItem('cardbuilder_shared_tokens', JSON.stringify(tokens));
}
```

### 2.5 昵称管理

```javascript
function getSavedAuthor() {
  return localStorage.getItem('cardbuilder_shared_author') || '';
}

function saveAuthor(name) {
  localStorage.setItem('cardbuilder_shared_author', name.trim().slice(0, 24));
}
```

### 2.6 发布流程

```javascript
async function publishCurrentCard() {
  // 1. 从编辑器获取当前状态
  //    需要 app.js 暴露 window.CardBuilder.getFullState()
  //    返回 { name, team, style, effect, rarity, slabType, badges, fullState, ... }
  const state = window.CardBuilder.getFullState();
  if (!state) {
    alert('请先制作一张卡牌');
    return;
  }

  // 2. 生成缩略图 (360×504 JPEG)
  //    需要 app.js 暴露 window.CardBuilder.captureThumbnail(width, height, format)
  //    返回 data:image/jpeg;base64,... 字符串
  const thumbnail = await window.CardBuilder.captureThumbnail(360, 504, 'image/jpeg');

  // 3. 内联相对路径图片
  const inlinedState = await inlineRelativeImages(state.fullState);

  // 4. 获取昵称
  const authorInput = document.getElementById('shared-author-input');
  const author = (authorInput?.value || '').trim() || '匿名';
  saveAuthor(author);

  // 5. 构建卡牌数据
  const card = {
    id: state.id || `cb_${Date.now().toString(36)}`,
    name: state.name,
    team: state.team,
    style: state.style,
    effect: state.effect,
    rarity: state.rarity,
    slabType: state.slabType,
    badges: state.badges || [],
    thumbnail,
    fullState: inlinedState,
    createdAt: Date.now(),
  };

  // 6. 调用 API
  try {
    const publishBtn = document.getElementById('shared-publish-btn');
    if (publishBtn) { publishBtn.disabled = true; publishBtn.textContent = '发布中...'; }

    const result = await apiPublishCard(author, card);

    // 7. 保存 token
    saveToken(result.id, result.token);

    // 8. 刷新列表
    await loadSharedCards();

    if (publishBtn) { publishBtn.disabled = false; publishBtn.textContent = '✦ PUBLISH CURRENT CARD'; }
    // 显示成功提示（可用现有 toast 组件或简单 alert）
  } catch (err) {
    console.error('Publish error:', err);
    alert('发布失败: ' + err.message);
    const publishBtn = document.getElementById('shared-publish-btn');
    if (publishBtn) { publishBtn.disabled = false; publishBtn.textContent = '✦ PUBLISH CURRENT CARD'; }
  }
}
```

### 2.7 图片内联工具函数

当 `fullState` 中的球员图 / Logo 是相对路径（如 `assets/players/lebron.png`），需在发布前将其转为 data URL，确保其他设备能渲染。

```javascript
async function inlineRelativeImages(fullState) {
  const state = JSON.parse(JSON.stringify(fullState)); // 深拷贝

  // 处理球员图
  if (state.playerImage && !state.playerImage.startsWith('data:')) {
    state.playerImage = await fetchAsDataUrl(state.playerImage);
  }
  // 处理球队 Logo
  if (state.teamLogo && !state.teamLogo.startsWith('data:')) {
    state.teamLogo = await fetchAsDataUrl(state.teamLogo);
  }
  // 处理签名图
  if (state.signatureImage && !state.signatureImage.startsWith('data:')) {
    state.signatureImage = await fetchAsDataUrl(state.signatureImage);
  }
  // 处理闪光蒙版
  if (state.shimmerMask && !state.shimmerMask.startsWith('data:')) {
    state.shimmerMask = await fetchAsDataUrl(state.shimmerMask);
  }

  return state;
}

async function fetchAsDataUrl(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // 转换失败则保留原路径
  }
}
```

### 2.8 卡牌网格渲染

```javascript
// 筛选状态
let sharedFilters = { rarity: 'ALL', style: 'ALL', slabType: 'ALL' };
let sharedCards = []; // 缓存列表

async function loadSharedCards() {
  try {
    sharedCards = await apiListCards();
    renderSharedGrid();
  } catch (err) {
    console.error('Load shared cards error:', err);
  }
}

function renderSharedGrid() {
  const grid = document.getElementById('shared-grid');
  const countEl = document.getElementById('shared-count');
  if (!grid) return;

  // 应用筛选
  const filtered = sharedCards.filter(item => {
    const c = item.card;
    if (sharedFilters.rarity !== 'ALL' && (c.rarity || '').toUpperCase() !== sharedFilters.rarity) return false;
    if (sharedFilters.style !== 'ALL' && (c.style || '').toUpperCase() !== sharedFilters.style) return false;
    if (sharedFilters.slabType !== 'ALL' && (c.slabType || '').toUpperCase() !== sharedFilters.slabType.replace(/\s+/g, '_')) return false;
    return true;
  });

  if (countEl) countEl.textContent = `${filtered.length} CARDS`;

  // 空状态
  if (sharedCards.length === 0) {
    grid.innerHTML = '<div class="shared-empty">还没有共享卡牌，先做一张卡发布吧！</div>';
    return;
  }
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="shared-empty">没有符合筛选条件的卡片</div>';
    return;
  }

  // 渲染网格
  grid.innerHTML = filtered.map(item => `
    <div class="shared-card-item" data-shared-id="${item.id}" role="button" tabindex="0"
         aria-label="查看 ${item.card.name || 'Card'} by ${item.author}">
      <div class="shared-card-thumb">
        <img src="${item.card.thumbnailUrl}" alt="${item.card.name || 'Card'}"
             loading="lazy" width="180" height="252" />
      </div>
      <div class="shared-card-info">
        <div class="shared-card-name">${item.card.name || 'UNNAMED'}</div>
        <div class="shared-card-meta">
          <span class="shared-card-team">${item.card.team || ''}</span>
          <span class="shared-card-rarity rarity-${(item.card.rarity || 'base').toLowerCase()}">${(item.card.rarity || 'BASE').toUpperCase()}</span>
        </div>
        <div class="shared-card-author">by ${item.author}</div>
      </div>
    </div>
  `).join('');

  // 绑定点击事件
  grid.querySelectorAll('.shared-card-item').forEach(el => {
    el.addEventListener('click', () => openSharedDetail(el.dataset.sharedId));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openSharedDetail(el.dataset.sharedId); });
  });
}
```

### 2.9 检视弹层

```javascript
async function openSharedDetail(sharedId) {
  const modal = document.getElementById('shared-detail-modal');
  if (!modal) return;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // 加载完整数据
  try {
    const data = await apiGetCard(sharedId);
    renderDetailContent(data, sharedId);
  } catch (err) {
    console.error('Load detail error:', err);
    modal.querySelector('.shared-detail-body').innerHTML =
      '<div class="shared-empty">加载失败，请重试</div>';
  }
}

function renderDetailContent(data, sharedId) {
  const body = document.querySelector('.shared-detail-body');
  if (!body) return;

  const card = data.card;
  const fullState = card.fullState || {};
  const token = getToken(sharedId);
  const createdDate = new Date(data.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  // 球员数据字段（空值不显示）
  const stats = fullState.playerStats || fullState.stats || {};
  const statFields = [
    { key: 'ppg', label: 'PPG' }, { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' }, { key: 'fgPct', label: 'FG%' },
    { key: 'threePct', label: '3P%' }, { key: 'gp', label: 'GP' },
    { key: 'height', label: 'Height' }, { key: 'weight', label: 'Weight' },
  ];
  const statsHtml = statFields
    .filter(s => stats[s.key] != null && stats[s.key] !== '')
    .map(s => `<div class="shared-detail-stat"><span class="stat-label">${s.label}</span><span class="stat-value">${stats[s.key]}</span></div>`)
    .join('');

  // 徽章
  const badgesHtml = (card.badges || [])
    .map(b => `<span class="shared-detail-badge">${b.toUpperCase()}</span>`)
    .join(' ');

  body.innerHTML = `
    <div class="shared-detail-preview">
      <img id="shared-detail-img" src="${card.thumbnail}" alt="${card.name}" />
      <div class="shared-detail-flip-btns">
        <button class="btn-flip active" data-side="front" aria-label="正面">FRONT</button>
        <button class="btn-flip" data-side="back" aria-label="反面">BACK</button>
      </div>
    </div>
    <div class="shared-detail-info">
      <h2 class="shared-detail-name">${card.name || 'UNNAMED'}</h2>
      <div class="shared-detail-author">by ${data.author} · ${createdDate}</div>
      <div class="shared-detail-tags">
        <span class="tag-style">${(card.style || '').toUpperCase()}</span>
        <span class="tag-rarity rarity-${(card.rarity || 'base').toLowerCase()}">${(card.rarity || 'BASE').toUpperCase()}</span>
        <span class="tag-effect">${(card.effect || 'NONE').toUpperCase()}</span>
        <span class="tag-slab">${(card.slabType || 'RAW').toUpperCase()}</span>
        ${badgesHtml ? `<div class="shared-detail-badges">${badgesHtml}</div>` : ''}
      </div>
      ${statsHtml ? `<div class="shared-detail-stats">${statsHtml}</div>` : ''}
      <div class="shared-detail-actions">
        <button id="shared-load-btn" class="btn-action btn-primary" aria-label="加载到编辑器">
          ▶ LOAD TO EDITOR
        </button>
        <button id="shared-download-btn" class="btn-action btn-secondary" aria-label="下载项目 JSON">
          ⬇ DOWNLOAD JSON
        </button>
        ${token ? `<button id="shared-delete-btn" class="btn-action btn-danger" aria-label="删除此卡牌">
          ✕ DELETE
        </button>` : ''}
      </div>
    </div>
  `;

  // --- 事件绑定 ---

  // 正反面切换
  body.querySelectorAll('.btn-flip').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.btn-flip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const img = document.getElementById('shared-detail-img');
      if (btn.dataset.side === 'back' && fullState.backThumbnail) {
        img.src = fullState.backThumbnail;
      } else {
        img.src = card.thumbnail;
      }
    });
  });

  // 加载到编辑器
  document.getElementById('shared-load-btn')?.addEventListener('click', () => {
    if (window.CardBuilder?.loadFullState) {
      window.CardBuilder.loadFullState(card.fullState);
      closeSharedDetail();
      // 关闭抽屉（如有）
      const drawer = document.getElementById('library-drawer');
      if (drawer) drawer.classList.remove('open');
    }
  });

  // 下载 JSON
  document.getElementById('shared-download-btn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(card.fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(card.name || 'card').replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // 删除
  document.getElementById('shared-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('确定要删除这张共享卡牌吗？此操作不可撤销。')) return;
    try {
      await apiDeleteCard(sharedId, token);
      removeToken(sharedId);
      closeSharedDetail();
      await loadSharedCards();
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  });
}

function closeSharedDetail() {
  const modal = document.getElementById('shared-detail-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}
```

### 2.10 弹层关闭事件

```javascript
// 初始化时绑定
function initSharedLibrary() {
  // Esc 关闭弹层
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSharedDetail();
  });

  // 遮罩点击关闭
  document.getElementById('shared-detail-modal')?.addEventListener('click', e => {
    if (e.target.id === 'shared-detail-modal' || e.target.classList.contains('shared-detail-overlay')) {
      closeSharedDetail();
    }
  });

  // 关闭按钮
  document.getElementById('shared-detail-close')?.addEventListener('click', closeSharedDetail);

  // 发布按钮
  document.getElementById('shared-publish-btn')?.addEventListener('click', publishCurrentCard);

  // 刷新按钮
  document.getElementById('shared-refresh-btn')?.addEventListener('click', loadSharedCards);

  // 筛选器变化
  document.querySelectorAll('.shared-filter-select').forEach(sel => {
    sel.addEventListener('change', e => {
      const field = e.target.dataset.filterField; // 'rarity' | 'style' | 'slabType'
      sharedFilters[field] = e.target.value;
      renderSharedGrid();
    });
  });

  // 回填昵称
  const authorInput = document.getElementById('shared-author-input');
  if (authorInput) authorInput.value = getSavedAuthor();

  // Tab 切换
  document.querySelectorAll('.library-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('local-library-panel')?.classList.toggle('hidden', target !== 'local');
      document.getElementById('shared-library-panel')?.classList.toggle('hidden', target !== 'shared');
      if (target === 'shared') loadSharedCards();
    });
  });
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', initSharedLibrary);
```

### 2.11 app.js 需暴露的接口

`shared-library.js` 依赖 `app.js` 暴露以下接口到 `window.CardBuilder`：

| 接口 | 签名 | 说明 |
|------|------|------|
| `getFullState()` | `() => object \| null` | 返回当前编辑器完整状态对象（含 name, team, style, effect, rarity, slabType, badges, fullState 等），未初始化时返回 null |
| `captureThumbnail(w, h, format)` | `(number, number, string) => Promise<string>` | 渲染当前卡面为指定尺寸的 data URL 缩略图 |
| `loadFullState(state)` | `(object) => void` | 将完整状态载入编辑器，恢复所有设计字段 |

**在 `app.js` 中添加：**

```javascript
window.CardBuilder = window.CardBuilder || {};
window.CardBuilder.getFullState = function() {
  // 返回当前编辑器状态
  // 具体实现取决于现有代码结构
  // 至少包含: { id, name, team, style, effect, rarity, slabType, badges, fullState }
};
window.CardBuilder.captureThumbnail = async function(width, height, format) {
  // 使用 Three.js renderer 或 canvas 截图
  // 返回 data URL 字符串
};
window.CardBuilder.loadFullState = function(state) {
  // 恢复所有编辑器字段
};
```

> **⚠️ Codex 关键指令：** 上述三个函数的内部实现必须根据 `app.js` 和 `three-preview.js` 的现有代码结构来编写。Codex 需要先阅读 `app.js` 中管理编辑器状态的变量和函数，然后将它们包装为上述三个公共接口。不要创建新的状态管理——复用现有的。

---

## 3. HTML 修改（`index.html`）

### 3.1 新增 `<script>` 标签

在现有 `<script src="app.js">` **之后** 添加：

```html
<script src="shared-library.js"></script>
```

### 3.2 卡牌库抽屉 Tab 栏

找到现有卡牌库抽屉容器（通常是 `#library-drawer` 或类似），在其顶部内容区域添加 Tab 栏：

```html
<div class="library-tabs" role="tablist" aria-label="卡牌库切换">
  <button class="library-tab active" data-tab="local" role="tab"
          aria-selected="true" aria-controls="local-library-panel">
    MY COLLECTION
  </button>
  <button class="library-tab" data-tab="shared" role="tab"
          aria-selected="false" aria-controls="shared-library-panel">
    SHARED LIBRARY
  </button>
</div>
```

### 3.3 共享卡牌库面板

在 Tab 栏之后、现有本地库面板（用 `id="local-library-panel"` 包裹）旁边添加：

```html
<div id="shared-library-panel" class="library-panel hidden" role="tabpanel" aria-labelledby="shared-tab">

  <!-- 发布区 -->
  <div class="shared-publish-section">
    <div class="shared-author-row">
      <label for="shared-author-input">NICKNAME</label>
      <input type="text" id="shared-author-input" maxlength="24"
             placeholder="匿名" autocomplete="off" />
    </div>
    <button id="shared-publish-btn" class="btn-publish" aria-label="发布当前卡牌">
      ✦ PUBLISH CURRENT CARD
    </button>
  </div>

  <!-- 筛选区 -->
  <div class="shared-filters">
    <select class="shared-filter-select" data-filter-field="rarity" aria-label="稀有度筛选">
      <option value="ALL">ALL RARITY</option>
      <option value="BASE">BASE</option>
      <option value="SILVER">SILVER</option>
      <option value="GOLD">GOLD</option>
      <option value="NEON">NEON</option>
      <option value="RWB">RWB</option>
      <option value="BLACK">BLACK</option>
    </select>
    <select class="shared-filter-select" data-filter-field="style" aria-label="系列筛选">
      <option value="ALL">ALL SERIES</option>
      <option value="PRISM">PRISM</option>
      <option value="TACTICAL">TACTICAL</option>
      <option value="HERITAGE">HERITAGE</option>
      <option value="MOSAIC">MOSAIC</option>
      <option value="SELECT">SELECT</option>
      <option value="OPTIC">OPTIC</option>
    </select>
    <select class="shared-filter-select" data-filter-field="slabType" aria-label="卡壳筛选">
      <option value="ALL">ALL SLABS</option>
      <option value="RAW">RAW</option>
      <option value="MAGNETIC">MAGNETIC</option>
      <option value="GRADED">GRADED</option>
      <option value="MUSEUM">MUSEUM</option>
      <option value="THICK_ACRYLIC">THICK ACRYLIC</option>
      <option value="CRYSTAL">CRYSTAL</option>
      <option value="GALLERY">GALLERY</option>
    </select>
  </div>

  <!-- 统计与刷新 -->
  <div class="shared-toolbar">
    <span id="shared-count" class="shared-count">0 CARDS</span>
    <button id="shared-refresh-btn" class="btn-refresh" aria-label="刷新共享库">
      ↻ REFRESH
    </button>
  </div>

  <!-- 网格 -->
  <div id="shared-grid" class="shared-grid" role="list" aria-label="共享卡牌列表">
    <div class="shared-empty">正在加载...</div>
  </div>
</div>
```

### 3.4 检视弹层

在 `<body>` 底部（所有 `<script>` 之前）添加：

```html
<!-- 共享卡牌检视弹层 -->
<div id="shared-detail-modal" class="shared-detail-modal" role="dialog"
     aria-modal="true" aria-label="卡牌详情" style="display:none;">
  <div class="shared-detail-overlay"></div>
  <div class="shared-detail-container">
    <button id="shared-detail-close" class="shared-detail-close"
            aria-label="关闭">✕</button>
    <div class="shared-detail-body">
      <!-- 由 JS 动态填充 -->
    </div>
  </div>
</div>
```

> **注意：** 弹层使用 `display:none` + `.active` 类切换（`display:flex`），而非 `hidden` 属性，以便过渡动画。JS 中将 `classList.add('active')` 改为同时设置 `style.display = 'flex'`，或使用纯 CSS 方案：

```css
.shared-detail-modal { display: none; }
.shared-detail-modal.active { display: flex; }
```

---

## 4. CSS 样式（`styles.css` 新增部分）

以下样式块追加到 `styles.css` 文件末尾。不修改现有样式。

```css
/* ============================
   SHARED LIBRARY — Tab 切换
   ============================ */
.library-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 16px;
}
.library-tab {
  flex: 1;
  padding: 10px 0;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  text-transform: uppercase;
}
.library-tab:hover { color: rgba(255,255,255,0.8); }
.library-tab.active {
  color: #fff;
  border-bottom-color: #4ecdc4; /* 主题色，按项目调整 */
}

.library-panel.hidden { display: none; }

/* ============================
   SHARED LIBRARY — 发布区
   ============================ */
.shared-publish-section {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 12px;
}
.shared-author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.shared-author-row label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
}
#shared-author-input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
}
#shared-author-input:focus {
  border-color: rgba(255,255,255,0.3);
}
.btn-publish {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #4ecdc4, #44b09e);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-publish:hover { opacity: 0.85; }
.btn-publish:disabled { opacity: 0.5; cursor: not-allowed; }

/* ============================
   SHARED LIBRARY — 筛选区
   ============================ */
.shared-filters {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.shared-filter-select {
  flex: 1;
  min-width: 90px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 6px 4px;
  cursor: pointer;
  -webkit-appearance: none;
}
.shared-filter-select option {
  background: #1a1a2e;
  color: #fff;
}

/* ============================
   SHARED LIBRARY — 工具栏
   ============================ */
.shared-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.shared-count {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.5);
}
.btn-refresh {
  background: none;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: rgba(255,255,255,0.6);
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
}
.btn-refresh:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

/* ============================
   SHARED LIBRARY — 网格
   ============================ */
.shared-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  max-height: calc(100vh - 350px);
  overflow-y: auto;
  padding-right: 4px;
}
.shared-card-item {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.shared-card-item:hover {
  border-color: rgba(255,255,255,0.25);
  transform: translateY(-2px);
}
.shared-card-thumb {
  width: 100%;
  aspect-ratio: 5 / 7;
  overflow: hidden;
  background: rgba(0,0,0,0.3);
}
.shared-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.shared-card-info {
  padding: 8px;
}
.shared-card-name {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}
.shared-card-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}
.shared-card-team {
  font-size: 9px;
  color: rgba(255,255,255,0.5);
  font-weight: 600;
}
.shared-card-rarity {
  font-size: 8px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
/* 稀有度颜色 */
.rarity-base   { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
.rarity-silver  { background: rgba(192,192,192,0.2); color: #c0c0c0; }
.rarity-gold    { background: rgba(255,215,0,0.2); color: #ffd700; }
.rarity-neon    { background: rgba(0,255,128,0.15); color: #00ff80; }
.rarity-rwb     { background: rgba(255,0,0,0.15); color: #ff6666; }
.rarity-black   { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.2); }

.shared-card-author {
  font-size: 9px;
  color: rgba(255,255,255,0.35);
}

.shared-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
  color: rgba(255,255,255,0.3);
  font-size: 12px;
}

/* ============================
   SHARED LIBRARY — 检视弹层
   ============================ */
.shared-detail-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 10000;
  align-items: center;
  justify-content: center;
}
.shared-detail-modal.active { display: flex; }
.shared-detail-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
}
.shared-detail-container {
  position: relative;
  z-index: 1;
  background: #1a1a2e;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  max-width: 720px;
  width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: row;
  gap: 24px;
  padding: 24px;
}
.shared-detail-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  z-index: 2;
}
.shared-detail-close:hover { background: rgba(255,255,255,0.2); }

.shared-detail-preview {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.shared-detail-preview img {
  width: 240px;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.shared-detail-flip-btns {
  display: flex;
  gap: 8px;
}
.btn-flip {
  padding: 4px 14px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.btn-flip.active {
  background: rgba(78,205,196,0.2);
  border-color: #4ecdc4;
  color: #4ecdc4;
}

.shared-detail-info {
  flex: 1;
  min-width: 0;
}
.shared-detail-name {
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 4px;
}
.shared-detail-author {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 16px;
}
.shared-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.shared-detail-tags span {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.5px;
}
.shared-detail-badges {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.shared-detail-badge {
  font-size: 8px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255,215,0,0.15);
  color: #ffd700;
}

.shared-detail-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
}
.shared-detail-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-label {
  font-size: 8px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.5px;
}
.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.shared-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn-action {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
}
.btn-primary {
  background: linear-gradient(135deg, #4ecdc4, #44b09e);
  color: #fff;
}
.btn-secondary {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
.btn-danger {
  background: rgba(255,59,48,0.2);
  color: #ff3b30;
}
.btn-action:hover { opacity: 0.85; }

/* ============================
   移动端适配 (≤ 600px)
   ============================ */
@media (max-width: 600px) {
  .shared-detail-container {
    flex-direction: column;
    padding: 16px;
    width: 95vw;
  }
  .shared-detail-preview {
    flex: none;
    width: 100%;
  }
  .shared-detail-preview img {
    width: 100%;
    max-width: 280px;
  }
  .shared-detail-stats {
    grid-template-columns: repeat(3, 1fr);
  }
  .shared-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }
  .shared-filters {
    flex-direction: column;
  }
}
```

---

## 5. `package.json` 修改

### 5.1 修改 `scripts` 字段

```json
{
  "scripts": {
    "start": "node server/shared-server.mjs",
    "check": "node --check app.js && node --check shared-library.js && node --check server/shared-server.mjs && node --check three-preview.js && echo '✓ All files passed syntax check'"
  }
}
```

> **如果 `package.json` 有 `"type": "module"`**，则 `shared-library.js` 作为浏览器脚本不受影响；但 `node --check shared-library.js` 可能需要确保文件没有 Node-only 语法。

### 5.2 确保无 `dependencies`

```json
{
  "dependencies": {}
}
```

---

## 6. app.js 接口暴露（最小修改规范）

### 6.1 需 Codex 根据现有代码实现的三个接口

Codex 执行此步骤时，必须先阅读 `app.js` 全文，找到：

1. **当前编辑器状态变量**（通常是一个包含所有设计字段的对象，如 `currentProject`、`state`、`cardState` 等）
2. **Three.js renderer 实例**（用于截图）
3. **加载/恢复项目状态的函数**（通常用于「从本地库加载」或「导入 JSON」）

然后在 `app.js` 的适当位置（推荐文件末尾或初始化完成后）添加：

```javascript
// === 共享库接口 ===
window.CardBuilder = window.CardBuilder || {};

// 接口 1：获取当前完整状态
window.CardBuilder.getFullState = function() {
  // TODO: Codex 需根据实际变量名填充
  // 例如：return currentProject ? { ...currentProject } : null;
  // 必须包含字段：id, name, team, style, effect, rarity, slabType, badges, fullState
  // 其中 fullState 是完整项目快照，包含 playerImage, teamLogo, signatureImage, shimmerMask, playerStats/stats, backThumbnail 等
};

// 接口 2：截图生成缩略图
window.CardBuilder.captureThumbnail = async function(width, height, format) {
  // TODO: Codex 需根据 Three.js renderer 实现
  // 方案 A：renderer.domElement.toDataURL(format)
  // 方案 B：离屏 canvas 缩放
  // 必须返回 data:image/jpeg;base64,... 格式字符串
  // 推荐：渲染一帧 → toDataURL → 如尺寸不匹配则用 canvas 缩放
};

// 接口 3：加载完整状态到编辑器
window.CardBuilder.loadFullState = function(state) {
  // TODO: Codex 需调用现有的项目加载/恢复逻辑
  // 例如：loadProject(state) 或 restoreState(state)
  // 加载后应刷新 3D 预览
};
```

### 6.2 Codex 检查清单

在实现上述接口后，Codex 须验证：

- [ ] `getFullState()` 返回的对象包含所有 FR-5.1 所列字段
- [ ] `captureThumbnail()` 返回的 data URL 是合法的 JPEG base64
- [ ] `loadFullState()` 执行后，编辑器 UI 和 3D 预览均已更新
- [ ] 本地库的 保存/加载/导出/导入 功能未被破坏

---

## 7. 验证脚本（`scripts/verify-shared.sh`）

创建自动化冒烟测试脚本，Codex 在实现完成后运行此脚本验证：

```bash
#!/bin/bash
# scripts/verify-shared.sh — 共享卡牌库自动化冒烟测试
set -e

PORT=${PORT:-4174}
BASE="http://127.0.0.1:$PORT"
PASS=0
FAIL=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗ $1${NC}"; FAIL=$((FAIL+1)); }

echo "=== 共享卡牌库冒烟测试 ==="
echo "Base URL: $BASE"
echo ""

# 1. 健康检查
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
[ "$STATUS" = "200" ] && pass "GET /api/health → 200" || fail "GET /api/health → $STATUS (expected 200)"

# 2. 空列表
BODY=$(curl -s "$BASE/api/cards")
echo "$BODY" | grep -q '"cards"' && pass "GET /api/cards returns cards array" || fail "GET /api/cards missing cards array"

# 3. 发布（有效 payload）
# 构造最小合法 thumbnail
THUMB="data:image/jpeg;base64,/9j/4AAQSkZJRg=="
PUBLISH_BODY="{\"author\":\"TestUser\",\"card\":{\"id\":\"cb_test\",\"name\":\"TEST CARD\",\"team\":\"TST\",\"style\":\"prism\",\"effect\":\"none\",\"rarity\":\"gold\",\"slabType\":\"raw\",\"badges\":[],\"thumbnail\":\"$THUMB\",\"fullState\":{\"test\":true},\"createdAt\":$(date +%s000)}}"
PUBLISH_RES=$(curl -s -X POST -H "Content-Type: application/json" -d "$PUBLISH_BODY" "$BASE/api/cards")
CARD_ID=$(echo "$PUBLISH_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TOKEN=$(echo "$PUBLISH_RES" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$CARD_ID" ] && pass "POST /api/cards → got id: $CARD_ID" || fail "POST /api/cards → no id returned"
[ -n "$TOKEN" ] && pass "POST /api/cards → got token" || fail "POST /api/cards → no token returned"

# 4. 列表包含新卡
LIST=$(curl -s "$BASE/api/cards")
echo "$LIST" | grep -q "$CARD_ID" && pass "GET /api/cards includes new card" || fail "GET /api/cards missing new card"

# 5. 详情
DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cards/$CARD_ID")
[ "$DETAIL_STATUS" = "200" ] && pass "GET /api/cards/:id → 200" || fail "GET /api/cards/:id → $DETAIL_STATUS"

# 6. 缩略图
THUMB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cards/$CARD_ID/thumbnail")
[ "$THUMB_STATUS" = "200" ] && pass "GET /api/cards/:id/thumbnail → 200" || fail "GET /api/cards/:id/thumbnail → $THUMB_STATUS"

# 7. 无 token 删除 → 403
DEL_NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/cards/$CARD_ID")
[ "$DEL_NO_TOKEN" = "403" ] && pass "DELETE without token → 403" || fail "DELETE without token → $DEL_NO_TOKEN (expected 403)"

# 8. 错误 token 删除 → 403
DEL_BAD_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/cards/$CARD_ID?token=wrong")
[ "$DEL_BAD_TOKEN" = "403" ] && pass "DELETE with wrong token → 403" || fail "DELETE with wrong token → $DEL_BAD_TOKEN (expected 403)"

# 9. 正确 token 删除 → 200
DEL_OK=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/cards/$CARD_ID?token=$TOKEN")
[ "$DEL_OK" = "200" ] && pass "DELETE with correct token → 200" || fail "DELETE with correct token → $DEL_OK (expected 200)"

# 10. 删除后详情 → 404
DEL_AFTER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cards/$CARD_ID")
[ "$DEL_AFTER" = "404" ] && pass "GET deleted card → 404" || fail "GET deleted card → $DEL_AFTER (expected 404)"

# 11. 校验：缺失 fullState → 400
BAD_BODY="{\"author\":\"X\",\"card\":{\"thumbnail\":\"$THUMB\"}}"
BAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$BAD_BODY" "$BASE/api/cards")
[ "$BAD_STATUS" = "400" ] && pass "POST missing fullState → 400" || fail "POST missing fullState → $BAD_STATUS (expected 400)"

# 12. 校验：无效 thumbnail → 400
BAD_THUMB="{\"author\":\"X\",\"card\":{\"thumbnail\":\"not-a-data-url\",\"fullState\":{}}}"
BAD_THUMB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$BAD_THUMB" "$BASE/api/cards")
[ "$BAD_THUMB_STATUS" = "400" ] && pass "POST invalid thumbnail → 400" || fail "POST invalid thumbnail → $BAD_THUMB_STATUS (expected 400)"

# 13. 静态资源
INDEX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
[ "$INDEX_STATUS" = "200" ] && pass "GET / (index.html) → 200" || fail "GET / → $INDEX_STATUS (expected 200)"

JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/app.js")
[ "$JS_STATUS" = "200" ] && pass "GET /app.js → 200" || fail "GET /app.js → $JS_STATUS (expected 200)"

CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/styles.css")
[ "$CSS_STATUS" = "200" ] && pass "GET /styles.css → 200" || fail "GET /styles.css → $CSS_STATUS (expected 200)"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

---

## 8. 实现步骤清单（Codex 执行顺序）

Codex 应按以下顺序执行，每步完成后运行对应验证：

| 步骤 | 操作 | 验证 | 对应章节 |
|------|------|------|---------|
| **Step 1** | 创建 `server/shared-server.mjs` | `node --check server/shared-server.mjs` | §1 |
| **Step 2** | 修改 `package.json`（scripts.start / scripts.check） | `cat package.json \| grep start` | §5 |
| **Step 3** | 启动服务器并运行 API 冒烟测试 | `npm start & sleep 2 && bash scripts/verify-shared.sh` | §7 |
| **Step 4** | 修改 `app.js` 暴露三个接口 | `node --check app.js` | §6 |
| **Step 5** | 创建 `shared-library.js` | `node --check shared-library.js` | §2 |
| **Step 6** | 修改 `index.html`（Tab + 面板 + 弹层） | 浏览器打开页面无报错 | §3 |
| **Step 7** | 修改 `styles.css`（追加样式） | 页面样式正确 | §4 |
| **Step 8** | 全流程验证 | 运行 `npm run check` + 浏览器端到端测试 | §7 + AC 全表 |

---

## 9. 验收标准映射（AC ↔ 实现）

| AC | 验收项 | 对应实现 | 自动化验证 |
|----|--------|---------|-----------|
| AC-1 | `npm install && npm start` 后页面正常 | §1 + §5 | `verify-shared.sh` #13 |
| AC-2 | 抽屉双 Tab | §3.2 HTML + §4 CSS + §2.10 JS | 手动 |
| AC-3 | 发布后 API 列表新增 | §1.6.4 + §2.6 | `verify-shared.sh` #3 #4 |
| AC-4 | 共享网格含作者与缩略图 | §2.8 + §4 CSS | 手动 |
| AC-5 | 检视弹层正反面切换 | §2.9 + §3.4 + §4 CSS | 手动 |
| AC-6 | 加载到编辑器 + 下载 JSON | §2.9 + §6.1 | 手动 |
| AC-7 | DELETE 鉴权 | §1.6.7 | `verify-shared.sh` #7 #8 #9 |
| AC-8 | 非法 payload → 400 | §1.6.4 校验 | `verify-shared.sh` #11 #12 |
| AC-9 | 局域网可访问 | §1.8 监听 0.0.0.0 | 手动 |
| AC-10 | 本地库不受影响 | §0.2 硬性约束 + §6.2 检查清单 | 手动 |

---

## 10. 边界情况与注意事项

### 10.1 竞态与并发

- 文件存储无锁机制，极端并发下可能丢失写入。本期可接受（本地 / 小团队场景）。
- 列表接口每次全量读 `readdir` + 逐文件 `readFile`，卡牌数 < 500 时性能可接受。若需优化可引入内存缓存 + 文件监听。

### 10.2 数据迁移

- 备份：直接复制 `server/data/cards/` 目录
- 恢复：将 JSON 文件放回目录，重启服务器即可
- 迁移到数据库：替换 `handleListCards` / `handlePublishCard` 等函数的存储层即可，API 接口不变

### 10.3 安全

- **路径穿越**：所有文件操作通过 `safePath()` 校验
- **XSS**：`author` / `name` / `team` 存储前经过 `escapeHtml()`；前端使用 `textContent` 或模板字符串时注意用户输入
- **Token 安全**：服务端只存 SHA-256 hash，原始 token 仅发布时返回一次
- **请求体大小**：`readBody()` 限制 4 MB，超出直接断开连接

### 10.4 thumbnail 正则说明

`THUMBNAIL_REGEX` 要求 thumbnail 为标准的 data URL 格式。实际生产中 base64 可能包含换行符，但 `canvas.toDataURL()` 生成的不会。如果遇到问题，可放宽正则：

```javascript
// 宽松版本（允许换行和空格）
const THUMBNAIL_REGEX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/;
```

### 10.5 `shared-library.js` 的加载时机

- 必须在 `app.js` 之后加载（依赖 `window.CardBuilder`）
- 使用 `DOMContentLoaded` 确保 DOM 就绪
- 如果 `app.js` 是异步初始化的，可能需要轮询 `window.CardBuilder` 是否已就绪：

```javascript
function waitForCardBuilder(cb, maxWait = 5000) {
  const start = Date.now();
  const check = () => {
    if (window.CardBuilder?.getFullState) { cb(); return; }
    if (Date.now() - start > maxWait) { console.warn('CardBuilder not ready'); return; }
    setTimeout(check, 100);
  };
  check();
}
```

### 10.6 slabType 筛选值映射

前端 `<option value="THICK_ACRYLIC">` 使用下划线，但编辑器中 `slabType` 可能存储为 `"thick_acrylic"` / `"thickAcrylic"` / `"thick acrylic"` 等形式。Codex 需检查 `app.js` 中 `slabType` 的实际值格式，并在筛选比较时统一处理：

```javascript
function normalizeSlabType(val) {
  return (val || '').toUpperCase().replace(/[\s-]+/g, '_');
}
```

---

## 11. 文件完整性校验表

实现完成后，确认以下文件存在且语法正确：

```bash
# 必须全部通过
node --check app.js
node --check shared-library.js
node --check server/shared-server.mjs
node --check three-preview.js

# 目录结构
ls -la server/shared-server.mjs   # 存在
ls -la shared-library.js          # 存在
ls -la server/data/               # 存在（启动后自动创建 cards/ 子目录）

# index.html 包含关键元素
grep -c 'shared-library-panel' index.html    # ≥ 1
grep -c 'shared-detail-modal' index.html     # ≥ 1
grep -c 'library-tab' index.html             # ≥ 2
grep -c 'shared-library.js' index.html       # ≥ 1

# styles.css 包含关键样式
grep -c 'shared-grid' styles.css             # ≥ 1
grep -c 'shared-detail-modal' styles.css     # ≥ 1
```

---

## 附录 A：API 请求 / 响应完整示例

### A.1 POST /api/cards — 发布

**Request:**
```
POST /api/cards HTTP/1.1
Content-Type: application/json
Content-Length: 12345

{
  "author": "小杰",
  "card": {
    "id": "cb_lz4k8x2",
    "name": "LEBRON JAMES",
    "team": "LAL",
    "style": "prism",
    "effect": "lightning",
    "rarity": "gold",
    "slabType": "acrylic",
    "badges": ["allstar", "mvp"],
    "thumbnail": "data:image/jpeg;base64,/9j/4AAQSkZJR...(truncated)",
    "fullState": {
      "playerImage": "data:image/png;base64,...",
      "teamLogo": "data:image/png;base64,...",
      "signatureImage": null,
      "shimmerMask": null,
      "playerStats": {
        "ppg": 25.7,
        "rpg": 7.3,
        "apg": 8.3,
        "fgPct": 50.4,
        "threePct": 41.0,
        "gp": 55,
        "height": "6'9\"",
        "weight": "250 lbs"
      },
      "backThumbnail": "data:image/jpeg;base64,...",
      "...其他设计字段": "..."
    },
    "createdAt": 1780000000000
  }
}
```

**Response (201):**
```json
{
  "id": "sc_lz4k8x2_a1b2c3d4",
  "token": "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
  "card": {
    "id": "cb_lz4k8x2",
    "sharedId": "sc_lz4k8x2_a1b2c3d4",
    "name": "LEBRON JAMES",
    "team": "LAL",
    "style": "prism",
    "effect": "lightning",
    "rarity": "gold",
    "slabType": "acrylic",
    "badges": ["allstar", "mvp"],
    "thumbnail": "data:image/jpeg;base64,...",
    "fullState": { "..." : "..." },
    "createdAt": 1780000000000
  }
}
```

### A.2 GET /api/cards — 列表

**Response (200):**
```json
{
  "cards": [
    {
      "id": "sc_lz4k8x2_a1b2c3d4",
      "author": "小杰",
      "createdAt": 1780000000000,
      "card": {
        "id": "cb_lz4k8x2",
        "name": "LEBRON JAMES",
        "team": "LAL",
        "style": "prism",
        "effect": "lightning",
        "rarity": "gold",
        "slabType": "acrylic",
        "badges": ["allstar", "mvp"],
        "thumbnailUrl": "/api/cards/sc_lz4k8x2_a1b2c3d4/thumbnail"
      }
    }
  ]
}
```

> **注意 `thumbnailUrl` 替代了 `thumbnail` 的 base64 原文。** 前端网格用 `<img src="${thumbnailUrl}">` 加载。

### A.3 GET /api/cards/:id — 详情

**Response (200):**
```json
{
  "id": "sc_lz4k8x2_a1b2c3d4",
  "author": "小杰",
  "createdAt": 1780000000000,
  "card": {
    "id": "cb_lz4k8x2",
    "sharedId": "sc_lz4k8x2_a1b2c3d4",
    "name": "LEBRON JAMES",
    "team": "LAL",
    "style": "prism",
    "effect": "lightning",
    "rarity": "gold",
    "slabType": "acrylic",
    "badges": ["allstar", "mvp"],
    "thumbnail": "data:image/jpeg;base64,...(完整 base64)",
    "fullState": { "...完整项目快照..." },
    "createdAt": 1780000000000
  }
}
```

### A.4 DELETE /api/cards/:id — 删除

**Request:**
```
DELETE /api/cards/sc_lz4k8x2_a1b2c3d4?token=e5f6a7b8... HTTP/1.1
```

**Response (200):** `{ "deleted": true }`
**Response (403):** `{ "error": "Token mismatch" }` 或 `{ "error": "Token required" }`
**Response (404):** `{ "error": "Card not found" }`

### A.5 错误响应汇总

| HTTP | 场景 | 响应体 |
|------|------|--------|
| 400 | 请求体非法 JSON | `{ "error": "Invalid JSON" }` |
| 400 | 缺少 card | `{ "error": "Missing card data" }` |
| 400 | 缺少 thumbnail | `{ "error": "Missing thumbnail" }` |
| 400 | thumbnail 格式不合法 | `{ "error": "Invalid thumbnail format" }` |
| 400 | thumbnail 过大 | `{ "error": "Thumbnail too large" }` |
| 400 | 缺少 fullState | `{ "error": "Missing fullState" }` |
| 400 | fullState 过大 | `{ "error": "fullState too large" }` |
| 400 | author 过长 | `{ "error": "Author name too long" }` |
| 403 | 缺少 token | `{ "error": "Token required" }` |
| 403 | token 不匹配 | `{ "error": "Token mismatch" }` |
| 404 | 卡牌不存在 | `{ "error": "Card not found" }` |
| 413 | 请求体超 4 MB | 连接断开 |

---

## 附录 B：Codex 常见陷阱提醒

1. **不要安装任何 npm 包。** 服务器必须零依赖运行。
2. **不要把 `shared-library.js` 写成 ESM 模块。** 它是浏览器端脚本，通过 `<script>` 标签加载，不能使用 `import/export`。使用 IIFE 或直接挂载到 `window`。
3. **`server/shared-server.mjs` 必须是 ESM**（`.mjs` 扩展名），使用 `import` 而非 `require`。
4. **不要修改现有的本地卡牌库逻辑。** 共享库与本地库是独立系统，通过 Tab 切换 UI 分离。
5. **缩略图 API 返回的是二进制图片，不是 JSON。** `Content-Type` 是 `image/jpeg` 等。
6. **列表 API 不返回 thumbnail 和 fullState 原文。** 只返回 `thumbnailUrl` 路径。这是性能优化的关键。
7. **`id` 格式中的随机部分用 `crypto.randomBytes(4).toString('hex')`**，不要用 `Math.random()`。
8. **监听 `0.0.0.0`** 而非 `127.0.0.1`，否则局域网设备无法访问（AC-9）。
9. **`DELETE` 路由的 `token` 从 URL query string 读取**（`url.searchParams.get('token')`），不是从请求体。
10. **路由匹配注意 `/api/cards/:id/thumbnail` 要在 `/api/cards/:id` 之前检查**，否则 `thumbnail` 会被当作 id 的一部分。

---

*文档结束。Codex 按 §0 → §1 → §2 → §3 → §4 → §5 → §6 → §7 → §8 的顺序执行，每步完成后运行对应验证。*
