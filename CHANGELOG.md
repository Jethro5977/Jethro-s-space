# Changelog / 更新日志

> 维护说明 / Maintenance note:
> 自 2026-08-09 起，所有新增与修改条目均使用中英双语撰写；历史条目保持原语言不变。
> From 2026-08-09 onward, all new and updated entries are written in both Chinese and English; older entries keep their original language.

## [Unreleased]

### 新增 / Added

- 新增 4 张用户确认的精选卡：Devin Booker（比赛瞬间 / NBA 2K23 封面 / 太阳队西装照）与 P.J. Washington（#25 比赛瞬间），沿用 2025-26 卡背数据与对应球队 logo，保持球员-数据-logo 一一对应
- EN: Added 4 user-confirmed curated cards: Devin Booker (game action / NBA 2K23 cover / Suns suit portrait) and P.J. Washington (#25 game action), each with 2025-26 back-side stats and a matching team logo to keep player-data-logo one-to-one
- 新增 8 张由用户提供卡面素材制作的精选卡：Cooper Flagg（2025 选秀纪念 / 比赛瞬间 / #32 城市插画 / NBA 最佳新秀）、Kyrie Irving（比赛瞬间）、Klay Thompson（2 张比赛瞬间）、James Harden（连续季后赛里程碑）；同时补齐 27 支球队的可跟踪 logo 资产（`assets/team-logos/*.webp`），每张卡自动嵌入对应球队 logo，确保球员-数据-logo 一一对应
- EN: Added 8 curated cards from user-supplied cover art: Cooper Flagg (2025 draft commemorative / game action / #32 city illustration / NBA Rookie of the Year), Kyrie Irving (game action), Klay Thompson (two game-action moments), and James Harden (straight playoff appearances milestone); also added tracked logo assets for 27 teams under `assets/team-logos/*.webp`, with each card embedding its matching team logo so player-data-logo stay one-to-one
- 新增 Kyrie Irving 与 Klay Thompson 的 2025-26 已核验赛季数据档案（写入卡背），并将 James Harden 的 2025-26 数据接入建卡管道
- EN: Added verified 2025-26 season stat profiles for Kyrie Irving and Klay Thompson (written to the card back) and wired James Harden's 2025-26 stats into the card-ingestion pipeline
- 为用户指定的 Shai Gilgeous-Alexander `PM-041`、Stephen Curry `PM-005` 与 LeBron James 43,000 分纪念 `PM-032` 添加对应原始签名；蓝墨签保留原始蓝色并增加清晰描边，LeBron 黑色原签采用金色箔签呈现以适配黑色 1/1 卡面
- EN: Added the supplied original signatures to Shai Gilgeous-Alexander `PM-041`, Stephen Curry `PM-005`, and the LeBron James 43,000-point commemorative `PM-032`; blue-ink signatures retain their original blue with a clarity outline, while LeBron's black signature is rendered as gold foil for the black 1/1 card
- 新增可复现签名预处理脚本与受限签名资产路径，透明签名在浏览器预览、Canvas 导出及精选卡库重新导入时保持一致
- EN: Added a reproducible signature-preparation script and restricted signature-asset paths so transparent signatures remain consistent in browser preview, Canvas export, and curated-library reimport
- README 顶部新增两张 Shai Gilgeous-Alexander 亚克力封装卡面，采用并排响应式展示并压缩为 WebP，补充真实卡牌设计预览且控制仓库图片体积
- EN: Added two Shai Gilgeous-Alexander acrylic card covers to the top of the README in a responsive side-by-side WebP layout, expanding the real card-design preview while keeping repository image weight low
- 首页 3D 预览区新增上一张 / 下一张切换按钮与卡库位置指示；桌面端可点击循环检视，手机端同时支持按钮与在卡牌上左右滑动切换
- EN: Added previous/next controls and a library position indicator to the homepage 3D preview; desktop users can click to cycle, while mobile users can also swipe horizontally on the card
- 人工影像批次由 18 张扩展至 46 张唯一素材：新增 Giannis Antetokounmpo、Bam Adebayo、Cade Cunningham、Luka Dončić、Jalen Brunson、LeBron James、Kevin Durant、Tyrese Maxey 与 Shai Gilgeous-Alexander 卡片；重复图片按哈希去重，文件简称通过画面与球衣信息人工确认
- EN: Expanded the manually reviewed media batch from 18 to 46 unique assets, adding cards for Giannis Antetokounmpo, Bam Adebayo, Cade Cunningham, Luka Dončić, Jalen Brunson, LeBron James, Kevin Durant, Tyrese Maxey, and Shai Gilgeous-Alexander; duplicate images were hash-deduplicated and abbreviated filenames were visually verified against uniforms and visible identifiers
- 新增人工上传球员影像的审核与制卡流程：首批 18 张素材完成球员身份、球队、画面类型与历史节点核验，生成 900×1260 卡面、360×504 缩略图及可导入个人卡库的 18 张卡牌；原始上传文件继续保留在本地，部署包仅包含经用户确认公开展示的压缩卡面衍生图，来源未补齐的记录仍保持 `review_required`
- EN: Added a review and card-generation pipeline for manually uploaded player media: the first 18 images were checked for player identity, team, composition type, and historical context, then converted into 900×1260 card art, 360×504 thumbnails, and an 18-card personal-library import; original uploads remain local, while the deployment contains only user-approved compressed card derivatives and records without documented provenance remain `review_required`
- 编辑器顶部新增常驻「快速选择球员」栏：支持姓名建议、Enter/按钮应用完整球员资料，以及一键打开对应授权影像库；移动端采用输入框独占一行的触控布局，避免继续在长面板中寻找「球员档案」
- EN: Added a sticky “Quick Player” bar at the top of the editor with name suggestions, Enter/button profile application, and one-click access to the matching licensed media library; mobile uses a touch-friendly full-row input so the buried Player Profile section is no longer required
- 首批可追溯球员影像资源：为 Stephen Curry、Luka Dončić、Giannis Antetokounmpo、Nikola Jokić 与 Shai Gilgeous-Alexander 导入 5 张经画面核验的训练/比赛照片；每张均保存拍摄日期、当时球队、摄影师、Wikimedia Commons 来源页与 Creative Commons 许可，并生成 900×1260 卡牌图及 360×504 缩略图
- EN: First traceable player-media batch: added five visually verified training/game photos for Stephen Curry, Luka Dončić, Giannis Antetokounmpo, Nikola Jokić, and Shai Gilgeous-Alexander; every record stores capture date, team at capture, photographer, Wikimedia Commons source page, and Creative Commons licence, with generated 900×1260 card art and 360×504 thumbnails
- 新增 `docs/ASSET_ATTRIBUTIONS.md` 与可复现导入脚本，集中保留首批图片的署名、许可与来源；社交媒体和无明确许可的候选不会自动进入公开影像库
- EN: Added `docs/ASSET_ATTRIBUTIONS.md` and a reproducible importer to retain first-batch credits, licences, and sources; social-media and unlicensed candidates never enter the public media library automatically
- 品牌 Logo 与 favicon：采用「棱镜卡牌层叠 + 金色闪电」主标（logo-concept-a.svg + 16/32/48/180/192/512 PNG + ICO），接入页面头部与浏览器标签页图标
- 预览区右下角新增小字水印 `DEVELOPED BY JETHRO`
- 共享库新增「官方展示卡」：服务启动时自动写入 COOPER FLAGG #32 展示卡，置顶显示「官方展示」标记，所有访客打开页面即可检视
- 卡壳封装（Slab）选择按钮：RAW / MAGNETIC / FORGE / MUSEUM / ACRYLIC / CRYSTAL / GALLERY，含颜色预览色块
- 新特效 **HOLOGRAPHIC（全息）**：基于 conic-gradient 的彩虹反光层，模拟真实球星卡镭射全息效果，含实时预览、Canvas 导出、Three.js 3D 预览折射同步
- 新特效 **LASER（镭射）**：网格 + 光谱 + 扫描线复合层，模拟镭射反光卡纹理，同样覆盖预览 / 导出 / 3D 全链路

### 改进 / Improvements

- 首页精选卡顺序固定为官方预览卡、Shai Gilgeous-Alexander `PM-041`、LeBron James `PM-031`；同步校正截图指定卡片的系列、稀有度、特效、湖人队视觉、人物裁切与封装
- EN: Pinned the featured-card order to the official showcase, Shai Gilgeous-Alexander `PM-041`, and LeBron James `PM-031`; also aligned the referenced cards with the supplied series, rarity, effect, Lakers visual, player crop, and slab treatments
- 新卡编号改为可复现的稀缺度加权随机规则，分母仅使用 299、99、25、20、15、1；编号越稀有，RAW 封装概率越低，`/25` 及以下默认采用实体卡壳
- EN: Card numbering now uses a reproducible rarity-weighted random rule limited to denominators 299, 99, 25, 20, 15, and 1; rarer serials are progressively less likely to be RAW, with `/25` and below receiving a physical slab by default
- 统一限制卡面特效强度：GALAXY 为 10、CRYSTAL 为 32、DIAMOND 为 18，并将 LeBron James 43,000 分纪念卡固定为湖人队 CUTOUT 黑色 1/1 卡
- EN: Standardized effect intensity to GALAXY 10, CRYSTAL 32, and DIAMOND 18, and pinned the LeBron James 43,000-point commemorative card as a Lakers CUTOUT black 1/1
- 精选卡库现自动安装 47 张内容（1 张官方预览卡 + 46 张人工影像卡）；所有新增卡片补齐现役球队 Logo、球员简介与 2025-26 背板统计，转队球员另行保留照片拍摄时球队字段
- EN: The curated library now installs 47 cards (one official showcase plus 46 manually reviewed media cards); every new card includes its current-team logo, a player biography, and 2025-26 back-side statistics, while transferred players retain a separate team-at-capture field for the image
- 卡牌库改为自动安装 19 张精选内容（1 张官方预览卡 + 18 张人工影像卡）；首次加载时精准移除旧 `auto-nba-v7` 25 张初始卡并合并重复预览卡，同时移除旧自动建库入口，避免刷新或新浏览器再次生成初始批次
- EN: The library now installs a 19-card curated set automatically (one official showcase plus 18 manually sourced image cards); first load precisely removes the legacy 25-card `auto-nba-v7` batch and consolidates duplicate showcase cards, while the old auto-build entry point is removed so the starter batch cannot return after refresh or in a new browser
- 首批 18 张人工影像卡补齐现役球队队徽、球员档案与 2025-26 赛季背面数据；转队球员按当前球队与号码展示，并采用完整赛季合并统计
- EN: Completed the first 18 manually sourced cards with current team logos, player profiles, and 2025-26 back-side statistics; transferred players now show their current team and number with full-season combined stats

- 拆包体验全新重设计（PACK REDESIGN v2）：五阶段仪式（包体氛围 → 增强物理撕裂 → 爆破/彩带 → 卡牌堆叠逐张揭示 → 稀有卡全息 Spotlight + 汇总）；内置零依赖 `PackConfetti` 粒子引擎（算法参考 canvas-confetti），包体/Spotlight 鼠标跟随 3D 倾斜与全息反光（CSS 技术参考 pokemon-cards-css），稀有度分层揭示参考 altare-tcg；保留键盘操作与 reduced-motion 支持
- 拆卡包装应用实体卡包贴图（NBA 25-26 赛季包装质感），支持两种拆法：**从上到下竖撕**（拖拽/键盘）或 **⚡ FLASH OPEN 闪光直拆**（白光 + 彩带 + 包体闪光）
- 拆包体验升级为 **Elite Court 实体包装版**：真实包装图左右半分（`elite-court-pack-web.png` 520×780 抠图），拖拽时左右半片随进度分离 + 中心发光撕裂线 + 鼠标跟随全息光泽；分裂完成时半片旋转飞出 + 全屏闪光 + 彩带；翻卡阶段 stagger 入场、稀有卡翻开发光 + 彩带；保留 FLASH OPEN 直拆按钮，关闭后完整重置
- 移除卡包鼠标静置悬停时的长方形光板特效（foil sheen）；拆包动画改用用户提供的 **5 帧序列**（`pack-frame-1..5.webp`）：拖拽按进度逐帧切换，键盘/FLASH OPEN 快速播放五帧后进入分裂爆发
- 拆包动画替换为**视频版**（`pack-animation.mp4`，HEVC MOV 转 H.264 Web 版 480KB / 1.3s）：拖拽撕满、键盘 Enter 或 ⚡ FLASH OPEN 均播放拆包视频，视频结束后全屏闪光 + 彩带并闪出卡片；关闭后视频与状态完整重置
- 拆包预览图更正为用户指定的完整包装设计（`pack-preview.webp`：TEAR HERE / 25-26 SEASON / TIMBERWOLVES / ELITE 等），同时作为卡包第 1 帧与视频 poster
- 移除卡包中央竖线（素材去竖线处理 + 删除撕裂线元素）；拆包视频黑底去除并转**透明 WebM**（VP9 alpha），预览图与动画同为透明抠图、尺寸比例一致
- 拆包动画改为主流浏览器全兼容的**透明动画 WebP**（连通背景去除，仅移除与边缘相连的黑色背景，保留包装深色设计）；预览图改为动画首帧，预览与动画尺寸、构图完全一致，播放中不再出现黑框
- 恢复上一版卡包比例：预览图与动画保持原始透明抠图尺寸（取消 150% 放大填满）
- 全息光板改为**自然光泽特效**：鼠标悬停时光标处柔和反光 + 一次斜向流光扫过（`pack-gloss-sweep`），不再是静止的长方形亮板
- 悬停光泽层沿**包装纸不规则边缘**显示：用卡包透明图作 CSS mask 遮罩，光泽只出现在包装图案内，四周不再有矩形亮板
- 首页预览区右上角新增**小比例动态卡包按钮**（`OPEN PACK`）：包装图 + 漂浮/脉冲动画 + 悬停光泽扫光，点击直接进入拆包流程
- UI 交互品质提升（UI POLISH v3）：按钮 ripple/按压回弹/选中光晕、面板错落入场、卡牌库与共享卡逐张入场、Toast 类型化 + 进度条、导出 Loading/成功闪光、拆包粒子与翻卡弹跳、工具按钮呼吸光效、输入聚焦/滑块/取色反馈、保存心形动画、对比模式 VS/数据条动画、自定义滚动条与 reduced-motion 保护
- 官方展示卡与首页预设同步：签名位置统一为正面 X 50% / Y 62% / 100%，展示卡创建时间恢复正常显示
- GitHub 仓库预览图替换为 1280×640 横幅：Cooper Flagg #32 **亚克力封装版**正/背面并排展示（用户提供图，等比裁切铺满）
- 移除卡牌库缩略图右上角的黄色「⚠ 配图未确认」角标；检视弹层内的文字警告保留
- 首页预设展示卡更新为 COOPER FLAGG / DAL / **#32**，卡号 `CB-077`、编号 `24/99`，签名位于正面（X 50% / Y 78% / 100%），与官方展示卡一致
- 拆卡背板全新重做（PACK BACKDROP v2）：零依赖五层舞台氛围——四色极光（青/紫/金/品红）缓慢漂移、跟随鼠标视线的中央聚光灯、底部透视点阵地板、Canvas 浮尘粒子 + 顶部星点引擎、暗角 + 胶片噪点收拢视线；层级修复确保卡包/卡牌始终在背板之上，极光改用渐变柔边而非重型 blur 滤镜以提升低端设备流畅度
- EN: Rebuilt the pack-opening backdrop (PACK BACKDROP v2): a zero-dependency five-layer stage — four slowly drifting aurora blobs (cyan/purple/gold/magenta), a pointer-following center spotlight, a perspective dot-matrix floor, a Canvas dust-and-stars engine, plus vignette and film grain to focus the view; fixed layering so the pack/cards always stay above the backdrop, and replaced heavy blur filters with soft gradient edges for smoother performance on low-end devices
- 重做 **CRYSTAL（水晶）** 特效：从低透明度纯色多边形改为渐变填充 + 虚线高光棱面，视觉效果更接近真实棱镜折射，不再显得单薄粗糙
- 自动建库球员数据更新为 **2025-26 赛季**（原按钮仍显示 24-25，现已同步）
- LIGHTNING（闪电）特效强度统一收紧到 20%，避免高强度特效遮挡球员人像（新建卡与修复旧卡均生效）

### 修复 / Fixes

- 按本地预览反馈调整精选卡：删除 Kyrie Irving `PM-049`；Cooper Flagg `PM-051` 改为 CUTOUT 保持完整构图；Cooper Flagg `PM-052` 与 Devin Booker `PM-056` 卡面左移微调；James Harden `PM-054` 改为 BASE 稀有度并移除 MVP 徽章；全量徽章审核后移除 Anthony Edwards 与 Jalen Brunson 卡片上错误的 MVP 标识
- EN: Adjusted curated cards per preview feedback — removed Kyrie Irving `PM-049`; switched Cooper Flagg `PM-051` to CUTOUT to preserve full composition; shifted Cooper Flagg `PM-052` and Devin Booker `PM-056` card art slightly left; changed James Harden `PM-054` to BASE rarity without the MVP badge; a full badge audit also removed erroneous MVP badges from Anthony Edwards and Jalen Brunson cards
- 修复新批次球员识别偏差：第 54 号卡面初判为 LeBron James，经卡面 OCR 复核确认实为 James Harden（骑士队连续季后赛纪录卡），已更正球员、赛季数据与卡面对应关系
- EN: Fixed a player-identity mismatch in the new batch: card #54 was initially read as LeBron James, then OCR re-check confirmed it is James Harden (Cavaliers straight-playoff-appearances card); player, season stats, and card mapping corrected
- 将 Shai Gilgeous-Alexander `PM-041` 的用户提供签名改为金色箔笔迹；保留原始笔画和安全位置，使其在高亮闪电背景上更清晰
- EN: Changed the supplied signature on Shai Gilgeous-Alexander `PM-041` to gold foil while retaining its original strokes and safe placement for stronger contrast against the lightning background
- 应用代码审计修复：影像缩略图加载失败时显示明确占位提示，打开影像库时保留当前卡面照片与队徽；同时为签名、卡库和拆包流程的反馈补齐成功、警告、错误状态
- EN: Applied code-audit fixes: failed media thumbnails now show a clear placeholder, opening the media library preserves the current card photo and team logo, and signature/library/pack feedback now uses explicit success, warning, and error states
- 球队 Logo 与 MVP / RC 等标识改为垂直分层，标识整体下移；同时去除队徽图片的透明留白，并为 Giannis Antetokounmpo 与 Bam Adebayo 卡面放大热火队 Logo
- EN: Vertically separated team logos from MVP/RC badges by moving the badge rack down; transparent logo padding is now trimmed, with larger Miami Heat logos for Giannis Antetokounmpo and Bam Adebayo
- 修复 Stephen Curry `PM-006` 人像顶部裁切，改用保持完整构图的 CUTOUT 渲染；卡面预览、Canvas 导出与卡库重载共享同一位置参数
- EN: Fixed the cropped head on Stephen Curry `PM-006` by switching to a composition-preserving CUTOUT render; card preview, Canvas export, and library reload now share the same positioning values
- 彻底移除 OPTIC 卡面的白色信息底板，并同步修复浏览器预览与 Canvas 导出；姓名改用自适应白字与深色阴影，长姓名不再被容器裁切
- EN: Removed the white OPTIC information panel from both the browser preview and Canvas export; player names now use adaptive white type with a dark shadow and are no longer clipped by the container
- 修复卡牌库导入遇到相同卡片 ID 时无法更新旧数据的问题；现在仅在导入卡片的数据版本更高时原位升级，并保留原收藏状态
- EN: Fixed library imports skipping cards with an existing ID; imports now upgrade a card in place only when its data version is newer, while preserving its favourite state

- 修复卡牌库抽屉面板缺少 flex 布局导致无法向下滚动查看更多卡片的问题
- 修复卡壳封装按钮因脚本缓存未更新而失效（静态资源版本号统一升级）
- 修复自动建库球员卡黑色矩形遮挡人像问题：根因是所有自动生成卡片继承了展示卡（Cooper Flagg）未抠图的原始不透明签名底图；现自动建库卡片不再继承任何签名数据
- 修复自动建库卡片全部被错误印上展示卡签名的问题：`AUTO_LIBRARY_DATA_VERSION` 升至 4，触发一次性修复重建，清除已入库卡片上的残留签名

### 数据版本 / Data Versions

- `player-media-manual-review` 手工审核批次 58 条；`sourceDataVersion` 7 → 8；精选卡库共 58 张（1 张官方展示卡 + 57 张人工影像卡，含 1 张已删除占位）
- EN: `player-media-manual-review` batch stays at 58 slots; `sourceDataVersion` 7 → 8; curated library now 58 cards (1 official showcase + 57 manual media cards, with one disabled slot)
- `player-media-manual-review` 手工审核批次由 54 条扩展至 58 条；`sourceDataVersion` 6 → 7；应用内球员库 27 → 28（新增 P.J. Washington）
- EN: `player-media-manual-review` manual-review batch expanded from 54 to 58 items; `sourceDataVersion` 6 → 7; in-app player database 27 → 28 (added P.J. Washington)
- `player-media-manual-review` 手工审核批次由 46 条扩展至 54 条；`sourceDataVersion` 5 → 6
- EN: `player-media-manual-review` manual-review batch expanded from 46 to 54 items; `sourceDataVersion` 5 → 6
- `AUTO_LIBRARY_DATA_VERSION`: 2 → 3 → 4（触发自动库重建修复）
- 静态资源缓存版本：`app.js` v25 → v26，`styles.css` v10，`shared-library.js` v3，`three-preview.js` v8
- 静态资源缓存版本本轮更新：`app.js` → v35，`styles.css` → v23
- EN: Static asset cache versions updated in this change: `app.js` → v35 and `styles.css` → v23
- 本轮静态资源缓存版本：`app.js` → v39，`styles.css` → v26
- EN: Static asset cache versions for this change: `app.js` → v39 and `styles.css` → v26
- 精选卡库迁移缓存版本：`app.js` → v40；新增 `data/curated-library.json` 与 36 个压缩卡面/缩略图衍生资源
- EN: Curated-library migration cache version: `app.js` → v40; added `data/curated-library.json` and 36 compressed card-art/thumbnail derivative assets
- 人工影像清单 / 精选卡库数据版本升至 v2；静态缓存更新为 `app.js` v41、`styles.css` v27，并生成 92 个压缩卡面 / 缩略图衍生资源
- EN: Bumped the manual-media manifest and curated-library data to v2, updated static caches to `app.js` v41 and `styles.css` v27, and generated 92 compressed card-art/thumbnail derivatives
- 人工影像清单 / 精选卡库数据版本升至 v3；静态缓存更新为 `app.js` v42、`styles.css` v29
- EN: Bumped the manual-media manifest and curated-library data to v3 and updated static caches to `app.js` v42 and `styles.css` v29
- 人工影像清单 / 精选卡库数据版本升至 v4；静态缓存更新为 `app.js` v43、`styles.css` v30
- EN: Bumped the manual-media manifest and curated-library data to v4 and updated static caches to `app.js` v43 and `styles.css` v30
- 人工影像清单 / 精选卡库数据版本升至 v5；静态缓存更新为 `app.js` v44、`styles.css` v31
- EN: Bumped the manual-media manifest and curated-library data to v5 and updated static caches to `app.js` v44 and `styles.css` v31

---

升级后卡牌库会自动迁移，无需再点击「校验 / 建库」。
After upgrading, the card library migrates automatically; no manual “Verify / Build” action is required.
