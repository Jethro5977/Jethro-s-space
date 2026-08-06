<p align="center">
  <img src="assets/card-builder-lockup.png" alt="Card Builder" width="600">
</p>

<h3 align="center">DIY 3D Trading Card Studio</h3>

<p align="center">
  Design, customize, and collect NBA-style trading cards with real-time 3D preview.
  <br>
  <a href="https://cardsbuilder.netlify.app"><strong>Live Demo &rarr;</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node 18+">
  <img src="https://img.shields.io/badge/zero_dependencies-yes-brightgreen" alt="Zero Dependencies">
</p>

---

## Features

**Card Design** — 6 original card series (Prizm, Tactical, Heritage, Mosaic, Select, Optic) with 8 dynamic effects (Diamond, Lightning, Rainbow, Crystal, Holographic, Laser, Flame, Galaxy). Cutout and Full Art photo modes, team colorways, badges, rarity tiers, and 7 slab/case types.

**3D Preview** — Three.js WebGL renderer with PBR acrylic slab, environment reflections, iridescence, and procedural scratches. 360° orbit controls, auto-rotate, front/back flip, and mouse-reactive foil effects.

**Card Library** — Collect up to 200 cards locally. Filter by rarity, series, case type, and favorites. One-click auto-build fills your collection with 25 NBA stars (2025-26 season data). Pack-opening experience with drag-to-tear and rare card reveals.

**Shared Library** — Publish cards for anyone to browse — no accounts needed. Featured showcase card visible to all visitors.

**Export** — High-res PNG export (1500×2100 card face, 2400×3200 3D scene), front/back composite, and project JSON import/export with full signature and foil mask data.

**DIY Tools** — Hand-drawn signatures (4 colors, position/scale controls), custom foil masks with adjustable brush, card comparison PK mode, and 20 collection achievements.

## Quick Start

```bash
git clone https://github.com/Jethro5977/Jethro-s-space.git card-builder
cd card-builder
npm install
npm start
```

Open **http://127.0.0.1:4174/** in your browser. Do not open `index.html` via `file://` — Three.js modules require HTTP.

The dev server (`server/shared-server.mjs`) is a zero-dependency Node static server with a shared card library API. Other devices on your LAN can access it at `http://<your-ip>:4174/`.

## Project Structure

```
card-builder/
├── index.html              # Main page
├── app.js                  # Card engine: rendering, effects, library, export
├── styles.css              # All styles and effect animations
├── three-preview.js        # Three.js 3D slab preview
├── shared-library.js       # Shared library frontend logic
├── server/
│   ├── shared-server.mjs   # Node HTTP server + shared library API
│   └── featured-card.json  # Featured showcase card data
├── assets/                 # Logos, icons, player images, signatures
├── scripts/
│   ├── audit-player-data.mjs   # Verify player data against NBA/ESPN
│   └── verify-shared.sh        # Shared library API smoke test
├── data/
│   └── player-registry.json    # NBA player database
├── docs/                   # Product specs and design docs
├── _headers                # Netlify security headers (CSP, etc.)
└── CHANGELOG.md            # Version history
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the dev server on port 4174 |
| `npm run check` | Syntax-check all JS files |
| `npm run verify` | Smoke-test the shared library API (server must be running) |
| `npm run audit:players` | Verify player names and headshot URLs against NBA/ESPN |

## Tech Stack

Pure web — zero runtime dependencies.

- **Frontend**: Vanilla JS, CSS custom properties, Canvas 2D export
- **3D**: Three.js (ES modules via CDN) with PBR materials
- **Server**: Node.js built-in `http` module (no Express, no frameworks)
- **Storage**: localStorage + IndexedDB for image offloading
- **Hosting**: Netlify (static + `_headers` for CSP)

## Data Sources

Player stats are based on the **2025-26 NBA regular season**. Player headshots are fetched from the NBA CDN with ESPN fallback. Team logos use NBA primary with ESPN fallback. All assets are downsampled and stored locally as data URLs after first load.

## License

MIT &copy; 2026 Jethro

## Credits

Developed by **Jethro** — Built with [Claude](https://claude.ai)
