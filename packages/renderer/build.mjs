#!/usr/bin/env node
/**
 * Build script for @card-builder/renderer
 *
 * Produces two bundles in dist/:
 *   - card-renderer.esm.js   — ES module (tree-shakeable, for bundlers)
 *   - card-renderer.umd.js   — UMD global (for <script> tag / CDN)
 *
 * ESM consumers resolve the Three.js peer and addons. UMD bundles the addons
 * and resolves only the Three.js core from the supplied `THREE` namespace.
 */

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const banner = `/* @card-builder/renderer v${pkg.version} | MIT License */`;
// The UMD build includes Three.js addon source, so carry the upstream MIT
// notice into the distributable instead of relying on the development tree.
const threeLicense = readFileSync(new URL("../LICENSE", import.meta.resolve("three")), "utf8").trim();
const umdBanner = `${banner}\n/*\n * Bundled Three.js addon license:\n * ${threeLicense.replace(/\n/g, "\n * ")}\n */`;

async function run() {
  mkdirSync("dist", { recursive: true });

  // 1. ESM bundle — clean external imports, tree-shakeable
  await build({
    entryPoints: ["src/index.js"],
    bundle: true,
    format: "esm",
    external: ["three", "three/*"],
    target: ["es2022"],
    minify: false,
    sourcemap: true,
    banner: { js: banner },
    outfile: "dist/card-renderer.esm.js",
    metafile: true,
  });

  // 2. Bundle addons (they are not properties of THREE), leaving only the
  //    exact core import external. A package-name external would also exclude
  //    all three/* subpaths, so use an exact-match resolver instead.
  const cjsForUmd = await build({
    entryPoints: ["src/index.js"],
    bundle: true,
    format: "cjs",
    plugins: [{
      name: "external-three-core",
      setup(builder) {
        builder.onResolve({ filter: /^three$/ }, () => ({ path: "three", external: true }));
      },
    }],
    target: ["es2022"],
    minify: false,
    write: false,
  });

  const umdCode = `${umdBanner}
(function(global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["three"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("three"));
  } else {
    global.CardBuilderRenderer = factory(global.THREE);
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function(THREE) {
  "use strict";
  if (!THREE) throw new Error("CardBuilderRenderer requires the Three.js namespace as globalThis.THREE");
  var module = { exports: {} };
  var exports = module.exports;
  function require(id) {
    if (id === "three") return THREE;
    throw new Error("Unexpected external dependency: " + id);
  }
${cjsForUmd.outputFiles[0].text}
  return module.exports;
});
`;

  writeFileSync("dist/card-renderer.umd.js", umdCode);

  // Report sizes
  for (const [label, file] of [["ESM", "dist/card-renderer.esm.js"], ["UMD", "dist/card-renderer.umd.js"]]) {
    const bytes = statSync(file).size;
    console.log(`${label}: ${(bytes / 1024).toFixed(1)} KB`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
