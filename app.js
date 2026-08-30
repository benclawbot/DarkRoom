function openFilePicker(){document.querySelector('#fileInput')?.click()}

function showExportSheet(){
  if(!currentPhoto)return;
  const sheet=$('#exportSheet'),settings=exportSettings();
  if(!sheet)return;
  $('#exportFormat').value=settings.format;
  $('#exportQuality').value=Math.round(settings.quality*100);
  $('#exportQualityValue').textContent=Math.round(settings.quality*100)+'%';
  $('#exportLongEdge').value=settings.longEdge||'';
  $('#exportSharpen').value=settings.sharpen;
  sheet.classList.remove('hidden');
  $('#exportFormat').focus();
}
function hideExportSheet(){$('#exportSheet')?.classList.add('hidden')}

function saveExportSheet(){
  localStorage.setItem('darkroom-export-format',$('#exportFormat').value);
  localStorage.setItem('darkroom-export-quality',String(+(+$('#exportQuality').value/100).toFixed(2)));
  localStorage.setItem('darkroom-export-long-edge',String(Math.max(0,+$('#exportLongEdge').value||0)));
  localStorage.setItem('darkroom-export-sharpen',$('#exportSharpen').value);
}

function bindFocusedApp(){
  $('#editorOpenPhoto')?.addEventListener('click',openFilePicker);

  const input=$('#fileInput');
  if(input)input.onchange=async e=>{const files=[...(e.target.files||[])].slice(0,1);e.target.value='';if(files.length)await importFiles(files)};

  const viewport=$('#photoViewport');
  if(viewport){
    for(const name of ['dragenter','dragover'])viewport.addEventListener(name,e=>{e.preventDefault();viewport.classList.add('dragging')});
    for(const name of ['dragleave','drop'])viewport.addEventListener(name,e=>{e.preventDefault();viewport.classList.remove('dragging')});
    viewport.addEventListener('drop',async e=>{const files=[...(e.dataTransfer?.files||[])].slice(0,1);if(files.length)await importFiles(files)});
  }

  $('#undoBtn').onclick=()=>currentPhoto&&undo();
  $('#redoBtn').onclick=()=>currentPhoto&&redo();
  $('#beforeAfterBtn').onclick=()=>{if(!currentPhoto)return;beforeMode=!beforeMode;if(beforeMode&&beforeSplit){beforeSplit=false;updateBeforeSplit()}syncEditorMeta();renderCanvas($('#editorCanvas'),EDITOR_PREVIEW_MAX_SIZE,beforeMode)};
  $('#beforeSplitBtn').onclick=()=>{if(!currentPhoto)return;beforeSplit=!beforeSplit;if(beforeSplit&&beforeMode)beforeMode=false;$('#beforeSplitBtn').classList.toggle('active',beforeSplit);renderCanvas($('#editorCanvas'));updateBeforeSplit()};
  $('#beforeSplitRange').oninput=e=>{if(!currentPhoto)return;beforeSplitPct=+e.target.value;applyBeforeSplitClip()};

  $('#resetEdits').onclick=()=>{if(!currentPhoto)return;captureHistory();currentPhoto.edits=defaultEdits();currentPhoto.presetSelection=null;currentPhoto.adjustmentLayers=[];currentPhoto.imageLayers=[];currentPhoto.lut=null;currentPhoto.skyReplacementId=null;currentPhoto.localEdits=[];currentPhoto.healOps=[];activeLocalId=null;activeLayerId=null;captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast('Edits reset')};
  $('#copyEdits').onclick=()=>{if(!currentPhoto)return;editClipboard={edits:clone(currentPhoto.edits),presetSelection:clone(currentPhoto.presetSelection||null),lut:clone(currentPhoto.lut||null),localEdits:clone(currentPhoto.localEdits||[])};toast('Edits copied')};
  $('#pasteEdits').onclick=()=>{if(!currentPhoto)return;if(!editClipboard)return toast('No copied edits');captureHistory();currentPhoto.edits={...defaultEdits(),...clone(editClipboard.edits||editClipboard)};currentPhoto.presetSelection=clone(editClipboard.presetSelection||null);currentPhoto.lut=clone(editClipboard.lut||null);currentPhoto.localEdits=clone(editClipboard.localEdits||[]);captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast('Edits pasted')};

  $('#fullscreenBtn').onclick=()=>currentPhoto&&togglePhotoOnly();
  $('#mobileFullscreenBtn').onclick=()=>currentPhoto&&togglePhotoOnly();
  $('#zoomIn').onclick=()=>{if(!currentPhoto)return;zoom=Math.min(8,zoom*1.25);applyTransform()};
  $('#zoomOut').onclick=()=>{if(!currentPhoto)return;zoom=Math.max(.25,zoom/1.25);applyTransform()};
  $('#zoomReset').onclick=()=>currentPhoto&&resetZoom();

  $('#exportBtn').onclick=showExportSheet;
  $('#closeExportSheet').onclick=hideExportSheet;$('#cancelExport').onclick=hideExportSheet;
  $('#exportQuality').oninput=e=>$('#exportQualityValue').textContent=e.target.value+'%';
  $('#confirmExport').onclick=async()=>{if(!currentPhoto)return;saveExportSheet();hideExportSheet();await exportPhoto()};
  $('#exportSheet').addEventListener('click',e=>{if(e.target.id==='exportSheet')hideExportSheet()});

  window.addEventListener('keydown',e=>{
    const editing=!!currentPhoto,tag=document.activeElement?.tagName;
    if(e.key==='Escape'&&!$('#exportSheet').classList.contains('hidden')){e.preventDefault();hideExportSheet();return}
    if((e.key==='f'||e.key==='F')&&editing&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();togglePhotoOnly();return}
    if(e.key==='Escape'&&editing){if(photoOnly){exitPhotoOnly();return}if(paintMode){stopPainting();return}}
    if(!currentPhoto)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
    if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();resetZoom()}
  });

  initZoom();applyEditorMode(false);
}

async function start(){
  bindFocusedApp();
  try{await initDB()}catch(error){console.error(error);toast('Could not open local photo storage')}
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}

start();
