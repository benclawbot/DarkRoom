"""Capture README screenshots from the bundled real-photo examples.

This intentionally imports one photo per page so documentation never falls back to
the synthetic geometry used by the browser regression fixtures.
"""
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from browser_ux import ROOT, boot


OUT = ROOT / "docs" / "assets"
TMP = ROOT / "test-output" / "readme-captures"
PHOTOS = ROOT / "docs" / "assets" / "examples"


def wait_for_library(page):
    page.wait_for_function("document.querySelectorAll('.photo-card').length===1", timeout=15000)
    page.wait_for_function("document.querySelector('.photo-card img')?.naturalWidth>0", timeout=10000)
    page.wait_for_timeout(1200)


def page_with_photo(browser, filename, viewport):
    context = browser.new_context(viewport=viewport, service_workers="block")
    page = context.new_page()
    boot(page)
    page.set_input_files("#fileInput", str(PHOTOS / filename))
    wait_for_library(page)
    return context, page


def save_capture(page, name, full_page=True):
    png = TMP / f"{name}.png"
    webp = OUT / f"{name}.webp"
    page.wait_for_timeout(750)
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    page.screenshot(path=str(png), full_page=full_page)
    with Image.open(png) as image:
        image.convert("RGB").save(webp, "WEBP", quality=92, method=6)


def open_editor(page, mode="pro"):
    page.locator(".photo-card").first.click()
    page.wait_for_selector("#editor:not(.hidden)")
    page.wait_for_function("document.querySelector('#editorCanvas').width>10 && !document.querySelector('#editorCanvas').hasAttribute('aria-busy')")
    page.click(f'[data-mode="{mode}"]')
    page.click('[data-tool-toggle="edit"]')
    page.wait_for_function("""()=>{const c=document.querySelector('#editorCanvas');if(!c||c.width<10)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let sum=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))sum+=d[i]+d[i+1]+d[i+2];return sum/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3>5}""", timeout=15000)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        launch = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if Path("/usr/bin/chromium").exists():
            launch["executable_path"] = "/usr/bin/chromium"
        browser = playwright.chromium.launch(**launch)

        context, page = page_with_photo(browser, "mountain-sunset.jpg", {"width": 1440, "height": 900})
        save_capture(page, "library-desktop")
        context.close()

        context, page = page_with_photo(browser, "race-car.jpg", {"width": 1440, "height": 900})
        open_editor(page, "pro")
        save_capture(page, "editor-desktop", full_page=False)
        context.close()

        context, page = page_with_photo(browser, "white-dunes.jpg", {"width": 390, "height": 844})
        open_editor(page, "advanced")
        save_capture(page, "editor-mobile", full_page=False)
        context.close()

        context, page = page_with_photo(browser, "mountain-sunset.jpg", {"width": 1440, "height": 900})
        page.click("#selectPhotosBtn")
        page.locator(".photo-card").first.click()
        page.wait_for_timeout(500)
        save_capture(page, "compare-desktop")
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
