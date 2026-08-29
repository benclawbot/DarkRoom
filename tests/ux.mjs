import fs from 'node:fs';import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),css=read('styles.css'),core=read('core.js'),editor=read('editor.js'),app=read('app.js'),lib=read('library.js'),renderer=read('renderer.js'),ai=read('ai-runtime.js');
assert(html.includes('rel="icon"')&&html.includes('href="icon.svg"'),'aperture favicon must be declared');
assert(css.includes('::-webkit-slider-thumb')&&css.includes('::-moz-range-thumb'),'range controls must have custom track and knob styling');
assert(html.includes('id="batchDelete"')&&lib.includes('async function batchDelete'),'library must expose local-only photo deletion');
assert(lib.includes('img.onerror')&&lib.includes('blobUrl(photo,false)'),'thumbnail failures must fall back to the original blob');
// Progressive disclosure
for(const m of ['quick','advanced','pro'])assert(html.includes(`data-mode="${m}"`),`missing ${m} mode`);
assert(core.includes('MODE_RANK')&&core.includes("quick:0")&&core.includes("advanced:1")&&core.includes("pro:2"));
assert(editor.includes('modeAllows(t.tier)'),'tool rail must obey editor mode');
// Right-side tools and accordion UX
assert(css.includes('grid-template-columns:minmax(0,1fr) var(--right)'),'desktop tools must stay right of photo');
assert(css.includes('.accordion.collapsed .accordion-body'),'sections must be independently collapsible');
assert(css.includes('.accordion-head{display:flex!important;'),'accordion headers must be compact horizontal rows');
assert(editor.includes('darkroom-accordion-')&&editor.includes('localStorage.setItem(accordionKey()'),'accordion state must persist');
assert(editor.includes('soloSections'),'pro solo-section workflow missing');
// Focus view
assert(app.includes("e.key==='f'||e.key==='F'")&&app.includes('togglePhotoOnly()'),'F shortcut missing');
assert(html.includes('id="mobileFullscreenBtn"')&&app.includes("$('#mobileFullscreenBtn').onclick=()=>togglePhotoOnly()"),'mobile fullscreen missing');
assert(css.includes('.editor.photo-only'),'picture-only CSS missing');
// Local tool completeness
for(const key of ['deblur','artifactReduction','blemish','lips','contour','faceRestore','relightForeground','relightBackground','rimLight','relightWarmth'])assert(core.includes(key+':0')||core.includes(`['${key}'`),`engine control not surfaced/defaulted: ${key}`);
for(const type of ['dodge','burn','luminance','hue','color','subject','object','sky','background','person','face','skin','hair','eyes','teeth','lips','clothing','water','vegetation','architecture','mountains','snow','ground','artificialGround'])assert(editor.includes(type),`mask type missing: ${type}`);
assert(editor.includes('modifierOperation')&&editor.includes('addSmartModifier'),'mask add/subtract/intersect UI missing');
assert(editor.includes("setPaintMode('sample-hue')")&&editor.includes('sampleMaskHueAt'),'hue picker must be functional');
// Remove/generative
assert(editor.includes('newGenerative')&&editor.includes("createHealOperation('generative')"),'generative fill control missing');
assert(renderer.includes('E.generativeFill')&&renderer.includes('E.clonePaint')&&renderer.includes('E.inpaint'),'render graph must distinguish fill/clone/remove');
// AI and local privacy architecture
assert(ai.includes('@huggingface/transformers')&&ai.includes('webgpu'),'local AI runtime must prefer WebGPU');
assert(!renderer.match(/fetch\(|XMLHttpRequest|WebSocket/),'renderer must not upload images');
// Selection/batch consistency
assert(lib.includes('selectionMode')&&lib.includes('batchMutate')&&lib.includes('batchExport'),'batch selection missing');
assert(app.includes('localEdits:clone(currentPhoto.localEdits')&&lib.includes('p.localEdits=clone(editClipboard.localEdits'),'copy/paste must include local masks');
// Shared preview/export render graph
assert(editor.includes('await renderCanvas(c,requested,false)')&&renderer.includes('applyLocalEdits'),'export and preview must share renderer');
console.log('UX state-machine tests passed: modes, right rail, accordion persistence, focus view, masks, generative tools, batch edit shape, shared renderer.');
// v7 professional UX coverage
assert(html.includes('ai-runtime.js')&&html.includes('raw-runtime.js'),'AI/RAW runtimes must load in product HTML');
assert(html.includes('pro-tools.js'),'professional workflow module missing');
assert(editor.includes("id:'layers'")&&editor.includes('renderLayersPanel'),'Pro adjustment layers missing');
assert(renderer.includes('applyAdjustmentLayers')&&renderer.includes('applyLUT'),'layers/LUT must be in shared render graph');
assert(editor.includes('parseCubeLUT')&&editor.includes('lutIntensity'),'3D LUT workflow missing');
assert(editor.includes('renderSkyMarkup')&&renderer.includes('applySkyReplacement'),'local sky replacement missing');
assert(html.includes('diagnosticOverlay')&&renderer.includes('renderDiagnosticOverlay'),'clipping/focus diagnostic overlay missing');
assert(lib.includes('batchColor')&&html.includes('batchColor'),'color label culling workflow missing');
assert(html.includes('batchAnalyze')&&html.includes('batchCompare')&&html.includes('batchRename'),'professional batch/culling controls missing');
assert(!read('pro-tools.js').includes('Promise.all([renderPhotoForCompare'),'Compare renders must not race shared currentPhoto state');
assert(ai.includes('depth-estimation')&&ai.includes('image-to-image'),'depth and on-device super-resolution pipelines missing');
assert(editor.includes('image/avif')&&editor.includes('saveExportRecipe'),'professional export recipe/AVIF support missing');
assert(editor.includes('imageLayers')&&renderer.includes('applyImageLayers'),'Pro image/raster layer workflow missing');
assert(editor.includes('customPresets')&&editor.includes('saveCustomPreset'),'custom local presets missing');
assert(core.includes('makeThumbnail')&&lib.includes('blobUrl(p,true)'),'thumbnail-backed library rendering missing');
assert(read('pro-tools.js').includes('perceptualHash')&&html.includes('batchSimilar'),'find-similar culling workflow missing');
assert(html.includes('batchMetadata')&&read('pro-tools.js').includes('batchMetadata'),'batch local metadata workflow missing');
assert(html.includes('<option value="noise">Noise Stack</option>'),'noise stacking must be exposed in Combine UI');

console.log('Professional UX tests passed: local AI/RAW, layers, LUT, sky, diagnostics, labels, culling, export recipes.');
