import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const focused=read('focused-editor.js');
const refine=read('refine-ui.js');
const refineCss=read('refine-ui.css');
const app=read('app.js');
const sw=read('sw.js');
const presetPack=read('presetpro-presets.js');

for(const id of ['fileInput','editor','editorOpenPhoto','photoViewport','editorCanvas','editorPanel','toolTabs','undoBtn','redoBtn','beforeAfterBtn','beforeSplitBtn','beforeSplitRange','histogramToneStrip','exportBtn','exportSheet','zoomIn','zoomOut','zoomReset']){
  assert(html.includes(`id="${id}"`),`Missing focused editor control #${id}`);
}

for(const removed of ['openPhotos','photoGrid','sessionFilmstrip','panelToggle'])assert(!html.includes(`id="${removed}"`),`Removed multi-photo/tool control #${removed} must stay absent`);
assert(!html.includes('multiple hidden'),'File picker must remain single-photo');
assert(!html.includes('modeSwitcher'),'Quick/Advanced/Pro switcher must not be in the product UI');
assert(!html.includes('ai-runtime.js')&&!html.includes('generative-runtime.js'),'Model runtimes must not be loaded');
assert(!html.includes('pro-tools.js')&&!html.includes('batch-workspace.js'),'Catalog/batch tooling must not be loaded');

for(const label of ['Adjust','Crop','Mask','Retouch'])assert(refine.includes(`label:'${label}'`),`Missing ${label} tool`);
assert(!refine.includes("label:'Heal'"),'Heal tool must remain removed');
for(const section of ['Presets','Light','Color','Tone Curve','Color Mixer','Color Grading','Detail','Effects','Optics','Geometry','LUT & Film'])assert(focused.includes(`'${section}'`),`Missing ${section} adjustment section`);
assert(refine.includes('newBrushMask')&&refine.includes('newLassoMask')&&refine.includes('newMaskSize'),'Simplified brush/lasso mask creation missing');
assert(refine.includes('data-mask-visibility')&&refine.includes('data-mask-delete-simple'),'Mask visibility/deletion controls missing');
assert(!refine.includes('cropGuideSelect'),'Crop guides must stay removed');
assert(refine.includes('groupedPresetOptions')&&refine.includes('deleteSelectedPreset'),'Preset listbox and individual user-preset deletion missing');
assert(presetPack.includes('Kodachrome 64')&&presetPack.includes('Cinematic Grade')&&presetPack.includes('Fuji Film'),'Specialised imported preset pack missing');
assert(html.includes('hist-tone-handle')&&refine.includes('setToneHandle'),'Histogram triangle tone controls missing');
assert(refine.includes('syncSplitGeometry')&&refineCss.includes('#beforeSplitCanvas'),'1:1 before/after split alignment missing');
assert(app.includes('showExportSheet')&&app.includes('confirmExport'),'Compact export sheet missing');
assert(app.includes('dragenter')&&app.includes("addEventListener('drop'"),'Drag-and-drop opening missing');
assert(refineCss.includes('color-scheme:dark')&&refineCss.includes('.crop-aspect-line'),'Dark crop aspect selector styling missing');
assert(sw.includes("darkroom-v27")&&sw.includes('refine-ui.js')&&sw.includes('presetpro-presets.js')&&sw.includes('crop-ui.js?v=26')&&sw.includes('performance-ui.js?v=2'),'Refined editor assets missing from offline shell');
assert(!sw.includes('ai-runtime')&&!sw.includes('generative-runtime')&&!sw.includes('pro-tools'),'Unused advanced runtimes must not be cached');

console.log('Single-photo DarkRoom refinement checks passed.');
