import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as THREE from "three";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const esmUrl = new URL("../dist/card-renderer.esm.js", import.meta.url);
const umdPath = new URL("../dist/card-renderer.umd.js", import.meta.url);

test("package metadata keeps Three.js external and publishes the license", () => {
  assert.equal(pkg.peerDependencies.three, "^0.185.1");
  assert.equal(pkg.exports["."].import, "./dist/card-renderer.esm.js");
  assert.equal(pkg.unpkg, "./dist/card-renderer.umd.js");
  assert.ok(pkg.files.includes("LICENSE"));
});

test("ESM distribution exports the public renderer API", async () => {
  const source = readFileSync(esmUrl, "utf8");
  assert.match(source, /from ['"]three['"]/u);
  const module = await import(esmUrl.href);
  assert.equal(typeof module.createCardRenderer, "function");
  assert.equal(typeof module.normalizeRendererState, "function");
});

test("UMD distribution attaches to a classic-script global with window.THREE", () => {
  const source = readFileSync(umdPath, "utf8");
  assert.match(source, /global\.THREE/u);

  const context = { THREE, console };
  context.globalThis = context;
  context.self = context;
  context.window = context;
  vm.runInNewContext(source, context, { filename: "card-renderer.umd.js" });

  assert.equal(typeof context.CardBuilderRenderer.createCardRenderer, "function");
  assert.equal(typeof context.CardBuilderRenderer.normalizeRendererState, "function");
});

test("source, installed-package ESM, and UMD expose the same public API", async () => {
  const source = await import("../src/index.js");
  const esm = await import("@card-builder/renderer");
  const context = { THREE, console };
  vm.runInNewContext(readFileSync(umdPath, "utf8"), context);
  const names = Object.keys(source).sort();
  assert.deepEqual(Object.keys(esm).sort(), names);
  assert.deepEqual(Object.keys(context.CardBuilderRenderer).sort(), names);
  for (const name of ["fromImage", "createDefaultBridge", "advanceSpring", "createScratchCanvas"]) {
    assert.equal(typeof esm[name], "function");
  }
  assert.deepEqual(esm.HOLO_UNIFORMS_DEFAULTS, source.HOLO_UNIFORMS_DEFAULTS);
});

test("all documented package subpaths resolve their published source and declarations", async () => {
  for (const name of ["config", "spring", "shaders", "textures", "bridge"]) {
    const exported = await import(`@card-builder/renderer/${name}`);
    assert.ok(Object.keys(exported).length > 0, name);
    assert.ok(readFileSync(new URL(`../${pkg.exports[`./${name}`].types}`, import.meta.url), "utf8").length > 0);
  }
});
