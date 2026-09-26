import test from "node:test";
import assert from "node:assert/strict";
import { advanceSpring, advancePointerSpring } from "../src/spring.js";

// ---------------------------------------------------------------------------
// advanceSpring — 1-D
// ---------------------------------------------------------------------------

test("spring converges to target from below", () => {
  const spring = { stiffness: 200, damping: 20 };
  let value = 0;
  let velocity = 0;

  // Simulate 2 seconds at 60fps
  for (let i = 0; i < 120; i++) {
    const result = advanceSpring(value, velocity, 1, spring, 1 / 60);
    value = result.value;
    velocity = result.velocity;
  }

  assert.ok(Math.abs(value - 1) < 0.001, `expected ~1, got ${value}`);
  assert.ok(Math.abs(velocity) < 0.01, `expected ~0 velocity, got ${velocity}`);
});

test("spring converges to target from above", () => {
  const spring = { stiffness: 200, damping: 20 };
  let value = 2;
  let velocity = 0;

  for (let i = 0; i < 120; i++) {
    const result = advanceSpring(value, velocity, 1, spring, 1 / 60);
    value = result.value;
    velocity = result.velocity;
  }

  assert.ok(Math.abs(value - 1) < 0.001, `expected ~1, got ${value}`);
});

test("spring snaps when close enough to target", () => {
  const spring = { stiffness: 200, damping: 20 };
  const result = advanceSpring(0.99999, 0.00001, 1, spring, 1 / 60);
  assert.equal(result.value, 1);
  assert.equal(result.velocity, 0);
});

test("spring with zero delta returns near-original value", () => {
  const spring = { stiffness: 200, damping: 20 };
  // deltaSeconds = 0 means steps = ceil(0/0.016) = 1, step = 0
  const result = advanceSpring(0.5, 0, 1, spring, 0);
  // With step=0, velocity and position should not change
  assert.ok(Math.abs(result.value - 0.5) < 0.01);
});

test("higher stiffness reaches target faster (measured by error)", () => {
  const softSpring = { stiffness: 50, damping: 10 };
  const stiffSpring = { stiffness: 400, damping: 30 };

  let softValue = 0, softVelocity = 0;
  let stiffValue = 0, stiffVelocity = 0;

  // Simulate 0.5 seconds
  for (let i = 0; i < 30; i++) {
    const softResult = advanceSpring(softValue, softVelocity, 1, softSpring, 1 / 60);
    softValue = softResult.value;
    softVelocity = softResult.velocity;

    const stiffResult = advanceSpring(stiffValue, stiffVelocity, 1, stiffSpring, 1 / 60);
    stiffValue = stiffResult.value;
    stiffVelocity = stiffResult.velocity;
  }

  // Stiff spring should be closer to target (may overshoot, so compare absolute error)
  const softError = Math.abs(1 - softValue);
  const stiffError = Math.abs(1 - stiffValue);
  assert.ok(stiffError < softError, `stiff error (${stiffError}) should be < soft error (${softError})`);
});

test("spring is frame-rate independent within tolerance", () => {
  const spring = { stiffness: 170, damping: 21 };

  // Simulate 1 second at 60fps
  let v60 = 0, vel60 = 0;
  for (let i = 0; i < 60; i++) {
    const r = advanceSpring(v60, vel60, 1, spring, 1 / 60);
    v60 = r.value; vel60 = r.velocity;
  }

  // Simulate 1 second at 30fps
  let v30 = 0, vel30 = 0;
  for (let i = 0; i < 30; i++) {
    const r = advanceSpring(v30, vel30, 1, spring, 1 / 30);
    v30 = r.value; vel30 = r.velocity;
  }

  // Sub-stepping should make these reasonably close
  assert.ok(Math.abs(v60 - v30) < 0.05, `60fps (${v60}) vs 30fps (${v30}) should be close`);
});

// ---------------------------------------------------------------------------
// advancePointerSpring — 2-D
// ---------------------------------------------------------------------------

test("pointer spring converges both axes", () => {
  const spring = { stiffness: 200, damping: 20 };
  const pointer = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  const target = { x: 0.8, y: 0.3 };

  for (let i = 0; i < 120; i++) {
    advancePointerSpring(pointer, velocity, target, spring, 1 / 60);
  }

  assert.ok(Math.abs(pointer.x - 0.8) < 0.001, `x: expected ~0.8, got ${pointer.x}`);
  assert.ok(Math.abs(pointer.y - 0.3) < 0.001, `y: expected ~0.3, got ${pointer.y}`);
});

test("pointer spring mutates input objects", () => {
  const spring = { stiffness: 200, damping: 20 };
  const pointer = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };

  advancePointerSpring(pointer, velocity, { x: 1, y: 1 }, spring, 1 / 60);

  assert.ok(pointer.x > 0, "pointer.x should have moved");
  assert.ok(pointer.y > 0, "pointer.y should have moved");
});
