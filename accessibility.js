(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hidden = el => !el || el.classList.contains('hidden');
  const returnFocus = new WeakMap();
  const overlays = [
    ['#modalBackdrop', '#cancelModal'], ['#batchAlbumBackdrop', '#cancelBatchAlbum'],
    ['#renameBackdrop', '#cancelRename'], ['#mergeBackdrop', '#cancelMerge'], ['#compareView', '#closeCompare']
  ];
  let lastTrigger = null, curvePointIndex = 0;

  function syncAria() {
    ['#editor','#compareView','#modalBackdrop','#batchAlbumBackdrop','#renameBackdrop','#mergeBackdrop'].forEach(s => {
      const n = $(s); if (n) n.setAttribute('aria-hidden', String(hidden(n)));
    });
    $$('[data-route]').forEach(b => b.classList.contains('active') ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current'));
    $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
    $$('#ratingButtons button').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('on'))));
    const pressed = (s,v) => $(s)?.setAttribute('aria-pressed', String(!!v));
    pressed('#filterToggle', !hidden($('#filterBar'))); pressed('#selectPhotosBtn', !hidden($('#batchBar')));
    pressed('#favoriteBtn', $('#favoriteBtn')?.textContent.trim()==='♥'); pressed('#pickBtn', $('#pickBtn')?.classList.contains('on'));
    pressed('#rejectBtn', $('#rejectBtn')?.classList.contains('rejected')); pressed('#beforeAfterBtn', $('#beforeAfterBtn')?.classList.contains('active'));
    pressed('#beforeSplitBtn', $('#beforeSplitBtn')?.classList.contains('active')); pressed('#panelToggle', $('#panelToggle')?.classList.contains('active'));
    pressed('#fullscreenBtn', $('#fullscreenBtn')?.classList.contains('active')); pressed('#mobileFullscreenBtn', $('#fullscreenBtn')?.classList.contains('active'));
  }

  function rangeText(input){ if(input.id==='beforeSplitRange') return `Split at ${input.value}%`; const l=input.getAttribute('aria-label')||'Value'; const n=+input.value; return `${l}: ${Number.isFinite(n)&&n>0?'+':''}${input.value}`; }
  function enhanceRanges(root=document){ $$('input[type="range"]',root).forEach(i=>i.setAttribute('aria-valuetext',rangeText(i))); }
  function hideGlyphs(root=document){ $$('.mask-tool-card > span,.tool-tabs button > span,.mobile-editor-dock button > span',root).forEach(s=>s.setAttribute('aria-hidden','true')); }
  function focusables(root){ return $$('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',root).filter(n=>n.offsetParent!==null&&n.getAttribute('aria-hidden')!=='true'); }
  function activeOverlay(){ for(let i=overlays.length-1;i>=0;i--){const o=$(overlays[i][0]);if(o&&!hidden(o))return[o,overlays[i][1]];} return null; }
  function syncOverlay(o){ const now=hidden(o),was=o.getAttribute('aria-hidden')==='true';o.setAttribute('aria-hidden',String(now)); if(!now&&was){const t=lastTrigger&&document.contains(lastTrigger)?lastTrigger:document.activeElement;if(t&&!o.contains(t))returnFocus.set(o,t);requestAnimationFrame(()=>focusables(o)[0]?.focus());} if(now&&!was){const t=returnFocus.get(o);returnFocus.delete(o);requestAnimationFrame(()=>t&&document.contains(t)&&t.focus());} }

  function curveName(canvas,points){ if(!canvas||!points?.length)return;curvePointIndex=Math.max(0,Math.min(points.length-1,curvePointIndex));const p=points[curvePointIndex];canvas.setAttribute('role','application');canvas.setAttribute('aria-label',`Tone curve. Point ${curvePointIndex+1} of ${points.length}, input ${Math.round(p.x*100)}%, output ${Math.round(p.y*100)}%. Left and right select points. Up and down adjust output. Alt plus left or right adjusts input. Enter adds a point. Delete removes an interior point.`); }
  function curveKeys(e){const c=e.target.closest?.('#toneCurveCanvas');if(!c||typeof ensureCurvePoints!=='function'||typeof currentPhoto==='undefined'||!currentPhoto)return;const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Delete','Backspace','Home','End'];if(!keys.includes(e.key))return;const pts=ensureCurvePoints();curvePointIndex=Math.max(0,Math.min(pts.length-1,curvePointIndex));if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!e.altKey){e.preventDefault();curvePointIndex=Math.max(0,Math.min(pts.length-1,curvePointIndex+(e.key==='ArrowRight'?1:-1)));curveName(c,pts);return;}if(e.key==='Home'||e.key==='End'){e.preventDefault();curvePointIndex=e.key==='Home'?0:pts.length-1;curveName(c,pts);return;}const sel=pts[curvePointIndex],next=pts.map(p=>({...p})),step=e.shiftKey?.05:.01;let changed=false;if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();next[curvePointIndex].y=Math.max(0,Math.min(1,sel.y+(e.key==='ArrowUp'?step:-step)));changed=true;}else if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.altKey&&curvePointIndex>0&&curvePointIndex<pts.length-1){e.preventDefault();const min=next[curvePointIndex-1].x+.005,max=next[curvePointIndex+1].x-.005;next[curvePointIndex].x=Math.max(min,Math.min(max,sel.x+(e.key==='ArrowRight'?step:-step)));changed=true;}else if(e.key==='Enter'&&curvePointIndex<pts.length-1){e.preventDefault();const n=pts[curvePointIndex+1];next.splice(curvePointIndex+1,0,{x:(sel.x+n.x)/2,y:(sel.y+n.y)/2});curvePointIndex++;changed=true;}else if((e.key==='Delete'||e.key==='Backspace')&&curvePointIndex>0&&curvePointIndex<pts.length-1){e.preventDefault();next.splice(curvePointIndex,1);curvePointIndex=Math.min(curvePointIndex,next.length-1);changed=true;}if(!changed)return;captureHistory?.();currentPhoto.edits.curvePoints=next;syncCurveSlidersFromPoints?.(next);captureHistory?.();drawToneCurve?.();renderCanvas?.($('#editorCanvas'));debouncedSave?.();curveName(c,next);}

  // Keep undo memory bounded without changing history semantics.
  if(typeof captureHistory==='function'){
    const baseCapture=captureHistory;
    captureHistory=function(...args){const r=baseCapture.apply(this,args);try{const limit=60;if(history.length>limit){const drop=history.length-limit;history.splice(0,drop);historyIndex=Math.max(-1,historyIndex-drop);}}catch{}return r;};
  }

  // Interactive editor previews: use the renderer's intended 960px target and coalesce rapid input renders.
  if(typeof renderCanvas==='function'){
    const baseRender=renderCanvas;let pending=null,inflight=false,raf=0;
    const flush=async()=>{raf=0;if(inflight||!pending)return;const job=pending;pending=null;inflight=true;try{await baseRender(job.canvas,job.max,job.original);}finally{inflight=false;if(pending&&!raf)raf=requestAnimationFrame(flush);}};
    renderCanvas=function(canvas,maxSize=1400,forceOriginal=false){
      if(canvas?.id!=='editorCanvas'||forceOriginal)return baseRender(canvas,maxSize,forceOriginal);
      const preview=typeof EDITOR_PREVIEW_MAX_SIZE==='number'?EDITOR_PREVIEW_MAX_SIZE:960;
      pending={canvas,max:Math.min(maxSize||preview,preview),original:false};if(!raf)raf=requestAnimationFrame(flush);return Promise.resolve();
    };
  }

  // Surface metadata limitations prominently rather than silently discarding trust-critical information.
  function exportWarning(){const controls=$('#controls');if(!controls||!currentPhoto)return;const exportSection=controls.querySelector('[data-section="export"],.export-options,.export-panel');if(exportSection&&!exportSection.querySelector('.metadata-warning')){const p=document.createElement('p');p.className='feature-note metadata-warning';p.setAttribute('role','note');p.innerHTML='<b>Metadata notice:</b> exported rendered files may not retain all EXIF/IPTC/XMP fields. Keep the original file for authoritative metadata.';exportSection.prepend(p);}}

  // Project bundle backup/restore for the local IndexedDB library.
  const blobToData=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)});
  async function dataToBlob(data){const r=await fetch(data);return r.blob();}
  async function exportProjectBundle(){
    const btn=$('#backupProject');if(btn)btn.disabled=true;try{const ps=await getAll('photos'),as=await getAll('albums');const out=[];for(let i=0;i<ps.length;i++){const p={...ps[i]};for(const k of ['blob','originalBlob','thumbnailBlob','aiSourceBlob'])if(p[k] instanceof Blob)p[k]={__blob:true,data:await blobToData(p[k]),type:p[k].type};out.push(p);if(btn)btn.textContent=`Backing up ${i+1}/${ps.length}…`;}
      const payload={format:'darkroom-project-bundle',version:1,created:new Date().toISOString(),photos:out,albums:as};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`DarkRoom-backup-${new Date().toISOString().slice(0,10)}.darkroom.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast?.('Project backup created');
    }catch(err){console.error(err);toast?.('Could not create project backup');}finally{if(btn){btn.disabled=false;btn.textContent='Back up project';}}
  }
  async function restoreProjectBundle(file){try{const payload=JSON.parse(await file.text());if(payload?.format!=='darkroom-project-bundle'||!Array.isArray(payload.photos)||!Array.isArray(payload.albums))throw new Error('Invalid bundle');if(!confirm(`Restore ${payload.photos.length} photos and ${payload.albums.length} albums? Existing items with the same IDs will be replaced.`))return;for(const p of payload.photos){for(const k of ['blob','originalBlob','thumbnailBlob','aiSourceBlob'])if(p[k]?.__blob)p[k]=await dataToBlob(p[k].data);await put('photos',p);}for(const a of payload.albums)await put('albums',a);await refreshData();toast?.('Project restored');}catch(err){console.error(err);toast?.('Could not restore this DarkRoom backup');}}
  function injectBackupUI(){const storage=$('#storageView .storage-detail');if(!storage||$('#backupProject'))return;const box=document.createElement('div');box.className='project-backup-tools';box.innerHTML='<h4>Project backup</h4><p>Export the complete local DarkRoom library and edit state so it can be restored later.</p><div class="project-backup-actions"><button id="backupProject" class="secondary">Back up project</button><label class="secondary project-restore">Restore project<input id="restoreProjectInput" type="file" accept=".json,.darkroom.json,application/json" hidden></label></div>';storage.insertBefore(box,storage.querySelector('.danger')||null);$('#backupProject').onclick=exportProjectBundle;$('#restoreProjectInput').onchange=e=>{const f=e.target.files?.[0];if(f)restoreProjectBundle(f);e.target.value='';};}

  // Quota-specific guidance even when legacy import paths emit a generic failure toast.
  if(typeof toast==='function'){
    const baseToast=toast;toast=function(msg){if(/^Could not import/i.test(String(msg))){navigator.storage?.estimate?.().then(e=>{if(e.quota&&e.usage/e.quota>.92)baseToast('Storage is nearly full. Free browser storage or back up and remove photos, then try the import again.');else baseToast(msg);}).catch(()=>baseToast(msg));return;}return baseToast(msg);};
  }

  // Long-press selects photos on touch; swipes navigate/cull only at fit zoom so pan gestures remain intact.
  let longTimer=0,longCard=null,gesture=null;
  document.addEventListener('pointerdown',e=>{const card=e.target.closest?.('.photo-card');if(card&&e.pointerType!=='mouse'){longCard=card;longTimer=setTimeout(()=>{if(!longCard)return;setSelectionMode?.(true);togglePhotoSelection?.(longCard.dataset.photo);navigator.vibrate?.(20);longCard=null;},450);}const canvas=e.target.closest?.('#editorCanvas');if(canvas&&e.pointerType!=='mouse'&&typeof zoom!=='undefined'&&zoom<=1.05)gesture={x:e.clientX,y:e.clientY,t:performance.now()};},{passive:true});
  document.addEventListener('pointerup',e=>{clearTimeout(longTimer);longTimer=0;longCard=null;if(!gesture)return;const g=gesture;gesture=null;const dx=e.clientX-g.x,dy=e.clientY-g.y,dt=performance.now()-g.t;if(dt>700)return;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.3&&typeof currentPhoto!=='undefined'&&currentPhoto){const list=typeof filteredPhotos==='function'?filteredPhotos():photos;const i=list.findIndex(p=>p.id===currentPhoto.id),n=i+(dx<0?1:-1);if(n>=0&&n<list.length)openEditor?.(list[n].id);}else if(typeof photoOnly!=='undefined'&&photoOnly&&Math.abs(dy)>70&&Math.abs(dy)>Math.abs(dx)*1.3){if(dy<0)setFlag?.('picked');else setFlag?.('rejected');}}, {passive:true});
  document.addEventListener('pointercancel',()=>{clearTimeout(longTimer);longTimer=0;longCard=null;gesture=null;},{passive:true});

  // Keyboard selection for the unified layer/mask rows added by the panel renderer.
  document.addEventListener('keydown',e=>{curveKeys(e);const row=e.target.closest?.('[role="option"][data-stack-kind]');if(!row)return;const rows=$$('[role="option"][data-stack-kind]',row.parentElement);const i=rows.indexOf(row);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();rows[Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();}if(e.key==='Enter'||e.key===' '){e.preventDefault();row.querySelector('[data-local-select],[data-layer-select],[data-image-layer-select]')?.click();}},true);

  document.addEventListener('click',e=>{const t=e.target.closest('button,a,input,select,summary,label');if(t)lastTrigger=t;requestAnimationFrame(()=>{syncAria();injectBackupUI();exportWarning();});},true);
  document.addEventListener('input',e=>{if(e.target.matches('input[type="range"]'))e.target.setAttribute('aria-valuetext',rangeText(e.target));},true);
  document.addEventListener('keydown',e=>{const a=activeOverlay();if(!a)return;const[o,close]=a;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();($(close,o)||$(close))?.click();return;}if(e.key==='Tab'){const items=focusables(o);if(!items.length)return;const f=items[0],l=items.at(-1);if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus();}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus();}}},true);
  overlays.forEach(([s])=>{const o=$(s);if(o)new MutationObserver(()=>syncOverlay(o)).observe(o,{attributes:true,attributeFilter:['class']});});
  const controls=$('#controls');if(controls)new MutationObserver(()=>{enhanceRanges(controls);hideGlyphs(controls);exportWarning();const c=$('#toneCurveCanvas');if(c&&typeof curvePointsForEdit==='function')curveName(c,curvePointsForEdit());}).observe(controls,{childList:true,subtree:true});
  new MutationObserver(()=>{syncAria();injectBackupUI();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  syncAria();enhanceRanges();hideGlyphs();injectBackupUI();
})();
