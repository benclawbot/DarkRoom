from io import BytesIO
from pathlib import Path
import os

from PIL import Image
from playwright.sync_api import sync_playwright

from browser_ux import boot


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures" / "photos"
NAMES = ["photo-1.jpg", "photo-2.jpg", "photo-3.jpg"]


def canvas_stats(page):
    return page.evaluate(
        """
        () => {
          const c = document.querySelector('#editorCanvas');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          const step = Math.max(4, Math.floor(d.length / 4000 / 4) * 4);
          let sum = 0, colorful = 0, count = 0;
          for (let i = 0; i < d.length; i += step) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            sum += r + g + b;
            colorful += (r + g + b > 36) ? 1 : 0;
            count++;
          }
          return { average: sum / Math.max(1, count) / 3, content: colorful / Math.max(1, count) };
        }
        """
    )


def screenshot_stats(blob):
    image = Image.open(BytesIO(blob)).convert("RGB")
    pixels = list(image.getdata())
    content = sum(1 for r, g, b in pixels if r + g + b > 36)
    mean = sum(r + g + b for r, g, b in pixels) / max(1, len(pixels)) / 3
    return mean, content / max(1, len(pixels))


def open_photo(page, name):
    card = page.locator(".photo-card").filter(has=page.locator(f'img[alt="{name}"]'))
    assert card.count() == 1, f"Missing library card for {name}"
    card.click()
    page.wait_for_selector("#editor:not(.hidden)")
    page.wait_for_function(
        "document.querySelector('#editorCanvas')?.width>10 && !document.querySelector('#editorCanvas')?.hasAttribute('aria-busy')",
        timeout=15000,
    )
    page.wait_for_timeout(150)


def close_editor(page):
    page.click("#closeEditor")
    page.wait_for_function("document.querySelector('#editor').classList.contains('hidden')")


def check_visible_photo(page, name, label):
    stats = canvas_stats(page)
    assert stats["average"] > 5 and stats["content"] > 0.01, f"{label} canvas is blank for {name}: {stats}"
    fallback = page.locator("#editorFallbackImage").evaluate("el => getComputedStyle(el).backgroundImage")
    assert "blob:" in (fallback or ""), f"{label} compositor fallback is missing for {name}: {fallback}"
    stage_mean, stage_content = screenshot_stats(page.locator("#photoViewport").screenshot())
    assert stage_content > 0.01, f"{label} screenshot is blank for {name}: mean={stage_mean} content={stage_content}"
    histogram = page.evaluate(
        """
        () => {
          const c = document.querySelector('#histogramCanvas');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 16) n += d[i] + d[i + 1] + d[i + 2];
          return n;
        }
        """
    )
    assert histogram > 0, f"{label} histogram did not render for {name}"
    return {"canvas": stats, "stage": {"mean": stage_mean, "content": stage_content}}


def run_desktop_interactions(page):
    page.click('[data-mode="advanced"]')
    if "open" not in (page.locator('[data-tool-section="edit"]').get_attribute("class") or ""):
        page.click('[data-tool-toggle="edit"]')
    if not page.locator('[data-section="light"] .accordion-body').is_visible():
        page.locator('[data-section="light"] .accordion-head').click()

    exposure = page.locator('[data-edit="exposure"]').first
    exposure.evaluate("(el) => { el.value = '28'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }")
    assert page.evaluate("currentPhoto.edits.exposure === 28")
    saturation = page.locator('[data-edit="saturation"]').first
    saturation.evaluate("(el) => { el.value = '-100'; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }")
    assert page.evaluate("currentPhoto.edits.saturation === -100")

    if not page.locator('[data-section="curves"] .accordion-body').is_visible():
        page.locator('[data-section="curves"] .accordion-head').click()
    curve = page.locator("#toneCurveCanvas")
    assert curve.is_visible() and (curve.bounding_box() or {}).get("width", 0) > 200
    box = curve.bounding_box()
    page.mouse.click(box["x"] + box["width"] * 0.62, box["y"] + box["height"] * 0.28)
    page.wait_for_timeout(100)
    assert page.evaluate("currentPhoto.edits.curvePoints.length >= 1")
    page.click("#resetToneCurve")
    page.wait_for_timeout(100)
    assert page.evaluate("currentPhoto.edits.curvePoints.length === 0 && currentPhoto.edits.curveMidtones === 0")

    page.click('[data-tool-toggle="masks"]')
    page.click('[data-mask-new="brush"]')
    canvas_box = page.locator("#editorCanvas").bounding_box()
    page.mouse.move(canvas_box["x"] + canvas_box["width"] * 0.4, canvas_box["y"] + canvas_box["height"] * 0.4)
    page.mouse.down()
    page.mouse.move(canvas_box["x"] + canvas_box["width"] * 0.6, canvas_box["y"] + canvas_box["height"] * 0.55, steps=5)
    page.mouse.up()
    page.wait_for_timeout(80)
    assert page.evaluate("currentPhoto.localEdits.some(m => m.strokes?.length >= 1)")

    page.click('[data-tool-toggle="heal"]')
    page.click("#newHeal")
    canvas_box = page.locator("#editorCanvas").bounding_box()
    page.mouse.move(canvas_box["x"] + canvas_box["width"] * 0.7, canvas_box["y"] + canvas_box["height"] * 0.5)
    page.mouse.down()
    page.mouse.move(canvas_box["x"] + canvas_box["width"] * 0.74, canvas_box["y"] + canvas_box["height"] * 0.54, steps=3)
    page.mouse.up()
    assert page.evaluate("currentPhoto.healOps.some(o => o.strokes?.length >= 1)")

    page.click('[data-tool-toggle="transform"]')
    if not page.locator("#autoCrop").is_visible():
        page.locator('[data-section="crop"] .accordion-head').click()
    page.click("#autoCrop")
    page.wait_for_timeout(250)
    assert page.evaluate("currentPhoto.edits.cropZoom >= 100")

    page.click('[data-mode="pro"]')
    page.click('[data-tool-toggle="layers"]')
    if page.locator("#newAdjustmentLayer").is_visible():
        page.click("#newAdjustmentLayer")
        assert page.evaluate("currentPhoto.adjustmentLayers.length >= 1")


def main():
    out = ROOT / "test-output" / "supplied-images"
    out.mkdir(parents=True, exist_ok=True)
    results = {"desktop": {}, "mobile": {}}
    with sync_playwright() as playwright:
        launch = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.path.exists("/usr/bin/chromium"):
            launch["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**launch)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        boot(page)
        files = [{"name": name, "mimeType": "image/jpeg", "buffer": (FIXTURES / name).read_bytes()} for name in NAMES]
        page.set_input_files("#fileInput", files)
        page.wait_for_function("document.querySelectorAll('.photo-card').length === 3", timeout=15000)
        assert page.evaluate("photos.length === 3 && photos.every(p => !!p.thumbnailBlob)")

        for name in NAMES:
            open_photo(page, name)
            results["desktop"][name] = check_visible_photo(page, name, "desktop")
            if name == NAMES[0]:
                run_desktop_interactions(page)
            close_editor(page)

        page.set_viewport_size({"width": 390, "height": 844})
        for name in NAMES:
            open_photo(page, name)
            geometry = page.evaluate(
                """
                () => {
                  const photo = document.querySelector('#photoViewport').getBoundingClientRect();
                  const tools = document.querySelector('.editor-panel').getBoundingClientRect();
                  return {photoRight: photo.right, toolsLeft: tools.left, toolsWidth: tools.width};
                }
                """
            )
            assert geometry["toolsLeft"] >= geometry["photoRight"] - 2 and geometry["toolsWidth"] > 120, geometry
            results["mobile"][name] = check_visible_photo(page, name, "mobile")
            close_editor(page)

        page.on("dialog", lambda dialog: dialog.accept())
        page.click("#selectPhotosBtn")
        page.locator(".photo-card").first.click()
        page.click("#batchDelete")
        page.wait_for_function("photos.length === 2")
        assert page.locator(".photo-card").count() == 2
        assert not errors, errors
        print("Supplied image UX passed: 3 real JPEGs rendered and interacted with on desktop and mobile; histogram, tone curve, sliders, mask, retouch, crop, layers, and local delete verified.")
        print(results)
        browser.close()


if __name__ == "__main__":
    main()
