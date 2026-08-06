# PRD — Card Builder 共享卡牌库（Shared Card Library）

| 项目 | 内容 |
| --- | --- |
| 产品 | Card Builder（DIY 3D 球星卡制作器，纯 Web / Three.js） |
| 文档版本 | v1.0 |
| 日期 | 2026-08-05 |
| 状态 | 已实现并完成本地验证 |
| 关键决策 | 无用户系统；所有人可见、可检视所有人的卡牌 |

---

## 1. 背景与目标

Card Builder 已具备完整的本地 DIY 流程：制作卡面 → 保存到本地卡牌库（`localStorage` + `IndexedDB`）→ 浏览、筛选、加载、对比。但本地卡牌库只存在当前浏览器，无法让其他人看到自己做的卡。

本 PRD 的目标是新增「共享卡牌库」：

1. 使用者可以把自己 DIY 的卡牌一键发布到共享卡牌库；
2. 所有使用者都可以看到所有人发布的卡牌；
3. 所有使用者都可以检视任意共享卡牌（正反面预览、完整资料、球员数据），并可将其加载回编辑器继续编辑或下载项目 JSON；
4. 现阶段不引入用户系统，不需要注册 / 登录 / 权限体系。

## 2. 用户场景

**场景 A：发布自己的作品**

小杰做好一张 LeBron 亚克力卡，点击「发布当前卡牌」，填写昵称（可选，默认匿名）后发布。发布成功后卡牌出现在共享卡牌库顶部，其他使用者立即能看到。

**场景 B：浏览与筛选别人的作品**

小美打开共享卡牌库，看到所有人发布的卡牌网格，按稀有度（GOLD / BLACK / NEON 等）、系列（Prism / Tactical / ...）、卡壳（Acrylic / Gallery / ...）筛选，快速找到感兴趣的作品。

**场景 C：检视与复用**

小美点击一张共享卡牌，弹层中展示正反面大图、作者、发布时间、稀有度 / 系列 / 特效 / 卡壳 / 徽章、球员数据（PPG / RPG / APG / FG% / 3P% / GP / 身高 / 体重）。她可以把它「加载到编辑器」继续改造，或下载项目 JSON 存档。

## 3. 范围

### 3.1 本期范围（In Scope）

- 共享卡牌发布（Publish）
- 共享卡牌库浏览 + 筛选（Browse / Filter）
- 共享卡牌检视详情（Detail / Inspect）
- 加载共享卡牌到编辑器、下载项目 JSON
- 发布者删除自己的卡牌（基于发布时返回的私有 token，不引入用户系统）
- 本地共享服务器（静态资源 + API 单端口），局域网内其他设备可访问

### 3.2 非目标（Out of Scope）

- 用户系统、注册、登录、角色权限
- 点赞 / 评论 / 关注 / 私信等社交功能
- 内容审核 / 举报 / 黑名单
- 云端公网部署与账号体系
- 实时推送（共享库通过手动刷新 / 打开时拉取）

## 4. 功能需求（Functional Requirements）

### FR-1 发布当前卡牌（Publish）

- FR-1.1 在共享卡牌库面板提供「发布当前卡牌」按钮，一键发布编辑器中的当前项目。
- FR-1.2 发布前可填写昵称（≤ 24 字符，去首尾空白，默认「匿名」），昵称保存在 `localStorage`，下次发布自动带出。
- FR-1.3 发布内容包含：卡面缩略图（360×504 JPEG data URL）+ 完整项目快照（`fullState`，含球员图 / 球队 Logo 内联 data URL、签名、闪光蒙版、所有设计字段）。
- FR-1.4 发布成功后共享列表立即刷新，新卡置顶；发布者本地保存该卡片的删除 token。
- FR-1.5 服务端校验：author ≤ 24 字符；thumbnail 必须是合法 `data:image/(png|jpeg|webp);base64` 且 ≤ 600,000 字符；`fullState` 序列化后 ≤ 2,000,000 字符；请求体 ≤ 4 MB。
- FR-1.6 图片内联：若球员图 / Logo 是相对路径（如默认 showcase 素材），发布时先抓取并转为压缩 data URL，确保其他设备也能完整渲染。

### FR-2 浏览共享卡牌库（Browse）

- FR-2.1 卡牌库抽屉增加两个 Tab：`MY COLLECTION`（本地库，保留全部现有功能）与 `SHARED LIBRARY`（共享库）。
- FR-2.2 共享库以网格展示所有卡牌：缩略图、卡名、球队 / 稀有度、作者（by XXX）。
- FR-2.3 提供筛选：稀有度（ALL / BASE / SILVER / GOLD / NEON / RWB / BLACK）、系列（ALL / PRISM / TACTICAL / HERITAGE / MOSAIC / SELECT / OPTIC）、卡壳（ALL / RAW / MAGNETIC / GRADED / MUSEUM / THICK ACRYLIC / CRYSTAL / GALLERY）。
- FR-2.4 显示共享库总数（N CARDS），提供手动刷新按钮；打开共享 Tab 时自动拉取最新列表。
- FR-2.5 空状态：无卡时提示「先做一张卡发布吧」；有卡但筛选无结果时提示「没有符合筛选条件的卡片」。

### FR-3 检视共享卡牌（Detail / Inspect）

- FR-3.1 点击任意共享卡牌打开检视弹层。
- FR-3.2 弹层展示：正反面大图（可切换）、卡名、作者、发布时间、系列 / 稀有度 / 特效 / 卡壳 / 徽章、球员数据（PPG / RPG / APG / FG% / 3P% / GP / 身高 / 体重，空值不显示）。
- FR-3.3 操作按钮：
  - 「加载到编辑器」：把该卡完整状态载入编辑器，可继续修改并重新保存 / 发布；
  - 「下载项目 JSON」：下载完整项目文件，与现有项目导入格式兼容；
  - 「删除（仅发布者）」：仅当本地持有该卡发布 token 时显示。
- FR-3.4 支持 `Esc` / 点击遮罩 / 关闭按钮退出检视。

### FR-4 删除（Delete）

- FR-4.1 发布时服务端生成私有 token，仅返回给发布者浏览器（存 `localStorage`），不落盘明文。
- FR-4.2 删除请求必须携带匹配 token；token 不匹配或缺失时返回 403。
- FR-4.3 删除前需二次确认；成功后共享列表刷新。

### FR-5 数据完整性（Data Integrity）

- FR-5.1 共享卡记录包含完整 `fullState`，加载到编辑器后应还原全部设计字段（系列、特效、稀有度、卡壳、徽章、球员资料、签名、闪光蒙版、图片）。
- FR-5.2 服务端只存 JSON 文件，不解析 / 执行任何前端代码；返回内容由前端 `escapeHtml` 转义，避免 XSS。

## 5. 非功能需求（Non-Functional Requirements）

| 编号 | 需求 |
| --- | --- |
| NFR-1 | 运行环境：Node.js ≥ 18（本地验证使用 v22.23.2），零第三方依赖 |
| NFR-2 | 单端口：`npm start` 同时提供前端静态资源与 `/api`，端口默认 4174，可用 `PORT` 环境变量覆盖 |
| NFR-3 | 数据可迁移：卡牌以独立 JSON 文件存于 `server/data/cards/`，备份 / 迁移即复制该目录 |
| NFR-4 | 大小与安全限制：请求体 ≤ 4 MB；缩略图 / fullState 上限见 FR-1.5；路径穿越防护；昵称与文本字段长度限制 |
| NFR-5 | 性能：列表接口只返回元数据（不含缩略图 / fullState），缩略图走独立图片接口并缓存，保证网格加载流畅 |
| NFR-6 | 兼容性：共享库与现有本地库（localStorage + IndexedDB）并存互不影响；不使用 file:// 直开（须经 `npm start`） |
| NFR-7 | 可访问性：Tab、按钮、弹层带 `aria` 属性与键盘操作（Esc 关闭） |

## 6. 数据设计

### 6.1 服务端记录（`server/data/cards/<id>.json`）

```json
{
  "schemaVersion": 1,
  "id": "sc_<时间戳36进制>_<随机hex>",
  "author": "匿名",
  "createdAt": 1780000000000,
  "tokenHash": "<sha256 哈希，用于删除鉴权>",
  "card": {
    "id": "cb_...",
    "sharedId": "sc_...",
    "name": "COOPER FLAGG",
    "team": "DAL",
    "style": "prism",
    "effect": "lightning",
    "rarity": "silver",
    "slabType": "acrylic",
    "badges": ["rc", "allstar"],
    "thumbnail": "data:image/jpeg;base64,...",
    "fullState": { "...": "完整项目快照（图片已内联）" },
    "createdAt": 1780000000000
  }
}
```

### 6.2 API 规范

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，返回共享卡数量 |
| GET | `/api/cards` | 元数据列表（不含缩略图与 fullState），按发布时间倒序 |
| POST | `/api/cards` | 发布卡牌，body `{ author, card }`，返回 `{ id, token, card }` |
| GET | `/api/cards/:id` | 完整卡牌（含 thumbnail、fullState、`own` 标记） |
| GET | `/api/cards/:id/thumbnail` | 缩略图图片（HTTP 缓存 1 天） |
| DELETE | `/api/cards/:id?token=...` | 删除卡牌（仅 token 匹配） |

## 7. 架构

```text
Browser (index.html + app.js + shared-library.js + three-preview.js)
        │  HTTP (同源)
        ▼
Node server (server/shared-server.mjs, 端口 4174)
        ├── 静态资源：/ , /app.js , /styles.css , /assets/...
        └── /api/*：共享卡牌库读写（JSON 文件存储）
```

设计要点：

- **无用户系统**：身份只依赖「发布时返回的私有 token」，token 仅用于删除自己的卡；浏览与检视完全公开。
- **本地优先**：数据落在 `server/data/cards/`，方便备份、迁移、接入真实后端时替换 API 实现。
- **与本地库解耦**：本地库是个人草稿/收藏，共享库是公开作品，两者 UI 并存、逻辑独立。

## 8. 验收标准（Acceptance Criteria）

| 编号 | 验收项 | 验收方式 |
| --- | --- | --- |
| AC-1 | `npm install && npm start` 后打开 `http://127.0.0.1:4174/` 页面正常 | 手动 / curl |
| AC-2 | 卡牌库抽屉出现 `MY COLLECTION` / `SHARED LIBRARY` 两个 Tab | 手动 |
| AC-3 | 填写昵称并点击「发布当前卡牌」后，`GET /api/cards` 列表新增该卡且置顶 | curl / 手动 |
| AC-4 | 发布后共享网格出现该卡，含作者名与缩略图 | 手动 |
| AC-5 | 点击共享卡打开检视弹层，可切换正反面，元数据与球员数据正确 | 手动 |
| AC-6 | 「加载到编辑器」后设计字段完整还原；「下载项目 JSON」文件可被项目导入 | 手动 |
| AC-7 | 无 token 的 DELETE 返回 403；带 token 的 DELETE 成功删除 | curl |
| AC-8 | 非法 payload（超大缩略图 / 缺失 fullState）返回 400 | curl |
| AC-9 | 局域网内另一设备访问 `http://<本机IP>:4174/` 可浏览共享库 | 手动 |
| AC-10 | 原有本地库功能（保存、筛选、收藏、对比、导出导入）不受影响 | 手动 |

## 9. 落地状态

### 已实现

- `server/shared-server.mjs`：静态 + API 单端口服务器，零依赖，文件存储，输入校验，token 删除鉴权，路径穿越防护。
- `shared-library.js`：发布、浏览、筛选、检视弹层、加载到编辑器、下载项目 JSON、发布者删除。
- `index.html`：抽屉双 Tab、共享面板（昵称 / 发布按钮 / 筛选 / 网格）、检视弹层。
- `styles.css`：共享库 Tab、发布按钮、卡片作者、检视弹层样式（含移动端适配）。
- `package.json`：`npm start` 改为 Node 共享服务器；`npm run check` 覆盖新文件。

### 验证记录（2026-08-05）

- `node --check` 全部通过（app.js / shared-library.js / shared-server.mjs / three-preview.js / audit-player-data.mjs）。
- API 冒烟：POST 发布 → GET 列表 → GET 详情 → GET 缩略图 → DELETE（403 / 200）→ 健康检查，全部符合预期。
- 浏览器验证：页面正常加载，抽屉双 Tab 可切换，发布 / 检视 / 加载链路可用。

## 10. 未来扩展（Backlog）

- 用户系统（注册 / 登录 / 个人主页）与「我的发布」管理页
- 点赞、收藏他人作品、评论
- 排序（最新 / 最热）、关键词搜索、按作者筛选
- 内容审核与举报流程
- 接真实后端（SQLite / PostgreSQL / 对象存储），前端 API 层无需大改
- 在线编辑他人作品的只读副本（fork）
