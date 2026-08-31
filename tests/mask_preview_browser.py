from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import contextlib, os, threading

ROOT=Path(__file__).resolve().parents[1]


def sample_png():
    im=Image.new('RGB',(1200,700),(38,52,72));d=ImageDraw.Draw(im)
    for y in range(700):
        t=y/699;d.line((0,y,1200,y),fill=(int(35+80*t),int(55+70*t),int(90+60*(1-t))))
    d.ellipse((170,100,470,590),fill=(204,153,94));d.rectangle((720,180,1010,570),fill=(72,126,164))
    bio=BytesIO();im.save(bio,'PNG');return bio.getvalue()


@contextlib.contextmanager
def serve():
    old=os.getcwd();os.chdir(ROOT)
    server=ThreadingHTTPServer(('127.0.0.1',0),SimpleHTTPRequestHandler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try: yield f'http://127.0.0.1:{server.server_port}/'
    finally: server.shutdown();thread.join(timeout=2);os.chdir(old)


def box(page,selector='#editorCanvas'):
    value=page.locator(selector).bounding_box();assert value,selector;return value


def main():
    with serve() as url, sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'):launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch);context=browser.new_context(viewport={'width':1440,'height':900},service_workers='block')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url,wait_until='networkidle')
        page.set_input_files('#fileInput',{'name':'mask-test.png','mimeType':'image/png','buffer':sample_png()})
        page.wait_for_function("currentPhoto && document.querySelector('#editorCanvas').width>20 && document.querySelector('#editorCanvas').dataset.stablePreview==='1'",timeout=15000)
        page.locator('#editorEmptyPicker').wait_for(state='hidden',timeout=15000)

        # Ordinary edits may change render resolution, never the presentation rectangle.
        before=box(page)
        light=page.locator('[data-section="light"]')
        if not light.locator('.accordion-body').is_visible():light.locator('.accordion-head').click()
        exposure=page.locator('[data-edit="exposure"]').first
        exposure.evaluate("el=>{el.value='28';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}")
        page.wait_for_timeout(500)
        after=box(page)
        assert abs(before['width']-after['width'])<1.5,(before,after)
        assert abs(before['height']-after['height'])<1.5,(before,after)

        page.click('[data-tool-toggle="masks"]')
        size=page.locator('#newMaskSize');assert size.is_visible()
        size.evaluate("el=>{el.value='10';el.dispatchEvent(new Event('input',{bubbles:true}))}")
        page.click('#newBrushMask')
        c=box(page);y=c['y']+c['height']*.40;x1=c['x']+c['width']*.25;x2=c['x']+c['width']*.75
        page.mouse.move(x1,y);page.mouse.down();page.mouse.move(x2,y,steps=1);page.mouse.up();page.wait_for_timeout(120)
        # A fast two-sample stroke must cover the segment midpoint, not only its sampled endpoints.
        midpoint=page.evaluate("()=>{const m=currentPhoto.localEdits[0];return DarkRoomEngine.maskValue(m,.5,.4,128,128,128,.5)}")
        assert midpoint>.60,midpoint
        # The overlay must occupy exactly the same visible rectangle as the photo canvas.
        page.evaluate("()=>{currentPhoto.localEdits[0].uiVisible=true;drawMaskOverlay()}")
        overlay=box(page,'#maskOverlay');c=box(page)
        assert max(abs(overlay[k]-c[k]) for k in ['x','y','width','height'])<1.5,(c,overlay)

        # Turning the eye off must win even though brush paint mode deliberately stays active between strokes.
        eye=page.locator('[data-mask-visibility]').first;assert eye.is_visible();eye.click();page.wait_for_timeout(40)
        hidden=page.evaluate("()=>{const o=document.querySelector('#maskOverlay'),s=getComputedStyle(o);return {visible:currentPhoto.localEdits[0].uiVisible,paint:paintMode,opacity:s.opacity,visibility:s.visibility,aria:o.getAttribute('aria-hidden')}}")
        assert hidden['visible'] is False,hidden
        assert hidden['paint']=='add',hidden
        assert hidden['visibility']=='hidden',hidden
        assert hidden['aria']=='true',hidden
        # While a new stroke is physically down the overlay may appear temporarily; release restores the eye preference.
        page.mouse.move(c['x']+c['width']*.35,c['y']+c['height']*.62);page.mouse.down();page.wait_for_timeout(20)
        during=page.evaluate("getComputedStyle(document.querySelector('#maskOverlay')).visibility");assert during=='visible',during
        page.mouse.move(c['x']+c['width']*.48,c['y']+c['height']*.64,steps=2);page.mouse.up();page.wait_for_timeout(40)
        restored=page.evaluate("getComputedStyle(document.querySelector('#maskOverlay')).visibility");assert restored=='hidden',restored

        page.keyboard.press('Escape');page.wait_for_timeout(50)
        page.click('#newLassoMask')
        c=box(page);pts=[(.30,.28),(.72,.28),(.72,.72),(.30,.72),(.30,.28)]
        page.mouse.move(c['x']+c['width']*pts[0][0],c['y']+c['height']*pts[0][1]);page.mouse.down()
        for px,py in pts[1:]:page.mouse.move(c['x']+c['width']*px,c['y']+c['height']*py,steps=3)
        page.mouse.up();page.wait_for_timeout(300)
        lasso=page.evaluate("()=>{const m=currentPhoto.localEdits.at(-1);return {type:m.type,name:m.name,points:m.points?.length||0,inside:DarkRoomEngine.maskValue(m,.5,.5,128,128,128,.5),outside:DarkRoomEngine.maskValue(m,.12,.12,128,128,128,.5),paint:paintMode}}")
        assert lasso['type']=='lasso',lasso
        assert lasso['points']>=4,lasso
        assert lasso['inside']>.9 and lasso['outside']<.1,lasso
        assert lasso['paint'] is None,lasso

        # A local adjustment settling after the lasso still must not collapse the preview.
        stable=box(page)
        local=page.locator('[data-local-edit="exposure"]').first
        if local.count():local.evaluate("el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}")
        page.wait_for_timeout(500);settled=box(page)
        assert abs(stable['width']-settled['width'])<1.5,(stable,settled)
        assert abs(stable['height']-settled['height'])<1.5,(stable,settled)

        context.close();browser.close();assert not errors,errors


if __name__=='__main__':main()
