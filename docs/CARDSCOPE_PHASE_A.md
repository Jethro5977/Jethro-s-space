# CardScope Phase A — 实施与验收

日期：2026-09-19

## 开发位置

- Worktree：`/Users/jethro/Documents/GAMES/card-builder-cardscope`
- 分支：`codex/cardscope-phase-a`，基于原仓库提交 `74bf6b0`。
- 原工作区缺失 src、renderer 源码与测试文件，并存在未提交修改。此次实施在独立 worktree 内完成，原工作区状态保留。
- 本次完成本地实现和验收；尚未提交、推送或部署生产。

## 使用

在此 worktree 运行 `npm ci`、`npm start`，访问 `http://127.0.0.1:4174/scan/`，或从主页设计工具区点击“扫描识别 / CARD SCAN”。

四步流程：正面必填，背面和标签选填 → 基础质量提示 → 球员补全/手动资料 → 原图取景参考、2D 卡面、可旋转 MAGNETIC 3D 卡壳。支持返回修改、直接保存到个人库、携带照片导入主页编辑器。

照片在浏览器内解码，保留最长边不超过 1400px 的 JPEG 副本。上传区显示原始尺寸与大小；质量提示基于原文件。不会发送图片或调用 AI/OCR。静态页面、Three.js 和球员 registry 仍需加载；全局样式沿用项目已有 Google Fonts 引用。

个人库沿用现有 localStorage 元数据 + IndexedDB 图片存储、库加载与 toast。扫描图片及标签副本会进入同一个 IndexedDB 图片库，刷新后可恢复；库内有相机标记。所有结果保持 `needs-review`，`candidateMatches` 为空，不生成 `conditionEstimate`。

## 对执行指令的代码适配

- 现有应用实际入口为 `src/main.js`，不是保留的旧版 `app.js`；导入扩展加在真实入口中，复用 `CardBuilder.loadFullState → setState/normalizeState → hydrateInputs/render`。
- 原生 schema 为 `style`、小写 `rarity`、`playerImg`、`imageMode: fullart`、`slabType`。adapter 生成可直接使用的原生字段。
- `playerNumber` 为球衣号码，`cardId` 为卡号，`cardNum` 为序列号；避免指令示例把卡号误映射为球衣号码。
- 现有 renderer 没有 GRADED 卡壳类型。Phase A 使用 MAGNETIC，保留 `reportedGrade` 手动转录资料；没有上传标签时不生成该对象，也不继承默认展示卡的分数或签名。
- 现有 toast 签名为 `showToast(message, type)`，所有新增调用按真实顺序传参。
- 新页直接复用现有 Canvas 卡面绘制器与 renderer 公共 API；renderer 包源码没有修改。
- Three.js 0.185.1 的必要运行时文件本地托管，保留 MIT LICENSE。生命周期与响应式处理参考 threejs-fundamentals 技能，返回修改/离开页面时销毁 renderer，页面恢复时重新创建。
- 3D 预览默认不自动旋转，reduced-motion 下禁用步骤动画；用户仍可主动拖动、缩放、翻面与重置。
- 原图裁剪框为中央取景参考框；Phase A 没有手动拖动裁剪或透视纠正。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| renderer build + unit tests | 46/46，通过 |
| 既有编辑器 E2E | 8/8，通过 |
| 既有视觉导出像素基线 | 8/8，通过，无基线修改 |
| renderer 浏览器消费者 | 10/10，通过，源码 / npm ESM dist / UMD |
| CardScope 专项 E2E | 4/4，通过 |
| npm run check + scan JS syntax + git diff --check | 通过 |
| renderer 源码 diff | 无变更 |
| 桌面/390px 手机截图 | 已视觉检查，无横向溢出 |

CardScope 测试覆盖：主页入口；无效图片恢复；正/背/标签照片上传；低分辨率与比例提示、大文件阈值；球员自动补全；所有支持的系列与稀有度映射；未知球员手填；2D/3D 生成；翻面/重置；编辑器导入；个人库保存、刷新并回读图片；optional 标签；移除照片；reduced-motion；console error/warning；上传到保存阶段无非 GET 请求。

测试命令：

```sh
npm run test:renderer
npm run check
npm run test:scan
npx playwright test tests/e2e/renderer-package.spec.mjs tests/e2e/card-builder.spec.mjs tests/e2e/export-effects.spec.mjs --workers=1
```

验收截图：`test-results/cardscope-desktop.png`、`cardscope-mobile.png`、`cardscope-upload.png`（测试产物，未提交）。

## 后续边界

本次没有接入 Sports Card Scope AI、OCR、检索、条件评估或价格服务，也没有生产部署。源图片在当前浏览器中保存；切换浏览器/设备不会自动同步。Phase B 可替换 MockScanService，但应继续保留人工核对、adapter 与现有编辑器/个人库接口。
