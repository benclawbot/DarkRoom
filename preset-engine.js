(function(root){
'use strict';
const E=root.DarkRoomEngine;
if(!E||typeof E.applyTonePixel!=='function'||typeof E.rgbToHsl!=='function'||typeof E.hslToRgb!=='function')return;
const BANDS=[['Red',0],['Orange',30],['Yellow',60],['Green',120],['Aqua',180],['Blue',240],['Purple',280],['Magenta',325],['Red',360]];
const MIXER_NAMES=['Red','Orange','Yellow','Green','Aqua','Blue','Purple','Magenta'];
const MIXER_KEYS=MIXER_NAMES.flatMap(name=>[`hue${name}`,`sat${name}`,`lum${name}`]);
const baseTonePixel=E.applyTonePixel.bind(E);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
function hasMixer(edits={}){return MIXER_KEYS.some(key=>Math.abs(Number(edits[key])||0)>.0001)}
function neutralizeMixer(edits={}){const neutral={...edits};for(const key of MIXER_KEYS)neutral[key]=0;return neutral}
function interpolatedMixer(hue,edits={}){
 const h=((Number(hue)||0)%360+360)%360;
 let left=BANDS[0],right=BANDS[1];
 for(let i=0;i<BANDS.length-1;i++){if(h>=BANDS[i][1]&&h<=BANDS[i+1][1]){left=BANDS[i];right=BANDS[i+1];break}}
 const span=Math.max(.0001,right[1]-left[1]),t=smooth((h-left[1])/span),a=left[0],b=right[0];
 const lerpKey=prefix=>(Number(edits[prefix+a])||0)+((Number(edits[prefix+b])||0)-(Number(edits[prefix+a])||0))*t;
 return{hue:lerpKey('hue'),sat:lerpKey('sat'),lum:lerpKey('lum')};
}
function chromaWeight(saturation){return smooth((saturation-.035)/.145)}
function applySmoothMixer(r,g,b,edits={}){
 let[h,s,l]=E.rgbToHsl(r,g,b);const mix=interpolatedMixer(h,edits),weight=chromaWeight(s);
 if(weight<=.0001)return[r,g,b];
 h+=mix.hue/100*45*weight;
 s=clamp(s*(1+mix.sat/100*.7*weight));
 const lumDelta=mix.lum/100*.22*weight,headroom=lumDelta>=0?clamp((1-l)/.22):clamp(l/.22);
 l=clamp(l+lumDelta*headroom);
 return E.hslToRgb(h,s,l);
}
function applyPresetPixel(r,g,b,edits={},neutralEdits){const base=baseTonePixel(r,g,b,neutralEdits||neutralizeMixer(edits));return applySmoothMixer(base[0],base[1],base[2],edits)}
root.DarkRoomPresetEngine={BANDS,MIXER_KEYS,hasMixer,neutralizeMixer,interpolatedMixer,chromaWeight,applySmoothMixer,applyPresetPixel};
if(typeof applyGlobalPixels==='function'){
 const originalApplyGlobalPixels=applyGlobalPixels;
 applyGlobalPixels=function(img,edits){
  if(!hasMixer(edits))return originalApplyGlobalPixels(img,edits);
  const d=img.data,neutral=neutralizeMixer(edits);
  for(let i=0;i<d.length;i+=4){const p=applyPresetPixel(d[i],d[i+1],d[i+2],edits,neutral);d[i]=p[0];d[i+1]=p[1];d[i+2]=p[2]}
  return img
 };
}
})(globalThis);
