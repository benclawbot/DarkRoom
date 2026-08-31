// Keep the mask overlay preference authoritative after painting finishes.
(function(root){
'use strict';
const q=s=>document.querySelector(s);
let strokeActive=false;

function activeMask(){
  if(typeof currentPhoto==='undefined'||!currentPhoto)return null;
  const id=typeof activeLocalId!=='undefined'?activeLocalId:null;
  return (currentPhoto.localEdits||[]).find(m=>m.id===id)||null;
}
function pointerInsideCanvas(e){
  const c=q('#editorCanvas'),r=c?.getBoundingClientRect();
  return !!(c&&r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom);
}
function isBrushPaintMode(){return typeof paintMode!=='undefined'&&['add','erase'].includes(paintMode)}
function syncMaskOverlayVisibility(){
  const overlay=q('#maskOverlay'),m=activeMask();if(!overlay)return;
  const visible=!!m&&(m.uiVisible===true||strokeActive);
  overlay.classList.toggle('force-visible',visible);
  overlay.style.setProperty('opacity',visible?'1':'0','important');
  overlay.setAttribute('aria-hidden',visible?'false':'true');
}

const baseDraw=typeof root.drawMaskOverlay==='function'?root.drawMaskOverlay:null;
if(baseDraw){
  root.drawMaskOverlay=function(){const result=baseDraw.apply(this,arguments);syncMaskOverlayVisibility();return result};
}

// Brush mode intentionally stays active between strokes. Only an actual pointer stroke may temporarily reveal the overlay.
document.addEventListener('pointerdown',e=>{
  if(!isBrushPaintMode()||!pointerInsideCanvas(e))return;
  strokeActive=true;syncMaskOverlayVisibility();
},true);
function finishStroke(){
  if(!strokeActive)return;
  strokeActive=false;requestAnimationFrame(syncMaskOverlayVisibility);
}
document.addEventListener('pointerup',finishStroke,true);
document.addEventListener('pointercancel',finishStroke,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){strokeActive=false;requestAnimationFrame(syncMaskOverlayVisibility)}},true);

// Re-sync after controls that can change the active mask or its explicit visibility preference.
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-mask-visibility],[data-local-select],[data-tool-toggle],#newBrushMask,#newLassoMask'))requestAnimationFrame(syncMaskOverlayVisibility);
},true);

root.DarkRoomMaskOverlayVisibility={sync:syncMaskOverlayVisibility,isStrokeActive:()=>strokeActive};
requestAnimationFrame(syncMaskOverlayVisibility);
})(typeof window!=='undefined'?window:globalThis);
