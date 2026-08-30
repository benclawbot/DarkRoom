# DarkRoom

DarkRoom is a focused, local-first, nondestructive photo editor for desktop and mobile browsers.

**Open a photo. Edit it. Export it.**

No account. No catalog workflow. No editing modes. No unnecessary setup between the photograph and the tools.

## What DarkRoom is

DarkRoom is built around a single professional editing workspace. The photograph stays at the center while controls remain secondary and appear only when needed.

- **One editor** — no Quick, Advanced, or Pro modes.
- **Nondestructive editing** — the original file is never modified.
- **Local-first** — photos and edit metadata stay in browser-managed storage on the current device.
- **Direct manipulation** — crop, masks, healing, zoom, pan, and comparison happen on the image.
- **Consistent output** — preview and export use the same rendering pipeline.

## Workflow

1. Open one or more photographs.
2. Edit with Adjust, Crop, Mask, Heal, and Retouch.
3. Compare with the original when needed.
4. Export the finished image.

When several photographs are open, DarkRoom shows a lightweight filmstrip for navigation. It is not a catalog or culling system.

## Editing tools

### Adjust

Global photographic controls include:

- Exposure, Contrast, Highlights, Shadows, Whites, Blacks
- Temperature, Tint, Vibrance, Saturation
- Tone Curve
- Eight-band Color Mixer
- Shadow, midtone, and highlight Color Grading
- Texture, Clarity, Dehaze
- Vignette and Grain
- Sharpening, Noise Reduction, Deblur, and artifact controls
- Lens correction and defringe
- Perspective and geometry adjustments
- Built-in and custom presets
- `.cube` 3D LUT import with adjustable strength

### Crop

- Free repositioning
- Common aspect ratios
- Straighten
- Rotate and flip
- Horizontal and vertical geometry
- Scale and X/Y offset
- Rule of Thirds, Golden Ratio, and diagonal guides

### Mask

Manual nondestructive local adjustments include:

- Brush
- Linear Gradient
- Radial Gradient
- Luminance Range
- Color Range
- Hue and parametric ranges
- Dodge and Burn
- Add, Subtract, and Intersect
- Invert, Feather, Flow, Density, and Opacity
- Local Light, Color, Detail, and texture adjustments

### Heal

- **Heal** blends nearby pixels into a painted region.
- **Clone** copies pixels from an adjustable offset source.

Both remain editable and removable.

### Retouch

Focused portrait and restoration controls are available without introducing a separate editing mode or workspace.

## Tone Curve

The point curve is directly editable:

- Click to add a point.
- Drag to adjust it.
- Double-click an interior point to remove it.
- Numeric tonal controls stay synchronized with the curve.

## Before / After

DarkRoom provides several fast comparison methods:

- **Before / After** toggles the original view.
- **Split** provides a draggable comparison.
- Hold **`\`** to temporarily show the original and release it to return to the edit.

Useful shortcuts:

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + 0` | Reset zoom |
| `F` | Picture-only fullscreen |
| `O` | Toggle mask overlay |
| `Left / Right Arrow` | Previous / next photo |
| Mouse wheel / pinch | Zoom |
| Drag | Pan |

## Multiple photographs

Opening several files creates a session filmstrip below the photograph.

- Click a thumbnail to switch photos.
- Use Left / Right Arrow to move through the session.
- Each photograph keeps its own nondestructive edits.
- Copy / Paste can transfer editing settings between photographs.

DarkRoom deliberately does not include albums, favorites, star ratings, pick/reject flags, color labels, search filters, culling modes, quality scoring, or multi-image merge workflows.

## RAW support

DarkRoom can decode common RAW formats in the browser through `libraw-wasm` where supported.

Detected extensions include DNG, CR2, CR3, NEF, NRW, ARW, SRF, SR2, RAF, ORF, RW2, PEF, RWL, 3FR, FFF, IIQ, MOS, MRW, and X3F.

RAW decoding stays local. Rendering may differ from proprietary camera-processing software.

## Export

The export sheet supports:

- JPEG
- PNG
- WebP
- AVIF when supported by the browser
- Baseline TIFF
- Quality control
- Optional long-edge resize
- Output sharpening for screen or print

Preview and export evaluate the same edit graph.

## Mobile

On smaller screens, the editing controls become a bottom sheet so the photograph remains the primary surface.

- Full-width image preview
- Five primary editing tools within thumb reach
- Collapsible control panel
- Pinch zoom and pan
- Synchronized overlays and preview transforms

## Privacy and storage

DarkRoom has no account system and no DarkRoom cloud photo storage. Originals and edit metadata are stored in browser-managed storage on the current device.

Browser storage is **not a backup**. Clearing site data, browser cleanup, origin changes, or storage eviction can remove locally stored photographs. Keep important originals and finished exports outside DarkRoom.

## Architecture

DarkRoom remains framework-light:

```text
index.html
├── engine-core.js       pixel, mask, heal, and image algorithms
├── raw-runtime.js       optional RAW decoding
├── core.js              storage, edit defaults, and import
├── library.js           lightweight photo session
├── renderer.js          nondestructive preview/export graph
├── editor.js            editing engine and interactions
├── focused-editor.js    focused editing surface
├── app.js               application bindings
├── styles.css           base editor styles
├── focused-editor.css   desktop/mobile workspace
└── sw.js                offline application shell
```

The central rule is simple: **the renderer owns image output**. Controls update the edit graph; preview and export evaluate that same graph.

## Run locally

Any static HTTP server is enough:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Tests

Run static and engine checks:

```bash
npm test
```

Run the focused browser workflow:

```bash
npm run test:browser
```

Run everything:

```bash
npm run test:all
```

## Deployment

DarkRoom is a static application and can be deployed to Vercel or any static host.

CI validates the editing engine and a Chromium workflow covering open → adjust → crop → mask → heal → compare → export, including the mobile bottom-sheet layout.
