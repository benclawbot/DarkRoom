from pathlib import Path
import os

from playwright.sync_api import sync_playwright

from browser_ux import boot


ROOT=Path(__file__).resolve().parents[1]


def plot_position(box,x,y):
    return (
        box['x']+box['width']*(20+x*(320-40))/320,
        box['y']+box['height']*(20+(1-y)*(170-40))/170,
    )


def main():
    out=ROOT/'test-output';out.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
        if os.path.exists('/usr/bin/chromium'): launch['executable_path']='/usr/bin/chromium'
        browser=playwright.chromium.launch(**launch)
        page=browser.new_page(viewport={'width':1440,'height':900})
        boot(page)
        page.set_input_files('#fileInput',str(ROOT/'tests'/'fixtures'/'photos'/'photo-3.jpg'))
        page.wait_for_selector('.photo-card')
        page.locator('.photo-card').click()
        page.wait_for_function("document.querySelector('#editorCanvas')?.width>10 && !document.querySelector('#editorCanvas')?.hasAttribute('aria-busy')")
        page.click('[data-mode="advanced"]')
        if 'open' not in (page.locator('[data-tool-section="edit"]').get_attribute('class') or ''): page.click('[data-tool-toggle="edit"]')
        if not page.locator('[data-section="curves"] .accordion-body').is_visible(): page.locator('[data-section="curves"] .accordion-head').click()
        page.click('#resetToneCurve')
        curve=page.locator('#toneCurveCanvas');box=curve.bounding_box();assert box
        assert page.evaluate('curvePointsForEdit().length')==2,'a reset point curve should begin with only two adjustable endpoints'
        x,y=plot_position(box,.5,.8);page.mouse.click(x,y);page.wait_for_timeout(80)
        points=page.evaluate('currentPhoto.edits.curvePoints')
        assert len(points)==3 and abs(points[1]['x']-.5)<.025 and abs(points[1]['y']-.8)<.025,points
        smooth=page.evaluate('curveValueAt(currentPhoto.edits.curvePoints,.25)')
        assert smooth>.42,f'curve is still a straight segment at quarter tone: {smooth}'
        x0,y0=plot_position(box,.5,.8);x1,y1=plot_position(box,.62,.3)
        page.mouse.move(x0,y0);page.mouse.down();page.mouse.move(x1,y1,steps=6);page.mouse.up();page.wait_for_timeout(80)
        moved=page.evaluate('currentPhoto.edits.curvePoints[1]')
        assert abs(moved['x']-.62)<.03 and abs(moved['y']-.3)<.03,moved
        assert page.evaluate('CURVE_KEYS.some(key=>currentPhoto.edits[key]!==0)'),'curve edits must synchronize the tonal sliders'
        page.wait_for_function("!document.querySelector('#editorCanvas')?.hasAttribute('aria-busy')")
        page.screenshot(path=str(out/'tone-curve.png'))
        browser.close()
        print('Tone curve UX test passed: arbitrary points map to the plot, drag smoothly, and synchronize sliders.')


if __name__=='__main__': main()
