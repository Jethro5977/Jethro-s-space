#!/usr/bin/env node
/**
 * Build script for @card-builder/renderer
 *
 * Produces two bundles in dist/:
 *   - card-renderer.esm.js   — ES module (tree-shakeable, for bundlers)
 *   - card-renderer.umd.js   — UMD global (for <script> tag / CDN)
 *
 * Three.js is always external — ESM consumers resolve the peer dependency and
 * the UMD build resolves the classic-script global `window.THREE`.
 */

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const banner = `/* @card-builder/renderer v${pkg.version} | MIT License */`;

async function run() {
  mkdirSync("dist", { recursive: true });

  // 1. ESM bundle — clean external imports, tree-shakeable
  const esm = await build({
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

  // 2. UMD bundle — esbuild IIFE externals produce require() which browsers
  //    lack, so we build ESM first then wrap it in a UMD envelope that maps
  //    the "three" import to the window.THREE global.
  const esmForUmd = await build({
    entryPoints: ["src/index.js"],
    bundle: true,
    format: "esm",
    external: ["three", "three/*"],
    target: ["es2022"],
    minify: false,
    write: false,
  });

  const esmCode = esmForUmd.outputFiles[0].text;

  // Rewrite bare three imports to reference the THREE global.
  // Three.js addons (OrbitControls etc.) are re-exported from the main
  // three module when using the classic CDN build, so we map those too.
  const rewrittenCode = esmCode
    .replace(/import\s*\*\s*as\s+\w+\s+from\s*["']three["'];?\n?/g, "// (THREE provided by UMD factory)\n")
    .replace(/import\s*\{([^}]+)\}\s*from\s*["']three(?:\/[^"']+)?["'];?/g, (_, names) => {
      const bindings = names.split(",").map((n) => n.trim()).filter(Boolean);
      return bindings.map((b) => {
        const [source, alias] = b.split(/\s+as\s+/);
        return `const ${(alias || source).trim()} = THREE.${source.trim()};`;
      }).join("\n");
    });

  // Collect named exports from the ESM source
  const exportNames = [];
  // Match: export { a, b, c }
  for (const m of rewrittenCode.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const name of m[1].split(",")) {
      const trimmed = name.trim().split(/\s+as\s+/).pop().trim();
      if (trimmed) exportNames.push(trimmed);
    }
  }
  // Match: export function name / export var/let/const name
  for (const m of rewrittenCode.matchAll(/export\s+(?:function|var|let|const)\s+(\w+)/g)) {
    exportNames.push(m[1]);
  }

  // Strip all export keywords from the body
  const bodyCode = rewrittenCode
    .replace(/export\s*\{[^}]+\};?/g, "")
    .replace(/export\s+(function|var|let|const)\s+/g, "$1 ");

  const umdCode = `${banner}
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
${bodyCode}
  return { ${exportNames.join(", ")} };
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
