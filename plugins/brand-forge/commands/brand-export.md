---
name: brand-export
description: Export a generated SVG asset in output/ to PNG, using the optional sharp dependency if installed, or an OS-native tool otherwise.
argument-hint: <svg filename in output/> [width in px, default 1024]
---

# /brand-export

Rasterize a vector asset to PNG on demand. brand-forge ships SVG (scalable, editable,
zero-permission); PNG copies are produced here when you need them. No PNGs are stored
in the repo.

## Steps

1. Pick the source SVG from `output/` (ask if not given) and a target width (default 1024).
2. Try the built-in rasterizer:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/rasterize.mjs" output/<name>.svg output/<name>.png <width>
   ```

   This uses the optional `sharp` dependency. If it prints a "needs sharp" message,
   `sharp` isn't installed — either `npm i sharp` in the plugin, or use an OS tool below.

## OS-native fallbacks (no dependency)

- **macOS (Quick Look):**
  ```bash
  qlmanage -t -s <width> -o <output-dir> output/<name>.svg   # writes <name>.svg.png
  ```
- **Headless Chrome/Chromium** (wrap the SVG so it fills the viewport, then screenshot):
  ```bash
  printf '<!doctype html><style>html,body{margin:0}svg{width:100vw;height:100vh}</style>%s' "$(cat output/<name>.svg)" > /tmp/w.html
  "chrome" --headless=new --disable-gpu --force-device-scale-factor=2 \
    --screenshot=output/<name>.png --window-size=<w>,<h> file:///tmp/w.html
  ```
- **librsvg:**
  ```bash
  rsvg-convert -w <width> output/<name>.svg -o output/<name>.png
  ```

## Notes
- Prefer keeping the SVG as the source of truth; export PNG for platforms that need raster.
- Fonts render with whatever is installed on the machine doing the rasterization; if a
  brand font is missing, the declared fallback applies (flag the substitution).
