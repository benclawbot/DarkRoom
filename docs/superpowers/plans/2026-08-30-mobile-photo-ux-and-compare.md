# Mobile Photo UX and Pixel-Aligned Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a genuinely mobile-first photo editor and a pixel-aligned comparison view while preserving the desktop workflow.

**Architecture:** Keep the existing renderer and edit graph. Add a mobile-only interaction shell selected by viewport capability, and centralize compare rendering around one normalized viewport transform shared by both images.

**Tech Stack:** Vanilla JavaScript, HTML, CSS, Canvas, Playwright browser tests, Node static tests.

**Spec:** `DARKROOM_PRODUCT_AUDIT.md` and the approved design in the preceding conversation.

## Global Constraints

- Preserve nondestructive edits and local-only storage.
- Desktop behavior remains available at widths above 760px.
- Mobile controls use touch targets of at least 44px.
- No new dependencies.
- Every behavior change gets a regression test and a focused commit.

### Task 1: Shared pixel-aligned comparison renderer

**Files:** Modify `pro-tools.js`, `styles.css`; Test `tests/ux.mjs`, `tests/browser_ux.py`.

- [ ] Add a failing static test requiring a shared compare viewport transform and alignment state.
- [ ] Implement common fit dimensions, shared zoom/pan, and overlay/split rendering with one transform.
- [ ] Add a side-by-side toggle while defaulting to aligned split comparison.
- [ ] Verify two images with different dimensions map the same normalized point to the same screen point.
- [ ] Commit `fix: align comparison images to shared viewport`.

### Task 2: Mobile editor shell

**Files:** Modify `index.html`, `styles.css`, `editor.js`, `app.js`; Test `tests/smoke.mjs`, `tests/browser_ux.py`.

- [ ] Add mobile-only bottom dock and sheet containers.
- [ ] Route Adjust, Presets, Mask, Remove, Crop, and More into sheets without changing desktop panel markup.
- [ ] Keep image viewport full-screen behind sheets and preserve focus/fullscreen actions.
- [ ] Verify keyboard/desktop rail remains unchanged above 760px.
- [ ] Commit `feat: add mobile-first editor shell`.

### Task 3: Mobile gestures and navigation

**Files:** Modify `editor.js`, `app.js`, `styles.css`; Test `tests/mobile_zoom.py`, `tests/browser_ux.py`.

- [ ] Add hold-before/after, tap-to-hide chrome, swipe photo navigation, swipe-down close, and double-tap slider reset.
- [ ] Add touch-safe gesture arbitration so painting, sliders, and scrolling do not conflict.
- [ ] Verify gestures at 320×667, 375×812, 390×844, and 430×932.
- [ ] Commit `feat: add mobile photo gestures`.

### Task 4: Mobile culling and selection actions

**Files:** Modify `index.html`, `library.js`, `styles.css`, `app.js`; Test `tests/browser_ux.py`.

- [ ] Add long-press selection and a mobile bottom action bar.
- [ ] Add full-screen culling mode with swipe-up pick, swipe-down reject, rating actions, and compare entry.
- [ ] Keep desktop grouped batch menus intact.
- [ ] Commit `feat: add mobile culling workflow`.

### Task 5: Mobile export and accessibility polish

**Files:** Modify `index.html`, `editor.js`, `styles.css`; Test `tests/ux.mjs`, `tests/browser_ux.py`.

- [ ] Move export, metadata, copy/apply, and advanced actions into a mobile More sheet.
- [ ] Ensure labels, focus order, Escape/back handling, and 44px targets.
- [ ] Verify no horizontal overflow and no console errors.
- [ ] Commit `feat: polish mobile delivery actions`.

### Task 6: Full verification and deployment

- [ ] Run `npm test`.
- [ ] Run the browser UX suite at desktop and mobile sizes.
- [ ] Inspect screenshots for mobile editor, culling, and compare alignment.
- [ ] Push the verified commits to `main` only after all checks pass.
