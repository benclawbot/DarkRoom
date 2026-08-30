// Direct crop interaction layer.
(function(){
'use strict';
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let cropDrag=null,cropObserver=null;

function aspectOptions(e){
  return ['original','1:1','4:3','3:4','3:2','2:3','16:9','9:16'].map(a=>`<option value="${a}" ${e.cropAspect===a?'selected':''}>${a==='original'?'Original':a}</option>`).join('');
}

window.renderTransformPanel=function(){
  const e=currentPhoto.edits;
  const crop=`
    <div class="crop-mode-strip" role="toolbar" aria-label="Crop tools">
      <button class="active" type="button" id="activateCropFrame"><span class="crop-tool-icon">⌗</span><b>Crop</b></button>
      <button type="button" id="drawStraighten"><span class="crop-tool-icon">▱</span><b>Straighten</b></button>
      <button type="button" data-transform="right" title="Rotate 90 degrees clockwise"><span class="crop-tool-icon">↻</span><b>Rotate</b></button>
      <button type="button" id="openPerspective"><span class="crop-tool-icon">◇</span><b>Perspective</b></button>
    </div>
    <div class="crop-direct-head"><div><b>Crop</b><span>Drag the borders or corners directly on the photo.</span></div><button id="resetCrop">Reset</button></div>
    <div class="crop-aspect-line crop-aspect-simple"><label>Aspect<select id="cropAspectSelect">${aspectOptions(e)}</select></label><button id="swapCropAspect" title="Swap portrait / landscape">↕</button></div>
    <div class="crop-straighten-control">${sliderMarkup([['angle','Straighten',-45,45]])}</div>`;
  const geometry=sliderMarkup([['geometryVertical','Vertical',-100,100],['geometryHorizontal','Horizontal',-100,100],['geometryRotate','Rotate',-45,45],['geometryAspect','Aspect',-100,100],['geometryScale','Scale',50,150],['geometryX','X Offset',-100,100],['geometryY','Y Offset',-100,100]]);
  return accordionSection('crop','Crop',crop,'quick')+accordionSection('geometry','Perspective',geometry,'advanced');
};

function ensureCropFrame(){
  const wrap=q('#canvasWrap');if(!wrap)return null;
  let frame=q('#directCropFrame');
  if(!frame){
    frame=document.createElement('div');frame.id='directCropFrame';frame.className='direct-crop-frame hidden';
    frame.innerHTML=`<span class="crop-grid crop-grid-v v1"></span><span class="crop-grid crop-grid-v v2"></span><span class="crop-grid crop-grid-h h1"></span><span class="crop-grid crop-grid-h h2"></span>
      ${['nw','n','ne','e','se','s','sw','w'].map(h=>`<button type="button" class="crop-handle crop-${h}" data-crop-handle="${h}" aria-label="Resize crop ${h}"></button>`).join('')}`;
    wrap.appendChild(frame);
    frame.addEventListener('pointerdown',beginCropDrag);
  }
  if(!cropObserver&&window.ResizeObserver){cropObserver=new ResizeObserver(syncCropFrame);cropObserver.observe(q('#editorCanvas'));cropObserver.observe(wrap)}
  return frame;
}

function syncCropFrame(){
  const frame=ensureCropFrame(),canvas=q('#editorCanvas'),wrap=q('#canvasWrap');if(!frame||!canvas||!wrap)return;
  const show=!!currentPhoto&&currentPanel==='transform'&&!q('#editorEmptyPicker:not(.hidden)');
  frame.classList.toggle('hidden',!show);if(!show)return;
  const cr=canvas.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
  frame.style.left=`${cr.left-wr.left}px`;frame.style.top=`${cr.top-wr.top}px`;frame.style.width=`${cr.width}px`;frame.style.height=`${cr.height}px`;
}

function beginCropDrag(e){
  const h=e.target.closest?.('[data-crop-handle]');if(!h||!currentPhoto)return;
  e.preventDefault();e.stopPropagation();
  const frame=q('#directCropFrame'),r=frame.getBoundingClientRect(),ed=currentPhoto.edits;
  cropDrag={handle:h.dataset.cropHandle,startClientX:e.clientX,startClientY:e.clientY,width:Math.max(1,r.width),height:Math.max(1,r.height),zoom:ed.cropZoom||100,x:ed.cropX??50,y:ed.cropY??50,pointerId:e.pointerId};
  captureHistory();h.setPointerCapture?.(e.pointerId);frame.classList.add('dragging');
}

function updateCropDrag(e){
  if(!cropDrag||!currentPhoto)return;
  const d=cropDrag,h=d.handle,dx=(e.clientX-d.startClientX)/d.width,dy=(e.clientY-d.startClientY)/d.height;
  let shrinkX=0,shrinkY=0,shiftX=0,shiftY=0;
  if(h.includes('e')){shrinkX=-dx;shiftX=dx*.5}
  if(h.includes('w')){shrinkX=dx;shiftX=dx*.5}
  if(h.includes('s')){shrinkY=-dy;shiftY=dy*.5}
  if(h.includes('n')){shrinkY=dy;shiftY=dy*.5}
  let shrink;
  if(['n','s'].includes(h))shrink=shrinkY;
  else if(['e','w'].includes(h))shrink=shrinkX;
  else shrink=(shrinkX+shrinkY)/2;
  const factor=clamp(1+shrink*1.8,.25,4);
  const ed=currentPhoto.edits;
  ed.cropZoom=clamp(Math.round(d.zoom*factor),100,400);
  const movementScale=100/(Math.max(1,d.zoom/100));
  if(h.includes('e'))ed.cropX=clamp(d.x+shiftX*movementScale,0,100);
  if(h.includes('w'))ed.cropX=clamp(d.x+shiftX*movementScale,0,100);
  if(h.includes('s'))ed.cropY=clamp(d.y+shiftY*movementScale,0,100);
  if(h.includes('n'))ed.cropY=clamp(d.y+shiftY*movementScale,0,100);
  renderCanvas(q('#editorCanvas'));syncCropFrame();
}

function finishCropDrag(){
  if(!cropDrag)return;
  cropDrag=null;q('#directCropFrame')?.classList.remove('dragging');captureHistory();renderControls();renderCanvas(q('#editorCanvas'));debouncedSave();requestAnimationFrame(syncCropFrame);
}

document.addEventListener('pointermove',updateCropDrag,true);
document.addEventListener('pointerup',finishCropDrag,true);
document.addEventListener('pointercancel',finishCropDrag,true);

const baseBind=window.bindGeneratedControls;
window.bindGeneratedControls=function(){
  baseBind();
  if(q('#activateCropFrame'))q('#activateCropFrame').onclick=()=>{stopPainting?.();syncCropFrame()};
  if(q('#openPerspective'))q('#openPerspective').onclick=()=>{
    const section=q('[data-section="geometry"]');if(!section)return;
    section.classList.remove('collapsed');setSectionOpen?.('geometry',true);section.scrollIntoView({block:'nearest',behavior:'smooth'});
  };
  qa('[data-transform="right"]').forEach(b=>{b.title='Rotate 90° clockwise'});
  if(q('#cropAspectSelect'))q('#cropAspectSelect').onchange=e=>{captureHistory();currentPhoto.edits.cropAspect=e.target.value;captureHistory();renderCanvas(q('#editorCanvas'));debouncedSave();requestAnimationFrame(syncCropFrame)};
};

const baseRenderControls=window.renderControls;
window.renderControls=function(){const result=baseRenderControls();requestAnimationFrame(syncCropFrame);return result};

const baseRenderCanvas=window.renderCanvas;
if(typeof baseRenderCanvas==='function')window.renderCanvas=function(){const result=baseRenderCanvas.apply(this,arguments);Promise.resolve(result).finally(()=>requestAnimationFrame(syncCropFrame));return result};

window.addEventListener('resize',syncCropFrame);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&cropDrag)finishCropDrag()});
requestAnimationFrame(syncCropFrame);
})();
