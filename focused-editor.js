// Focused DarkRoom experience: one professional photo editor, no catalog or model-driven tools.
editorMode='pro';
currentPanel='edit';
soloSections=false;

const FOCUSED_TOOLS=[
  {id:'edit',icon:'☼',label:'Adjust'},
  {id:'transform',icon:'⌗',label:'Crop'},
  {id:'masks',icon:'◌',label:'Mask'},
  {id:'heal',icon:'✚',label:'Heal'},
  {id:'retouch',icon:'◍',label:'Retouch'}
];

applyEditorMode=function(rerender=true){
  editorMode='pro';
  if(rerender&&currentPhoto)renderControls();
};
setEditorMode=function(){};

syncEditorMeta=function(){
  if(!currentPhoto)return;
  const name=$('#editorName'),meta=$('#editorMeta');
  if(name)name.textContent=currentPhoto.name;
  if(meta)meta.textContent=`${currentPhoto.width||'—'} × ${currentPhoto.height||'—'} · ${fmtBytes(currentPhoto.size)}`;
  $('#beforeAfterBtn')?.classList.toggle('active',beforeMode);
  $('#fullscreenBtn')?.classList.toggle('active',photoOnly);
};

renderEditPanel=function(){
  return accordionSection('presets','Presets',presetMarkup(),'quick')+
    accordionSection('light','Light',sliderMarkup(panelDefs.light),'quick',changedSummary(panelDefs.light))+
    accordionSection('color','Color',sliderMarkup(panelDefs.color),'quick',changedSummary(panelDefs.color))+
    accordionSection('curves','Tone Curve',curveMarkup(),'advanced',changedSummary(panelDefs.curves))+
    accordionSection('mixer','Color Mixer',mixerMarkup(),'advanced')+
    accordionSection('grading','Color Grading',gradingMarkup(),'advanced')+
    accordionSection('detail','Detail',sliderMarkup(panelDefs.detail),'advanced',changedSummary(panelDefs.detail))+
    accordionSection('effects','Effects',sliderMarkup(panelDefs.effects),'advanced',changedSummary(panelDefs.effects))+
    accordionSection('optics','Optics',sliderMarkup(panelDefs.optics),'advanced',changedSummary(panelDefs.optics))+
    accordionSection('geometry','Geometry',sliderMarkup(panelDefs.geometry),'advanced',changedSummary(panelDefs.geometry))+
    accordionSection('lut','LUT & Film',renderLUTMarkup(),'advanced',currentPhoto.lut?currentPhoto.lut.name:'');
};

maskCreationMarkup=function(){
  return `<div class="mask-create-head"><div><b>New mask</b><span>Draw a selection or isolate a tonal/color range.</span></div></div>
    <div class="mask-create-group"><small>DRAW</small><div class="mask-card-grid">
      ${maskToolButton('brush','Brush','●')}${maskToolButton('linear','Linear','↗')}${maskToolButton('radial','Radial','◯')}${maskToolButton('dodge','Dodge','＋')}${maskToolButton('burn','Burn','−')}
    </div></div>
    <div class="mask-create-group"><small>RANGE</small><div class="mask-card-grid">
      ${maskToolButton('luminance','Luminance','◐')}${maskToolButton('color','Color','◉')}${maskToolButton('hue','Hue','◒')}${maskToolButton('parametric','Advanced','⌁')}
    </div></div>
    <p class="feature-note mask-guidance">Add, subtract, or intersect manual selections. Press <b>O</b> to show or hide the overlay.</p>`;
};

maskListMarkup=function(){
  const list=currentPhoto.localEdits||[];
  if(!list.length)return '<div class="mask-empty"><b>No masks yet</b><span>Start with a brush, gradient, or range selection.</span></div>';
  return `<div class="local-list mask-list">${list.map(m=>`<div class="local-row mask-parent ${m.id===activeLocalId?'active':''}" data-local-row="${m.id}">
    <button class="swatch" data-local-select="${m.id}" title="Select mask"></button>
    <button class="local-name" data-local-select="${m.id}"><b>${esc(maskLabel(m))}</b><small>${(m.modifiers||[]).length?`${m.modifiers.length+1} components · `:''}${m.enabled===false?'hidden':'active'}</small></button>
    <button data-local-toggle="${m.id}" title="Show or hide">${m.enabled===false?'○':'●'}</button>
  </div>`).join('')}</div>`;
};

activeMaskMarkup=function(){
  const m=activeLocal();if(!m)return'';
  const adjustDefs=[['exposure','Exposure',-100,100],['contrast','Contrast',-100,100],['highlights','Highlights',-100,100],['shadows','Shadows',-100,100],['whites','Whites',-100,100],['blacks','Blacks',-100,100],['temp','Temperature',-100,100],['tint','Tint',-100,100],['vibrance','Vibrance',-100,100],['saturation','Saturation',-100,100],['texture','Texture',-100,100],['clarity','Clarity',-100,100],['dehaze','Dehaze',-100,100],['sharpness','Sharpness',0,100],['noise','Noise',0,100]];
  const modifiers=(m.modifiers||[]).map((x,i)=>`<div class="modifier-row"><span class="modifier-op ${x.operation||'add'}">${x.operation==='subtract'?'−':x.operation==='intersect'?'∩':'＋'}</span><span class="modifier-name"><b>${esc(maskLabel(x))}</b><small>${esc(x.type||'selection')}</small></span><button data-modifier-invert="${i}" title="Invert component">↔</button><button data-modifier-delete="${i}" title="Remove component">×</button></div>`).join('');
  let options=`<div class="mask-active-header"><div><b>${esc(maskLabel(m))}</b><small>Local adjustment</small></div><button id="renameMask">Rename</button></div>
    <div class="mask-combine-bar"><button data-combine-menu="add">＋ Add</button><button data-combine-menu="subtract">− Subtract</button><button data-combine-menu="intersect">∩ Intersect</button></div>
    <div id="maskCombinePicker" class="mask-combine-picker hidden"><select id="modifierType"><optgroup label="Draw"><option value="brush">Brush</option><option value="linear">Linear Gradient</option><option value="radial">Radial Gradient</option></optgroup><optgroup label="Range"><option value="luminance">Luminance Range</option><option value="color">Color Range</option><option value="hue">Hue Range</option><option value="parametric">Advanced Range</option></optgroup></select><button id="addModifier">Add component</button></div>
    ${modifiers?`<div class="mask-tree">${modifiers}</div>`:''}
    <div class="local-mask-actions"><button id="paintAdd">Brush Add</button><button id="paintErase">Brush Subtract</button>${['linear','radial'].includes(m.type)?'<button id="editMaskShape">Edit on photo</button>':''}<button id="invertMask">${m.invert?'Uninvert':'Invert'}</button><button id="duplicateMask">Duplicate</button><button id="deleteMask" class="danger-mini">Delete</button></div>
    <details class="mask-settings" open><summary>Brush & mask</summary><div class="brush-options"><label>Size <input id="maskSize" type="range" min="1" max="50" value="${Math.round((m.size||.08)*100)}"></label><label>Feather <input id="maskFeather" type="range" min="0" max="100" value="${Math.round((m.feather??.6)*100)}"></label><label>Flow <input id="maskFlow" type="range" min="1" max="100" value="${Math.round((m.flow??.65)*100)}"></label><label>Density <input id="maskDensity" type="range" min="1" max="100" value="${Math.round((m.density??1)*100)}"></label><label>Opacity <input id="maskOpacity" type="range" min="1" max="100" value="${Math.round((m.opacity??1)*100)}"></label></div></details>
    <div class="mask-overlay-settings"><label>Overlay <select id="maskOverlayMode"><option value="color">Color</option><option value="color-bw">Color on B&W</option><option value="image-bw">Image on B&W</option><option value="black">Mask on Black</option><option value="white">Mask on White</option></select></label><label>Color <select id="maskOverlayColor"><option value="red">Red</option><option value="green">Green</option><option value="blue">Blue</option><option value="white">White</option></select></label><label>Opacity <input id="maskOverlayOpacity" type="range" min="10" max="90" value="${+(localStorage.getItem('darkroom-mask-opacity')||50)}"></label></div>`;
  if(m.type==='luminance')options+=`${rangeHistogramMarkup(m)}<div class="range-row"><button id="sampleMaskLuma" class="panel-button">Sample</button><label>Low <input id="maskLo" type="range" min="0" max="100" value="${Math.round((m.lo??.25)*100)}"></label><label>High <input id="maskHi" type="range" min="0" max="100" value="${Math.round((m.hi??.75)*100)}"></label></div>`;
  if(m.type==='hue')options+=`<div class="range-row"><button id="sampleMaskHue" class="panel-button">Pick hue</button><label>Hue <input id="maskHue" type="range" min="0" max="360" value="${Math.round(m.hue||0)}"></label><label>Range <input id="maskTolerance" type="range" min="5" max="90" value="${Math.round(m.tolerance||35)}"></label></div>`;
  if(m.type==='color')options+=`<div class="range-row"><button id="sampleMaskColor" class="panel-button">Pick color</button><label>Tolerance <input id="maskTolerance" type="range" min="10" max="255" value="${Math.round(m.tolerance||90)}"></label><span class="color-chip" style="--chip:rgb(${(m.target||[128,128,128]).join(',')})"></span></div>`;
  if(m.type==='parametric')options+=`<div class="parametric-range"><label>Luminance</label><div class="dual-range"><input id="paramLumaLo" type="range" min="0" max="100" value="${Math.round((m.lumaLo??0)*100)}"><input id="paramLumaHi" type="range" min="0" max="100" value="${Math.round((m.lumaHi??1)*100)}"></div><label class="switch-row"><input id="paramUseSat" type="checkbox" ${m.useSaturation?'checked':''}> Limit saturation</label><div class="dual-range"><input id="paramSatLo" type="range" min="0" max="100" value="${Math.round((m.satLo??0)*100)}"><input id="paramSatHi" type="range" min="0" max="100" value="${Math.round((m.satHi??1)*100)}"></div><label class="switch-row"><input id="paramUseHue" type="checkbox" ${m.useHue?'checked':''}> Limit hue</label><div class="range-row"><input id="paramHue" type="range" min="0" max="360" value="${Math.round(m.hue??180)}"><input id="paramHueTolerance" type="range" min="5" max="180" value="${Math.round(m.hueTolerance??45)}"></div></div>`;
  if(m.type==='linear')options+=`<div class="shape-summary"><span>Drag on the photo to position and rotate.</span>${sliderMarkup([['angle','Angle',-180,180]],{angle:m.angle||0},'mask-shape')}</div>`;
  if(m.type==='radial')options+=`<div class="shape-summary"><span>Drag on the photo to position and resize.</span>${sliderMarkup([['angle','Rotation',-180,180]],{angle:m.angle||0},'mask-shape')}</div>`;
  return options+`<div class="local-adjustments"><h4>Adjust selected area</h4>${sliderMarkup(adjustDefs,m.adjust,'local-edit')}</div>`;
};

renderMasksPanel=function(){
  return accordionSection('smartMasks','Create Mask',maskCreationMarkup(),'quick')+
    accordionSection('localAdjust','Masks',maskListMarkup()+activeMaskMarkup(),'quick',`${currentPhoto.localEdits.length} mask${currentPhoto.localEdits.length===1?'':'s'}`);
};

renderHealPanel=function(){
  const ops=(currentPhoto.healOps||[]).filter(o=>o.mode!=='generative');
  return accordionSection('remove','Heal & Clone',`<div class="heal-toolbar"><button id="newHeal" class="primary-action">Heal</button><button id="newClone">Clone</button>${ops.length?'<button id="clearHeals">Clear All</button>':''}</div><p class="feature-note">Heal blends nearby pixels. Clone copies from an offset source. Paint directly on the photograph.</p>${ops.length?`<div class="local-list heal-list">${ops.map((o,i)=>`<div class="local-row heal-row"><span class="swatch"></span><b>${o.mode==='clone'?'Clone':'Heal'} ${i+1}</b>${o.mode==='clone'?`<label class="mini-offset">X <input data-clone-x="${o.id}" type="range" min="-50" max="50" value="${Math.round((o.sourceDx??-.12)*100)}"></label><label class="mini-offset">Y <input data-clone-y="${o.id}" type="range" min="-50" max="50" value="${Math.round((o.sourceDy??-.12)*100)}"></label>`:''}<button data-heal-delete="${o.id}">Delete</button></div>`).join('')}</div>`:''}`,'quick',ops.length?`${ops.length} operation${ops.length===1?'':'s'}`:'');
};

renderTransformPanel=function(){
  const e=currentPhoto.edits,guides=compositionOverlay||'thirds';
  const crop=`<div class="crop-hero"><div><b>Crop & Straighten</b><span>Work directly on the photograph.</span></div><button id="resetCrop">Reset</button></div><div class="transform-tools icon-tools"><button data-transform="left">↶ <span>Left</span></button><button data-transform="right">↷ <span>Right</span></button><button data-transform="flipX">↔ <span>Flip H</span></button><button data-transform="flipY">↕ <span>Flip V</span></button></div><div class="crop-primary-actions"><button id="repositionCrop" class="primary-action">Reposition</button><button id="drawStraighten">Draw Straighten Line</button><button id="autoStraighten">Auto Straighten</button></div><div class="crop-aspect-line"><label>Aspect <select id="cropAspectSelect">${['original','1:1','4:3','3:4','3:2','2:3','16:9','9:16'].map(a=>`<option value="${a}" ${e.cropAspect===a?'selected':''}>${a==='original'?'Original':a}</option>`).join('')}</select></label><button id="swapCropAspect">↕ Swap</button><label>Guide <select id="cropGuideSelect"><option value="none">None</option><option value="thirds" ${guides==='thirds'?'selected':''}>Thirds</option><option value="golden" ${guides==='golden'?'selected':''}>Golden Ratio</option><option value="diagonal" ${guides==='diagonal'?'selected':''}>Diagonal</option></select></label></div>${sliderMarkup([['angle','Straighten',-45,45],['cropZoom','Zoom',100,400],['cropX','Horizontal',0,100],['cropY','Vertical',0,100]])}`;
  const geometry=`${sliderMarkup([['geometryVertical','Vertical',-100,100],['geometryHorizontal','Horizontal',-100,100],['geometryRotate','Rotate',-45,45],['geometryAspect','Aspect',-100,100],['geometryScale','Scale',50,150],['geometryX','X Offset',-100,100],['geometryY','Y Offset',-100,100]])}<label class="solo-toggle"><input id="constrainCrop" type="checkbox" ${e.constrainCrop!==false?'checked':''}> Constrain to image</label>`;
  return accordionSection('crop','Crop',crop,'quick')+accordionSection('composition','Geometry',geometry,'advanced');
};

renderRetouchPanel=function(){
  const portrait=sliderMarkup(panelDefs.retouch)+`<div class="retouch-quick"><button data-mask-new="dodge">Dodge</button><button data-mask-new="burn">Burn</button></div>`;
  const restore=sliderMarkup(panelDefs.restore)+`<p class="feature-note">Use restrained values to clean dust, scratches, blemishes, and thin distractions.</p>`;
  return accordionSection('portrait','Portrait',portrait,'quick',changedSummary(panelDefs.retouch))+
    accordionSection('restore','Restore',restore,'quick',changedSummary(panelDefs.restore));
};

renderControls=function(){
  if(!currentPhoto)return;
  editorMode='pro';
  if(!FOCUSED_TOOLS.some(t=>t.id===currentPanel))currentPanel='edit';
  const panels={edit:renderEditPanel,transform:renderTransformPanel,masks:renderMasksPanel,heal:renderHealPanel,retouch:renderRetouchPanel};
  const rail=$('#toolTabs');
  rail.classList.add('tool-accordion','focused-tools');
  rail.innerHTML=FOCUSED_TOOLS.map(t=>`<section class="tool-section ${currentPanel===t.id?'open':''}" data-tool-section="${t.id}"><button class="tool-section-header" type="button" data-tool-toggle="${t.id}" aria-pressed="${currentPanel===t.id}"><span class="tool-section-icon">${t.icon}</span><b>${t.label}</b></button><div class="tool-section-body">${currentPanel===t.id?panels[t.id]():''}</div></section>`).join('');
  const controls=$('#controls');if(controls){controls.innerHTML='';controls.classList.add('hidden')}
  $$('[data-tool-toggle]').forEach(b=>b.onclick=()=>{currentPanel=b.dataset.toolToggle;renderControls()});
  bindAccordions();bindGeneratedControls();drawMaskOverlay();drawToneCurve?.();
};

filteredPhotos=function(){return [...photos].sort((a,b)=>(a.created||0)-(b.created||0));};

function focusedPhotoCard(p){return `<button class="photo-card focused-photo-card" data-photo="${p.id}" aria-label="Edit ${esc(p.name)}"><img data-photo-thumb="${p.id}" src="${blobUrl(p,true)}" alt=""><span>${esc(p.name)}</span></button>`;}

renderPhotos=function(){
  const grid=$('#photoGrid'),empty=$('#emptyState');if(!grid||!empty)return;
  const list=filteredPhotos();
  empty.hidden=!!list.length;grid.hidden=!list.length;
  grid.innerHTML=list.map(focusedPhotoCard).join('');
  $$('[data-photo-thumb]').forEach(img=>img.onerror=()=>{const p=photos.find(x=>x.id===img.dataset.photoThumb),fallback=p&&blobUrl(p,false);if(fallback)img.src=fallback});
  $$('[data-photo]').forEach(card=>card.onclick=()=>openEditor(card.dataset.photo));
};

function renderSessionFilmstrip(){
  const strip=$('#sessionFilmstrip');if(!strip)return;
  if(!currentPhoto){strip.innerHTML='';return}
  strip.innerHTML=filteredPhotos().map(p=>`<button class="session-thumb ${p.id===currentPhoto.id?'active':''}" data-session-photo="${p.id}" title="${esc(p.name)}"><img src="${blobUrl(p,true)}" alt=""><span>${esc(p.name)}</span></button>`).join('');
  $$('[data-session-photo]').forEach(b=>b.onclick=()=>openEditor(b.dataset.sessionPhoto));
  strip.querySelector('.active')?.scrollIntoView?.({block:'nearest',inline:'center'});
}

render=function(){renderPhotos();renderSessionFilmstrip();};
updateStorage=async function(){};

const focusedOpenEditor=openEditor;
openEditor=async function(id){
  if(currentPhoto&&currentPhoto.id!==id)await put('photos',currentPhoto);
  await focusedOpenEditor(id);
  renderSessionFilmstrip();
  $('#editorPanel')?.classList.remove('sheet-collapsed');
};

const focusedImportFiles=importFiles;
importFiles=async function(files){
  const before=new Set(photos.map(p=>p.id));
  await focusedImportFiles(files);
  const added=photos.filter(p=>!before.has(p.id)).sort((a,b)=>(a.created||0)-(b.created||0));
  if(added.length)await openEditor(added[0].id);
};

function navigateSession(delta){
  if(!currentPhoto)return;
  const list=filteredPhotos(),index=list.findIndex(p=>p.id===currentPhoto.id),next=list[index+delta];
  if(next)openEditor(next.id);
}

let holdBefore=false;
document.addEventListener('keydown',e=>{
  if(/input|textarea|select/i.test(e.target.tagName))return;
  if(e.key==='\\'&&!holdBefore&&currentPhoto){holdBefore=true;e.preventDefault();beforeMode=true;syncEditorMeta();renderCanvas($('#editorCanvas'),EDITOR_PREVIEW_MAX_SIZE,true)}
  if(e.key==='ArrowLeft'&&currentPhoto){e.preventDefault();navigateSession(-1)}
  if(e.key==='ArrowRight'&&currentPhoto){e.preventDefault();navigateSession(1)}
});
document.addEventListener('keyup',e=>{if(e.key==='\\'&&holdBefore&&currentPhoto){holdBefore=false;beforeMode=false;syncEditorMeta();renderCanvas($('#editorCanvas'))}});

// Keep precise controls consistent: double-click any global slider or value to reset it.
document.addEventListener('dblclick',e=>{
  const number=e.target.closest?.('.control-number[data-control-number^="edit|"]');
  if(!number)return;
  const key=number.dataset.controlNumber.split('|')[1],range=document.querySelector(`input[data-edit="${key}"]`);if(!range)return;
  const value=defaultEdits()[key]??0;number.value=value;range.value=value;range.dispatchEvent(new Event('input',{bubbles:true}));range.dispatchEvent(new Event('change',{bubbles:true}));
});
