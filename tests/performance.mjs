import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const crop=fs.readFileSync('crop-ui.js','utf8');
const perf=fs.readFileSync('performance-ui.js','utf8');
const css=fs.readFileSync('crop-ui.css','utf8');

assert.match(index,/crop-ui\.js\?v=26/);
assert.match(index,/performance-ui\.js\?v=2/);
assert.match(perf,/window\.syncRenderedPreview=async function/);
assert.match(perf,/const fastSize=\(\)=>clamp\(Math\.round\(displayLongEdge\(\)\),480,960\)/);
assert.match(perf,/canvas\.style\.width=`\$\{box\.width\}px`/);
assert.match(perf,/canvas\.style\.height=`\$\{box\.height\}px`/);
assert.match(perf,/window\.transformedSourceCanvas=function/);
assert.match(perf,/window\.applyGlobalPixels=function/);
assert.match(perf,/LUT_SIZE=17/);
assert.match(crop,/setPaintMode\('straighten'\)/);
assert.match(crop,/function updateCropDrag[\s\S]*frame\.style\.width/);
const dragBody=crop.match(/function updateCropDrag\(e\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert.equal(dragBody.includes('renderCanvas('),false,'crop drag should not rerender on every pointer move');
assert.match(css,/\.straighten-guide\{/);
console.log('performance interaction checks passed');
