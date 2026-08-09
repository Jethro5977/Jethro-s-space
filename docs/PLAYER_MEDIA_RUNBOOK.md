# NBA Player Media Library — 运行手册

该模块落实 `PRD_NBA球员影像资产库.md` 的 Phase 0 / Phase 1 工程基础。仓库不包含从 NBA.com、ESPN、社交媒体或搜索引擎批量抓取的未授权照片。

## 已实现

- 25 名种子球员统一注册表及稳定 `playerId`；
- 球员与媒体元数据审计；
- 卡牌编辑器“从影像库选择”弹层及分类筛选；
- 卡牌状态保存 `playerMediaId`、分类、球队快照、署名和授权状态；
- 普通 API 只返回 `status=published`、`licenseStatus=valid`、包含 `web_display` 且未过期的照片；
- 管理员授权上传：文件魔数、尺寸、哈希和 provider asset ID 去重；
- 使用 Sharp 生成 `900×1260 WebP` 卡牌图和 `360×504 WebP` 缩略图，公开衍生图不保留 EXIF；
- 私有 Vercel Blob 存储、Function 代理读取、上传/撤回审计日志；
- 缺图时明确标记 NBA CDN 头像为临时兼容回退；
- 旧项目和手动上传照片继续使用 `playerImg`，不要求迁移。

## Vercel 设置

1. 保持现有 Blob Store 与项目连接；
2. 在 **Settings → Environment Variables** 新增 `PLAYER_MEDIA_ADMIN_TOKEN`；
3. 令牌使用至少 32 字节随机值，应用于 Production、Preview；
4. Redeploy 后先检查 `GET /api/players?active=true` 和 `GET /api/players/nba_1642843/media`。

生成管理员令牌：

```bash
openssl rand -hex 32
```

令牌只能放在受控的管理员工具或本地环境中，不能写进前端、Git 仓库、截图或 URL。

## 上传已授权照片

`POST /api/admin/player-media/upload`，请求头：

```text
Content-Type: application/json
X-Admin-Token: <PLAYER_MEDIA_ADMIN_TOKEN>
```

最小请求体：

```json
{
  "playerId": "nba_1642843",
  "category": "game_action",
  "title": "Cooper Flagg game action",
  "capturedAt": "2026-01-15T02:30:00.000Z",
  "season": "2025-26",
  "teamAtCapture": "DAL",
  "provider": "licensed_provider",
  "providerAssetId": "provider-asset-123",
  "sourceUrl": "https://provider.example/assets/123",
  "photographer": "Photographer or agency",
  "creditLine": "Required public credit line",
  "licenseType": "rights_managed",
  "licenseReference": "contract-or-license-record-123",
  "licenseExpiresAt": null,
  "usageScope": ["web_display", "card_derivative"],
  "rightsConfirmed": true,
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

上传图只接受 PNG/JPEG/WebP，最大 3 MB，长边至少 1200px。接口不会抓取 `sourceUrl`，因此不存在任意 URL 服务端下载；供应商批量 manifest 接入应在获得正式授权凭证后单独实现白名单连接器。

## 撤回照片

`POST /api/admin/player-media/:mediaId/revoke`，使用相同管理员请求头：

```json
{ "reason": "License expired or rights holder request" }
```

撤回后照片立即不再出现在普通列表和文件接口中，操作会追加写入 `player-media/audit/`。

## 审计命令

```bash
npm run sync:players
npm run audit:media
npm run check
```

`sync:players` 从 `app.js` 的种子球员数据机械生成完整注册表；`audit:media` 检查主键、外部 ID、媒体关联、分类和授权闸门。当前所有球员身份仍标记为 `needs_review`，必须在获得当前官方 roster 核验结果后逐项改为 `verified`。

## 尚需外部条件

- Sportradar/Getty 或其他图片供应商的正式许可证和 API 凭证；
- 25 名球员身份、球队、号码和外部 ID 的人工复核签字；
- 供应商 manifest 字段映射；
- 高清导出是否包含授权图片的产品/法律决定；
- 全量现役名单阶段使用 PostgreSQL 的关系数据模型。
