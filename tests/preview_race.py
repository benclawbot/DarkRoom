from pathlib import Path
import os

from playwright.sync_api import sync_playwright

from browser_ux import boot


ROOT=Path(__file__).resolve().parents[1]


def main():
    out=ROOT/'test-output';out.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'): launch['executable_path']='/usr/bin/chromium'
        browser=playwright.chromium.launch(**launch)
        page=browser.new_page(viewport={'width':1440,'height':900})
        boot(page)
        photo=ROOT/'tests'/'fixtures'/'photos'/'photo-1.jpg'
        page.set_input_files('#fileInput',str(photo))
        page.wait_for_selector('.photo-card')
        page.locator('.photo-card').click()
        page.wait_for_function("document.querySelector('#editorCanvas')?.width>10 && !document.querySelector('#editorCanvas')?.hasAttribute('aria-busy')")
        result=page.evaluate("""async()=>{
          const canvas=document.querySelector('#editorCanvas'),fallback=document.querySelector('#editorFallbackImage');
          const stableBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          const originalToBlob=canvas.toBlob.bind(canvas),originalDecode=Image.prototype.decode;
          const originalCreate=URL.createObjectURL.bind(URL),originalRevoke=URL.revokeObjectURL.bind(URL);
          const revoked=[];let decodeCall=0;
          canvas.toBlob=callback=>queueMicrotask(()=>callback(stableBlob));
          URL.createObjectURL=blob=>originalCreate(blob);
          URL.revokeObjectURL=url=>{revoked.push(url);return originalRevoke(url)};
          Image.prototype.decode=function(){
            const call=++decodeCall,image=this;
            return Promise.resolve().then(()=>originalDecode.call(image)).catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,call===1?80:0)));
          };
          try{
            await Promise.all([syncRenderedPreview(canvas),syncRenderedPreview(canvas)]);
            const background=getComputedStyle(fallback).backgroundImage;
            return{background,revoked,referencesRevoked:revoked.some(url=>background.includes(url))};
          }finally{
            canvas.toBlob=originalToBlob;Image.prototype.decode=originalDecode;
            URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
          }
        }""")
        assert not result['referencesRevoked'],f"visible preview points at a revoked URL: {result}"
        page.screenshot(path=str(out/'preview-race.png'))
        browser.close()
        print('Preview race test passed: the newest completed render remains visible.')


if __name__=='__main__': main()
