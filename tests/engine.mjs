import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
vm.runInThisContext(fs.readFileSync(new URL('../engine-core.js',import.meta.url),'utf8'));
const E=globalThis.DarkRoomEngine;assert(E,'engine loaded');
const px=(r,g,b,a=255)=>new Uint8ClampedArray([r,g,b,a]);
const changed=(a,b)=>a.some((v,i)=>v!==b[i]);

// Global tone / color pipeline
const neutral=E.applyTonePixel(100,120,140,{gamma:100,gradeBlending:50});assert(neutral.every(Number.isFinite));
const bright=E.applyTonePixel(100,100,100,{exposure:50,gamma:100});assert(bright[0]>100,'exposure should brighten');
const sat=E.applyTonePixel(180,100,90,{saturation:-100,gamma:100});assert(Math.max(...sat)-Math.min(...sat)===0,'saturation -100 must produce true black and white');
const redHue=E.applyTonePixel(210,50,45,{hueRed:80,gamma:100});assert(Math.abs(redHue[1]-50)>2||Math.abs(redHue[2]-45)>2,'HSL hue should alter red-band color');
const redLum=E.applyTonePixel(210,50,45,{lumRed:80,gamma:100});assert(redLum.reduce((a,b)=>a+b,0)>305,'HSL luminance should brighten red band');
const graded=E.applyTonePixel(80,80,80,{gradeShadowHue:220,gradeShadowSat:80,gradeBlending:70,gamma:100});assert(changed(graded,[80,80,80]),'color grading should alter shadow color');

// Masks and mask algebra
const brush={type:'brush',size:.3,feather:.5,flow:1,opacity:1,density:1,strokes:[{size:.3,feather:.5,flow:1,points:[{x:.5,y:.5}]}]};
assert(E.maskValue(brush,.5,.5,0,0,0,.5)>.9);assert(E.maskValue(brush,.05,.05,0,0,0,.5)===0);
const subtract={...structuredClone(brush),modifiers:[{type:'brush',operation:'subtract',size:.2,feather:.2,flow:1,strokes:[{size:.2,feather:.2,flow:1,points:[{x:.5,y:.5}]}]}]};assert(E.maskValue(subtract,.5,.5,0,0,0,.5)<.2,'subtract modifier should remove mask area');
const intersect={...structuredClone(brush),modifiers:[{type:'box',operation:'intersect',box:{xmin:.4,ymin:.4,xmax:.6,ymax:.6},feather:.01}]};assert(E.maskValue(intersect,.5,.5,0,0,0,.5)>.8&&E.maskValue(intersect,.35,.5,0,0,0,.5)===0,'intersect modifier should constrain mask');
const lum={type:'luminance',lo:.6,hi:1,feather:.1,opacity:1,density:1};assert(E.maskValue(lum,.5,.5,240,240,240,.94)>.5&&E.maskValue(lum,.5,.5,40,40,40,.16)===0,'luminance range should work');
const hue={type:'hue',hue:0,tolerance:25,opacity:1,density:1};assert(E.maskValue(hue,.5,.5,230,40,40,.4)>.6,'hue range should select red');

// Smart semantic fallbacks
const w=24,h=24,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;data[i]=110;data[i+1]=120;data[i+2]=130;data[i+3]=255;if(y<8){data[i]=90;data[i+1]=145;data[i+2]=225}if(x>7&&x<17&&y>7&&y<21){data[i]=220;data[i+1]=90;data[i+2]=70}}
for(const type of ['subject','object','background','sky','person','face','skin','hair','eyes','teeth','lips','clothing','water','vegetation','architecture','mountains','snow','ground','artificialGround']){const r=E.smartMaskRaster(data,w,h,type);assert.equal(r.data.length,w*h,`${type} raster size`);assert(r.data.every(v=>Number.isFinite(v)&&v>=0&&v<=255),`${type} fallback values must be valid`);if(['subject','object','background','sky'].includes(type))assert(r.data.some(v=>v>0),`${type} fallback should select something`) }

// Local adjustments including dodge and burn behavior
const base=new Uint8ClampedArray(data);const dodge={...structuredClone(brush),type:'dodge',adjust:{exposure:40}};const burn={...structuredClone(brush),type:'burn',adjust:{exposure:-40}};const d=E.applyLocalEdits(new Uint8ClampedArray(base),w,h,[dodge]),b=E.applyLocalEdits(new Uint8ClampedArray(base),w,h,[burn]),mid=((12*w+12)*4);assert(d[mid]>base[mid],'dodge should brighten painted area');assert(b[mid]<base[mid],'burn should darken painted area');

// Detail, restoration, portrait and relighting
const noisy=new Uint8ClampedArray(w*h*4);for(let i=0;i<noisy.length;i+=4){const v=(i/4)%2?70:190;noisy[i]=v;noisy[i+1]=130;noisy[i+2]=150;noisy[i+3]=255}
assert(changed(E.detailProcess(noisy,w,h,80,0,{colorNoise:50}),noisy),'denoise should change noisy pixels');
assert(changed(E.detailProcess(noisy,w,h,0,0,{deblur:70}),noisy),'deblur should sharpen pixels');
const speck=new Uint8ClampedArray(data);speck[(12*w+12)*4]=255;speck[(12*w+12)*4+1]=255;speck[(12*w+12)*4+2]=255;assert(changed(E.restoreProcess(speck,w,h,{dustRemoval:100,lineRemoval:0,blemish:0}),speck),'dust removal should alter outlier');
assert(changed(E.portraitProcess(data,w,h,{skinSmooth:50,eyes:40,lips:30,faceLight:20,faceRestore:40}),data),'portrait process should alter portrait-like pixels');
assert(changed(E.relightProcess(data,w,h,{relightForeground:50,relightBackground:-20,rimLight:20,relightWarmth:20,relightDirection:50,relightSoftness:50}),data),'relight should alter pixels');

// Remove/clone/generative algorithms
const heal={type:'heal',size:.35,feather:.2,flow:1,opacity:1,density:1,strokes:[{size:.35,feather:.2,flow:1,points:[{x:.5,y:.5}]}]};
const repaired=E.inpaint(new Uint8ClampedArray(data),w,h,heal,4);assert.equal(repaired.length,data.length);assert(changed(repaired,data),'content-aware inpaint should change masked pixels');
const cloned=E.clonePaint(new Uint8ClampedArray(data),w,h,heal,-.25,0);assert(changed(cloned,data),'clone should copy pixels from source offset');
const gen=E.generativeFill(new Uint8ClampedArray(data),w,h,heal,'blue replacement');assert(changed(gen,data),'generative fallback should change the selected region');

// Analysis and histogram
const stats=E.analyzePixels(data);assert(stats.mean>0&&stats.mean<1);const auto=E.autoEdits(stats);assert(Number.isFinite(auto.exposure));const hist=E.histogram(data,32);assert.equal(hist.r.length,32);assert.equal(hist.l.reduce((a,b)=>a+b,0),w*h);
console.log('Pixel engine tests passed: tone, HSL, grading, masks, local edits, smart masks, detail, retouch, restore, relight, remove/clone/generative.');
// v7 professional engine coverage
const layerBase=new Uint8ClampedArray([100,100,100,255]);const layered=E.applyAdjustmentLayers(layerBase,1,1,[{opacity:1,blend:'normal',edits:{exposure:50}}]);assert(layered[0]>100,'adjustment layer should affect pixels');
const lut={size:2,data:[0,0,0,1,0,0,0,1,0,1,1,0,0,0,1,1,0,1,0,1,1,1,1,1]};const lutOut=E.applyLUT(new Uint8ClampedArray([255,255,255,255]),lut,1);assert(lutOut[0]>240&&lutOut[1]>240&&lutOut[2]>240,'identity LUT corner should stay white');
const q=E.qualityMetrics(data,w,h);assert(q.sharpness>=0&&q.sharpness<=100,'quality sharpness range');
const redEye=new Uint8ClampedArray(20*20*4).fill(0);for(let i=0;i<redEye.length;i+=4){redEye[i]=200;redEye[i+1]=50;redEye[i+2]=40;redEye[i+3]=255}const re=E.redEyeProcess(redEye,20,20,100);assert(re.some((v,i)=>i%4===0&&v<200),'red-eye reduction should reduce red in eye region');
const freq=E.frequencyProcess(data,w,h,50,25);assert(freq.length===data.length,'frequency processing keeps size');
assert(E.mergeAverage([data,data]).length===data.length,'noise stack merge size');assert(E.mergeHDR([data,data]).length===data.length,'HDR merge size');assert(E.mergeFocus([data,data],w,h).length===data.length,'focus merge size');

{
 const px=new Uint8ClampedArray([255,0,0,255,0,255,0,255]);const t=E.encodeTIFF(px,2,1);assert.equal(t[0],0x49);assert.equal(t[1],0x49);assert.equal(new DataView(t.buffer,t.byteOffset,t.byteLength).getUint16(2,true),42);assert(t.length>px.length,'TIFF encoder should include a valid header/IFD');
}
console.log('Professional engine tests passed: layers, LUT, quality, red-eye/frequency, HDR/noise/focus merges, TIFF.');
