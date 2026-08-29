function bind(){
 $$('[data-route]').forEach(b=>b.onclick=()=>route(b.dataset.route));
 $('#storageBtn').onclick=()=>route('storage');['#importTop','#sideAdd','#emptyImport','#mobileAdd','#homeImport'].forEach(s=>$(s).onclick=()=>$('#fileInput').click());
 $('#fileInput').onchange=e=>{importFiles(e.target.files);e.target.value=''};
 $('#searchInput').oninput=()=>{if(!['library','recent','favorites','flagged','album'].includes(currentRoute))route('library');else renderPhotos()};
 $('#sortSelect').onchange=renderPhotos;$('#gridSizeBtn').onclick=()=>{gridMode=gridMode===5?4:gridMode===4?6:5;renderPhotos()};
 $('#filterToggle').onclick=()=>$('#filterBar').classList.toggle('hidden');$$('[data-filter]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderPhotos()});
 ['#newAlbumBtn','#newAlbumMini'].forEach(s=>$(s).onclick=showAlbumModal);$('#cancelModal').onclick=hideAlbumModal;$('#createAlbum').onclick=createAlbum;$('#albumName').onkeydown=e=>{if(e.key==='Enter')createAlbum()};$('#modalBackdrop').onclick=e=>{if(e.target===$('#modalBackdrop'))hideAlbumModal()};
 $('#renameAlbum').onclick=renameAlbum;$('#deleteAlbum').onclick=deleteAlbum;
 $('#closeEditor').onclick=closeEditor;$('#exportBtn').onclick=exportPhoto;
 $('#favoriteBtn').onclick=()=>{captureHistory();currentPhoto.favorite=!currentPhoto.favorite;captureHistory();syncEditorMeta();debouncedSave()};
 $('#pickBtn').onclick=()=>setFlag('picked');$('#rejectBtn').onclick=()=>setFlag('rejected');
 $$('#toolTabs button').forEach(b=>b.onclick=()=>{currentPanel=b.dataset.panel;renderControls()});
 $('#resetEdits').onclick=()=>{captureHistory();currentPhoto.edits=defaultEdits();captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast('Edits reset')};
 $$('#ratingButtons button').forEach(b=>b.onclick=()=>{captureHistory();currentPhoto.rating=+b.dataset.rate===currentPhoto.rating?0:+b.dataset.rate;captureHistory();updateRating();debouncedSave()});
 $('#copyEdits').onclick=()=>{editClipboard=clone(currentPhoto.edits);toast('Edits copied')};$('#pasteEdits').onclick=()=>{if(!editClipboard)return toast('No copied edits');captureHistory();currentPhoto.edits={...defaultEdits(),...clone(editClipboard)};captureHistory();renderControls();renderCanvas($('#editorCanvas'));debouncedSave();toast('Edits pasted')};
 $('#beforeAfterBtn').onclick=()=>{beforeMode=!beforeMode;syncEditorMeta();renderCanvas($('#editorCanvas'),1800,beforeMode)};$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
 $('#deletePhoto').onclick=async()=>{if(!confirm('Delete this photo from DarkRoom local storage?'))return;const id=currentPhoto.id;$('#editor').classList.add('hidden');currentPhoto=null;await del('photos',id);await refreshData();toast('Photo deleted')};
 $('#clearLibrary').onclick=async()=>{if(!confirm('Delete every photo and album stored by DarkRoom in this browser? This cannot be undone.'))return;await clearStore('photos');await clearStore('albums');await refreshData();toast('Local library deleted')};
 $('#zoomIn').onclick=()=>{zoom=Math.min(8,zoom*1.25);applyTransform()};$('#zoomOut').onclick=()=>{zoom=Math.max(.25,zoom/1.25);applyTransform()};$('#zoomReset').onclick=resetZoom;
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#editor').classList.contains('hidden'))closeEditor();if(!currentPhoto)return;if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();resetZoom()}if(e.key>='1'&&e.key<='5'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){captureHistory();currentPhoto.rating=+e.key;captureHistory();updateRating();debouncedSave()}if(e.key==='p'||e.key==='P')setFlag('picked');if(e.key==='x'||e.key==='X')setFlag('rejected')});
 window.addEventListener('resize',renderPhotos);initZoom()
}
bind();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));initDB().catch(e=>{console.error(e);toast('Could not open local storage')});
