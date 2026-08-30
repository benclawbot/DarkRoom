// DarkRoom refinement layer: one photo, focused editing, simplified masks and comparison.
(function(){
'use strict';
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
let pendingMaskSize=8,lassoPoints=null;

function showEmptyPicker(show=true){
  q('#editorEmptyPicker')?.classList.toggle('hidden',!show);
  q('#editorPanel')?.classList.toggle('empty-editor',show);
  q('.editor-title')?.classList.toggle('empty',show);
  if(show){const c=q('#editorCanvas');if(c){c.width=1;c.height=1;c.getContext('2d')?.clearRect(0,0,1,1)}}
}

const baseOpenEditor=window.openEditor;
window.openEditor=async function(id){
  const result=await baseOpenEditor(id);
  showEmptyPicker(false);
  syncSplitGeometry();
  return result;
};

const baseImportFiles=window.importFiles;
window.importFiles=async function(files){
  const one=[...(files||[])].slice(0,1);
  if(!one.length)return;
  return baseImportFiles(one);
};

window.closeEditor=async function(){
  if(currentPhoto)await put('photos',currentPhoto);
  stopPainting?.();
  currentPhoto=null;beforeMode=false;beforeSplit=false;activeLocalId=null;
  q('#beforeSplitCanvas')?.classList.remove('active');q('#beforeSplitDivider')?.classList.add('hidden');q('#beforeSplitRange')?.classList.add('hidden');
  showEmptyPicker(true);
};

function groupedPresetOptions(){
  const custom=customPresets(),all=allPresets();
  const imported=new Set(['Style','Cinematic Grade','Insta Film','Kodachrome 64','Interior Design','Shutter','Fashion Film','Olive & Earth','KDK Colour','Fuji Film']);
  const groups={Standard:[],Specialised:[],User:[]};
  for(const name of Object.keys(all)){if(Object.prototype.hasOwnProperty.call(custom,name))groups.User.push(name);else if(imported.has(name))groups.Specialised.push(name);else groups.Standard.push(name)}
  return Object.entries(groups).filter(([,names])=>names.length).map(([label,names])=>`<optgroup label="${esc(label)}">${names.map(name=>`<option value="${esc(name)}" ${currentPhoto?.presetSelection?.name===name?'selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
}

window.presetMarkup=function(){
  const selected=currentPhoto?.presetSelection?.name||'';
  const isCustom=Object.prototype.hasOwnProperty.call(customPresets(),selected);
  return `<div class="preset-picker-row"><select id="presetList" aria-label="Preset"><option value="">Choose a preset…</option>${groupedPresetOptions()}</select><button id="deleteSelectedPreset" class="preset-delete" ${isCustom?'':'disabled'} title="Delete selected user preset" aria-label="Delete selected user preset">×</button></div><div class="preset-save"><input id="customPresetName" maxlength="40" placeholder="Preset name"><button id="saveCustomPreset">Save</button></div>`;
};

function applyPresetByName(name){
  if(!currentPhoto||!name)return;
  const p=allPresets()[name];if(!p)return;
  captureHistory();
  const defaults=defaultEdits();
  if(window.DarkRoomPresetUI?.applyPresetState){const r=DarkRoomPresetUI.applyPresetState(currentPhoto.edits||{},currentPhoto.presetSelection,name,p,defaults);currentPhoto.edits=r.edits;currentPhoto.presetSelection=r.state}
  else {currentPhoto.edits={...currentPhoto.edits,...clone(p)};currentPhoto.presetSelection={name,applied:clone(p)}}
  captureHistory();renderControls();renderCanvas(q('#editorCanvas'));debouncedSave();toast(`${name} applied`);
}

function deleteSelectedPreset(){
  const select=q('#presetList'),name=select?.value;if(!name)return;
  const all=customPresets();if(!Object.prototype.hasOwnProperty.call(all,name))return;
  delete all[name];localStorage.setItem('darkroom-user-presets',JSON.stringify(all));
  if(currentPhoto?.presetSelection?.name===name)currentPhoto.presetSelection=null;
  renderControls();toast('User preset deleted');
}

function saveCurrentPreset(){
  if(!currentPhoto)return;
  const name=q('#customPresetName')?.value.trim();if(!name)return toast('Name the preset');
  const all=customPresets();
  if(Object.prototype.hasOwnProperty.call(presets,name))return toast('That name is used by a built-in preset');
  all[name]=window.DarkRoomPresetUI?.buildPresetPayload?DarkRoomPresetUI.buildPresetPayload(currentPhoto.edits||{},defaultEdits()):clone(currentPhoto.edits);
  localStorage.setItem('darkroom-user-presets',JSON.stringify(all));
  currentPhoto.presetSelection={name,applied:clone(all[name])};debouncedSave();renderControls();toast('User preset saved');
}

window.renderTransformPanel=function(){
  const e=currentPhoto.edits;
  const crop=`<div class="crop-hero"><div><b>Crop & Straighten</b><span>Work directly on the photograph.</span></div><button id="resetCrop">Reset</button></div><div class="transform-tools icon-tools"><button data-transform="left">↶ <span>Left</span></button><button data-transform="right">↷ <span>Right</span></button><button data-transform="flipX">↔ <span>Flip H</span></button><button data-transform="flipY">↕ <span>Flip V</span></button></div><div class="crop-primary-actions"><button id="repositionCrop" class="primary-action">Reposition</button><button id="drawStraighten">Draw Straighten Line</button><button id="autoStraighten">Auto Straighten</button></div><div class="crop-aspect-line"><label>Aspect<select id="cropAspectSelect">${['original','1:1','4:3','3:4','3:2','2:3','16:9','9:16'].map(a=>`<option value="${a}" ${e.cropAspect===a?'selected':''}>${a==='original'?'Original':a}</option>`).join('')}</select></label><button id="swapCropAspect">↕ Swap</button></div>${sliderMarkup([['angle','Straighten',-45,45],['cropZoom','Zoom',100,400],['cropX','Horizontal',0,100],['cropY','Vertical',0,100]])}`;
  const geometry=sliderMarkup([['geometryVertical','Vertical',-100,100],['geometryHorizontal','Horizontal',-100,100],['geometryRotate','Rotate',-45,45],['geometryAspect','Aspect',-100,100],['geometryScale','Scale',50,150],['geometryX','X Offset',-100,100],['geometryY','Y Offset',-100,100]]);
  return accordionSection('crop','Crop',crop,'quick')+accordionSection('geometry','Geometry',geometry,'advanced');
};

function simpleMaskList(){
  const list=currentPhoto.localEdits||[];
  if(!list.length)return '<div class="mask-empty"><b>No masks</b><span>Create a brush or lasso selection first.</span></div>';
  return `<div class="local-list mask-list">${list.map(m=>`<div class="local-row ${m.id===activeLocalId?'active':''}"><button class="local-name" data-local-select="${m.id}"><b>${esc(maskLabel(m))}</b><small>${m.id===activeLocalId?'Selected':'Mask'}</small></button><button class="mask-eye ${m.uiVisible?'visible':''}" data-mask-visibility="${m.id}" title="Show mask overlay" aria-label="Show mask overlay">${m.uiVisible?'◉':'○'}</button><button class="mask-delete" data-mask-delete-simple="${m.id}" title="Delete mask" aria-label="Delete mask">×</button></div>`).join('')}</div>`;
}
function simpleActiveMask(){
  const m=activeLocal();if(!m)return'';
  const adjust=[['exposure','Exposure',-100,100],['contrast','Contrast',-100,100],['highlights','Highlights',-100,100],['shadows','Shadows',-100,100],['whites','Whites',-100,100],['blacks','Blacks',-100,100],['temp','Temperature',-100,100],['tint','Tint',-100,100],['saturation','Saturation',-100,100],['clarity','Clarity',-100,100]];
  return `<div class="mask-adjustments"><h4>Adjust selected mask</h4>${sliderMarkup(adjust,m.adjust,'local-edit')}</div>`;
}
window.renderMasksPanel=function(){
  const create=`<div class="mask-create-simple"><div><b>New mask</b><div class="feature-note">Choose a selection method, set brush size, then draw on the photo. The overlay disappears when the selection is finished.</div></div><label class="mask-brush-size"><span>Size</span><input id="newMaskSize" type="range" min="1" max="40" value="${pendingMaskSize}"><b>${pendingMaskSize}</b></label><div class="mask-methods"><button id="newBrushMask" class="primary-action">Brush</button><button id="newLassoMask">Lasso</button></div></div>`;
  return accordionSection('smartMasks','Create Mask',create,'quick')+accordionSection('localAdjust','Masks',simpleMaskList()+simpleActiveMask(),'quick',`${currentPhoto.localEdits.length}`);
};

function createSimpleBrush(){
  createLocalMask('brush');
  const m=activeLocal();if(m){m.size=pendingMaskSize/100;m.name='Brush';m.uiVisible=true;setPaintMode('add');drawMaskOverlay()}
  renderControls();
}
function createLasso(){
  const m=newMask('brush','Lasso');m.size=.012;m.feather=.18;m.flow=1;m.strokes=[];m.uiVisible=true;
  captureHistory();currentPhoto.localEdits.push(m);activeLocalId=m.id;captureHistory();
  paintMode='lasso';lassoPoints=[];q('#photoViewport')?.classList.add('painting');q('#paintHud')?.classList.remove('hidden');if(q('#paintHud b'))q('#paintHud b').textContent='Draw lasso';if(q('#paintHud span'))q('#paintHud span').textContent='Draw a closed selection';
  renderControls();drawMaskOverlay();
}
function pointNorm(e){const c=q('#editorCanvas'),r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width))),y:Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)))}}
function insidePoly(x,y,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>y)!==(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y||1e-9)+a.x))inside=!inside}return inside}
function rasterizeLasso(){
  const m=activeLocal(),pts=lassoPoints;if(!m||!pts||pts.length<3)return;
  let minX=1,maxX=0,minY=1,maxY=0;pts.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)});
  const step=.012;
  for(let y=minY;y<=maxY;y+=step){let run=null;for(let x=minX;x<=maxX+step;x+=step){const hit=insidePoly(x,y,pts);if(hit&&!run)run={x};if((!hit||x>maxX)&&run){m.strokes.push({size:.014,feather:.18,flow:1,erase:false,points:[{x:run.x,y},{x:Math.min(maxX,x),y}]});run=null}}}
  m.uiVisible=false;lassoPoints=null;paintMode=null;q('#photoViewport')?.classList.remove('painting');q('#paintHud')?.classList.add('hidden');captureHistory();renderControls();renderCanvas(q('#editorCanvas'));debouncedSave();
}

document.addEventListener('pointerdown',e=>{if(paintMode!=='lasso'||e.target!==q('#editorCanvas'))return;e.preventDefault();e.stopImmediatePropagation();lassoPoints=[pointNorm(e)];e.target.setPointerCapture?.(e.pointerId)},true);
document.addEventListener('pointermove',e=>{if(paintMode!=='lasso'||!lassoPoints?.length)return;e.preventDefault();e.stopImmediatePropagation();const p=pointNorm(e),prev=lassoPoints.at(-1);if(Math.hypot(p.x-prev.x,p.y-prev.y)>.003)lassoPoints.push(p);const m=activeLocal();if(m){m.strokes=[{size:.006,feather:.1,flow:1,points:lassoPoints}];drawMaskOverlay()}},true);
document.addEventListener('pointerup',e=>{if(paintMode!=='lasso'||!lassoPoints?.length)return;e.preventDefault();e.stopImmediatePropagation();const m=activeLocal();if(m)m.strokes=[];rasterizeLasso()},true);

const baseStopPainting=window.stopPainting;
window.stopPainting=function(){const m=activeLocal();if(m)m.uiVisible=false;baseStopPainting();q('#maskOverlay')?.classList.remove('force-visible');renderControls?.()};
const baseDrawMaskOverlay=window.drawMaskOverlay;
window.drawMaskOverlay=function(){baseDrawMaskOverlay();const m=activeLocal();q('#maskOverlay')?.classList.toggle('force-visible',!!m?.uiVisible||!!paintMode)};

const baseBindGenerated=window.bindGeneratedControls;
window.bindGeneratedControls=function(){
  baseBindGenerated();
  if(q('#presetList'))q('#presetList').onchange=e=>{applyPresetByName(e.target.value);};
  if(q('#deleteSelectedPreset'))q('#deleteSelectedPreset').onclick=deleteSelectedPreset;
  if(q('#saveCustomPreset'))q('#saveCustomPreset').onclick=saveCurrentPreset;
  if(q('#newMaskSize'))q('#newMaskSize').oninput=e=>{pendingMaskSize=+e.target.value;const b=e.target.parentElement.querySelector('b');if(b)b.textContent=e.target.value};
  if(q('#newBrushMask'))q('#newBrushMask').onclick=createSimpleBrush;
  if(q('#newLassoMask'))q('#newLassoMask').onclick=createLasso;
  qa('[data-mask-visibility]').forEach(b=>b.onclick=()=>{const m=currentPhoto.localEdits.find(x=>x.id===b.dataset.maskVisibility);if(!m)return;m.uiVisible=!m.uiVisible;activeLocalId=m.id;renderControls();drawMaskOverlay()});
  qa('[data-mask-delete-simple]').forEach(b=>b.onclick=()=>{captureHistory();currentPhoto.localEdits=currentPhoto.localEdits.filter(m=>m.id!==b.dataset.maskDeleteSimple);if(activeLocalId===b.dataset.maskDeleteSimple)activeLocalId=currentPhoto.localEdits[0]?.id||null;captureHistory();renderControls();renderCanvas(q('#editorCanvas'));debouncedSave()});
};

window.renderControls=function(){
  if(!currentPhoto)return;
  editorMode='pro';
  const tools=[{id:'edit',icon:'☼',label:'Adjust'},{id:'transform',icon:'⌗',label:'Crop'},{id:'masks',icon:'◌',label:'Mask'},{id:'retouch',icon:'◍',label:'Retouch'}];
  if(!tools.some(t=>t.id===currentPanel))currentPanel='edit';
  const panels={edit:renderEditPanel,transform:renderTransformPanel,masks:renderMasksPanel,retouch:renderRetouchPanel};
  const rail=q('#toolTabs');rail.classList.add('tool-accordion','focused-tools');
  rail.innerHTML=tools.map(t=>`<section class="tool-section ${currentPanel===t.id?'open':''}" data-tool-section="${t.id}"><button class="tool-section-header" type="button" data-tool-toggle="${t.id}" aria-pressed="${currentPanel===t.id}"><span class="tool-section-icon">${t.icon}</span><b>${t.label}</b></button><div class="tool-section-body">${currentPanel===t.id?panels[t.id]():''}</div></section>`).join('');
  qa('[data-tool-toggle]').forEach(b=>b.onclick=()=>{currentPanel=b.dataset.toolToggle;stopPainting?.();renderControls()});
  bindAccordions();bindGeneratedControls();drawMaskOverlay();drawToneCurve?.();
};

function syncSplitGeometry(){
  const wrap=q('#canvasWrap'),edited=q('#editorCanvas'),before=q('#beforeSplitCanvas'),divider=q('#beforeSplitDivider'),range=q('#beforeSplitRange');
  if(!wrap||!edited||!before)return;
  const wr=wrap.getBoundingClientRect(),er=edited.getBoundingClientRect();
  if(!er.width||!er.height)return;
  const left=er.left-wr.left,top=er.top-wr.top,width=er.width,height=er.height;
  before.width=edited.width;before.height=edited.height;
  before.style.left=`${left}px`;before.style.top=`${top}px`;before.style.width=`${width}px`;before.style.height=`${height}px`;before.style.right='auto';before.style.bottom='auto';
  const pct=Math.max(0,Math.min(100,+beforeSplitPct||50));
  before.style.clipPath=`inset(0 ${100-pct}% 0 0)`;
  if(divider){divider.style.left=`${left+width*pct/100}px`;divider.style.top=`${top}px`;divider.style.height=`${height}px`;divider.style.bottom='auto'}
  if(range){range.style.left=`${left}px`;range.style.top=`${top}px`;range.style.width=`${width}px`;range.style.height=`${height}px`;range.style.right='auto';range.style.bottom='auto'}
}
const oldApplySplit=window.applyBeforeSplitClip;
window.applyBeforeSplitClip=function(){oldApplySplit?.();syncSplitGeometry()};
const oldUpdateSplit=window.updateBeforeSplit;
window.updateBeforeSplit=async function(){await oldUpdateSplit?.();syncSplitGeometry()};
new ResizeObserver(syncSplitGeometry).observe(q('#canvasWrap'));

function setToneHandle(tone,pct,commit=true){
  const h=q(`[data-tone="${tone}"]`);if(h)h.style.left=`${pct}%`;
  if(!currentPhoto)return;
  const base=tone==='shadows'?18:tone==='highlights'?82:50;
  const span=tone==='midtones'?32:18;
  const value=Math.max(-100,Math.min(100,Math.round((pct-base)/span*100)));
  const key=tone==='shadows'?'shadows':tone==='highlights'?'highlights':'exposure';
  currentPhoto.edits[key]=value;renderCanvas(q('#editorCanvas'));if(commit)debouncedSave();
}
let toneDrag=null;
document.addEventListener('pointerdown',e=>{const h=e.target.closest?.('.hist-tone-handle');if(!h)return;toneDrag=h.dataset.tone;h.setPointerCapture?.(e.pointerId);e.preventDefault()},true);
document.addEventListener('pointermove',e=>{if(!toneDrag)return;const strip=q('#histogramToneStrip'),r=strip.getBoundingClientRect(),pct=Math.max(0,Math.min(100,(e.clientX-r.left)/Math.max(1,r.width)*100));setToneHandle(toneDrag,pct,false)},true);
document.addEventListener('pointerup',e=>{if(!toneDrag)return;captureHistory();debouncedSave();toneDrag=null},true);

q('#editorOpenPhoto')?.addEventListener('click',()=>q('#fileInput')?.click());
showEmptyPicker(!currentPhoto);
})();
