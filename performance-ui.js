// Display-sized interactive preview pipeline.
// Keep the photograph's on-screen geometry stable, render at viewer resolution while dragging,
// cache unchanged source geometry, and refine to display-density quality after input settles.
(function(){
'use strict';
const q=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// The editor canvas itself is the preview. Do not encode it to PNG and decode it again after every render.
if(typeof window.syncRenderedPreview==='function'){
  window.syncRenderedPreview=async function(canvas){
    if(!canvas||canvas.id!=='editorCanvas')return;
    const stage=q('#photoViewport'),fallback=q('#editorFallbackImage');
    if(fallback?._renderedUrl){try{URL.revokeObjectURL(fallback._renderedUrl)}catch{}fallback._renderedUrl=''}
    if(fallback){fallback.classList.remove('active');fallback.style.backgroundImage='none';fallback.dataset.photoId='';fallback.dataset.source=''}
    stage?.classList.remove('preview-fallback');
    canvas.style.display='block';canvas.style.visibility='visible';canvas.style.background='transparent';canvas.dataset.renderedPreview='1';
  };
}

// Cache the geometry stage. Basic tone/color edits do not need to decode, scale and transform the source again.
if(typeof window.transformedSourceCanvas==='function'){
  const baseTransform=window.transformedSourceCanvas;
  const transformCache=new WeakMap();
  const geometryKey=(e,maxSize)=>[
    Math.round(+maxSize||0),e.rotation||0,e.angle||0,e.geometryRotate||0,e.geometryScale||100,
    e.geometryAspect||0,e.geometryHorizontal||0,e.geometryVertical||0,e.geometryX||0,e.geometryY||0,
    e.flipX?1:0,e.flipY?1:0,e.lensCorrection||0
  ].join('|');
  window.transformedSourceCanvas=function(image,e,maxSize){
    if(!image)return baseTransform(image,e,maxSize);
    let entries=transformCache.get(image);if(!entries){entries=new Map();transformCache.set(image,entries)}
    const key=geometryKey(e,maxSize);const hit=entries.get(key);if(hit)return hit;
    const rendered=baseTransform(image,e,maxSize);entries.set(key,rendered);
    if(entries.size>6)entries.delete(entries.keys().next().value);
    return rendered;
  };
}

// During pointer interaction use a compact 3D color LUT. The settled render still uses the exact pixel pipeline.
const exactGlobalPixels=typeof window.applyGlobalPixels==='function'?window.applyGlobalPixels:null;
let fastColorPass=false,lastLutKey='',lastLut=null;
const LUT_SIZE=17,LUT_MAX=LUT_SIZE-1;
function editKey(e){
  try{return JSON.stringify(e)}catch{return String(Date.now())}
}
function buildLut(e){
  const key=editKey(e);if(lastLut&&key===lastLutKey)return lastLut;
  const lut=new Float32Array(LUT_SIZE*LUT_SIZE*LUT_SIZE*3);let p=0;
  for(let r=0;r<LUT_SIZE;r++)for(let g=0;g<LUT_SIZE;g++)for(let b=0;b<LUT_SIZE;b++){
    const out=DarkRoomEngine.applyTonePixel(r*255/LUT_MAX,g*255/LUT_MAX,b*255/LUT_MAX,e);
    lut[p++]=out[0];lut[p++]=out[1];lut[p++]=out[2];
  }
  lastLutKey=key;lastLut=lut;return lut;
}
function lutIndex(r,g,b){return ((r*LUT_SIZE+g)*LUT_SIZE+b)*3}
function applyFastLut(img,e){
  const lut=buildLut(e),d=img.data,scale=LUT_MAX/255;
  for(let i=0;i<d.length;i+=4){
    const rf=d[i]*scale,gf=d[i+1]*scale,bf=d[i+2]*scale;
    const r0=rf|0,g0=gf|0,b0=bf|0,r1=Math.min(LUT_MAX,r0+1),g1=Math.min(LUT_MAX,g0+1),b1=Math.min(LUT_MAX,b0+1);
    const tr=rf-r0,tg=gf-g0,tb=bf-b0,ar=1-tr,ag=1-tg,ab=1-tb;
    const i000=lutIndex(r0,g0,b0),i001=lutIndex(r0,g0,b1),i010=lutIndex(r0,g1,b0),i011=lutIndex(r0,g1,b1);
    const i100=lutIndex(r1,g0,b0),i101=lutIndex(r1,g0,b1),i110=lutIndex(r1,g1,b0),i111=lutIndex(r1,g1,b1);
    for(let c=0;c<3;c++){
      const c00=lut[i000+c]*ab+lut[i001+c]*tb,c01=lut[i010+c]*ab+lut[i011+c]*tb;
      const c10=lut[i100+c]*ab+lut[i101+c]*tb,c11=lut[i110+c]*ab+lut[i111+c]*tb;
      const c0=c00*ag+c01*tg,c1=c10*ag+c11*tg;
      d[i+c]=c0*ar+c1*tr;
    }
  }
  return img;
}
if(exactGlobalPixels){
  window.applyGlobalPixels=function(img,e){return fastColorPass?applyFastLut(img,e):exactGlobalPixels(img,e)};
}

let pointerEditing=false,lastInputAt=0,settleTimer=0,inFlight=null,pendingArgs=null,rafPending=false;
let stableBox=null,boxLocked=false;
const baseRenderCanvas=window.renderCanvas;
const editorCanvas=()=>q('#editorCanvas');
const interactiveTarget=t=>!!t?.closest?.('input[type="range"],.crop-handle,#toneCurveCanvas,#editorCanvas,.hist-tone-handle');

function measureCanvas(canvas=editorCanvas()){
  if(!canvas)return stableBox;
  const w=canvas.offsetWidth||0,h=canvas.offsetHeight||0;
  if(w>2&&h>2)stableBox={width:w,height:h};
  return stableBox;
}
function lockCanvasBox(canvas){
  const box=stableBox||measureCanvas(canvas);if(!canvas||!box||box.width<3||box.height<3)return;
  canvas.style.width=`${box.width}px`;canvas.style.height=`${box.height}px`;canvas.dataset.interactivePreview='1';boxLocked=true;
}
function unlockCanvasBox(canvas=editorCanvas()){
  if(!canvas||!boxLocked)return;
  canvas.style.removeProperty('width');canvas.style.removeProperty('height');delete canvas.dataset.interactivePreview;boxLocked=false;
  requestAnimationFrame(()=>measureCanvas(canvas));
}
function displayLongEdge(){
  const canvas=editorCanvas(),box=stableBox||measureCanvas(canvas);
  if(box)return Math.max(box.width,box.height);
  const stage=q('#photoViewport');return Math.max(480,Math.min(stage?.clientWidth||960,stage?.clientHeight||720));
}
// Like desktop editors, the live proxy matches the viewer's CSS resolution. The settled frame adds display-density headroom.
const fastSize=()=>clamp(Math.round(displayLongEdge()),480,960);
const qualitySize=()=>clamp(Math.round(displayLongEdge()*Math.min(window.devicePixelRatio||1,1.5)),720,1440);

function suppressInteractiveStatus(){const s=q('#renderStatus'),c=editorCanvas();s?.classList.add('hidden');c?.removeAttribute('aria-busy')}
function releasePointer(){
  if(!pointerEditing)return;pointerEditing=false;lastInputAt=performance.now();scheduleSettle(55);
}
document.addEventListener('pointerdown',e=>{if(interactiveTarget(e.target)){pointerEditing=true;lastInputAt=performance.now();measureCanvas()}},true);
document.addEventListener('pointerup',releasePointer,true);
document.addEventListener('pointercancel',releasePointer,true);
document.addEventListener('input',e=>{if(e.target?.matches?.('input[type="range"]')){lastInputAt=performance.now();scheduleSettle(110)}},true);

function runPending(){
  rafPending=false;if(inFlight||!pendingArgs)return;
  const args=pendingArgs;pendingArgs=null;lockCanvasBox(args.canvas);fastColorPass=true;
  const task=baseRenderCanvas(args.canvas,Math.min(args.maxSize,fastSize()),args.forceOriginal);suppressInteractiveStatus();
  inFlight=Promise.resolve(task).catch(error=>console.error('Interactive preview failed',error)).finally(()=>{
    fastColorPass=false;inFlight=null;
    if(pendingArgs&&!rafPending){rafPending=true;requestAnimationFrame(runPending)}
  });
}
function scheduleFast(args){
  pendingArgs=args;
  if(!inFlight&&!rafPending){rafPending=true;requestAnimationFrame(runPending)}
  return inFlight||Promise.resolve();
}
function scheduleSettle(delay=120){
  clearTimeout(settleTimer);settleTimer=setTimeout(()=>{
    if(pointerEditing||performance.now()-lastInputAt<55){scheduleSettle(70);return}
    const canvas=editorCanvas();if(!canvas||!currentPhoto)return;
    pendingArgs=null;
    const refine=()=>Promise.resolve(baseRenderCanvas(canvas,qualitySize(),false)).catch(error=>console.error('Refined preview failed',error)).finally(()=>unlockCanvasBox(canvas));
    if(inFlight)Promise.resolve(inFlight).finally(refine);else refine();
  },delay);
}

if(typeof baseRenderCanvas==='function'){
  window.renderCanvas=function(canvas,maxSize=960,forceOriginal=false){
    if(canvas?.id!=='editorCanvas'||forceOriginal)return baseRenderCanvas(canvas,maxSize,forceOriginal);
    const now=performance.now(),interactive=pointerEditing||now-lastInputAt<75;
    if(interactive){lastInputAt=now;scheduleSettle(120);return scheduleFast({canvas,maxSize:Number.isFinite(+maxSize)?+maxSize:960,forceOriginal})}
    const result=baseRenderCanvas(canvas,Math.min(Number.isFinite(+maxSize)?+maxSize:1440,qualitySize()),forceOriginal);
    return Promise.resolve(result).finally(()=>{if(!pointerEditing)unlockCanvasBox(canvas);measureCanvas(canvas)});
  };
}

// Histogram updates are useful, but not at pointer-move frequency.
if(typeof window.drawHistogram==='function'){
  const baseDrawHistogram=window.drawHistogram;let lastHistogram=0;
  window.drawHistogram=function(canvas){const now=performance.now();if(pointerEditing&&now-lastHistogram<180)return;lastHistogram=now;return baseDrawHistogram(canvas)};
}

window.addEventListener('resize',()=>{if(!pointerEditing&&!boxLocked)requestAnimationFrame(()=>measureCanvas())});
requestAnimationFrame(()=>measureCanvas());
})();
