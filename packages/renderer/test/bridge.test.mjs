import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultBridge } from "../src/bridge.js";

test("default bridge preserves view updates and flips the camera without changing face identity", () => {
  const initial = { effect: "laser", rarity: "gold", view: { rotX: 12, rotY: 20, viewScale: 0.8 } };
  const bridge = createDefaultBridge("unused.png", initial);
  bridge.setView({ rotX: 25 });
  bridge.flip();
  assert.deepEqual(bridge.getState().view, { rotX: 25, rotY: 200, viewScale: 0.8, motionOn: false });
  bridge.flip();
  assert.equal(bridge.getState().view.rotY, 20);
  assert.equal(initial.view.rotX, 12);
  const snapshot = bridge.getState();
  snapshot.view.rotX = 100;
  assert.equal(bridge.getState().view.rotX, 25);
  assert.equal(snapshot.effect, "laser");
});

test("image loading is lazy and a failed image produces a usable fallback canvas", async () => {
  let imageLoads = 0;
  let fills = 0;
  const context = {
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() { fills += 1; },
    strokeRect() {}, fillText() {}
  };
  const documentTarget = { createElement(tag) {
    if (tag === "img") {
      imageLoads += 1;
      return { set src(value) { queueMicrotask(() => this.onerror(new Error(value))); } };
    }
    return { getContext: () => context };
  } };
  const bridge = createDefaultBridge("missing.png", {}, { documentTarget });
  assert.equal(imageLoads, 0);
  const front = await bridge.renderCardCanvas("front", 600, 840);
  const back = await bridge.renderCardCanvas("back", 600, 840);
  assert.equal(front.width, 600);
  assert.equal(back.height, 840);
  assert.equal(imageLoads, 1);
  assert.equal(fills, 2);
});
