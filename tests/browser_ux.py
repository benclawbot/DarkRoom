from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
import re
import os

ROOT=Path(__file__).resolve().parents[1]

def sample_png(seed=0,w=900,h=600):
    im=Image.new('RGB',(w,h),(35+seed*15,55,80));d=ImageDraw.Draw(im)
    for y in range(h):
        t=y/(h-1);d.line((0,y,w,y),fill=(int(35+120*t),int(70+95*t),int(120+80*(1-t))))
    d.ellipse((w*.18,h*.18,w*.43,h*.66),fill=(210,160-seed*10,90+seed*10))
    d.polygon([(0,h*.72),(w*.32,h*.44),(w*.57,h*.7),(w*.78,h*.36),(w,h*.7),(w,h),(0,h)],fill=(38+seed*8,62+seed*8,45))
    d.rectangle((w*.7,h*.58,w*.77,h*.83),fill=(180,190,185))
    bio=BytesIO();im.save(bio,'PNG');return bio.getvalue()

def sample_webp(seed=0,w=900,h=600):
    im=Image.new('RGB',(w,h),(95,45+seed*5,40));d=ImageDraw.Draw(im);d.rectangle((80,80,420,460),fill=(220,170,60));d.ellipse((500,120,820,440),fill=(55,145,220));bio=BytesIO();im.save(bio,'WEBP',quality=88);return bio.getvalue()

def boot(page):
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet"[^>]+>','',html)
    html=re.sub(r'<link rel="manifest"[^>]+>','',html)
    html=re.sub(r'<script src="[^"]+"></script>','',html)
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(ROOT/'styles.css').read_text(encoding='utf-8'))
    # Opaque about:blank cannot access storage, so supply a deterministic browser-local storage shim.
    page.evaluate("""()=>{const mem={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null,setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k],clear:()=>Object.keys(mem).forEach(k=>delete mem[k])}})}""")
    for f in ['engine-core.js','ai-runtime.js','raw-runtime.js','core.js']:
        page.add_script_tag(content=(ROOT/f).read_text(encoding='utf-8'))
    # Browser-compatible in-memory DB implementing the exact objectStore request contract used by core.js.
    page.evaluate("""()=>{const stores={photos:new Map(),albums:new Map()};const request=(getter,effect)=>{const r={error:null};Object.defineProperty(r,'result',{get:getter||(()=>undefined)});Object.defineProperty(r,'onsuccess',{set(fn){queueMicrotask(()=>{effect?.();fn?.()})}});Object.defineProperty(r,'onerror',{set(fn){}});return r};db={transaction(name){return{objectStore(){return{getAll(){return request(()=>[...stores[name].values()])},put(obj){return request(()=>obj?.id,()=>stores[name].set(obj.id,obj))},delete(id){return request(()=>undefined,()=>stores[name].delete(id))},clear(){return request(()=>undefined,()=>stores[name].clear())}}}}}};initDB=async()=>{await refreshData()};window.__darkroomTestStores=stores}""")
    for f in ['library.js','renderer.js','editor.js','pro-tools.js','app.js']:
        page.add_script_tag(content=(ROOT/f).read_text(encoding='utf-8'))
    page.wait_for_function("typeof db!=='undefined' && db && document.querySelector('#libraryView.active')")

def main():
    out=ROOT/'test-output';out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']};
        if os.path.exists('/usr/bin/chromium'): launch['executable_path']='/usr/bin/chromium'
        browser=p.chromium.launch(**launch)
        context=browser.new_context(viewport={'width':1440,'height':900},service_workers='block')
        page=context.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
        boot(page)
        assert page.title()=='DarkRoom'
        fixtures=ROOT/'tests'/'fixtures'/'photos'
        files=[{'name':'sample.png','mimeType':'image/png','buffer':sample_png(7)},{'name':'sample.webp','mimeType':'image/webp','buffer':sample_webp(3)}]
        files += [{'name':f.name,'mimeType':'image/jpeg','buffer':f.read_bytes()} for f in sorted(fixtures.glob('*.jpg'))]
        page.set_input_files('#fileInput',files)
        page.wait_for_function("document.querySelectorAll('.photo-card').length===5",timeout=15000)
        assert page.evaluate("photos.length") == 5
        assert page.evaluate("photos.every(p=>!!p.thumbnailBlob)")
        thumb=page.locator('.photo-card').first.locator('img')
        page.wait_for_function("document.querySelector('.photo-card img')?.naturalWidth>0")
        thumb.evaluate("el=>{el.src='blob:darkroom-invalid-thumbnail'}")
        page.wait_for_function("document.querySelector('.photo-card img')?.naturalWidth>0",timeout=5000)
        page.screenshot(path=str(out/'library-desktop.png'),full_page=True)
        page.locator('.photo-card').first.click();page.wait_for_selector('#editor:not(.hidden)');page.wait_for_function("document.querySelector('#editorCanvas').width>10 && !document.querySelector('#editorCanvas').hasAttribute('aria-busy')")
        png_avg=page.evaluate("()=>{const c=document.querySelector('#editorCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))n+=d[i]+d[i+1]+d[i+2];return n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3}")
        assert png_avg>5, f'PNG preview unexpectedly black: {png_avg}'
        page.click('#closeEditor');page.wait_for_function("document.querySelector('#editor').classList.contains('hidden')")
        webp_card=page.locator('.photo-card').filter(has=page.locator('img[alt="sample.webp"]'));assert webp_card.count()==1
        webp_card.click();page.wait_for_selector('#editor:not(.hidden)');page.wait_for_function("document.querySelector('#editorCanvas').width>10 && !document.querySelector('#editorCanvas').hasAttribute('aria-busy')")
        page.click('[data-mode="advanced"]');page.click('[data-tool-toggle="retouch"]');page.wait_for_timeout(500)
        webp_avg=page.evaluate("()=>{const c=document.querySelector('#editorCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))n+=d[i]+d[i+1]+d[i+2];return n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3}")
        assert webp_avg>5, f'WebP preview unexpectedly black in Retouch: {webp_avg}'
        page.evaluate("setEditorFallback(true)");assert page.locator('#editorFallbackImage').is_visible();assert page.locator('#editorFallbackImage').get_attribute('src');page.evaluate("setEditorFallback(false)");assert not page.locator('#editorFallbackImage').is_visible()
        fallback_avg=page.evaluate("""async()=>{const original=currentPhoto.blob;currentPhoto.blob=new Blob([new Uint8Array([0,1,2,3])],{type:'image/webp'});await renderCanvas(document.querySelector('#editorCanvas'));const c=document.querySelector('#editorCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))n+=d[i]+d[i+1]+d[i+2];const avg=n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3;currentPhoto.blob=original;await renderCanvas(c);return avg}""")
        assert fallback_avg>5, f'WebP thumbnail fallback unexpectedly black: {fallback_avg}'
        sanitized_avg=page.evaluate("""async()=>{currentPhoto.edits={...currentPhoto.edits,gamma:NaN,curvePoints:[{x:.5,y:0},{x:.5,y:0}]};normalizePhoto(currentPhoto);await renderCanvas(document.querySelector('#editorCanvas'));const c=document.querySelector('#editorCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4))){n+=d[i]+d[i+1]+d[i+2]}return n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)))/3}""")
        assert sanitized_avg>5, f'Sanitized persisted edits unexpectedly black: {sanitized_avg}'
        exposure=page.locator('[data-edit="exposure"]').first
        for value in range(-80,81,8):
            exposure.evaluate("(el, value) => { el.value = value; el.dispatchEvent(new Event('input', {bubbles: true})); }", value)
        page.wait_for_timeout(500)
        assert page.evaluate("()=>{const c=document.querySelector('#editorCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))n+=d[i]+d[i+1]+d[i+2];return n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3}") > 5
        geo=page.evaluate("""()=>{const p=document.querySelector('#photoViewport').getBoundingClientRect(),t=document.querySelector('.editor-panel').getBoundingClientRect();return {photoRight:p.right,toolsLeft:t.left,toolsWidth:t.width}}""")
        assert geo['toolsLeft'] >= geo['photoRight']-2 and geo['toolsWidth']>250
        overlays=page.evaluate("()=>['maskOverlay','diagnosticOverlay'].map(id=>getComputedStyle(document.getElementById(id)).backgroundColor)")
        assert all(v in ('rgba(0, 0, 0, 0)','transparent') for v in overlays), overlays
        counts=[]
        for mode in ['quick','advanced','pro']:
            page.click(f'[data-mode="{mode}"]');counts.append(page.locator('.tool-section').count())
        assert counts[0] <= counts[1] <= counts[2]
        page.click('[data-mode="advanced"]');head=page.locator('.accordion-head').first;section=head.locator('..');before='collapsed' in (section.get_attribute('class') or '');head.click();after='collapsed' in (section.get_attribute('class') or '');assert before != after
        if 'open' not in (page.locator('[data-tool-section="edit"]').get_attribute('class') or ''): page.click('[data-tool-toggle="edit"]')
        if not page.locator('[data-section="light"] .accordion-body').is_visible(): page.locator('[data-section="light"] .accordion-head').click()
        number=page.locator('[data-control-number="edit|exposure"]');number.fill('37');assert page.evaluate("currentPhoto.edits.exposure===37");number.fill('0');assert page.evaluate("currentPhoto.edits.exposure===0")
        if not page.locator('[data-section="curves"] .accordion-body').is_visible(): page.locator('[data-section="curves"] .accordion-head').click()
        curve=page.locator('#toneCurveCanvas');assert curve.is_visible();curve_box=curve.bounding_box();assert curve_box and curve_box['width']>200 and curve_box['height']>100
        curve_before=page.evaluate("currentPhoto.edits.curvePoints.length")
        page.mouse.click(curve_box['x']+curve_box['width']*.62,curve_box['y']+curve_box['height']*.28);page.wait_for_timeout(100)
        curve_after=page.evaluate("({count:currentPhoto.edits.curvePoints.length,mid:currentPhoto.edits.curveMidtones,points:currentPhoto.edits.curvePoints})")
        assert curve_after['count']>=curve_before+1 and any(abs(curve_after['points'][i]['y']-curve_after['points'][i]['x'])>.05 for i in range(len(curve_after['points']))), curve_after
        point=max(curve_after['points'],key=lambda p: p['y']-p['x'])
        page.mouse.move(curve_box['x']+point['x']*curve_box['width'],curve_box['y']+(1-point['y'])*curve_box['height']);page.mouse.down();page.mouse.move(curve_box['x']+point['x']*curve_box['width'],curve_box['y']+curve_box['height']*.55,steps=4);page.mouse.up();page.wait_for_timeout(100)
        curve_dragged=page.evaluate("(x)=>currentPhoto.edits.curvePoints.find(p=>Math.abs(p.x-x)<.05)?.y",point['x'])
        assert curve_dragged is not None and abs(curve_dragged-point['y'])>.05, curve_dragged
        page.locator('[data-edit="curveMidtones"]').evaluate("(el)=>{el.value='-30';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}")
        assert page.evaluate("currentPhoto.edits.curveMidtones===-30")
        page.click('#resetToneCurve');page.wait_for_timeout(100);assert page.evaluate("currentPhoto.edits.curvePoints.length===0 && currentPhoto.edits.curveMidtones===0")
        if 'open' not in (page.locator('[data-tool-section="transform"]').get_attribute('class') or ''): page.click('[data-tool-toggle="transform"]')
        if not page.locator('#autoCrop').is_visible(): page.locator('[data-section="crop"] .accordion-head').click()
        page.click('#autoCrop');page.wait_for_timeout(100);assert page.evaluate("currentPhoto.edits.cropZoom>=100 && currentPhoto.edits.cropX>=0 && currentPhoto.edits.cropX<=100")
        z0=page.locator('#zoomLabel').inner_text();page.click('#zoomIn');assert page.locator('#zoomLabel').inner_text()!=z0
        page.click('#beforeSplitBtn');page.wait_for_function("document.querySelector('#beforeSplitCanvas').classList.contains('active')");page.locator('#beforeSplitRange').fill('65');assert '65%' in page.locator('#beforeSplitDivider').get_attribute('style');page.click('#beforeSplitBtn')
        page.keyboard.press('f');assert 'photo-only' in (page.locator('#editor').get_attribute('class') or '');page.keyboard.press('f');assert 'photo-only' not in (page.locator('#editor').get_attribute('class') or '')
        # Open masks and paint actual strokes.
        page.click('[data-tool-toggle="masks"]');page.click('[data-mask-new="brush"]');canvas=page.locator('#editorCanvas').bounding_box();assert canvas
        page.mouse.move(canvas['x']+canvas['width']*.5,canvas['y']+canvas['height']*.5);page.mouse.down();page.mouse.move(canvas['x']+canvas['width']*.62,canvas['y']+canvas['height']*.58,steps=6);page.mouse.up();page.wait_for_timeout(50)
        assert page.evaluate("currentPhoto.localEdits.length>=1 && currentPhoto.localEdits[0].strokes.length>=1")
        # The mask tool remains open after rerender; make dodge/burn real graph nodes.
        if not page.locator('[data-mask-new="dodge"]').count(): page.click('[data-tool-toggle="masks"]')
        page.click('[data-mask-new="dodge"]');
        if not page.locator('[data-mask-new="burn"]').count(): page.click('[data-tool-toggle="masks"]')
        page.click('[data-mask-new="burn"]');assert page.evaluate("currentPhoto.localEdits.some(m=>m.type==='dodge')&&currentPhoto.localEdits.some(m=>m.type==='burn')")
        if not page.locator('#newHeal').is_visible(): page.click('[data-tool-toggle="heal"]')
        page.click('#newHeal');canvas=page.locator('#editorCanvas').bounding_box();page.mouse.move(canvas['x']+canvas['width']*.7,canvas['y']+canvas['height']*.55);page.mouse.down();page.mouse.move(canvas['x']+canvas['width']*.74,canvas['y']+canvas['height']*.58,steps=4);page.mouse.up();assert page.evaluate("currentPhoto.healOps.length>=1 && currentPhoto.healOps[0].strokes.length>=1")
        page.click('[data-mode="pro"]');
        if not page.locator('#newAdjustmentLayer').is_visible(): page.click('[data-tool-toggle="layers"]')
        page.locator('#newAdjustmentLayer').click();assert page.evaluate("currentPhoto.adjustmentLayers.length===1")
        if not page.locator('[data-section="imageLayers"] .accordion-body').is_visible(): page.locator('[data-section="imageLayers"] .accordion-head').click()
        page.select_option('#imageLayerSource',index=1);page.click('#addImageLayer');assert page.evaluate("currentPhoto.imageLayers.length===1")
        # Local sky replacement with second photo.
        if not page.locator('[data-tool-section="ai"]').get_attribute('class') or 'open' not in (page.locator('[data-tool-section="ai"]').get_attribute('class') or ''): page.click('[data-tool-toggle="ai"]')
        if not page.locator('#skyPhoto').is_visible(): page.locator('[data-section="sky"] .accordion-head').click()
        page.select_option('#skyPhoto',index=1);page.click('#applySky');assert page.evaluate("!!currentPhoto.skyReplacementId")
        page.wait_for_timeout(900)
        avg=page.evaluate("()=>{const c=document.querySelector('#editorCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))n+=d[i]+d[i+1]+d[i+2];return n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3}")
        assert avg>5, f'editor preview unexpectedly black: {avg}'
        page.screenshot(path=str(out/'editor-desktop.png'),full_page=True)
        page.click('#closeEditor');page.wait_for_function("document.querySelector('#editor').classList.contains('hidden')")
        page.click('#selectPhotosBtn');page.locator('.photo-card').nth(0).click();page.locator('.photo-card').nth(1).click();page.click('#batchAnalyze');page.wait_for_function("photos.filter(p=>selectedPhotoIds.has(p.id)).length===2&&photos.filter(p=>selectedPhotoIds.has(p.id)).every(p=>p.analysis&&Number.isFinite(p.analysis.sharpness))",timeout=15000)
        page.click('#batchCompare');page.wait_for_selector('#compareView:not(.hidden)');
        for _ in range(30):
            if 'Focus' in page.locator('#compareLeftMeta').inner_text(): break
            page.wait_for_timeout(500)
        assert 'Focus' in page.locator('#compareLeftMeta').inner_text(), (page.locator('#compareLeftMeta').inner_text(),errors)
        page.screenshot(path=str(out/'compare-desktop.png'),full_page=True);page.click('#closeCompare')
        page.click('#batchDone');page.locator('.photo-card').nth(1).click();page.evaluate("try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (_) {}")
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
        geo=page.evaluate("""()=>{const p=document.querySelector('#photoViewport').getBoundingClientRect(),t=document.querySelector('.editor-panel').getBoundingClientRect();return {photoRight:p.right,toolsLeft:t.left,toolsWidth:t.width,button:getComputedStyle(document.querySelector('#mobileFullscreenBtn')).display}}""")
        assert geo['toolsLeft'] >= geo['photoRight']-2 and geo['toolsWidth']>120 and geo['button']!='none'
        page.screenshot(path=str(out/'editor-mobile.png'),full_page=True);page.click('#zoomIn');page.click('#mobileFullscreenBtn');assert 'photo-only' in (page.locator('#editor').get_attribute('class') or '')
        page.wait_for_function("document.querySelector('#editorCanvas')?.getBoundingClientRect().width>0")
        full=page.evaluate("()=>{const c=document.querySelector('#editorCanvas'),r=c.getBoundingClientRect(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=Math.max(4,Math.floor(d.length/4000/4)*4))n+=d[i]+d[i+1]+d[i+2];return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,avg:n/Math.max(1,d.length/Math.max(4,Math.floor(d.length/4000/4)*4))/3}}")
        assert full['left']>=-2 and full['right']<=390+2 and full['top']>=-2 and full['bottom']<=844+2 and full['avg']>5, full
        page.click('#mobileFullscreenBtn')
        page.click('#closeEditor');page.wait_for_function("document.querySelector('#editor').classList.contains('hidden')")
        page.on('dialog',lambda dialog: dialog.accept())
        page.click('#selectPhotosBtn');page.locator('.photo-card').first.click();page.click('#batchDelete');page.wait_for_function("photos.length===4")
        assert page.locator('.photo-card').count()==4
        if errors: raise AssertionError('Browser page errors: '+repr(errors))
        print('Browser UX tests passed: import/data flow, fixed right rail, modes, accordion, zoom/fullscreen, masks, dodge/burn, remove, layers, sky, culling/compare, mobile layout.')
        browser.close()
if __name__=='__main__': main()
