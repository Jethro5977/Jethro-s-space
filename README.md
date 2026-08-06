<p align="center">
  <img src="assets/card-builder-lockup.png" alt="Card Builder" width="720">
</p>

# Card Builder

以 Claude `card_3d_preview.html` 为界面基础的纯 Web DIY 3D 球星卡制作器。预览使用本地安装的 Three.js ES Modules，需要通过本地 HTTP 服务运行。

## 启动

```bash
cd /path/to/card-builder
npm install
npm start
```

浏览器打开 `http://127.0.0.1:4174/`。不要直接用 `file://` 打开 `index.html`，浏览器会阻止 Three.js 模块和贴图加载。

`npm start` 运行的是 `server/shared-server.mjs`（Node 静态服务器 + 共享卡牌库 API，零依赖）。局域网内其他设备可通过 `http://<本机IP>:4174/` 访问并浏览共享卡牌库。

## 功能

- 6 种原创卡片系列：Prism、Tactical、Heritage、Mosaic、Select、Optic
- 6 种动态特效：Diamond、Lightning、Rainbow、Crystal、Flame、Galaxy
- Cutout 与 Full Art 两种照片模式
- 球队配色、Logo、球衣纹样、徽章、稀有度与卡壳（含厚版透明亚克力壳）
- Claude 风格双栏编辑器与 Three.js WebGL 真 3D 预览
- OrbitControls 360 度旋转、鼠标滚轮与触控缩放、固定 90 度视角、自动展示、正反翻面及视角复位
- 独立前后亚克力板、周边导轨、内腔、接缝和角部固定件，侧面与俯视均保留实体厚度
- PBR 透明亚克力、环境反射、折射、清漆高光和程序化轻微划痕
- 随旋转角度变化的全息光带、特效视差与双层辉光闪电
- 可开关的 6px PVC 卡体厚度，金卡、黑卡和霓虹卡拥有对应侧边材质
- DIY 手写签名：四色笔、正反面、位置及缩放调整
- DIY 闪光蒙版：自由涂抹局部特效区域、笔刷调整与全卡填充
- 1500/2100 像素卡面、正反合图、卡壳展示及 2400×3200 当前 3D 视角 PNG 导出
- PNG 同步导出签名与局部闪光效果
- 本机保存、项目 JSON 导入导出，并恢复签名与蒙版数据
- 卡牌库：最多 200 张本地收藏，支持稀有度、系列、卡壳和收藏筛选，以及完整快照加载
- 收藏背景：库存缩略图自动平铺为暗化模糊舞台背景，空库使用球队色块
- 拆包体验：拖拽撕包、3 张卡逐张翻开，并为 GOLD、BLACK、NEON 添加稀有闪光
- 卡牌对比 PK：PPG、RPG、APG、FG%、3P%、GP 六项数据并排高亮
- 20 项收藏成就与进度追踪
- 校验 / 建库：自动补齐 25 位球员卡；旧批量卡会保留设计与收藏状态并刷新身份、头像、球队、赛季数据和缩略图
- 自动素材容错：球员头像优先 NBA CDN、回退 ESPN；球队 Logo 优先 NBA、回退 ESPN；跨域失败时使用程序化占位卡
- 共享卡牌库：无用户系统，一键发布 DIY 卡牌，所有人可浏览、筛选、检视，可加载回编辑器或下载项目 JSON，发布者可删除自己的卡

界面与交互以 Claude V1 `card_3d_preview.html` 为主体，卡面生成、特效、存储与 Canvas 导出位于 `app.js`，WebGL 封装几何与材质位于 `three-preview.js`。

共享卡牌库相关：前端逻辑在 `shared-library.js`，服务端在 `server/shared-server.mjs`，执行规范见 `docs/PRD_共享卡牌库_Codex_Spec.md`（v2.0，含逐节实现要求与验收标准），简要 PRD 见 `docs/PRD_共享卡牌库.md`。

验证：

```bash
npm run check        # 语法检查
npm run verify       # 共享库 API 冒烟测试（需先 npm start）
```

卡牌库数据保存在浏览器 `localStorage` 的 `card-builder-library-v1` 键中；可在卡库抽屉顶部导入或导出完整 JSON 备份。

一键建库首次运行需要联网下载头像与球队 Logo。素材会在浏览器内降采样并转为本地 data URL，之后加载卡片不依赖网络；批量流程每 5 张建立一个保存检查点，存储空间不足时可保留已完成的批次并再次续建。

球员数据以 2024-25 NBA 常规赛为统一口径；Cooper Flagg 明确标注为 `2024-25 NCAA` 杜克赛季数据。联网核对姓名、ESPN 身份映射和 NBA 头像端点：

```bash
npm run audit:players
```
