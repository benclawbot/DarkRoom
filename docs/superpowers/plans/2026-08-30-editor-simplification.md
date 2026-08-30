# DarkRoom focused photo editor simplification

## Goal
Turn DarkRoom from a photo-management suite into a focused professional photo editor: open photos, edit nondestructively, move through a lightweight session strip, and export.

## Product changes
- Remove Quick / Advanced / Pro mode switching from the primary editing experience.
- Remove the AI tool surface and model-cache controls from the UI.
- Make one adjustment rail with photographic sections: Presets, Light, Color, Tone Curve, Color Mixer, Color Grading, Detail, Effects, Optics, Geometry.
- Keep dedicated interaction tools for Crop, Mask, Heal/Clone, and Retouch.
- Replace library-first navigation with a simple open-photo/open-session entry and lightweight filmstrip while editing.
- Remove culling/organizing surfaces from the default UI: albums, favorites, ratings, pick/reject, color labels, search/filter, analysis, combine and batch-management controls.
- Keep core renderer, nondestructive edit graph, RAW decoding, undo/redo, before/after, masks, heal/clone, presets, copy/paste edits, histogram and export.
- Mobile editing uses a bottom-sheet tool surface instead of a desktop-style side rail.

## Implementation approach
1. Simplify `index.html` to the editor-first shell and remove AI/storage/catalog controls.
2. Simplify editor mode logic so all photographic adjustment sections are available in one mode.
3. Strip AI and generative controls from editor rendering and event bindings.
4. Add a compact session filmstrip driven by currently opened files.
5. Reduce CSS chrome and add responsive bottom-sheet editor behavior.
6. Update documentation and tests to reflect a focused editor, not a catalog/AI product.
