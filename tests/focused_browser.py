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
        assert page.locator('#editorOpenPhoto').is_visible()
        assert page.locator('#photoGrid').count()==0
        assert page.locator('#sessionFilmstrip').count()==0
        assert page.locator('#panelToggle').count()==0

        page.set_input_files('#fileInput',{'name':'studio.png','mimeType':'image/png','buffer':sample_png()})
        page.wait_for_function("window.currentPhoto && document.querySelector('#editorCanvas').width>20",timeout=15000)
        assert not page.locator('#editorEmptyPicker').is_visible()
        labels=page.locator('[data-tool-toggle] b').all_inner_texts()
        assert labels==['Adjust','Crop','Mask','Retouch'],labels

        light=page.locator('[data-section="light"]')
        assert light.count()==1
        if not light.locator('.accordion-body').is_visible():light.locator('.accordion-head').click()
        exposure=page.locator('[data-edit="exposure"]').first
        exposure.evaluate("el=>{el.value='24';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}")
        assert page.evaluate('currentPhoto.edits.exposure===24')
        exposure.dblclick();page.wait_for_timeout(100)
        assert page.evaluate('currentPhoto.edits.exposure===0')

        preset=page.locator('#presetList')
        if not preset.is_visible():
            section=page.locator('[data-section="presets"]')
            if section.count() and not section.locator('.accordion-body').is_visible():section.locator('.accordion-head').click()
        assert page.locator('#presetList').is_visible()
        options=page.locator('#presetList option').all_inner_texts()
        assert 'Kodachrome 64' in options and 'Fuji Film' in options

        page.click('[data-tool-toggle="transform"]')
        assert page.locator('#cropAspectSelect').is_visible()
        assert page.locator('#cropGuideSelect').count()==0
        page.select_option('#cropAspectSelect','1:1')
        assert page.evaluate("currentPhoto.edits.cropAspect==='1:1'")

        page.click('[data-tool-toggle="masks"]')
        size=page.locator('#newMaskSize');assert size.is_visible()
        size.evaluate("el=>{el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}))}")
        page.click('#newBrushMask')
        canvas=page.locator('#editorCanvas').bounding_box();assert canvas
        page.mouse.move(canvas['x']+canvas['width']*.45,canvas['y']+canvas['height']*.45);page.mouse.down();page.mouse.move(canvas['x']+canvas['width']*.58,canvas['y']+canvas['height']*.55,steps=5);page.mouse.up()
        page.wait_for_timeout(150)
        assert page.evaluate('currentPhoto.localEdits.length===1 && currentPhoto.localEdits[0].strokes.length>=1')
        page.keyboard.press('Escape');page.wait_for_timeout(50)
        assert page.locator('[data-mask-visibility]').count()==1
        assert page.locator('[data-mask-delete-simple]').count()==1

        assert page.locator('[data-tool-toggle="heal"]').count()==0

        page.click('#beforeSplitBtn');page.wait_for_timeout(300)
        assert page.locator('#beforeSplitRange').is_visible()
        geom=page.evaluate("()=>{const a=document.querySelector('#editorCanvas').getBoundingClientRect(),b=document.querySelector('#beforeSplitCanvas').getBoundingClientRect();return [a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height]}")
        assert max(abs(geom[i]-geom[i+4]) for i in range(4))<1.5,geom
        page.click('#beforeSplitBtn')

        assert page.locator('#histogramToneStrip .hist-tone-handle').count()==3
        page.click('#exportBtn');assert page.locator('#exportSheet').is_visible();page.select_option('#exportFormat','image/png');page.click('#cancelExport');assert not page.locator('#exportSheet').is_visible()

        context.close();browser.close()
        assert not errors,errors

    with serve() as url, sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'):launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch);context=browser.new_context(viewport={'width':390,'height':844},service_workers='block');page=context.new_page();page.goto(url,wait_until='networkidle')
        assert page.locator('#editorOpenPhoto').is_visible()
        page.set_input_files('#fileInput',{'name':'mobile.png','mimeType':'image/png','buffer':sample_png()});page.wait_for_function("window.currentPhoto && document.querySelector('#editorCanvas').width>20",timeout=15000)
        assert page.locator('#panelToggle').count()==0
        assert page.locator('#sessionFilmstrip').count()==0
        assert page.locator('#editorPanel').bounding_box() is not None
        context.close();browser.close()


if __name__=='__main__':main()
