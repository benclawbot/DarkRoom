from pathlib import Path
from playwright.sync_api import sync_playwright
import os
from browser_ux import boot, sample_png

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-output';OUT.mkdir(exist_ok=True)

def main():
    with sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'): launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch)
        page=browser.new_page(viewport={'width':1440,'height':900}); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
        boot(page)
        page.set_input_files('#fileInput',{'name':'mask-ux.png','mimeType':'image/png','buffer':sample_png(9)})
        page.wait_for_selector('.photo-card'); page.locator('.photo-card').click(); page.wait_for_selector('#editor:not(.hidden)')
        page.wait_for_function("document.querySelector('#editorCanvas').width>10")
        page.click('[data-mode="advanced"]'); page.click('[data-tool-toggle="masks"]')
        assert page.locator('.mask-card-grid').count()>=2
        page.click('[data-mask-new="linear"]'); page.wait_for_timeout(100)
        assert page.locator('#duplicateInvertMask').is_visible()
        # Direct-on-photo gradient geometry.
        page.click('#editMaskShape'); box=page.locator('#editorCanvas').bounding_box(); assert box
        page.mouse.move(box['x']+box['width']*.35,box['y']+box['height']*.45); page.mouse.down(); page.mouse.move(box['x']+box['width']*.68,box['y']+box['height']*.64,steps=6); page.mouse.up(); page.wait_for_timeout(100)
        shape=page.evaluate("()=>({cx:activeLocal().cx,cy:activeLocal().cy,angle:activeLocal().angle,feather:activeLocal().feather})")
        assert abs(shape['cx']-.35)<.08 and abs(shape['angle'])>5 and shape['feather']>.08, shape
        # Composite a luminance range with an intersect operation.
        page.click('[data-combine-menu="intersect"]'); page.select_option('#modifierType','luminance'); page.click('#addModifier'); page.wait_for_timeout(100)
        assert page.evaluate("activeLocal().modifiers.some(m=>m.type==='luminance'&&m.operation==='intersect')")
        # Duplicate + invert is a single action.
        before=page.evaluate('currentPhoto.localEdits.length'); page.click('#duplicateInvertMask');
        assert page.evaluate('(n)=>currentPhoto.localEdits.length===n+1 && activeLocal().invert===true',before)
        # Overlay modes and O shortcut are live.
        page.select_option('#maskOverlayMode','black'); page.locator('#maskOverlayOpacity').fill('70');
        assert page.evaluate("localStorage.getItem('darkroom-mask-mode')==='black' && localStorage.getItem('darkroom-mask-opacity')==='70'")
        page.evaluate('document.activeElement?.blur()'); page.keyboard.press('O'); assert 'overlay-hidden' in (page.locator('#maskOverlay').get_attribute('class') or '')
        page.evaluate('document.activeElement?.blur()'); page.keyboard.press('O'); assert 'overlay-hidden' not in (page.locator('#maskOverlay').get_attribute('class') or '')
        page.screenshot(path=str(OUT/'masking-ux.png'),full_page=True)
        # Edge-aware brush records a sampled target and makes the stroke content-aware.
        page.click('[data-mask-new="brush"]'); page.locator('#maskAutoMask').check(); box=page.locator('#editorCanvas').bounding_box();
        page.mouse.move(box['x']+box['width']*.26,box['y']+box['height']*.33); page.mouse.down(); page.mouse.move(box['x']+box['width']*.34,box['y']+box['height']*.38,steps=4); page.mouse.up();
        assert page.evaluate("activeLocal().strokes.at(-1).autoMask===true && activeLocal().strokes.at(-1).target.length===3")
        # Crop: draw-to-straighten and direct reposition.
        page.click('[data-tool-toggle="transform"]');
        if not page.locator('#drawStraighten').is_visible(): page.locator('[data-section="crop"] .accordion-head').click()
        page.click('#drawStraighten'); box=page.locator('#editorCanvas').bounding_box();
        page.mouse.move(box['x']+box['width']*.25,box['y']+box['height']*.40); page.mouse.down(); page.mouse.move(box['x']+box['width']*.75,box['y']+box['height']*.48,steps=5); page.mouse.up(); page.wait_for_timeout(100)
        assert abs(page.evaluate('currentPhoto.edits.angle'))>.2
        page.select_option('#cropAspectSelect','4:3'); assert page.evaluate("currentPhoto.edits.cropAspect==='4:3'")
        page.click('#swapCropAspect'); assert page.evaluate("currentPhoto.edits.cropAspect==='3:4'")
        page.select_option('#cropGuideSelect','thirds'); assert 'thirds' in (page.locator('#compositionOverlay').get_attribute('class') or '')
        x0=page.evaluate('currentPhoto.edits.cropX'); page.click('#repositionCrop'); box=page.locator('#editorCanvas').bounding_box();
        page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5); page.mouse.down(); page.mouse.move(box['x']+box['width']*.62,box['y']+box['height']*.5,steps=4); page.mouse.up(); page.wait_for_timeout(100)
        assert abs(page.evaluate('currentPhoto.edits.cropX')-x0)>1
        page.screenshot(path=str(OUT/'crop-align-ux.png'),full_page=True)
        if errors: raise AssertionError(errors)
        print('Masking/crop UX test passed: direct handles, compositing, invert, overlay modes, auto-mask brush, draw-straighten, reposition, aspects and guides.')
        browser.close()

if __name__=='__main__': main()
