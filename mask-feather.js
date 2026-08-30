// Image-relative edge feathering for local masks.
// Keeps a subtle default falloff on drawn masks and exposes a variable radius without tying it to preview resolution.
(function(root){
'use strict';
const E=root.DarkRoomEngine;
if(!E||root.DarkRoomMaskFeather?.installed)return;

const DEFAULT_DRAWN_FEATHER_PERCENT=1.5;
const MAX_FEATHER_PERCENT=12;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const drawnMask=m=>!!m&&(['brush','dodge','burn'].includes(m.type)||m.name==='Lasso');
const effectiveFeatherPercent=m=>{
  if(!m)return 0;
  if(Number.isFinite(+m.edgeFeather))return clamp(+m.edgeFeather,0,MAX_FEATHER_PERCENT);
  return drawnMask(m)?DEFAULT_DRAWN_FEATHER_PERCENT:0;
};

function blurPass(src,w,h,radius){
  if(radius<=0)return src;
  const span=radius*2+1,tmp=new Float32Array(src.length),out=new Float32Array(src.length);
  for(let y=0;y<h;y++){
    const row=y*w;let sum=0;
    for(let k=-radius;k<=radius;k++)sum+=src[row+clamp(k,0,w-1)];
    for(let x=0;x<w;x++){
      tmp[row+x]=sum/span;
      sum-=src[row+clamp(x-radius,0,w-1)];
      sum+=src[row+clamp(x+radius+1,0,w-1)];
    }
  }
  for(let x=0;x<w;x++){
    let sum=0;
    for(let k=-radius;k<=radius;k++)sum+=tmp[clamp(k,0,h-1)*w+x];
    for(let y=0;y<h;y++){
      out[y*w+x]=sum/span;
      sum-=tmp[clamp(y-radius,0,h-1)*w+x];
      sum+=tmp[clamp(y+radius+1,0,h-1)*w+x];
    }
  }
  return out;
}

function featherCoverage(src,w,h,percent){
  const radius=Math.max(0,Math.round(Math.max(w,h)*clamp(+percent||0,0,MAX_FEATHER_PERCENT)/100));
  if(!radius)return src;
  const passRadius=Math.max(1,Math.ceil(radius/2));
  let out=blurPass(src,w,h,passRadius);
  out=blurPass(out,w,h,passRadius);
  return out;
}

const rawMaskValue=E.maskValue.bind(E);
function buildMaskCoverage(data,w,h,mask){
  const coverage=new Float32Array(w*h),denX=Math.max(1,w-1),denY=Math.max(1,h-1);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x,i=p*4,r=data[i],g=data[i+1],b=data[i+2],l=(.2126*r+.7152*g+.0722*b)/255;
    coverage[p]=rawMaskValue(mask,x/denX,y/denY,r,g,b,l);
  }
  return featherCoverage(coverage,w,h,effectiveFeatherPercent(mask));
}

const baseApplyLocalEdits=E.applyLocalEdits.bind(E);
E.applyLocalEdits=function(data,w,h,locals=[]){
  if(!locals?.length)return data;
  if(!locals.some(m=>effectiveFeatherPercent(m)>0))return baseApplyLocalEdits(data,w,h,locals);
  for(const mask of locals){
    if(mask?.enabled===false)continue;
    const coverage=buildMaskCoverage(data,w,h,mask);
    for(let p=0;p<coverage.length;p++){
      let mv=coverage[p];if(mv<=.001)continue;
      mv=mv*mv*(3-2*mv); // smoothstep: soft derivative at both ends of the falloff.
      const i=p*4,out=E.localAdjustPixel(data[i],data[i+1],data[i+2],mask.adjust,mv);
      data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];
    }
  }
  return data;
};

if(typeof root.newMask==='function'){
  const baseNewMask=root.newMask;
  root.newMask=function(type,name,adjust){
    const mask=baseNewMask(type,name,adjust);
    if(!Number.isFinite(+mask.edgeFeather))mask.edgeFeather=drawnMask(mask)?DEFAULT_DRAWN_FEATHER_PERCENT:0;
    return mask;
  };
}

function activeMask(){
  if(typeof currentPhoto==='undefined'||!currentPhoto)return null;
  const id=typeof activeLocalId!=='undefined'?activeLocalId:null;
  return (currentPhoto.localEdits||[]).find(m=>m.id===id)||null;
}
function formatPercent(v){return Number.isInteger(v)?String(v):String(Math.round(v*100)/100)}

if(typeof document!=='undefined'&&typeof root.renderMasksPanel==='function'){
  const baseRenderMasksPanel=root.renderMasksPanel;
  root.renderMasksPanel=function(){
    const html=baseRenderMasksPanel.apply(this,arguments),m=activeMask();
    if(!m)return html;
    const value=effectiveFeatherPercent(m),control=`<label class="mask-brush-size mask-edge-feather"><span>Edge feather</span><input id="maskEdgeFeather" type="range" min="0" max="${MAX_FEATHER_PERCENT}" step="0.25" value="${value}"><b id="maskEdgeFeatherValue">${formatPercent(value)}%</b></label><p class="feature-note mask-feather-note">Image-relative falloff radius. 0% keeps a hard edge.</p>`;
    return html.replace('<div class="mask-adjustments"><h4>Adjust selected mask</h4>',`<div class="mask-adjustments">${control}<h4>Adjust selected mask</h4>`);
  };
}

if(typeof document!=='undefined'&&typeof root.bindGeneratedControls==='function'){
  const baseBindGeneratedControls=root.bindGeneratedControls;
  root.bindGeneratedControls=function(){
    const result=baseBindGeneratedControls.apply(this,arguments),slider=document.querySelector('#maskEdgeFeather');
    if(slider){
      slider.onpointerdown=()=>{if(typeof captureHistory==='function')captureHistory()};
      slider.oninput=e=>{
        const m=activeMask();if(!m)return;
        m.edgeFeather=clamp(+e.target.value||0,0,MAX_FEATHER_PERCENT);
        const label=document.querySelector('#maskEdgeFeatherValue');if(label)label.textContent=`${formatPercent(m.edgeFeather)}%`;
        if(typeof drawMaskOverlay==='function')drawMaskOverlay();
        if(typeof renderCanvas==='function')renderCanvas(document.querySelector('#editorCanvas'));
      };
      slider.onchange=()=>{if(typeof captureHistory==='function')captureHistory();if(typeof debouncedSave==='function')debouncedSave()};
    }
    return result;
  };
}

if(typeof document!=='undefined'&&typeof root.drawMaskOverlay==='function'){
  const baseDrawMaskOverlay=root.drawMaskOverlay;
  root.drawMaskOverlay=function(){
    const result=baseDrawMaskOverlay.apply(this,arguments),overlay=document.querySelector('#maskOverlay'),m=activeMask();
    if(overlay){
      const pct=effectiveFeatherPercent(m),rect=overlay.getBoundingClientRect(),radius=Math.max(rect.width,rect.height)*pct/100;
      overlay.style.filter=pct?`blur(${Math.max(.35,radius*.42)}px)`:'none';
    }
    return result;
  };
}

root.DarkRoomMaskFeather={installed:true,DEFAULT_DRAWN_FEATHER_PERCENT,MAX_FEATHER_PERCENT,effectiveFeatherPercent,featherCoverage,buildMaskCoverage};
})(typeof window!=='undefined'?window:globalThis);
