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
  for(const id of ['openPhotos','openPhotosTop','openMorePhotos'])$('#'+id)?.addEventListener('click',openFilePicker);

  const input=$('#fileInput');
  if(input)input.onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(files.length)await importFiles(files)};

  const drop=$('#dropZone');
  if(drop){
    for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('dragging')});
    for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('dragging')});
    drop.addEventListener('drop',async e=>{const files=[...(e.dataTransfer?.files||[])];if(files.length)await importFiles(files)});
    drop.addEventListener('dblclick',openFilePicker);
  }

  $('#closeEditor').onclick=closeEditor;
  $('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
  $('#beforeAfterBtn').onclick=()=>{beforeMode=!beforeMode;if(beforeMode&&beforeSplit){beforeSplit=false;updateBeforeSplit()}syncEditorMeta();renderCanvas($('#editorCanvas'),EDITOR_PREVIEW_MAX_SIZE,beforeMode)};
  $('#beforeSplitBtn').onclick=()=>{beforeSplit=!beforeSplit;if(beforeSplit&&beforeMode)beforeMode=false;$('#beforeSplitBtn').classList.toggle('active',beforeSplit);renderCanvas($('#editorCanvas'));updateBeforeSplit()};
  $('#beforeSplitRange').oninput=e=>{beforeSplitPct=+e.target.value;applyBeforeSplitClip()};

  $('#resetEdits').onclick=()=>{if(!currentPhoto)return;captureHistory();currentPhoto.edits=defaultEdits();currentPhoto.presetSelection=null;currentPhoto.adjustmentLayers=[];currentPhoto.imageLayers=[];currentPhoto.lut=null;currentPhoto.skyReplacementId=null;currentPhoto.localEdits=[];currentPhoto.healOps=[];activeLocalId=null;activeLayerId=null;captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast('Edits reset')};
  $('#copyEdits').onclick=()=>{if(!currentPhoto)return;editClipboard={edits:clone(currentPhoto.edits),presetSelection:clone(currentPhoto.presetSelection||null),lut:clone(currentPhoto.lut||null),localEdits:clone(currentPhoto.localEdits||[]),healOps:clone((currentPhoto.healOps||[]).filter(o=>o.mode!=='generative'))};toast('Edits copied')};
  $('#pasteEdits').onclick=()=>{if(!currentPhoto)return;if(!editClipboard)return toast('No copied edits');captureHistory();currentPhoto.edits={...defaultEdits(),...clone(editClipboard.edits||editClipboard)};currentPhoto.presetSelection=clone(editClipboard.presetSelection||null);currentPhoto.lut=clone(editClipboard.lut||null);currentPhoto.localEdits=clone(editClipboard.localEdits||[]);currentPhoto.healOps=clone(editClipboard.healOps||[]);captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast('Edits pasted')};

  $('#panelToggle').onclick=()=>{const editor=$('#editor'),panel=$('#editorPanel');if(innerWidth<=760){panel.classList.toggle('sheet-collapsed');return}editor.classList.toggle('tools-collapsed');$('#panelToggle').classList.toggle('active',editor.classList.contains('tools-collapsed'));};
  $('#fullscreenBtn').onclick=()=>togglePhotoOnly();
  $('#mobileFullscreenBtn').onclick=()=>togglePhotoOnly();
  $('#zoomIn').onclick=()=>{zoom=Math.min(8,zoom*1.25);applyTransform()};
  $('#zoomOut').onclick=()=>{zoom=Math.max(.25,zoom/1.25);applyTransform()};
  $('#zoomReset').onclick=resetZoom;

  $('#exportBtn').onclick=showExportSheet;
  $('#closeExportSheet').onclick=hideExportSheet;$('#cancelExport').onclick=hideExportSheet;
  $('#exportQuality').oninput=e=>$('#exportQualityValue').textContent=e.target.value+'%';
  $('#confirmExport').onclick=async()=>{saveExportSheet();hideExportSheet();await exportPhoto()};
  $('#exportSheet').addEventListener('click',e=>{if(e.target.id==='exportSheet')hideExportSheet()});

  window.addEventListener('keydown',e=>{
    const editing=currentPhoto&&!$('#editor').classList.contains('hidden'),tag=document.activeElement?.tagName;
    if(e.key==='Escape'&&!$('#exportSheet').classList.contains('hidden')){e.preventDefault();hideExportSheet();return}
    if((e.key==='f'||e.key==='F')&&editing&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();togglePhotoOnly();return}
    if(e.key==='Escape'&&editing){if(photoOnly){exitPhotoOnly();return}if(paintMode){stopPainting();return}closeEditor();return}
    if(!currentPhoto)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
    if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();resetZoom()}
  });

  initZoom();applyEditorMode(false);
}

async function start(){
  bindFocusedApp();
  try{
    await initDB();
    if(!photos.length)$('#recentPhotos')?.classList.add('hidden');
    else $('#recentPhotos')?.classList.remove('hidden');
  }catch(error){console.error(error);toast('Could not open local photo storage')}
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}

start();
