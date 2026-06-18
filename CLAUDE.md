# Sprout — Focus Timer

A tiny, always-on-top frosted-glass focus timer for Mac. Built with Electron.

## What it is

A thin floating bar that sits above all your windows. You type a task, set a time, and hit Start. A kawaii plant grows out of its pot over the duration, a pie-chart counts down, and every 5–7 minutes a cute cat wanders across the bar with a meow. When time's up it asks "Did you finish?" — Yes rains confetti, No lets you add more time.

## Running the app (dev)

```bash
npm start        # or: npx electron .
```

> Heads-up: dev runs register a throwaway copy of Electron with macOS
> LaunchServices. See **Testing gotchas** below — for day-to-day use, run the
> built `/Applications/Sprout.app`, not the dev command.

## Building a distributable app

```bash
npx electron-builder --mac          # signed .dmg (arm64 + x64) in dist/
npx electron-builder --mac --dir    # fast, unsigned Sprout.app in dist/mac-arm64/ (for testing)
```

Install by copying the built app to `/Applications`:

```bash
cp -R dist/mac-arm64/Sprout.app /Applications/
xattr -cr /Applications/Sprout.app
```

## Project structure

```
main.js           — Electron main process (window, Dock menu, app menu, IPC, width persistence)
preload.js        — Context bridge: exposes sprout.resize() to the renderer
index.html        — UI markup (idle / running / finished rows, resize grips)
styles.css        — All styling: frosted glass, cat lane, plant stage, resize grips, animations
app.js            — Timer logic, cat visits, confetti, sounds, settings
cats.js           — 8 cat colours × 3 poses; returns <img> HTML strings
plants.js         — 20 kawaii plants; draw(p) reveals plant from pot upward via clip-path
gallery.html      — Local preview of all 44 assets (plants + cats)
preview-server.js — Static file server for the UI / gallery (port 5179)
crop_assets.py    — Re-crops plant/cat PNGs from the reference grids
process_meows.py  — Trims/denoises/normalizes raw meows into assets/meows/processed/
make_icon.py      — Generates icon.icns from icon.png
assets/
  icon.png            — 1024×1024 app icon
  icon.icns           — macOS icon bundle (for electron-builder)
  plants/             — 20 plant PNGs (160×160, transparent bg, bottom-anchored pot)
  cats/               — 24 cat PNGs: {colour}_{walk|sit|stretch}.png
  plants-reference.png, cats-reference.png — source grids for crop_assets.py
  meows/              — raw source recordings (mp3/wav)
  meows/processed/    — 5 approved meow WAVs used at runtime
```

## Key design decisions

- **No native vibrancy** — `transparent: true` + CSS `backdrop-filter` only. Avoids dark-corner fringe from native vibrancy on frameless windows.
- **Always-on-top, all Spaces** — `setAlwaysOnTop(true, 'floating')` + `setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true })`. The `skipTransformProcessType` flag is **critical**: without it, `setVisibleOnAllWorkspaces` demotes the process to an *accessory* app, which removes the Dock running dot and the Dock right-click Quit. Tradeoff: the bar no longer floats over apps in **native macOS fullscreen** (it still floats over normal/maximized windows).
- **Dock = normal app** — `app.setActivationPolicy('regular')` (running dot), `app.dock.setMenu(...)` (right-click → Show Sprout / Quit Sprout), and `Menu.setApplicationMenu(...)` (menu bar reads "Sprout" with ⌘Q + Edit for copy/paste).
- **Width persistence** — saved (debounced) to `prefs.json` in Electron's userData dir; loaded at startup. Drag either edge of the bar to resize (grips fade in on hover).
- **Plant growth** — full-size PNG always rendered, pot anchored to the bottom; `clip-path: inset(top% 0 0 0)` reveals it from the bottom up (pot first) as `p` goes 0→1.
- **Cat animation** — 3-pose PNGs (walk/sit/stretch), orchestrated with JS timers in app.js (`runCat`). Walking is currently a gentle vertical bob on the static walk PNG. *A true layered leg/body walk cycle is a planned improvement (pending review).*
- **Sounds** — 5 real meow WAVs (preloaded HTMLAudioElement) + Web Audio API synthesis for the end chime. All mutable; mute state persists.

## States

`idle` → `running` → `finished` (with add-time sub-state). Controlled by `bar.dataset.state`.

## Cat visit timing

First visit: 5–7 min into the task. Subsequent visits: 5–7 min after each visit ends.
To test cats quickly, lower the delay in `app.js` (`scheduleCat`), or trigger one
directly in the preview console: `runCat(true)`.

## Asset pipeline

```bash
python3 crop_assets.py    # re-crop plants/cats from the reference grids (needs Pillow, numpy)
python3 process_meows.py  # rebuild processed meows from raw recordings (needs miniaudio, scipy, soundfile)
```

`crop_assets.py` uses per-row/column ink-gap detection to isolate each plant/cat
and strip the baked-in text labels while keeping the whole subject (full pots,
uncut tails).

## Testing gotchas (macOS)

- **Quit gracefully, never `kill -9`.** Force-killing triggers macOS app-resume,
  which silently relaunches the app (looks like a "stray" reappearing). Use ⌘Q or
  `osascript -e 'tell application id "com.sprout.focus" to quit'`.
- **Blank "Electron" windows.** Repeated `npx electron .` runs register dev copies
  of Electron in LaunchServices; macOS can then co-launch a blank Electron welcome
  window. Clean them up:
  ```bash
  LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
  "$LSREG" -u /path/to/node_modules/electron/dist/Electron.app
  "$LSREG" -gc
  ```
- For real testing, build and run `/Applications/Sprout.app` rather than the dev command.
