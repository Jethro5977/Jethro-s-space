import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const moduleFiles = [
  "three-preview.js",
  ...listModules("src"),
  ...listModules("packages/renderer/src")
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

function listModules(directory) {
  return readdirSync(directory).filter((file) => /\.m?js$/.test(file)).sort().map((file) => `${directory}/${file}`);
}
