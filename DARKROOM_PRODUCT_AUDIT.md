# DarkRoom product audit (August 2026)

## Executive view

DarkRoom is already differentiated on privacy and breadth: local-only IndexedDB storage, nondestructive edits, RAW decoding, masks/layers, batch culling, HDR/focus/noise/panorama combine, LUTs, and optional on-device AI. The biggest gap versus leading products is workflow maturity around the image: camera ingest/tethering, catalog and metadata depth, cross-device safety, color-managed output, and professional delivery. The UX risk is that a very capable editor still presents too many concepts at once.

## Competitive benchmark

| Capability | DarkRoom today | Leading reference | Gap / implication |
|---|---|---|---|
| Library and search | Albums, filename/date/search, ratings, flags, local-only | Lightroom has cross-device cloud/local workflows and increasingly semantic search; Capture One has catalog/session workflows | Add smart collections, keyword hierarchy, saved searches, people/location/object search, and a clear catalog model. |
| Ingest and shooting | File-picker import | Capture One supports tethering, wireless tethering, next-capture adjustments and collaboration ([Capture One bundle](https://www.captureone.com/en/products/all-in-one-bundle), [mobile](https://www.captureone.com/en/products/capture-one-mobile)) | Tethering, auto-import/watch folders, camera roll/SD-card ingest, and capture naming are major missing workflow features. |
| RAW quality | Browser `libraw-wasm` decode and deterministic renderer | DxO emphasizes camera/lens-specific optical modules and DeepPRIME 3/XD3 denoise ([PhotoLab features](https://www.dxo.com/en/dxo-photolab/features/)) | Add downloadable camera profiles, lens correction database, better demosaic/high-ISO denoise, and transparent “quality vs speed” controls. |
| Masking and retouch | Strong manual/range/smart masks, heal/clone/generative fallback, portrait/depth tools | Lightroom and Capture One now emphasize refined AI masks, people parts, feather/edge control, and distraction removal ([Lightroom updates](https://lightroom.adobe.com/news), [Capture One AI masking](https://support.captureone.com/hc/en-us/articles/14055231933853-AI-Masking)) | Improve mask edge refinement, preview/selection confidence, hair/eye/skin quality, and repeatable mask presets. |
| Color and output | Curves/HSL/grading/LUT, JPEG/PNG/WebP/AVIF/TIFF, recipes; README notes EXIF is not copied | darktable highlights professional color management and GPU processing ([darktable](https://www.darktable.org/)); Capture One offers print-oriented pro workflows | Add ICC display/print profiles, soft proofing, gamut warnings, embedded profiles, EXIF/IPTC/XMP preservation, and 16-bit/linear export where feasible. |
| Multi-image work | Batch edits/export, compare, HDR/focus/noise/panorama | Capture One combines tethering, layers, AI crop, retouch and collaboration; darktable 5.6 adds batch/tiled inference and metadata propagation ([darktable 5.6](https://www.darktable.org/2026/06/darktable-5.6.0-released/)) | Add contact sheets, synced multi-view editing, stack/group management, duplicate detection, and batch progress/retry/cancel. |
| Safety and portability | Local browser storage; explicit warning that browser cleanup can remove the library | Desktop tools use filesystem catalogs, sidecars, backups, and cloud sync | Highest-risk gap: one-click backup/restore, sidecar export/import, project bundles, storage health warnings, and optional encrypted sync. |
| Ecosystem | PWA, no account/cloud, no plugin system | Adobe ecosystem and Capture One collaboration/integrations | Add open sidecar format, plugin/automation hooks, handoff to Photoshop/Affinity, and shareable edit recipes before considering accounts. |

## UX findings in the current interface

1. **The library is visually calm but under-signals the first action.** The empty state is good, but the toolbar has several icon-only controls and a large unused canvas. Make “Import → Cull → Edit → Export” the visible primary path, with a first-run sample and short guided tour.
2. **The batch bar is overloaded.** It exposes roughly twenty actions in one row. Group actions into `Organize`, `Edit`, `Analyze`, `Combine`, and `Export`, with a compact overflow menu and a persistent selection summary.
3. **Quick / Advanced / Pro is sound progressive disclosure, but discoverability is weak.** Add “Recommended next step” prompts and show why a control is hidden; remember the last-used tool and provide searchable commands.
4. **Iconography is ambiguous.** Symbols such as `≡`, `◫`, `☷`, `◌`, `✧`, and flags are not self-explanatory. Use a consistent SVG icon set, visible labels on desktop, tooltips, and keyboard shortcut hints. This also improves accessibility.
5. **Editing feedback needs stronger state communication.** Add per-operation progress, cancel/retry, “edited / synced / backed up” status, and a clear modified badge. AI and heavy renders should show estimated work and preserve responsiveness.
6. **The storage warning is correct but too late.** Put backup/export guidance beside import and show a non-blocking “local-only risk” checklist on first use. Never make users discover data-loss risk in Local Storage settings.
7. **Mobile should prioritize thumb reach and gesture clarity.** Keep the image-first layout, but use a bottom-sheet tool rail, larger 44px targets, explicit gesture hints, and a one-handed “apply / undo” affordance.

## Prioritized roadmap

### P0 — trust and simplicity

- Backup/restore library as a versioned project bundle; export/import XMP-like sidecars.
- Preserve and edit EXIF/IPTC/XMP; show exactly what export will retain.
- Replace icon-only batch toolbar with grouped actions and a command/search palette.
- Add operation progress, cancellation, undo-safe async jobs, and clear modified/backup status.

### P1 — professional workflow parity

- Watch folder and camera/SD-card ingest; capture naming templates and next-capture adjustments.
- Contact sheets, stacks, duplicate/near-duplicate detection, synced compare, and saved smart collections.
- Camera/lens profile packs, improved denoise/demosaic, ICC display/print soft proofing, gamut warnings.
- Keyword hierarchy, people/face groups (local-only), location/date facets, and batch metadata templates.

### P2 — differentiation without clutter

- Optional encrypted cross-device sync with explicit local-first controls.
- Open plugin/automation API and handoff to external editors.
- Shareable edit recipes and review links that do not upload originals by default.
- Guided “recipes” for common outcomes (social, print, portrait, night, panorama) instead of adding more top-level controls.

## Product principle

Keep DarkRoom’s strongest promise—private, local, nondestructive editing—and make the surrounding workflow dependable. A photographer should be able to import safely, find the right frame, make a good edit in three obvious steps, and export with confidence before ever seeing Pro mode.

## Recommended simple information architecture

Use four top-level jobs instead of exposing every capability equally:

`Photos` (library, search, smart collections, stacks) → `Cull` (pick/reject, ratings, contact sheet, compare) → `Edit` (Quick first, Advanced and Pro on demand) → `Deliver` (export recipes, metadata, share/backup).

Keep Albums and Storage as secondary destinations. Put AI, masks, layers, and computational merges inside Edit or Deliver rather than making them feel like separate products.

## Three user journeys to optimize

### First-time photographer

Open app → see “Add photos” and “Try sample set” → import → a short three-step coachmark explains pick/reject, edit, and export → app recommends one safe preset → export confirms format, metadata, and backup status.

### High-volume culling

Import folder/watch folder → automatic grouping by capture time → contact sheet → keyboard `P` pick, `X` reject, `1–5` rating, arrow navigation → compare only shortlisted frames → batch edit/export with visible progress.

### Mobile on-location edit

Share sheet/camera roll import → bottom-sheet Quick tools → one-tap subject/sky mask → crop preset → export/share recipe → optional “save project bundle” before leaving the location.

## Success metrics

- Time from first launch to first exported image: under 3 minutes.
- First-session backup completion: above 80%.
- Median cull decision: under 2 seconds per photo with keyboard or touch.
- Batch jobs expose progress and can be cancelled without losing edits.
- Fewer than 5 visible primary actions in any default toolbar.
