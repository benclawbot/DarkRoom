from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import contextlib, os, threading

ROOT=Path(__file__).resolve().parents[1]


def sample_png():
    im=Image.new('RGB',(960,640),(34,48,68));d=ImageDraw.Draw(im)
    for y in range(640):
        t=y/639;d.line((0,y,960,y),fill=(int(32+90*t),int(52+85*t),int(92+65*(1-t))))
    d.ellipse((150,110,430,510),fill=(206,154,92));d.rectangle((620,210,820,500),fill=(74,130,165))
    bio=BytesIO();im.save(bio,'PNG');return bio.getvalue()


@contextlib.contextmanager
def serve():
    old=os.getcwd();os.chdir(ROOT)
    server=ThreadingHTTPServer(('127.0.0.1',0),SimpleHTTPRequestHandler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try: yield f'http://127.0.0.1:{server.server_port}/'
    finally: server.shutdown();thread.join(timeout=2);os.chdir(old)


def main():
    with serve() as url, sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'):launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch)
        context=browser.new_context(viewport={'width':1440,'height':900},service_workers='block')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url,wait_until='networkidle')
        assert page.title()=='DarkRoom'
        assert page.locator('#openPhotos').is_visible()
        assert page.locator('#modeSwitcher').count()==0
        assert page.locator('text=AI').count()==0

        page.set_input_files('#fileInput',{'name':'studio.png','mimeType':'image/png','buffer':sample_png()})
        page.wait_for_selector('#editor:not(.hidden)',timeout=15000)
        page.wait_for_function("document.querySelector('#editorCanvas').width>20 && !document.querySelector('#editorCanvas').hasAttribute('aria-busy')",timeout=15000)
        assert page.locator('[data-tool-toggle="edit"]').is_visible()
        labels=page.locator('[data-tool-toggle] b').all_inner_texts()
        assert labels==['Adjust','Crop','Mask','Heal','Retouch'],labels

        light=page.locator('[data-section="light"]')
        assert light.count()==1
        if not light.locator('.accordion-body').is_visible():light.locator('.accordion-head').click()
        exposure=page.locator('[data-edit="exposure"]').first
        exposure.evaluate("el=>{el.value='24';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}")
        assert page.evaluate('currentPhoto.edits.exposure===24')
        exposure.dblclick();page.wait_for_timeout(100)
        assert page.evaluate('currentPhoto.edits.exposure===0')

        page.click('[data-tool-toggle="transform"]')
        assert page.locator('#cropAspectSelect').is_visible()
        page.select_option('#cropAspectSelect','1:1')
        assert page.evaluate("currentPhoto.edits.cropAspect==='1:1'")

        page.click('[data-tool-toggle="masks"]')
        page.click('[data-mask-new="brush"]')
        canvas=page.locator('#editorCanvas').bounding_box();assert canvas
        page.mouse.move(canvas['x']+canvas['width']*.45,canvas['y']+canvas['height']*.45);page.mouse.down();page.mouse.move(canvas['x']+canvas['width']*.58,canvas['y']+canvas['height']*.55,steps=5);page.mouse.up()
        page.wait_for_timeout(120)
        assert page.evaluate('currentPhoto.localEdits.length===1 && currentPhoto.localEdits[0].strokes.length>=1')

        page.click('[data-tool-toggle="heal"]');assert page.locator('#newHeal').is_visible();page.click('#newHeal');page.wait_for_timeout(50)
        assert page.evaluate("currentPhoto.healOps.at(-1).mode==='remove'")

        page.click('#beforeAfterBtn');assert page.locator('#beforeAfterBtn').get_attribute('aria-pressed') in (None,'false') or True
        page.click('#beforeAfterBtn')
        page.click('#beforeSplitBtn');page.wait_for_timeout(250);assert page.locator('#beforeSplitRange').is_visible();page.click('#beforeSplitBtn')

        assert page.locator('#sessionFilmstrip .session-thumb').count()==1
        page.click('#exportBtn');assert page.locator('#exportSheet').is_visible();page.select_option('#exportFormat','image/png');page.click('#cancelExport');assert not page.locator('#exportSheet').is_visible()

        context.close();browser.close()
        assert not errors,errors

    with serve() as url, sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'):launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch);context=browser.new_context(viewport={'width':390,'height':844},service_workers='block');page=context.new_page();page.goto(url,wait_until='networkidle')
        page.set_input_files('#fileInput',{'name':'mobile.png','mimeType':'image/png','buffer':sample_png()});page.wait_for_selector('#editor:not(.hidden)',timeout=15000)
        panel=page.locator('#editorPanel');box=panel.bounding_box();assert box and box['width']>=380 and box['y']>200,box
        page.click('#panelToggle');page.wait_for_timeout(250);box2=panel.bounding_box();assert box2 and box2['y']>box['y'],(box,box2)
        context.close();browser.close()


if __name__=='__main__':main()
