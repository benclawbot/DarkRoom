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

function ensureStraightenGuide(){
  const wrap=q('#canvasWrap');if(!wrap)return null;
  let guide=q('#straightenGuide');
  if(!guide){guide=document.createElement('div');guide.id='straightenGuide';guide.className='straighten-guide hidden';wrap.appendChild(guide)}
  return guide;
}

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
  ensureStraightenGuide();
  if(!cropObserver&&window.ResizeObserver){cropObserver=new ResizeObserver(syncCropFrame);cropObserver.observe(q('#editorCanvas'));cropObserver.observe(wrap)}
  return frame;
}

function syncCropFrame(){
  const frame=ensureCropFrame(),canvas=q('#editorCanvas'),wrap=q('#canvasWrap');if(!frame||!canvas||!wrap)return;
  const straightening=typeof paintMode!=='undefined'&&paintMode==='straighten';
  const show=!!currentPhoto&&currentPanel==='transform'&&!q('#editorEmptyPicker:not(.hidden)')&&!straightening;
  frame.classList.toggle('hidden',!show);if(!show)return;
  setEditorFallback?.(false);
  frame.style.left=`${canvas.offsetLeft}px`;frame.style.top=`${canvas.offsetTop}px`;frame.style.width=`${canvas.offsetWidth}px`;frame.style.height=`${canvas.offsetHeight}px`;
}

function rectForDrag(d,e){
  const dx=e.clientX-d.startClientX,dy=e.clientY-d.startClientY,h=d.handle;
  let sx=1,sy=1;
  if(h.includes('e'))sx=(d.width+dx)/d.width;
  if(h.includes('w'))sx=(d.width-dx)/d.width;
  if(h.includes('s'))sy=(d.height+dy)/d.height;
  if(h.includes('n'))sy=(d.height-dy)/d.height;
  let scale;
  if(['e','w'].includes(h))scale=sx;
  else if(['n','s'].includes(h))scale=sy;
  else scale=Math.min(sx,sy);
  scale=clamp(scale,.25,1);
  const width=d.width*scale,height=d.height*scale;
  let left=d.left,top=d.top;
  if(h.includes('w'))left=d.left+d.width-width;
  else if(!h.includes('e'))left=d.left+(d.width-width)/2;
  if(h.includes('n'))top=d.top+d.height-height;
  else if(!h.includes('s'))top=d.top+(d.height-height)/2;
  return{left,top,width,height,scale};
}

function beginCropDrag(e){
  const h=e.target.closest?.('[data-crop-handle]');if(!h||!currentPhoto)return;
  e.preventDefault();e.stopPropagation();stopPainting?.();
  const frame=q('#directCropFrame'),ed=currentPhoto.edits;
  cropDrag={handle:h.dataset.cropHandle,startClientX:e.clientX,startClientY:e.clientY,left:frame.offsetLeft,top:frame.offsetTop,width:Math.max(1,frame.offsetWidth),height:Math.max(1,frame.offsetHeight),zoom:ed.cropZoom||100,x:ed.cropX??50,y:ed.cropY??50,pointerId:e.pointerId};
  captureHistory();h.setPointerCapture?.(e.pointerId);frame.classList.add('dragging');
}

function updateCropDrag(e){
  if(!cropDrag||!currentPhoto)return;
  const d=cropDrag,r=rectForDrag(d,e),frame=q('#directCropFrame'),ed=currentPhoto.edits;
  frame.style.left=`${r.left}px`;frame.style.top=`${r.top}px`;frame.style.width=`${r.width}px`;frame.style.height=`${r.height}px`;
  const baseCenterX=d.left+d.width/2,baseCenterY=d.top+d.height/2,nextCenterX=r.left+r.width/2,nextCenterY=r.top+r.height/2;
  const movementScale=100/Math.max(1,d.zoom/100);
  ed.cropZoom=clamp(Math.round(d.zoom/r.scale),100,400);
  ed.cropX=clamp(d.x+(nextCenterX-baseCenterX)/d.width*movementScale,0,100);
  ed.cropY=clamp(d.y+(nextCenterY-baseCenterY)/d.height*movementScale,0,100);
}

function finishCropDrag(){
  if(!cropDrag)return;
  cropDrag=null;q('#directCropFrame')?.classList.remove('dragging');captureHistory();debouncedSave();
  Promise.resolve(renderCanvas(q('#editorCanvas'))).finally(()=>requestAnimationFrame(syncCropFrame));
}

function startStraighten(e){
  e?.preventDefault?.();e?.stopPropagation?.();cropDrag=null;q('#directCropFrame')?.classList.add('hidden');
  stopPainting?.();setPaintMode('straighten');
  const hud=q('#paintHud');if(hud){hud.classList.remove('hidden');hud.querySelector('b').textContent='Draw a reference line';hud.querySelector('span').textContent='Drag along a horizon or vertical edge'}
  const guide=ensureStraightenGuide();guide?.classList.add('hidden');
  qa('.crop-mode-strip button').forEach(b=>b.classList.toggle('active',b.id==='drawStraighten'));
}

function updateStraightenGuide(e){
  if(typeof paintMode==='undefined'||paintMode!=='straighten'||typeof paintStroke==='undefined'||!paintStroke?.start)return;
  const canvas=q('#editorCanvas'),guide=ensureStraightenGuide();if(!canvas||!guide)return;
  const cr=canvas.getBoundingClientRect(),wr=q('#canvasWrap').getBoundingClientRect();
  const sx=cr.left-wr.left+paintStroke.start.x*cr.width,sy=cr.top-wr.top+paintStroke.start.y*cr.height;
  const ex=clamp(e.clientX,cr.left,cr.right)-wr.left,ey=clamp(e.clientY,cr.top,cr.bottom)-wr.top;
  const dx=ex-sx,dy=ey-sy,len=Math.hypot(dx,dy);if(len<2)return;
  guide.style.left=`${sx}px`;guide.style.top=`${sy}px`;guide.style.width=`${len}px`;guide.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;guide.classList.remove('hidden');
}
function hideStraightenGuide(){ensureStraightenGuide()?.classList.add('hidden');requestAnimationFrame(syncCropFrame)}

document.addEventListener('pointermove',e=>{updateCropDrag(e);updateStraightenGuide(e)},true);
document.addEventListener('pointerup',()=>{if(cropDrag)finishCropDrag();hideStraightenGuide()},true);
document.addEventListener('pointercancel',()=>{if(cropDrag)finishCropDrag();hideStraightenGuide()},true);

const baseBind=window.bindGeneratedControls;
window.bindGeneratedControls=function(){
  baseBind();
  if(q('#activateCropFrame'))q('#activateCropFrame').onclick=e=>{e.stopPropagation();stopPainting?.();qa('.crop-mode-strip button').forEach(b=>b.classList.toggle('active',b.id==='activateCropFrame'));syncCropFrame()};
  if(q('#drawStraighten'))q('#drawStraighten').onclick=startStraighten;
  if(q('#openPerspective'))q('#openPerspective').onclick=e=>{e.stopPropagation();stopPainting?.();qa('.crop-mode-strip button').forEach(b=>b.classList.toggle('active',b.id==='openPerspective'));const section=q('[data-section="geometry"]');if(!section)return;section.classList.remove('collapsed');setSectionOpen?.('geometry',true);section.scrollIntoView({block:'nearest',behavior:'smooth'})};
  qa('[data-transform="right"]').forEach(b=>{b.title='Rotate 90° clockwise'});
  if(q('#cropAspectSelect'))q('#cropAspectSelect').onchange=e=>{e.stopPropagation();captureHistory();currentPhoto.edits.cropAspect=e.target.value;captureHistory();debouncedSave();Promise.resolve(renderCanvas(q('#editorCanvas'))).finally(()=>requestAnimationFrame(syncCropFrame))};
  if(q('#resetCrop'))q('#resetCrop').onclick=e=>{e.stopPropagation();captureHistory();Object.assign(currentPhoto.edits,{angle:0,cropX:50,cropY:50,cropZoom:100,cropAspect:'original'});captureHistory();debouncedSave();renderControls();Promise.resolve(renderCanvas(q('#editorCanvas'))).finally(()=>requestAnimationFrame(syncCropFrame));toast('Crop reset')};
};

const baseRenderControls=window.renderControls;
window.renderControls=function(){const result=baseRenderControls();requestAnimationFrame(syncCropFrame);return result};

const baseRenderCanvas=window.renderCanvas;
if(typeof baseRenderCanvas==='function')window.renderCanvas=function(){const result=baseRenderCanvas.apply(this,arguments);Promise.resolve(result).finally(()=>requestAnimationFrame(syncCropFrame));return result};

window.addEventListener('resize',syncCropFrame);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(cropDrag)finishCropDrag();hideStraightenGuide()}});
requestAnimationFrame(syncCropFrame);
})();
