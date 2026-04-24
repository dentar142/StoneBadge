# StoneBadge — Stone & Toilet Edition

> Per-repo unique 3D rotating SVG badge for your GitHub README. The badge color
> is seeded by your repo's latest commit SHA, so every repository gets a
> one-of-a-kind look that evolves with each commit.
>
> Fork of [professor-lee/StoneBadge](https://github.com/professor-lee/StoneBadge),
> adding a procedurally-built **toilet** model and a new `/api/toilet`
> endpoint alongside the original stone.

🇬🇧 English | [🇨🇳 中文](./README_zh.md)

---

## Two endpoints

```md
![Stone Badge](https://YOUR_DOMAIN/api/stone/<owner>/<repo>)
![Toilet Badge](https://YOUR_DOMAIN/api/toilet/<owner>/<repo>)
```

| Path | Source model | Origin |
|------|--------------|--------|
| `/api/stone/:owner/:repo` | `seatstone.glb` (binary 3D mesh) | upstream |
| `/api/toilet/:owner/:repo` | `lib/toilet-geometry.js` (Three.js primitives composed in code) | this fork |

---

## How it works in one paragraph

At build time the server uses **Three.js + JSDOM** to render the 3D model to a
20-frame stop-motion grayscale SVG (cached as `templates/*-template.svg`). At
request time **`colorizer.js`** fetches the repo's latest commit SHA via the
GitHub API, hashes the bytes into HSL parameters (hue / saturation / lightness
in safe ranges), and rewrites every `fill` to a colored version while
preserving the original 3D shading luminance — fast (~50 ms) and stateless.
The animation itself plays via SVG `<animate>` tags toggling each frame's
visibility every 0.5 s. Full algorithm in the upstream README.

---

## Quick start (local)

```bash
git clone https://github.com/dentar142/StoneBadge.git
cd StoneBadge
npm install
node server.js     # http://localhost:3000
```

On first start the server auto-generates any missing template SVGs (about
30 s for the stone, 30 s for the toilet). Manually regenerate the toilet
template after editing the geometry:

```bash
MODEL=toilet node lib/template-generator.js
```

---

## Deploy

See [DEPLOY_TOILET.md](./DEPLOY_TOILET.md). Three paths covered:

1. **Render Blueprint** — one-click, free tier; `render.yaml` is in this repo
2. **Fly.io** — always-on, region-selectable
3. **GitHub Action static** — no server at all; manual refresh for personal repos

---

## Want a different shape?

Edit `lib/toilet-geometry.js`. Everything is stock Three.js primitives:
`CylinderGeometry`, `TorusGeometry`, `BoxGeometry`. Compose, position,
re-run `MODEL=toilet node lib/template-generator.js`, commit. The render
pipeline does not care whether the source is a GLB file or a programmatic
`THREE.Group`.

---

## Credit

- Original concept, render pipeline, color algorithm:
  **[professor-lee / StoneBadge](https://github.com/professor-lee/StoneBadge)**
- Toilet model + `/api/toilet` route + Render blueprint + this README:
  this fork

MIT License.
