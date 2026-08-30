import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

vm.runInThisContext(fs.readFileSync(new URL('../engine-core.js',import.meta.url),'utf8'));
vm.runInThisContext(fs.readFileSync(new URL('../mask-feather.js',import.meta.url),'utf8'));

const E=globalThis.DarkRoomEngine,F=globalThis.DarkRoomMaskFeather;
assert(E&&F?.installed,'mask feather runtime should install on top of the pixel engine');
assert.equal(F.DEFAULT_DRAWN_FEATHER_PERCENT,1.5,'drawn masks should start with a subtle 1.5% long-edge falloff');
assert.equal(F.effectiveFeatherPercent({type:'brush'}),1.5,'existing brush masks should inherit the default');
assert.equal(F.effectiveFeatherPercent({type:'brush',edgeFeather:0}),0,'users must be able to request a hard edge');
assert.equal(F.effectiveFeatherPercent({type:'luminance'}),0,'range masks should not gain an unsolicited spatial blur');

const step=new Float32Array(21);for(let i=0;i<10;i++)step[i]=1;
const softened=F.featherCoverage(step,21,1,10);
assert(softened[8]>softened[9]&&softened[9]>softened[10]&&softened[10]>softened[11],'edge coverage should fall smoothly across the boundary');
assert(softened[9]<1&&softened[9]>0&&softened[10]<1&&softened[10]>0,'feathering should create partial coverage on both sides of the edge');
assert.strictEqual(F.featherCoverage(step,21,1,0),step,'zero feather should preserve the original coverage exactly');

const w=101,h=101,makeBase=()=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=100;data[i+3]=255}return data};
const brush=edgeFeather=>({type:'brush',size:.4,feather:0,flow:1,opacity:1,density:1,edgeFeather,strokes:[{size:.4,feather:0,flow:1,points:[{x:.5,y:.5}]}],adjust:{exposure:50}});
const at=(data,x,y=50)=>data[(y*w+x)*4];

const defaultMask=brush(undefined);delete defaultMask.edgeFeather;
const feathered=E.applyLocalEdits(makeBase(),w,h,[defaultMask]);
const hard=E.applyLocalEdits(makeBase(),w,h,[brush(0)]);
const broad=E.applyLocalEdits(makeBase(),w,h,[brush(5)]);

assert(feathered[(50*w+50)*4]>100,'the selected interior should still receive the local adjustment');
assert.equal(at(hard,70),100,'a zero-radius mask should remain hard immediately outside its painted boundary');
assert(at(feathered,70)>100,'the default falloff should blend the adjustment just outside the nominal boundary');
assert(at(broad,73)>at(feathered,73),'increasing the radius should extend the smooth transition farther from the mask edge');
assert.equal(at(broad,90),100,'feathering must not leak into distant unselected image areas');

console.log('Mask feather tests passed: default falloff, hard-edge override, smooth boundary, and variable radius.');
