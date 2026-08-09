import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = new URL("../assets/player-media/commons/", import.meta.url);

// These are deliberately limited to files with a clear Wikimedia Commons
// description page, photographer credit, and Creative Commons licence.
// The public metadata lives in data/player-media.json and docs/ASSET_ATTRIBUTIONS.md.
const candidates = [
  {
    slug: "stephen-curry-training-2017",
    source: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Stephen_Curry_Shooting_%28cropped%29_%28cropped%29.jpg",
    cropPosition: "attention",
  },
  {
    slug: "luka-doncic-game-2021",
    source: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Luka_Don%C4%8Di%C4%87_2021.jpg",
    cropPosition: "attention",
  },
  {
    slug: "giannis-antetokounmpo-game-2022",
    source: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Giannis_Antetokounmpo_%2851915153421%29.jpg",
    cropPosition: "attention",
  },
  {
    slug: "nikola-jokic-free-throw-2020",
    source: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Nikola_Jokic_free_throw_%28cropped%29.jpg",
    cropPosition: "attention",
  },
  {
    slug: "shai-gilgeous-alexander-game-2018",
    source: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Shai_Gilgeous-Alexander_2.jpg",
    cropPosition: "right",
  },
];

await fs.mkdir(outputDirectory, { recursive: true });

async function downloadSource(candidate) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(candidate.source, {
      headers: { "User-Agent": "Card-Builder-Attribution-Importer/1.0" },
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`${candidate.slug}: source download failed (${response.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw new Error(`${candidate.slug}: source download failed`);
}

for (const candidate of candidates) {
  const source = await downloadSource(candidate);
  const image = sharp(source).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) < 1200) {
    throw new Error(`${candidate.slug}: source is below the 1200px quality floor`);
  }

  const cardPath = path.join(outputDirectory.pathname, `${candidate.slug}-card.webp`);
  const thumbPath = path.join(outputDirectory.pathname, `${candidate.slug}-thumb.webp`);
  await Promise.all([
    image.clone().resize(900, 1260, { fit: "cover", position: candidate.cropPosition }).webp({ quality: 86 }).toFile(cardPath),
    image.clone().resize(360, 504, { fit: "cover", position: candidate.cropPosition }).webp({ quality: 78 }).toFile(thumbPath),
  ]);
  console.log(`✓ ${candidate.slug}: ${metadata.width}×${metadata.height}`);
}
