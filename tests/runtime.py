import json, subprocess, time, urllib.request, websocket, os, shutil
root='/mnt/data/darkroom'
profile='/tmp/darkroom-chrome-test'
shutil.rmtree(profile,ignore_errors=True)
server=subprocess.Popen(['python','-m','http.server','4173','--bind','127.0.0.1'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
chrome=subprocess.Popen(['chromium','--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=9223','--remote-allow-origins=*',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen('http://127.0.0.1:4173/',timeout=1)
            tabs=json.load(urllib.request.urlopen('http://127.0.0.1:9223/json',timeout=1)); break
        except Exception: time.sleep(.1)
    else: raise RuntimeError('server/chromium did not start')
    ws=websocket.create_connection(tabs[0]['webSocketDebuggerUrl'],timeout=15)
    seq=0
    def cmd(method,params=None):
        nonlocal_seq=None
        global seq
        seq+=1; ws.send(json.dumps({'id':seq,'method':method,'params':params or {}}))
        while True:
            m=json.loads(ws.recv())
            if m.get('id')==seq:return m
    cmd('Page.enable'); cmd('Runtime.enable'); cmd('Page.navigate',{'url':'http://127.0.0.1:4173/'}); time.sleep(1)
    ready=cmd('Runtime.evaluate',{'expression':"({title:document.title,state:document.readyState,importFn:typeof importFiles,db:!!db,ids:['photoViewport','editorCanvas','controls'].every(id=>!!document.getElementById(id))})",'returnByValue':True})['result']['result']['value']
    assert ready['title']=='DarkRoom' and ready['state']=='complete' and ready['importFn']=='function' and ready['ids'], ready
    expr=r'''(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const seed=document.createElement('canvas'); seed.width=80; seed.height=60;
      const x=seed.getContext('2d'); x.fillStyle='#c33'; x.fillRect(0,0,40,60); x.fillStyle='#36f'; x.fillRect(40,0,40,60);
      const blob=await new Promise(r=>seed.toBlob(r,'image/png'));
      const file=new File([blob],'runtime-test.png',{type:'image/png',lastModified:Date.now()});
      await importFiles([file]); await sleep(80);
      if(photos.length!==1) throw new Error('import failed '+photos.length);
      if(photos[0].width!==80||photos[0].height!==60) throw new Error('dimensions failed');
      document.querySelector('#albumName').value='Runtime Album'; await createAlbum();
      if(albums.length!==1) throw new Error('album create failed');
      await openEditor(photos[0].id); await sleep(80);
      if(document.querySelector('#editor').classList.contains('hidden')) throw new Error('editor open failed');
      currentPhoto.edits.exposure=25; currentPhoto.edits.rotation=90; currentPhoto.edits.cropAspect='1:1'; currentPhoto.edits.geometryX=12; currentPhoto.favorite=true; currentPhoto.rating=4; currentPhoto.flag='picked'; currentPhoto.albumIds=[albums[0].id];
      await put('photos',currentPhoto); await renderCanvas(document.querySelector('#editorCanvas'));
      const ec=document.querySelector('#editorCanvas'); if(!ec.width||!ec.height||ec.width!==ec.height) throw new Error('render/crop failed '+ec.width+'x'+ec.height);
      zoom=2; panX=17; panY=11; applyTransform(); if(!document.querySelector('#canvasWrap').style.transform.includes('scale(2)')) throw new Error('zoom failed');
      captureHistory(); currentPhoto.edits.contrast=33; captureHistory(); undo(); if(currentPhoto.edits.contrast===33) throw new Error('undo failed'); redo(); if(currentPhoto.edits.contrast!==33) throw new Error('redo failed');
      beforeMode=true; await renderCanvas(ec,1800,true); beforeMode=false; await renderCanvas(ec,1800,false);
      editClipboard=clone(currentPhoto.edits); currentPhoto.edits=defaultEdits(); currentPhoto.edits={...defaultEdits(),...clone(editClipboard)}; if(currentPhoto.edits.exposure!==25) throw new Error('copy paste failed');
      await closeEditor();
      if(!photos[0].favorite||photos[0].rating!==4||photos[0].flag!=='picked'||photos[0].edits.exposure!==25) throw new Error('edit persistence failed');
      currentAlbumId=albums[0].id; route('album'); if(filteredPhotos().length!==1) throw new Error('album membership/routing failed');
      route('favorites'); if(filteredPhotos().length!==1) throw new Error('favorite filter failed'); route('flagged'); if(filteredPhotos().length!==1) throw new Error('flag filter failed');
      activeFilter='4'; route('library'); if(filteredPhotos().length!==1) throw new Error('rating filter failed'); activeFilter='all';
      document.querySelector('#searchInput').value='runtime'; if(filteredPhotos().length!==1) throw new Error('search failed'); document.querySelector('#searchInput').value='';
      route('storage'); if(!document.querySelector('#storageView').classList.contains('active')) throw new Error('storage route failed');
      return {photos:photos.length,albums:albums.length,canvas:[ec.width,ec.height],zoom:document.querySelector('#zoomLabel').textContent,storage:document.querySelector('#storageBig').textContent};
    })()'''
    res=cmd('Runtime.evaluate',{'expression':expr,'awaitPromise':True,'returnByValue':True})
    if res.get('result',{}).get('exceptionDetails'): raise RuntimeError(json.dumps(res['result']['exceptionDetails']))
    rr=res['result']['result'];
    if rr.get('subtype')=='error': raise RuntimeError(rr.get('description'))
    print('Runtime workflow passed:',json.dumps(rr.get('value')))
    cmd('Page.reload',{'ignoreCache':True}); time.sleep(1)
    res=cmd('Runtime.evaluate',{'expression':"(async()=>{await new Promise(r=>setTimeout(r,400));return {photos:photos.length,albums:albums.length,exposure:photos[0]?.edits?.exposure,rating:photos[0]?.rating,flag:photos[0]?.flag,albumIds:photos[0]?.albumIds?.length}})()",'awaitPromise':True,'returnByValue':True})
    val=res['result']['result'].get('value'); print('Reload persistence passed:',json.dumps(val)); assert val=={'photos':1,'albums':1,'exposure':25,'rating':4,'flag':'picked','albumIds':1},val
finally:
    for p in (chrome,server):
        try:p.terminate()
        except:pass
