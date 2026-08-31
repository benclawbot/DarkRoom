import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const mask=read('mask-interaction.js');
const preview=read('preview-geometry.js');
const sw=read('sw.js');

assert(html.indexOf('mask-interaction.js?v=1')<html.indexOf('mask-feather.js?v=1'),'Mask geometry engine must load before feather coverage wraps maskValue');
assert(html.indexOf('performance-ui.js?v=2')<html.indexOf('preview-geometry.js?v=1'),'Stable presentation geometry must wrap the performance renderer last');
assert(mask.includes("m?.type==='lasso'")&&mask.includes('pointInPolygon'),'Vector lasso mask support missing');
assert(mask.includes('pointSegmentDistance')&&mask.includes('stroke.aspect'),'Continuous aspect-correct brush coverage missing');
assert(mask.includes("paintMode='vector-lasso'")&&mask.includes('m.points=points.map'),'Vector lasso interaction missing');
assert(mask.includes("style.setProperty('left'")&&mask.includes('base.offsetLeft'),'Mask overlay is not anchored to the visible photo rectangle');
assert(preview.includes('data-stable-preview')&&preview.includes('--darkroom-preview-width'),'Stable CSS presentation box missing');
assert(sw.includes("darkroom-v29")&&sw.includes('mask-interaction.js?v=1')&&sw.includes('preview-geometry.js?v=1'),'Interaction fix assets missing from offline cache');
console.log('Mask interaction and preview geometry checks passed.');
