import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const focused=read('focused-editor.js');
const css=read('focused-editor.css');
const app=read('app.js');
const sw=read('sw.js');
const library=read('library.js');

for(const id of ['fileInput','openPhotos','photoGrid','editor','photoViewport','editorCanvas','editorPanel','toolTabs','sessionFilmstrip','undoBtn','redoBtn','beforeAfterBtn','beforeSplitBtn','exportBtn','exportSheet','zoomIn','zoomOut','zoomReset']){
  assert(html.includes(`id="${id}"`),`Missing focused editor control #${id}`);
}

assert(!html.includes('modeSwitcher'),'Quick/Advanced/Pro switcher must not be in the product UI');
assert(!html.includes('data-mode="quick"')&&!html.includes('data-mode="advanced"')&&!html.includes('data-mode="pro"'),'Editing complexity modes must not be exposed');
assert(!html.includes('ai-runtime.js')&&!html.includes('generative-runtime.js'),'Model runtimes must not be loaded');
assert(!html.includes('pro-tools.js')&&!html.includes('batch-workspace.js'),'Catalog/batch tooling must not be loaded');
assert(!/\bAI\b|Generative Fill|Smart Mask|model download/i.test(html),'AI concepts must not appear in the UI shell');

for(const label of ['Adjust','Crop','Mask','Heal','Retouch'])assert(focused.includes(`label:'${label}'`),`Missing ${label} tool`);
for(const section of ['Presets','Light','Color','Tone Curve','Color Mixer','Color Grading','Detail','Effects','Optics','Geometry','LUT & Film'])assert(focused.includes(`'${section}'`),`Missing ${section} adjustment section`);
assert(focused.includes("maskToolButton('brush'")&&focused.includes("maskToolButton('linear'")&&focused.includes("maskToolButton('radial'")&&focused.includes("maskToolButton('luminance'")&&focused.includes("maskToolButton('color'"),'Manual masking tools missing');
assert(focused.includes("createHealOperation('remove')")||read('editor.js').includes("createHealOperation('remove')"),'Heal operation missing');
assert(focused.includes('renderSessionFilmstrip')&&focused.includes('navigateSession'),'Session filmstrip/navigation missing');
assert(focused.includes("e.key==='\\\\'")||focused.includes("e.key==='\\'"),'Hold-for-before shortcut missing');
assert(app.includes('showExportSheet')&&app.includes('confirmExport'),'Compact export sheet missing');
assert(app.includes('dragenter')&&app.includes("addEventListener('drop'"),'Drag-and-drop opening missing');
assert(library.length<2500,'Library module should remain a lightweight session, not a catalog');
assert(css.includes('@media(max-width:760px)')&&css.includes('position:fixed!important')&&css.includes('sheet-collapsed'),'Mobile bottom-sheet editing layout missing');
assert(sw.includes("darkroom-v23")&&sw.includes('focused-editor.js')&&sw.includes('focused-editor.css'),'Focused assets missing from offline shell');
assert(!sw.includes('ai-runtime')&&!sw.includes('generative-runtime')&&!sw.includes('pro-tools'),'Unused advanced runtimes must not be cached');

console.log('Focused professional editor checks passed.');
