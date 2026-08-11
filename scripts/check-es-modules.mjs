import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const moduleFiles = [
  "three-preview.js",
  ...listNumberedModules("src", 15),
  "packages/renderer/src/config.js",
  "packages/renderer/src/index.js"
];

for (const file of moduleFiles) {
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: readFileSync(file),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    process.stderr.write(`Module syntax check failed: ${file}\n${result.stderr}`);
    process.exit(result.status || 1);
  }
}

console.log(`✓ ${moduleFiles.length} ES modules passed syntax checks`);

function listNumberedModules(directory, expectedCount) {
  const files = [
    "app-core.js",
    "constants.js",
    "effects.js",
    "export.js",
    "foil.js",
    "interaction.js",
    "library.js",
    "main.js",
    "pack-opening.js",
    "player-data.js",
    "render.js",
    "signatures.js",
    "state.js",
    "ui-polish.js",
    "utils.js"
  ].map((file) => `${directory}/${file}`);

  if (files.length !== expectedCount) throw new Error(`Expected ${expectedCount} application modules`);
  return files;
}
