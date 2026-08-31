// Stable editor presentation geometry.
// Rendering resolution may change internally, but the photograph keeps the same on-screen size.
(function(root){
'use strict';
const q=s=>document.querySelector(s);
const canvas=()=>q('#editorCanvas');
let photoId=null,displayBox=null;

const style=document.createElement('style');
style.textContent='#editorCanvas[data-stable-preview="1"]{width:var(--darkroom-preview-width)!important;height:var(--darkroom-preview-height)!important;}';
document.head.appendChild(style);

function validSize(w,h){return Number.isFinite(w)&&Number.isFinite(h)&&w>8&&h>8}
function currentLayoutBox(c=canvas()){
  if(!c)return null;const w=c.offsetWidth||0,h=c.offsetHeight||0;return validSize(w,h)?{width:w,height:h,aspect:w/h}:null;
}
function stageBounds(){const s=q('#photoViewport');return{width:Math.max(80,(s?.clientWidth||960)-24),height:Math.max(80,(s?.clientHeight||720)-24)}}
function fittedFromLongEdge(longEdge,aspect){
  aspect=Math.max(.03,aspect||1);let width,height;if(aspect>=1){width=longEdge;height=width/aspect}else{height=longEdge;width=height*aspect}
  const max=stageBounds(),scale=Math.min(1,max.width/Math.max(1,width),max.height/Math.max(1,height));return{width:Math.max(1,width*scale),height:Math.max(1,height*scale),aspect};
}
function setStableBox(c,box){
  if(!c||!box||!validSize(box.width,box.height))return;displayBox={width:box.width,height:box.height,aspect:box.aspect||box.width/box.height};
  c.style.setProperty('--darkroom-preview-width',`${displayBox.width}px`);c.style.setProperty('--darkroom-preview-height',`${displayBox.height}px`);c.dataset.stablePreview='1';
}
function clearStableBox(c=canvas()){if(!c)return;delete c.dataset.stablePreview;c.style.removeProperty('--darkroom-preview-width');c.style.removeProperty('--darkroom-preview-height');displayBox=null}
function preserveForIntrinsic(c=canvas()){
  if(!c||!displayBox||!c.width||!c.height)return;const aspect=c.width/c.height,currentAspect=displayBox.aspect||displayBox.width/displayBox.height;
  if(Math.abs(aspect-currentAspect)<.002){setStableBox(c,{...displayBox,aspect});return}
  setStableBox(c,fittedFromLongEdge(Math.max(displayBox.width,displayBox.height),aspect));
}
function initializeAfterRender(c=canvas()){
  if(!c||!c.width||!c.height)return;const measured=currentLayoutBox(c);if(measured)setStableBox(c,measured);
}

const innerRender=typeof root.renderCanvas==='function'?root.renderCanvas:null;
if(innerRender){
  root.renderCanvas=function(c,maxSize,forceOriginal){
    if(c?.id!=='editorCanvas'||forceOriginal)return innerRender.apply(this,arguments);
    const id=typeof currentPhoto!=='undefined'?currentPhoto?.id:null;
    if(id!==photoId){photoId=id;clearStableBox(c)}
    else if(!displayBox){const measured=currentLayoutBox(c);if(measured)setStableBox(c,measured)}
    if(displayBox)preserveForIntrinsic(c);
    const result=innerRender.apply(this,arguments);
    return Promise.resolve(result).finally(()=>{if(id!==photoId)return;if(!displayBox)initializeAfterRender(c);else preserveForIntrinsic(c)});
  };
}

// performance-ui intentionally removes temporary inline width/height after its refined pass.
// The dataset rule above remains authoritative, so those internal changes never affect layout.
const observer=new MutationObserver(()=>{const c=canvas();if(c&&displayBox&&c.dataset.stablePreview!=='1')setStableBox(c,displayBox)});
const c=canvas();if(c)observer.observe(c,{attributes:true,attributeFilter:['style','data-stable-preview']});

window.addEventListener('resize',()=>{const c=canvas();if(!c||!displayBox)return;const aspect=c.width&&c.height?c.width/c.height:displayBox.aspect;setStableBox(c,fittedFromLongEdge(Math.max(displayBox.width,displayBox.height),aspect))});
requestAnimationFrame(()=>{const c=canvas();if(c&&typeof currentPhoto!=='undefined'&&currentPhoto){photoId=currentPhoto.id;initializeAfterRender(c)}});

root.DarkRoomPreviewGeometry={get box(){return displayBox?{...displayBox}:null},preserveForIntrinsic,clearStableBox};
})(typeof window!=='undefined'?window:globalThis);
