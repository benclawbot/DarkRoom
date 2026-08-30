(function(root){
'use strict';
const EXCLUDED_PRESET_KEYS=new Set(['rotation','angle','flipX','flipY','cropAspect','cropX','cropY','cropZoom','geometryX','geometryY','geometryRotate','geometryScale','geometryVertical','geometryHorizontal','geometryAspect','constrainCrop','expand','superResolution','useAISource','skyReplacementOpacity']);
const IMPORTED_PRESETS=new Set(['Style','Cinematic Grade','Insta Film','Kodachrome 64','Interior Design','Shutter','Fashion Film','Olive & Earth','KDK Colour','Fuji Film']);
const copy=v=>v===undefined?undefined:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
const same=(a,b)=>{if(a===b)return true;try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
function cleanPresetBaseline(edits={},defaults={}){const next={...copy(defaults)};for(const key of EXCLUDED_PRESET_KEYS)if(key in edits)next[key]=copy(edits[key]);return next}
function removePresetContribution(edits={},state,defaults={}){const next=state?.applied&&state?.base?{...copy(defaults),...copy(edits)}:cleanPresetBaseline(edits,defaults);if(!state?.applied||!state?.base)return next;for(const key of Object.keys(state.applied))if(same(next[key],state.applied[key]))next[key]=copy(state.base[key]);return next}
function applyPresetState(edits={},state,name,preset={},defaults={}){const base=removePresetContribution(edits,state,defaults),applied=copy(preset),next={...base,...applied},storedBase={};for(const key of Object.keys(applied))storedBase[key]=copy(base[key]);return{edits:next,state:{name,base:storedBase,applied}}}
function buildPresetPayload(edits={},defaults={},excluded=EXCLUDED_PRESET_KEYS){const out={};for(const key of Object.keys(defaults)){if(excluded.has(key))continue;if(!same(edits[key],defaults[key]))out[key]=copy(edits[key])}return out}
root.DarkRoomPresetUI={EXCLUDED_PRESET_KEYS,cleanPresetBaseline,removePresetContribution,applyPresetState,buildPresetPayload};
if(typeof document==='undefined')return;

function all(){return typeof allPresets==='function'?allPresets():presets}
function custom(){return typeof customPresets==='function'?customPresets():{}}
function selected(){const name=currentPhoto?.presetSelection?.name;return name&&Object.prototype.hasOwnProperty.call(all(),name)?name:''}
function names(){return Object.keys(all())}
function groups(){const c=custom(),g={DarkRoom:[],"Presetpro Film Pack":[],Saved:[]};for(const name of names()){if(Object.prototype.hasOwnProperty.call(c,name))g.Saved.push(name);else if(IMPORTED_PRESETS.has(name))g['Presetpro Film Pack'].push(name);else g.DarkRoom.push(name)}return g}
function presetMarkupListbox(){const label=selected()||'Choose a preset…';return `<div class="preset-picker"><button type="button" id="presetListTrigger" class="preset-list-trigger" role="combobox" aria-label="Preset" aria-haspopup="listbox" aria-expanded="false" aria-controls="presetPortalListbox"><span class="preset-value">${esc(label)}</span><span class="preset-caret" aria-hidden="true">▾</span></button></div><div class="preset-save"><input id="customPresetName" maxlength="40" placeholder="Preset name" aria-label="Preset name"><button type="button" id="savePresetButton">Save preset</button></div>`}

let activeIndex=-1;
function portal(){let el=document.getElementById('presetPortalListbox');if(!el){el=document.createElement('div');el.id='presetPortalListbox';el.className='preset-portal-listbox';el.setAttribute('role','listbox');el.setAttribute('aria-label','Presets');el.hidden=true;document.body.appendChild(el)}return el}
function optionHtml(name,index,value){return `<div id="preset-option-${index}" class="preset-portal-option${name===value?' selected':''}" role="option" aria-selected="${name===value?'true':'false'}" data-preset-option="${esc(name)}">${esc(name)}</div>`}
function portalMarkup(){const value=selected();let index=0;return Object.entries(groups()).filter(([,items])=>items.length).map(([group,items])=>`<div class="preset-portal-group" role="presentation"><div class="preset-portal-group-title">${esc(group)}</div>${items.map(name=>optionHtml(name,index++,value)).join('')}</div>`).join('')}
function trigger(){return document.getElementById('presetListTrigger')}
function isOpen(){return trigger()?.getAttribute('aria-expanded')==='true'}
function positionPortal(){const t=trigger(),p=portal();if(!t||p.hidden)return;const r=t.getBoundingClientRect(),gap=4,margin=8,maxH=Math.min(320,window.innerHeight-margin*2);const below=window.innerHeight-r.bottom-gap,above=r.top-gap;const useAbove=below<180&&above>below;p.style.left=`${Math.max(margin,Math.min(r.left,window.innerWidth-r.width-margin))}px`;p.style.width=`${Math.max(180,r.width)}px`;p.style.maxHeight=`${Math.max(120,Math.min(maxH,useAbove?above:below))}px`;p.style.top=useAbove?'auto':`${r.bottom+gap}px`;p.style.bottom=useAbove?`${window.innerHeight-r.top+gap}px`:'auto'}
function setActive(index,scroll=true){const p=portal(),opts=[...p.querySelectorAll('[role="option"]')];if(!opts.length){activeIndex=-1;return}activeIndex=(index+opts.length)%opts.length;opts.forEach((o,i)=>o.classList.toggle('active',i===activeIndex));const active=opts[activeIndex];p.setAttribute('aria-activedescendant',active.id);trigger()?.setAttribute('aria-activedescendant',active.id);if(scroll)active.scrollIntoView({block:'nearest'})}
function openList(){const t=trigger();if(!t)return;const p=portal();p.innerHTML=portalMarkup();p.hidden=false;t.setAttribute('aria-expanded','true');const opts=[...p.querySelectorAll('[role="option"]')],value=selected(),idx=Math.max(0,opts.findIndex(o=>o.dataset.presetOption===value));setActive(idx,false);positionPortal()}
function closeList(focus=false){const t=trigger(),p=portal();p.hidden=true;p.removeAttribute('aria-activedescendant');if(t){t.setAttribute('aria-expanded','false');t.removeAttribute('aria-activedescendant');if(focus)t.focus()}activeIndex=-1}
function toggleList(){isOpen()?closeList():openList()}
function applyPreset(name){if(!currentPhoto||!name)return;const preset=all()[name];if(!preset)return;closeList();captureHistory();const result=applyPresetState(currentPhoto.edits||{},currentPhoto.presetSelection,name,preset,defaultEdits());currentPhoto.edits=result.edits;currentPhoto.presetSelection=result.state;captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast(`${name} applied`);requestAnimationFrame(()=>trigger()?.focus())}
function cyclePreset(delta){const list=names();if(!list.length)return;const value=selected(),index=list.indexOf(value),next=index<0?(delta>0?0:list.length-1):(index+delta+list.length)%list.length;applyPreset(list[next])}
function savePreset(){if(!currentPhoto)return;const input=$('#customPresetName'),name=input?.value.trim().replace(/\s+/g,' ');if(!name)return toast('Name the preset');const c=custom(),exists=Object.prototype.hasOwnProperty.call(c,name);if(!exists&&Object.prototype.hasOwnProperty.call(presets,name))return toast('That name is used by a built-in preset');if(exists&&!confirm(`Replace saved preset “${name}”?`))return;const defaults=defaultEdits(),payload=buildPresetPayload(currentPhoto.edits||{},defaults);if(!Object.keys(payload).length)return toast('No adjustable edits to save');c[name]=payload;localStorage.setItem('darkroom-user-presets',JSON.stringify(c));const base={};for(const key of Object.keys(payload))base[key]=copy(defaults[key]);currentPhoto.presetSelection={name,base,applied:copy(payload)};debouncedSave();syncBatchPresetOptions?.();renderControls();toast(exists?'Preset replaced':'Preset saved');requestAnimationFrame(()=>trigger()?.focus())}

function consume(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}
function onClick(e){const t=e.target.closest?.('#presetListTrigger');if(t){consume(e);toggleList();return}const option=e.target.closest?.('#presetPortalListbox [data-preset-option]');if(option){consume(e);applyPreset(option.dataset.presetOption);return}const save=e.target.closest?.('#savePresetButton');if(save){consume(e);savePreset();return}if(isOpen()&&!e.target.closest?.('#presetPortalListbox'))closeList()}
function onKeyDown(e){const t=e.target.closest?.('#presetListTrigger');if(t){if(e.key==='ArrowDown'||e.key==='ArrowUp'){consume(e);if(isOpen())setActive(activeIndex+(e.key==='ArrowDown'?1:-1));else cyclePreset(e.key==='ArrowDown'?1:-1);return}if(e.key==='Enter'||e.key===' '){consume(e);toggleList();return}if(e.key==='Escape'&&isOpen()){consume(e);closeList(true);return}if((e.key==='Home'||e.key==='End')&&isOpen()){consume(e);const opts=portal().querySelectorAll('[role="option"]');setActive(e.key==='Home'?0:opts.length-1);return}}
 if(isOpen()&&(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Home'||e.key==='End'||e.key==='Enter'||e.key===' '||e.key==='Escape')){consume(e);const opts=[...portal().querySelectorAll('[role="option"]')];if(e.key==='ArrowDown')setActive(activeIndex+1);else if(e.key==='ArrowUp')setActive(activeIndex-1);else if(e.key==='Home')setActive(0);else if(e.key==='End')setActive(opts.length-1);else if(e.key==='Escape')closeList(true);else if(opts[activeIndex])applyPreset(opts[activeIndex].dataset.presetOption);return}
 if(e.target.id==='customPresetName'&&e.key==='Enter'){consume(e);savePreset()}}

if(!root.__darkroomPresetDelegatedBound){root.__darkroomPresetDelegatedBound=true;document.addEventListener('click',onClick,true);document.addEventListener('keydown',onKeyDown,true);window.addEventListener('resize',()=>isOpen()&&positionPortal());window.addEventListener('scroll',()=>isOpen()&&positionPortal(),true)}

const style=document.createElement('style');style.id='darkroom-preset-listbox-style-v2';style.textContent=`
#toolTabs .preset-picker{width:100%!important;min-width:0!important;position:relative!important}
#toolTabs .preset-list-trigger{box-sizing:border-box!important;display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;width:100%!important;min-width:0!important;height:38px!important;min-height:38px!important;margin:0!important;padding:0 10px!important;border:1px solid #3f3f3f!important;border-radius:6px!important;background:#202020!important;color:#e8e8e8!important;font:400 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;text-align:left!important;cursor:pointer!important;position:relative!important;z-index:3!important}
#toolTabs .preset-list-trigger:hover{background:#272727!important;border-color:#555!important}
#toolTabs .preset-list-trigger:focus-visible{outline:2px solid var(--accent,#4ea7ff)!important;outline-offset:2px!important}
#toolTabs .preset-value{display:block!important;visibility:visible!important;opacity:1!important;flex:1 1 auto!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#e8e8e8!important;text-align:left!important;transform:none!important;position:static!important}
#toolTabs .preset-caret{display:block!important;visibility:visible!important;opacity:1!important;flex:0 0 auto!important;color:#aaa!important;transform:none!important;position:static!important}
.preset-portal-listbox{box-sizing:border-box;position:fixed;z-index:2147483647;overflow-y:auto;overscroll-behavior:contain;padding:4px;border:1px solid #484848;border-radius:6px;background:#191919;color:#eee;box-shadow:0 14px 36px rgba(0,0,0,.65);font:400 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark}
.preset-portal-listbox[hidden]{display:none!important}
.preset-portal-group+.preset-portal-group{margin-top:4px;padding-top:4px;border-top:1px solid #303030}
.preset-portal-group-title{padding:6px 8px 5px;color:#7f7f7f;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;user-select:none}
.preset-portal-option{box-sizing:border-box;display:flex;align-items:center;width:100%;min-height:32px;padding:0 9px;border-radius:4px;color:#ddd;cursor:pointer;user-select:none;text-align:left}
.preset-portal-option:hover,.preset-portal-option.active{background:#303030;color:#fff}
.preset-portal-option.selected{font-weight:600;color:#fff}
`;document.head.appendChild(style);

presetMarkup=presetMarkupListbox;
const previousBindGeneratedControls=bindGeneratedControls;
bindGeneratedControls=function(){previousBindGeneratedControls()};
batchApplyPreset=async function(name){if(!name)return;const preset=all()[name];if(!preset)return;await batchMutate(photo=>{const result=applyPresetState(photo.edits||{},photo.presetSelection,name,preset,defaultEdits());photo.edits=result.edits;photo.presetSelection=result.state},`${name} applied`)};
})(globalThis);
