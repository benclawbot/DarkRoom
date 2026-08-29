from pathlib import Path
import os
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))
from browser_ux import boot, sample_png


def main():
    with sync_playwright() as p:
        launch = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'):
            launch['executable_path'] = '/usr/bin/chromium'
        browser = p.chromium.launch(**launch)
        context = browser.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block')
        page = context.new_page()
        boot(page)
        page.set_input_files('#fileInput', {'name': 'perf.png', 'mimeType': 'image/png', 'buffer': sample_png(4, 1800, 1200)})
        page.wait_for_function("document.querySelectorAll('.photo-card').length===1")
        page.locator('.photo-card').first.click()
        page.wait_for_function("currentPhoto && document.querySelector('#editorCanvas').width>1")
        page.evaluate("""()=>{
            window.__darkroomDecodeCount=0;
            const original=window.decodeImage;
            window.decodeImage=async(...args)=>{window.__darkroomDecodeCount++;return original(...args)};
        }""")
        samples = page.evaluate("""async()=>{
            const canvas=document.querySelector('#editorCanvas'),times=[];
            for(const value of [8,16,24]){
                currentPhoto.edits.exposure=value;
                const started=performance.now();
                await renderCanvas(canvas);
                times.push(performance.now()-started);
            }
            return {times,decodeCount:window.__darkroomDecodeCount};
        }""")
        assert samples['decodeCount'] <= 1, f"preview should reuse decoded source: {samples}"
        assert max(samples['times']) < 750, f"preview interaction exceeded 750ms: {samples}"
        print(f"Render performance test passed: decode reuse={samples['decodeCount']}, render samples={[round(x, 1) for x in samples['times']]}ms")
        browser.close()


if __name__ == '__main__':
    main()
