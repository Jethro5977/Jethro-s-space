import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets", "signatures", "source");
const outputDir = path.join(root, "assets", "signatures");
const signatures = [
  { source: "shai-gilgeous-alexander.png", output: "shai-gilgeous-alexander-blue.png", ink: "blue" },
  { source: "lebron-james.png", output: "lebron-james-black.png", ink: "black" },
  { source: "stephen-curry.png", output: "stephen-curry-blue.png", ink: "blue" }
];

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

function inkCoverage(r, g, b, alpha, ink) {
  const lightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (ink === "blue") {
    const blueLead = b - Math.max(r, g);
    return clampByte(Math.max((chroma - 20) * 4.4, (blueLead - 7) * 5.1) * (alpha / 255));
  }
  return clampByte((195 - lightness) * 3.1 * (alpha / 255));
}

async function extractSignature({ source, output, ink }) {
  const input = path.join(sourceDir, source);
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    const coverage = inkCoverage(data[offset], data[offset + 1], data[offset + 2], data[offset + 3], ink);
    data[offset + 3] = coverage;
    if (coverage > 16) {
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) throw new Error(`No ${ink} ink pixels found in ${source}`);

  const padding = 7;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const width = Math.min(info.width - left, maxX - minX + 1 + padding * 2);
  const height = Math.min(info.height - top, maxY - minY + 1 + padding * 2);
  const outputPath = path.join(outputDir, output);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width, height })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath);
  console.log(`${output}: ${width}x${height}`);
}

await fs.mkdir(outputDir, { recursive: true });
for (const signature of signatures) await extractSignature(signature);
