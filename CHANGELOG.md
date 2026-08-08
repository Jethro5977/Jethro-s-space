# Changelog / 更新日志

> 维护说明 / Maintenance note:
> 自 2026-08-09 起，所有新增与修改条目均使用中英双语撰写；历史条目保持原语言不变。
> From 2026-08-09 onward, all new and updated entries are written in both Chinese and English; older entries keep their original language.

## [Unreleased]

### 新增 / Added

- 品牌 Logo 与 favicon：采用「棱镜卡牌层叠 + 金色闪电」主标（logo-concept-a.svg + 16/32/48/180/192/512 PNG + ICO），接入页面头部与浏览器标签页图标
- 预览区右下角新增小字水印 `DEVELOPED BY JETHRO`
- 共享库新增「官方展示卡」：服务启动时自动写入 COOPER FLAGG #32 展示卡，置顶显示「官方展示」标记，所有访客打开页面即可检视
- 卡壳封装（Slab）选择按钮：RAW / MAGNETIC / FORGE / MUSEUM / ACRYLIC / CRYSTAL / GALLERY，含颜色预览色块
- 新特效 **HOLOGRAPHIC（全息）**：基于 conic-gradient 的彩虹反光层，模拟真实球星卡镭射全息效果，含实时预览、Canvas 导出、Three.js 3D 预览折射同步
- 新特效 **LASER（镭射）**：网格 + 光谱 + 扫描线复合层，模拟镭射反光卡纹理，同样覆盖预览 / 导出 / 3D 全链路

### 改进 / Improvements

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

- 修复卡牌库抽屉面板缺少 flex 布局导致无法向下滚动查看更多卡片的问题
- 修复卡壳封装按钮因脚本缓存未更新而失效（静态资源版本号统一升级）
- 修复自动建库球员卡黑色矩形遮挡人像问题：根因是所有自动生成卡片继承了展示卡（Cooper Flagg）未抠图的原始不透明签名底图；现自动建库卡片不再继承任何签名数据
- 修复自动建库卡片全部被错误印上展示卡签名的问题：`AUTO_LIBRARY_DATA_VERSION` 升至 4，触发一次性修复重建，清除已入库卡片上的残留签名

### 数据版本 / Data Versions

- `AUTO_LIBRARY_DATA_VERSION`: 2 → 3 → 4（触发自动库重建修复）
- 静态资源缓存版本：`app.js` v25 → v26，`styles.css` v10，`shared-library.js` v3，`three-preview.js` v8
- 静态资源缓存版本本轮更新：`app.js` → v35，`styles.css` → v23

---

升级后需在页面内点击「校验 / 建库」以修复已存在的自动建库卡片。
