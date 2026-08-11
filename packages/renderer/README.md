# @card-builder/renderer

Card Builder 的可嵌入 Three.js 3D 卡牌渲染器。包本身不查找页面节点、不写入全局变量，也不拥有产品数据；调用方负责传入容器、Canvas 和业务桥接对象。

## API

```js
import { createCardRenderer } from "@card-builder/renderer";

const renderer = createCardRenderer({
  host: document.querySelector("#preview"),
  canvas: document.querySelector("canvas"),
  status: document.querySelector("#status"),
  bridge: {
    getState: () => cardState,
    setView: (nextView) => updateView(nextView),
    flip: () => flipCard(),
    renderCardCanvas: (side, width, height) => renderTexture(side, width, height)
  }
});

renderer.setState(nextState);
renderer.setView(nextView);
const imageCanvas = renderer.captureCanvas(2400, 3200);
renderer.destroy();
```

`createCardRenderer()` 返回 `ready`、`setState`、`setView`、`resize`、`rebuild`、`captureCanvas`、`getHoverTiltState` 与 `destroy`。调用方卸载页面或替换 Canvas 前必须调用 `destroy()`。

当前版本面向浏览器并以 `three` 为 peer dependency。Card Builder 主应用通过 import map 使用此包，根目录 `three-preview.js` 仅负责旧全局 API 的兼容。
