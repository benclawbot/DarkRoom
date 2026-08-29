from pathlib import Path
import os

from playwright.sync_api import sync_playwright

from browser_ux import boot


ROOT=Path(__file__).resolve().parents[1]


def transforms(page):
    return page.evaluate("""()=>({
      wrap:document.querySelector('#canvasWrap').style.transform||'none',
      preview:document.querySelector('#editorFallbackImage').style.transform||'none',
      label:document.querySelector('#zoomLabel').textContent,
      previewWidth:document.querySelector('#editorFallbackImage').getBoundingClientRect().width
    })""")


def pinch(page,start,end):
    page.evaluate("""({start,end})=>{
      const target=document.querySelector('#photoViewport');
      const touch=(id,p)=>new Touch({identifier:id,target,clientX:p[0],clientY:p[1],screenX:p[0],screenY:p[1],pageX:p[0],pageY:p[1],radiusX:2,radiusY:2,force:1});
      const emit=(type,points)=>{const touches=points.map((p,i)=>touch(i+1,p));target.dispatchEvent(new TouchEvent(type,{touches,targetTouches:touches,changedTouches:touches,bubbles:true,cancelable:true}))};
      emit('touchstart',start);emit('touchmove',end);emit('touchend',[]);
    }""",{'start':start,'end':end})


def main():
    out=ROOT/'test-output';out.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'): launch['executable_path']='/usr/bin/chromium'
        browser=playwright.chromium.launch(**launch)
        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        page=context.new_page();boot(page)
        page.set_input_files('#fileInput',str(ROOT/'tests'/'fixtures'/'photos'/'photo-2.jpg'))
        page.wait_for_selector('.photo-card');page.locator('.photo-card').click()
        page.wait_for_function("document.querySelector('#editorCanvas')?.width>10&&!document.querySelector('#editorCanvas')?.hasAttribute('aria-busy')")
        page.wait_for_function("getComputedStyle(document.querySelector('#editorFallbackImage')).backgroundImage.includes('blob:')")

        before=transforms(page);page.click('#zoomIn');after_button=transforms(page)
        assert after_button['label']=='125%',after_button
        assert after_button['wrap']==after_button['preview']!='none',f"mobile zoom button transformed only one render layer: {after_button}"
        assert after_button['previewWidth']>before['previewWidth']*1.2,(before,after_button)

        page.click('#zoomReset');pinch(page,[[120,420],[180,420]],[[90,420],[210,420]])
        after_pinch=transforms(page)
        assert int(after_pinch['label'].rstrip('%'))>=190,after_pinch
        assert after_pinch['wrap']==after_pinch['preview']!='none',f"pinch zoom transformed only one render layer: {after_pinch}"

        pinch(page,[[140,420]],[[175,450]])
        after_pan=transforms(page)
        assert 'translate(' in after_pan['preview'] and after_pan['wrap']==after_pan['preview'],after_pan
        page.screenshot(path=str(out/'mobile-zoom.png'))
        assert not page.locator('#editorFallbackImage').is_hidden()
        browser.close()
        print('Mobile zoom test passed: buttons, pinch, and pan transform the visible preview and edit canvas together.')


if __name__=='__main__': main()
