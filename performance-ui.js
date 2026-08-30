// Fast interactive preview layer: keep the canvas live, coalesce slider work, and refine after input settles.
(function(){
'use strict';
const q=s=>document.querySelector(s);

// The rendered canvas is already the preview. Avoid encoding every frame to PNG and decoding it again.
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

let pointerEditing=false,lastInputAt=0,settleTimer=0,inFlight=null,pendingArgs=null,rafPending=false;
const baseRenderCanvas=window.renderCanvas;
const qualitySize=()=>Math.min(960,Math.max(720,Math.round(Math.min(innerWidth||960,innerHeight||960)*.9)));
const fastSize=()=>innerWidth<=760?420:520;
const interactiveTarget=t=>!!t?.closest?.('input[type="range"],.crop-handle,#toneCurveCanvas,#editorCanvas,.hist-tone-handle');

function releasePointer(){
  if(!pointerEditing)return;pointerEditing=false;lastInputAt=performance.now();scheduleSettle(60);
}
document.addEventListener('pointerdown',e=>{if(interactiveTarget(e.target)){pointerEditing=true;lastInputAt=performance.now()}},true);
document.addEventListener('pointerup',releasePointer,true);
document.addEventListener('pointercancel',releasePointer,true);
document.addEventListener('input',e=>{if(e.target?.matches?.('input[type="range"]')){lastInputAt=performance.now();scheduleSettle(130)}},true);

function runPending(){
  rafPending=false;if(inFlight||!pendingArgs)return;
  const args=pendingArgs;pendingArgs=null;
  inFlight=Promise.resolve(baseRenderCanvas(args.canvas,Math.min(args.maxSize,fastSize()),args.forceOriginal)).catch(error=>console.error('Interactive preview failed',error)).finally(()=>{
    inFlight=null;
    if(pendingArgs&&!rafPending){rafPending=true;requestAnimationFrame(runPending)}
  });
}
function scheduleFast(args){
  pendingArgs=args;
  if(!inFlight&&!rafPending){rafPending=true;requestAnimationFrame(runPending)}
  return inFlight||Promise.resolve();
}
function scheduleSettle(delay=140){
  clearTimeout(settleTimer);settleTimer=setTimeout(()=>{
    if(pointerEditing||performance.now()-lastInputAt<70){scheduleSettle(90);return}
    const canvas=q('#editorCanvas');if(!canvas||!currentPhoto)return;
    pendingArgs=null;
    Promise.resolve(baseRenderCanvas(canvas,qualitySize(),false)).catch(error=>console.error('Refined preview failed',error));
  },delay);
}

if(typeof baseRenderCanvas==='function'){
  window.renderCanvas=function(canvas,maxSize=960,forceOriginal=false){
    if(canvas?.id!=='editorCanvas'||forceOriginal)return baseRenderCanvas(canvas,maxSize,forceOriginal);
    const now=performance.now(),interactive=pointerEditing||now-lastInputAt<85;
    if(interactive){lastInputAt=now;scheduleSettle(150);return scheduleFast({canvas,maxSize:Number.isFinite(+maxSize)?+maxSize:960,forceOriginal})}
    return baseRenderCanvas(canvas,Math.min(Number.isFinite(+maxSize)?+maxSize:960,qualitySize()),forceOriginal);
  };
}

// Histogram updates are useful, but not at pointer-move frequency.
if(typeof window.drawHistogram==='function'){
  const baseDrawHistogram=window.drawHistogram;let lastHistogram=0;
  window.drawHistogram=function(canvas){const now=performance.now();if(pointerEditing&&now-lastHistogram<180)return;lastHistogram=now;return baseDrawHistogram(canvas)};
}
})();
