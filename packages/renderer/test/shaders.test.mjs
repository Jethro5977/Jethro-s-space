import test from "node:test";
import assert from "node:assert/strict";
import {
  holoVertexShader,
  holoFragmentShader,
  HOLO_UNIFORMS_DEFAULTS
} from "../src/shaders.js";

test("vertex shader is a non-empty string containing gl_Position", () => {
  assert.equal(typeof holoVertexShader, "string");
  assert.ok(holoVertexShader.length > 50);
  assert.match(holoVertexShader, /gl_Position/);
  assert.match(holoVertexShader, /vUv/);
});

test("fragment shader is a non-empty string containing all 9 mode branches", () => {
  assert.equal(typeof holoFragmentShader, "string");
  assert.ok(holoFragmentShader.length > 200);
  assert.match(holoFragmentShader, /gl_FragColor/);
  assert.match(holoFragmentShader, /uMode/);
  assert.match(holoFragmentShader, /uPointer/);
  assert.match(holoFragmentShader, /uHover/);
  assert.match(holoFragmentShader, /uStrength/);
  assert.match(holoFragmentShader, /uOpacity/);
  assert.match(holoFragmentShader, /uTint/);
  assert.match(holoFragmentShader, /uTime/);
});

test("fragment shader declares all uniform types correctly", () => {
  assert.match(holoFragmentShader, /uniform vec2\s+uPointer/);
  assert.match(holoFragmentShader, /uniform float\s+uHover/);
  assert.match(holoFragmentShader, /uniform float\s+uTime/);
  assert.match(holoFragmentShader, /uniform float\s+uStrength/);
  assert.match(holoFragmentShader, /uniform float\s+uMode/);
  assert.match(holoFragmentShader, /uniform float\s+uOpacity/);
  assert.match(holoFragmentShader, /uniform vec3\s+uTint/);
});

test("fragment shader contains helper functions", () => {
  assert.match(holoFragmentShader, /float hash21/);
  assert.match(holoFragmentShader, /vec3 spectrum/);
});

test("HOLO_UNIFORMS_DEFAULTS has expected keys and types", () => {
  assert.ok(Object.isFrozen(HOLO_UNIFORMS_DEFAULTS));
  assert.deepEqual(HOLO_UNIFORMS_DEFAULTS.uPointer, [0.5, 0.5]);
  assert.equal(typeof HOLO_UNIFORMS_DEFAULTS.uHover, "number");
  assert.equal(typeof HOLO_UNIFORMS_DEFAULTS.uTime, "number");
  assert.equal(typeof HOLO_UNIFORMS_DEFAULTS.uStrength, "number");
  assert.equal(typeof HOLO_UNIFORMS_DEFAULTS.uMode, "number");
  assert.equal(typeof HOLO_UNIFORMS_DEFAULTS.uOpacity, "number");
  assert.equal(typeof HOLO_UNIFORMS_DEFAULTS.uTint, "number");
});
