import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0,s=0,l=(mx+mn)/2;if(d){s=d/(1-Math.abs(2*l-1));if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360}return[h,s,l]}
function hslToRgb(h,s,l){h=((h%360)+360)%360;s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}return[(r+m)*255,(g+m)*255,(b+m)*255]}

const engineSource=fs.readFileSync(new URL('../preset-engine.js',import.meta.url),'utf8');
const identityEngine={applyTonePixel:(r,g,b)=>[r,g,b],rgbToHsl,hslToRgb};
const engineContext={DarkRoomEngine:identityEngine,globalThis:null};engineContext.globalThis=engineContext;
vm.runInNewContext(engineSource,engineContext,{filename:'preset-engine.js'});
const P=engineContext.DarkRoomPresetEngine;assert(P,'preset engine installed');
const style={hueRed:5,satRed:-6,lumRed:-37,hueOrange:-3,satOrange:-28,lumOrange:-14,hueYellow:0,satYellow:-74,lumYellow:89,hueGreen:28,satGreen:-75,lumGreen:81,hueAqua:12,satAqua:-3,lumAqua:-15,hueBlue:-16,satBlue:2,lumBlue:61,huePurple:16,satPurple:-40,lumPurple:5,hueMagenta:33,satMagenta:11,lumMagenta:6};
const a=hslToRgb(44.9,.65,.5),b=hslToRgb(45.1,.65,.5),oa=P.applySmoothMixer(...a,style),ob=P.applySmoothMixer(...b,style);
const boundaryDelta=Math.max(...oa.map((v,i)=>Math.abs(v-ob[i])));assert(boundaryDelta<4,`smooth HSL boundary discontinuity: ${boundaryDelta}`);
const neutral=hslToRgb(45,.02,.5),neutralOut=P.applySmoothMixer(...neutral,style);assert(Math.max(...neutralOut.map((v,i)=>Math.abs(v-neutral[i])))<1.5,'near-neutral pixels should be protected from HSL bucket noise');
const highlight=hslToRgb(60,.7,.9),highlightOut=P.applySmoothMixer(...highlight,style);assert(Math.max(...highlightOut)<255,'positive HSL luminance should preserve highlight headroom');

const uiSource=fs.readFileSync(new URL('../preset-ui.js',import.meta.url),'utf8');
const uiContext={globalThis:null,structuredClone,JSON};uiContext.globalThis=uiContext;
vm.runInNewContext(uiSource,uiContext,{filename:'preset-ui.js'});
const U=uiContext.DarkRoomPresetUI;assert(U,'preset UI helpers installed');
const defaults={exposure:0,contrast:0,highlights:0,shadows:0,cropX:50,curvePoints:[]};
const auto={exposure:8,contrast:6,shadows:18};
let first=U.applyPresetState(defaults,null,'Auto',auto,defaults);
let styleState=U.applyPresetState(first.edits,first.state,'Style',{contrast:0,highlights:-15,shadows:15},defaults);
assert.equal(styleState.edits.exposure,0,'switching presets must remove untouched values from the previous preset');
assert.equal(styleState.edits.highlights,-15);assert.equal(styleState.edits.shadows,15);
first.edits.exposure=12;
styleState=U.applyPresetState(first.edits,first.state,'Style',{contrast:0,highlights:-15,shadows:15},defaults);
assert.equal(styleState.edits.exposure,12,'manual edits made after a preset should survive when the next preset does not control that setting');
const custom=U.buildPresetPayload({exposure:12,contrast:0,highlights:0,shadows:0,cropX:20,curvePoints:[]},defaults);
assert.equal(JSON.stringify(custom),JSON.stringify({exposure:12}),'saved presets should include changed image adjustments but exclude crop/geometry state');

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
for(const asset of ['preset-engine.js?v=21','presetpro-presets.js?v=21','preset-ui.js?v=21'])assert(app.includes(asset),`app loader must include ${asset}`);
assert(app.indexOf('preset-engine.js?v=21')<app.indexOf('presetpro-presets.js?v=21')&&app.indexOf('presetpro-presets.js?v=21')<app.indexOf('preset-ui.js?v=21'),'preset runtime must load engine patch, pack, then UI manager');
assert(app.includes('currentPhoto.presetSelection=null'),'reset edits must clear the selected preset state');
assert(uiSource.includes('role="combobox"')&&uiSource.includes('role="listbox"'),'preset picker must use a collapsed accessible combobox/listbox');
assert(!uiSource.includes('size="10"'),'preset picker must not regress to an always-open native listbox');
console.log('Preset tests passed: smooth HSL, neutral protection, no stacking, custom preset payloads and combobox runtime.');
