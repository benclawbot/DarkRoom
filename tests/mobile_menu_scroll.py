from pathlib import Path
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import contextlib, os, threading

ROOT = Path(__file__).resolve().parents[1]


def sample_png():
    image = Image.new('RGB', (960, 640), (50, 80, 110))
    bio = BytesIO()
    image.save(bio, 'PNG')
    return bio.getvalue()


@contextlib.contextmanager
def serve():
    old = os.getcwd()
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/'
    finally:
        server.shutdown()
        thread.join(timeout=2)
        os.chdir(old)


def main():
    with serve() as url, sync_playwright() as p:
        launch = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'):
            launch['executable_path'] = '/usr/bin/chromium'
        browser = p.chromium.launch(**launch)
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True,
            service_workers='block',
        )
        page = context.new_page()
        page.goto(url, wait_until='networkidle')
        page.set_input_files('#fileInput', {
            'name': 'mobile.png',
            'mimeType': 'image/png',
            'buffer': sample_png(),
        })
        page.wait_for_function("currentPhoto && document.querySelector('#editorCanvas').width > 20", timeout=15000)
        page.locator('#editorEmptyPicker').wait_for(state='hidden', timeout=15000)

        page.click('[data-tool-toggle="edit"]')
        body = page.locator('.focused-tools .tool-section.open .tool-section-body')
        body.wait_for(state='visible')

        metrics = body.evaluate("el => ({clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, overflowY: getComputedStyle(el).overflowY, position: getComputedStyle(el).position, top: getComputedStyle(el).top, bottom: getComputedStyle(el).bottom})")
        assert metrics['position'] == 'absolute', metrics
        assert metrics['overflowY'] in ('scroll', 'auto'), metrics
        assert metrics['scrollHeight'] > metrics['clientHeight'], metrics

        body.evaluate("el => { el.scrollTop = Math.min(180, el.scrollHeight - el.clientHeight); }")
        page.wait_for_timeout(100)
        assert body.evaluate('el => el.scrollTop') > 0

        context.close()
        browser.close()


if __name__ == '__main__':
    main()
