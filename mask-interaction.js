// Mask interaction corrections: keep overlays on the rendered photo, make brush strokes continuous,
// and use a real vector lasso instead of rasterizing a polygon into sparse brush samples.
(function(root){
'use strict';
const q=s=>document.querySelector(s);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const E=root.DarkRoomEngine;

function activeMask(){
  if(typeof currentPhoto==='undefined'||!currentPhoto)return null;
  const id=typeof activeLocalId!=='undefined'?activeLocalId:null;
  return (currentPhoto.localEdits||[]).find(m=>m.id===id)||null;
}

// Brush coordinates are normalized, but the displayed photograph usually is not square.
// Measure distance in short-edge units and interpolate every segment so fast strokes have no gaps.
if(E?.maskValue&&!root.DarkRoomMaskInteractionEngineInstalled){
  const baseMaskValue=E.maskValue.bind(E);
  const isBrush=m=>!!m&&['brush','dodge','burn','heal','clone'].includes(m.type);
  const isSpecial=m=>isBrush(m)||m?.type==='lasso';
  const pointMetric=(p,aspect)=>aspect>=1?{x:p.x*aspect,y:p.y}:{x:p.x,y:p.y/Math.max(.0001,aspect)};
  function pointSegmentDistance(p,a,b){
    const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,den=vx*vx+vy*vy;
    const t=den?clamp((wx*vx+wy*vy)/den):0,dx=p.x-(a.x+vx*t),dy=p.y-(a.y+vy*t);
    return Math.hypot(dx,dy);
  }
  function brushCoverage(mask,x,y,r=128,g=128,b=128){
    let best=0;
    for(const stroke of mask.strokes||[]){
      const radius=Math.max(.0001,(stroke.size||mask.size||.08)/2),feather=clamp(stroke.feather??mask.feather??.6),aspect=Math.max(.05,+stroke.aspect||+mask.aspect||1);
      const p=pointMetric({x,y},aspect),points=(stroke.points||[]).map(v=>pointMetric(v,aspect));
      let distance=Infinity;
      if(points.length===1)distance=Math.hypot(p.x-points[0].x,p.y-points[0].y);
      else for(let i=1;i<points.length;i++)distance=Math.min(distance,pointSegmentDistance(p,points[i-1],points[i]));
      if(!Number.isFinite(distance)||distance>=radius)continue;
      const hard=radius*(1-feather*.88),edge=Math.max(.0001,radius-hard),coverage=distance<=hard?1:1-(distance-hard)/edge;
      let sv=clamp(coverage)*Math.abs(stroke.flow??mask.flow??1);
      if(stroke.autoMask&&stroke.target){
        const t=stroke.target,tol=stroke.edgeTolerance||85,similarity=clamp(1-Math.hypot(r-t[0],g-t[1],b-t[2])/tol);sv*=similarity;
      }
      best=stroke.erase?best*(1-sv):Math.max(best,sv);
    }
    return clamp(best);
  }
  function pointInPolygon(x,y,points){
    if(!Array.isArray(points)||points.length<3)return 0;
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j],cross=((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y||1e-12)+a.x);
      if(cross)inside=!inside;
    }
    return inside?1:0;
  }
  function rangeBand(value,lo,hi,soft=.08){return clamp(Math.min((value-lo)/Math.max(.001,soft),(hi-value)/Math.max(.001,soft),1))}
  function specialValue(mask,x,y,r,g,b,luma){
    if(!mask||mask.enabled===false)return 0;
    let v=isBrush(mask)?brushCoverage(mask,x,y,r,g,b):pointInPolygon(x,y,mask.points);
    for(const mod of mask.modifiers||[]){
      let mv=isSpecial(mod)?specialValue(mod,x,y,r,g,b,luma):baseMaskValue(mod,x,y,r,g,b,luma);
      if(mod.operation==='subtract')v*=1-mv;else if(mod.operation==='intersect')v*=mv;else v=Math.max(v,mv);
    }
    if(mask.intersect)v*=rangeBand(luma,mask.intersect.lo??.2,mask.intersect.hi??.8,mask.intersect.feather??.08);
    if(mask.invert)v=1-v;
    return clamp(v*(mask.density??1)*(mask.opacity??1));
  }
  E.maskValue=function(mask,x,y,r,g,b,luma){return isSpecial(mask)?specialValue(mask,x,y,r,g,b,luma):baseMaskValue(mask,x,y,r,g,b,luma)};
  root.DarkRoomMaskInteractionEngineInstalled=true;
}

function syncOverlayGeometry(){
  const wrap=q('#canvasWrap'),base=q('#editorCanvas');if(!wrap||!base||base.offsetWidth<2||base.offsetHeight<2)return;
  for(const overlay of [q('#maskOverlay'),q('#lassoGuideOverlay')]){
    if(!overlay)continue;
    overlay.style.setProperty('position','absolute','important');
    overlay.style.setProperty('left',`${base.offsetLeft}px`,'important');
    overlay.style.setProperty('top',`${base.offsetTop}px`,'important');
    overlay.style.setProperty('right','auto','important');overlay.style.setProperty('bottom','auto','important');
    overlay.style.setProperty('width',`${base.offsetWidth}px`,'important');overlay.style.setProperty('height',`${base.offsetHeight}px`,'important');
  }
}
function ensureGuide(){
  const wrap=q('#canvasWrap');if(!wrap)return null;
  let c=q('#lassoGuideOverlay');
  if(!c){c=document.createElement('canvas');c.id='lassoGuideOverlay';c.setAttribute('aria-hidden','true');c.style.pointerEvents='none';c.style.zIndex='8';c.style.background='transparent';c.style.boxShadow='none';wrap.appendChild(c)}
  syncOverlayGeometry();return c;
}
function clearGuide(){const c=q('#lassoGuideOverlay');if(c)c.getContext('2d')?.clearRect(0,0,c.width,c.height)}

const baseDrawMaskOverlay=typeof root.drawMaskOverlay==='function'?root.drawMaskOverlay:null;
if(baseDrawMaskOverlay){
  root.drawMaskOverlay=function(){syncOverlayGeometry();const result=baseDrawMaskOverlay.apply(this,arguments);syncOverlayGeometry();return result};
}
const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>syncOverlayGeometry()):null;
if(resizeObserver){const c=q('#editorCanvas'),w=q('#canvasWrap');if(c)resizeObserver.observe(c);if(w)resizeObserver.observe(w)}
window.addEventListener('resize',syncOverlayGeometry);

// Give ordinary brush strokes the photograph aspect ratio used when they were painted.
document.addEventListener('pointerdown',e=>{
  if(typeof paintMode==='undefined'||!['add','erase'].includes(paintMode))return;
  const canvas=q('#editorCanvas'),rect=canvas?.getBoundingClientRect();if(!canvas||!rect||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
  const m=activeMask();if(!m)return;const index=(m.strokes||[]).length,aspect=rect.width/Math.max(1,rect.height);m.aspect=aspect;
  queueMicrotask(()=>{const stroke=m.strokes?.[index];if(stroke&&!Number.isFinite(+stroke.aspect))stroke.aspect=aspect});
},true);

// Lightroom-style brush cursor: the painted coverage is centered exactly below this circle.
function ensureBrushCursor(){
  const wrap=q('#canvasWrap');if(!wrap)return null;let el=q('#maskBrushCursor');
  if(!el){el=document.createElement('div');el.id='maskBrushCursor';el.innerHTML='<i></i>';Object.assign(el.style,{position:'absolute',zIndex:'9',pointerEvents:'none',border:'1px solid rgba(255,255,255,.95)',borderRadius:'50%',boxShadow:'0 0 0 1px rgba(0,0,0,.65)',transform:'translate(-50%,-50%)',display:'none'});Object.assign(el.firstElementChild.style,{position:'absolute',left:'50%',top:'50%',border:'1px solid rgba(255,255,255,.7)',borderRadius:'50%',transform:'translate(-50%,-50%)'});wrap.appendChild(el)}return el;
}
function updateBrushCursor(e){
  const el=ensureBrushCursor(),canvas=q('#editorCanvas');if(!el||!canvas||typeof paintMode==='undefined'||!['add','erase'].includes(paintMode)){if(el)el.style.display='none';return}
  const rect=canvas.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom){el.style.display='none';return}
  const m=activeMask();if(!m){el.style.display='none';return}const px=(e.clientX-rect.left)/Math.max(1,rect.width),py=(e.clientY-rect.top)/Math.max(1,rect.height),diameter=Math.max(4,(m.size||.08)*Math.min(canvas.offsetWidth,canvas.offsetHeight));
  el.style.left=`${canvas.offsetLeft+px*canvas.offsetWidth}px`;el.style.top=`${canvas.offsetTop+py*canvas.offsetHeight}px`;el.style.width=el.style.height=`${diameter}px`;el.style.display='block';
  const inner=el.firstElementChild,hard=Math.max(2,diameter*(1-(m.feather??.6)*.88));inner.style.width=inner.style.height=`${hard}px`;
}
document.addEventListener('pointermove',updateBrushCursor,true);document.addEventListener('pointerdown',updateBrushCursor,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const el=q('#maskBrushCursor');if(el)el.style.display='none'}},true);

// Vector lasso. While dragging only the boundary is drawn; release closes the polygon and the mask engine fills it.
let lassoState=null;
function canvasPoint(e,allowClamp=false){
  const canvas=q('#editorCanvas'),rect=canvas?.getBoundingClientRect();if(!canvas||!rect?.width||!rect?.height)return null;
  if(!allowClamp&&(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom))return null;
  return{x:clamp((e.clientX-rect.left)/rect.width),y:clamp((e.clientY-rect.top)/rect.height),rect};
}
function drawLassoGuide(){
  const guide=ensureGuide();if(!guide)return;const base=q('#editorCanvas');guide.width=base.width;guide.height=base.height;syncOverlayGeometry();const x=guide.getContext('2d');x.clearRect(0,0,guide.width,guide.height);const pts=lassoState?.points||[];if(!pts.length)return;
  x.save();x.strokeStyle='rgba(255,255,255,.96)';x.lineWidth=Math.max(1.2,guide.width/900);x.setLineDash([Math.max(4,guide.width/180),Math.max(3,guide.width/230)]);x.shadowColor='rgba(0,0,0,.8)';x.shadowBlur=Math.max(1,guide.width/700);x.beginPath();x.moveTo(pts[0].x*guide.width,pts[0].y*guide.height);for(const p of pts.slice(1))x.lineTo(p.x*guide.width,p.y*guide.height);x.stroke();x.restore();
}
function startVectorLasso(e){
  e?.preventDefault?.();e?.stopPropagation?.();if(!currentPhoto)return;
  if(typeof stopPainting==='function')stopPainting();
  const m=typeof newMask==='function'?newMask('lasso','Lasso'):{id:`lasso-${Date.now()}`,type:'lasso',name:'Lasso',enabled:true,invert:false,opacity:1,density:1,adjust:{},modifiers:[]};m.points=[];m.uiVisible=true;
  if(typeof captureHistory==='function')captureHistory();currentPhoto.localEdits=currentPhoto.localEdits||[];currentPhoto.localEdits.push(m);activeLocalId=m.id;if(typeof captureHistory==='function')captureHistory();
  paintMode='vector-lasso';lassoState={maskId:m.id,points:[],pointerId:null};q('#photoViewport')?.classList.add('painting');const hud=q('#paintHud');hud?.classList.remove('hidden');if(hud?.querySelector('b'))hud.querySelector('b').textContent='Draw lasso';if(hud?.querySelector('span'))hud.querySelector('span').textContent='Trace the selection boundary · release to close';
  if(typeof renderControls==='function')renderControls();syncOverlayGeometry();if(typeof drawMaskOverlay==='function')drawMaskOverlay();clearGuide();
}
function finishVectorLasso(cancel=false){
  if(!lassoState)return;const m=(currentPhoto?.localEdits||[]).find(x=>x.id===lassoState.maskId),points=lassoState.points.slice();
  if(cancel||points.length<3){currentPhoto.localEdits=(currentPhoto.localEdits||[]).filter(x=>x.id!==lassoState.maskId);if(activeLocalId===lassoState.maskId)activeLocalId=currentPhoto.localEdits[0]?.id||null}
  else if(m){m.points=points.map(({x,y})=>({x,y}));m.uiVisible=false;m.aspect=q('#editorCanvas')?.getBoundingClientRect().width/Math.max(1,q('#editorCanvas')?.getBoundingClientRect().height||1)}
  lassoState=null;paintMode=null;if(typeof paintStroke!=='undefined')paintStroke=null;q('#photoViewport')?.classList.remove('painting');q('#paintHud')?.classList.add('hidden');clearGuide();if(typeof captureHistory==='function')captureHistory();if(typeof renderControls==='function')renderControls();if(typeof drawMaskOverlay==='function')drawMaskOverlay();if(!cancel&&points.length>=3&&typeof renderCanvas==='function')renderCanvas(q('#editorCanvas'));if(typeof debouncedSave==='function')debouncedSave();
}
document.addEventListener('pointerdown',e=>{
  if(typeof paintMode==='undefined'||paintMode!=='vector-lasso')return;const p=canvasPoint(e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();lassoState.points=[{x:p.x,y:p.y}];lassoState.pointerId=e.pointerId;q('#editorCanvas')?.setPointerCapture?.(e.pointerId);drawLassoGuide();
},true);
document.addEventListener('pointermove',e=>{
  if(typeof paintMode==='undefined'||paintMode!=='vector-lasso'||!lassoState?.points.length)return;if(lassoState.pointerId!==null&&e.pointerId!==lassoState.pointerId)return;const p=canvasPoint(e,true);if(!p)return;e.preventDefault();e.stopImmediatePropagation();const last=lassoState.points.at(-1),distance=Math.hypot((p.x-last.x)*p.rect.width,(p.y-last.y)*p.rect.height);if(distance>=1.5){lassoState.points.push({x:p.x,y:p.y});drawLassoGuide()}
},true);
document.addEventListener('pointerup',e=>{if(typeof paintMode==='undefined'||paintMode!=='vector-lasso'||!lassoState?.points.length)return;e.preventDefault();e.stopImmediatePropagation();const p=canvasPoint(e,true),last=lassoState.points.at(-1);if(p&&Math.hypot((p.x-last.x)*p.rect.width,(p.y-last.y)*p.rect.height)>=1)lassoState.points.push({x:p.x,y:p.y});finishVectorLasso(false)},true);
document.addEventListener('pointercancel',e=>{if(typeof paintMode==='undefined'||paintMode!=='vector-lasso')return;e.preventDefault();e.stopImmediatePropagation();finishVectorLasso(true)},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&typeof paintMode!=='undefined'&&paintMode==='vector-lasso'){e.preventDefault();finishVectorLasso(true)}},true);

if(typeof root.bindGeneratedControls==='function'){
  const baseBindGenerated=root.bindGeneratedControls;
  root.bindGeneratedControls=function(){const result=baseBindGenerated.apply(this,arguments),button=q('#newLassoMask');if(button)button.onclick=startVectorLasso;return result};
}

root.DarkRoomMaskInteraction={syncOverlayGeometry,finishVectorLasso};
requestAnimationFrame(syncOverlayGeometry);
})(typeof window!=='undefined'?window:globalThis);
