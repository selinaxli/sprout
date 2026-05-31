# Sprout — Focus Timer

A tiny, always-on-top frosted-glass focus timer for Mac. Built with Electron.

## What it is

A thin floating bar that sits above all your windows. You type a task, set a time, and hit Start. A kawaii plant grows out of its pot over the duration, a pie-chart counts down, and every 5–7 minutes a cute cat wanders across the bar with a meow. When time's up it asks "Did you finish?" — Yes rains confetti, No lets you add more time.

## Running the app

```bash
npx electron .
```

## Building a distributable .app

```bash
npx electron-builder --mac
```

Output lands in `dist/`. Drag `Sprout.app` to `/Applications`.

## Project structure

```
main.js          — Electron main process (window, IPC, width persistence)
preload.js       — Context bridge: exposes sprout.resize() to the renderer
index.html       — UI markup (idle / running / finished rows)
styles.css       — All styling: frosted glass, cat lane, plant stage, animations
app.js           — Timer logic, cat visits, confetti, sounds, settings
cats.js          — 8 cat colours × 3 poses; returns <img> HTML strings
plants.js        — 20 kawaii plants; draw(p) reveals plant from pot upward via clip-path
assets/
  icon.png       — 1024×1024 app icon
  icon.icns      — macOS icon bundle (for electron-builder)
  plants/        — 20 plant PNGs (160×160, transparent bg)
  cats/          — 24 cat PNGs: {colour}_{walk|sit|stretch}.png
  meows/
    processed/   — 5 approved meow WAV files
crop_assets.py   — Re-crops plants/cats from reference grids (run if art changes)
gallery.html     — Local preview of all 44 assets
preview-server.js — Static file server for gallery.html (port 5179)
```

## Key design decisions

- **No native vibrancy** — `transparent: true` + CSS `backdrop-filter` only. Avoids dark-corner fringe from native vibrancy on frameless windows.
- **Always-on-top level** — `'floating'` + `setVisibleOnAllWorkspaces(true)` so it stays visible on every Space and in fullscreen.
- **Width persistence** — saved to `prefs.json` in Electron's userData dir; loaded at startup.
- **Plant growth** — full-size PNG always rendered; `clip-path: inset(top% 0 0 0)` reveals from bottom (pot first) as `p` goes 0→1.
- **Cat animation** — 3-pose PNGs (walk/sit/stretch), orchestrated with JS timers. No SVG leg-stepping; a gentle vertical bob animates walking.
- **Sounds** — 5 real meow WAVs (preloaded HTMLAudioElement) + Web Audio API synthesis for the end chime.

## States

`idle` → `running` → `finished` (with add-time sub-state). Controlled by `bar.dataset.state`.

## Cat visit timing

First visit: 5–7 min into the task. Subsequent visits: 5–7 min after each visit ends.
To test cats quickly, temporarily lower the delay in `app.js`:
```js
const delay = 3000 + Math.random() * 2000; // 3–5 seconds instead
```

## Asset pipeline

If you need to re-crop the reference grids:
```bash
python3 crop_assets.py
```
Requires: `Pillow`, `numpy`.
