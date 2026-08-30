# DarkRoom

**DarkRoom is a focused, local-first, nondestructive photo editor for desktop and mobile browsers.**

The product is deliberately narrow: **open a photograph, edit it, export it.** It does not require an account, upload originals to a DarkRoom server, or ask photographers to work through a catalog, culling system, editing mode hierarchy, or assistant.

## Product principles

- **Photo first.** The photograph occupies the workspace; controls stay secondary.
- **One editor.** There is no Quick / Advanced / Pro choice. Professional controls are available through progressive disclosure in one interface.
- **Nondestructive.** Originals remain untouched; edits are stored as parameters, masks, and operations.
- **Local first.** Imported originals and edits stay in browser-managed local storage on the current device.
- **Minimal workflow.** Open → Adjust → Export.
- **Direct manipulation.** Crop, masks, healing, zoom, pan, and before/after are designed around the image rather than configuration screens.
- **One renderer.** Preview and export evaluate the same editing graph.

## Editing workspace

The right-hand editor has five jobs:

1. **Adjust** — presets, Light, Color, Tone Curve, Color Mixer, Color Grading, Detail, Effects, Optics, Geometry, and LUT/film looks.
2. **Crop** — crop ratios, straighten, rotate, flip, reposition, composition guides, and perspective geometry.
3. **Mask** — brush, linear gradient, radial gradient, luminance range, color range, hue range, dodge, and burn.
4. **Heal** — heal and clone painting.
5. **Retouch** — restrained portrait and restoration controls.

Only one tool is active at a time. Within a tool, sections expand only when needed.

## Professional editing controls

### Light

- Exposure
- Contrast
- Highlights
- Shadows
- Whites
- Blacks
- Gamma / midtone processing

### Color

- Temperature / Tint
- Vibrance / Saturation
- RGB/HSL-aware transformations
- Eight-band Color Mixer
- Shadow / midtone / highlight color grading

### Tone Curve

- Smooth point curve
- Click to add points
- Drag to edit
- Double-click an interior point to remove it
- Precise numeric tonal controls remain synchronized with the curve

### Detail and effects

- Texture
- Clarity
- Dehaze
- Vignette
- Grain
- Sharpening
- Noise reduction
- Deblur / artifact reduction controls

### Optics and geometry

- Lens correction and defringe controls
- Straighten
- Rotate / flip
- Horizontal / vertical geometry
- Aspect and scale
- X/Y offset
- Composition guides

### LUTs and presets

- Built-in photographic presets
- Save reusable local presets
- Import `.cube` 3D LUT files
- Adjustable LUT strength

## Local editing

DarkRoom supports manual, nondestructive local adjustments:

- Brush
- Linear gradient
- Radial gradient
- Luminance range
- Color range
- Hue / parametric ranges
- Add / subtract / intersect components
- Mask invert, feather, flow, density, and opacity
- Local Light, Color, Detail, and texture controls
- Dodge and Burn

## Heal and clone

Healing is intentionally simple:

- **Heal** blends nearby pixels into the painted region.
- **Clone** copies pixels from an adjustable offset source.

Both are stored nondestructively and can be removed later.

## Working with several photographs

Opening multiple files creates a lightweight **session filmstrip** below the photograph. It is navigation, not a catalog.

- Click a thumbnail to move between photographs.
- Use Left / Right Arrow to move through the session.
- Each photograph keeps its own nondestructive edits.
- Copy / Paste transfers editing settings between photographs.

The landing screen only keeps a simple list of locally opened photographs so work can be resumed. There are no albums, favorites, star ratings, pick/reject flags, color labels, culling modes, quality analysis, or multi-image merge workflows.

## Before / after and navigation

- **Before / After** button toggles the original view.
- **Split** provides a draggable before/after comparison.
- Hold **`\`** to temporarily see the original; release to return to the edit.
- `Ctrl/Cmd + Z` — Undo
- `Ctrl/Cmd + Shift + Z` — Redo
- `Ctrl/Cmd + 0` — Reset zoom
- `F` — Picture-only fullscreen
- `O` — Toggle mask overlay
- Mouse wheel / pinch — Zoom
- Drag — Pan

## RAW support

DarkRoom detects common RAW extensions and can decode them in-browser through `libraw-wasm` where supported.

Detected extensions include DNG, CR2/CR3, NEF/NRW, ARW/SRF/SR2, RAF, ORF, RW2, PEF, RWL, 3FR, FFF, IIQ, MOS, MRW, and X3F.

RAW decoding is local. Browser rendering will not exactly match proprietary camera pipelines.

## Export

Export is presented as one compact sheet:

- JPEG
- PNG
- WebP
- AVIF where supported by the browser
- Baseline TIFF
- Quality
- Optional long-edge resize
- Output sharpening for screen or print

Preview and export use the same editing renderer.

## Mobile

On small screens the editing panel becomes a bottom sheet:

- The photograph remains full-width.
- The five tools stay within thumb reach.
- The panel can be collapsed to maximize the photograph.
- Pinch zoom and pan continue to operate on the visible preview and overlays together.

## Privacy and storage

DarkRoom has no account system and no DarkRoom cloud photo storage. Originals and edit metadata are stored in browser-managed storage on the current device.

Browser storage is **not a filesystem backup**. Clearing site data, changing origin, browser cleanup, or storage eviction can remove locally stored photographs. Export important originals and finished work outside DarkRoom.

## Architecture

DarkRoom remains framework-light:

```text
index.html
├── engine-core.js       deterministic pixel, mask, heal and image algorithms
├── raw-runtime.js       optional RAW decoding
├── core.js              local storage, edit defaults, import
├── library.js           lightweight recent-photo session
├── renderer.js          shared nondestructive preview/export graph
├── editor.js            base editing engine and interactions
├── focused-editor.js    focused professional editing surface
├── app.js               focused application bindings
├── styles.css           base renderer/editor styles
├── focused-editor.css   focused desktop/mobile workspace
└── sw.js                offline application shell
```

The central invariant is unchanged: **the renderer owns image output**. Controls update the edit graph; preview and export evaluate the same graph.

## Run locally

Any static HTTP server is enough:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Tests

Static, editing-engine, and focused-product checks:

```bash
npm test
```

Focused browser workflow:

```bash
npm run test:browser
```

Full suite:

```bash
npm run test:all
```

## Deployment

DarkRoom is a static application and can be deployed to Vercel or another static host. Pull requests run static/engine checks and a Chromium workflow covering open → edit → crop → mask → heal → compare → export plus the mobile bottom-sheet layout.
