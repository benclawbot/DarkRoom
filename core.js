const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DB_NAME='darkroom-db', DB_VERSION=3;
let db,photos=[],albums=[],currentPhoto=null,currentRoute='library',currentAlbumId=null,currentPanel='light',gridMode=5,activeFilter='all',saveTimer,renderToken=0;
let zoom=1,panX=0,panY=0,drag=null,pinch=null,beforeMode=false,history=[],historyIndex=-1,editClipboard=null;
const clone=o=>JSON.parse(JSON.stringify(o));
const defaultEdits=()=>({exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,temp:0,tint:0,vibrance:0,saturation:0,texture:0,clarity:0,dehaze:0,vignette:0,grain:0,sharpness:0,noise:0,rotation:0,angle:0,flipX:false,flipY:false,cropAspect:'original',geometryX:0,geometryY:0,geometryRotate:0,geometryScale:100,lensCorrection:0,chromatic:0});
const panelDefs={
 light:[['exposure','Exposure',-100,100],['contrast','Contrast',-100,100],['highlights','Highlights',-100,100],['shadows','Shadows',-100,100],['whites','Whites',-100,100],['blacks','Blacks',-100,100]],
 color:[['temp','Temperature',-100,100],['tint','Tint',-100,100],['vibrance','Vibrance',-100,100],['saturation','Saturation',-100,100]],
 effects:[['texture','Texture',-100,100],['clarity','Clarity',-100,100],['dehaze','Dehaze',-100,100],['vignette','Vignette',-100,100],['grain','Grain',0,100]],
 detail:[['sharpness','Sharpening',0,100],['noise','Noise Reduction',0,100]],
 optics:[['lensCorrection','Lens Correction',-100,100],['chromatic','Defringe',0,100]],
 geometry:[['geometryX','Horizontal',-100,100],['geometryY','Vertical',-100,100],['geometryRotate','Rotate',-45,45],['geometryScale','Scale',50,150]]
};
const presets={
 'Auto':{exposure:8,contrast:6,highlights:-18,shadows:18,whites:8,blacks:-8,vibrance:10},
 'Natural':{contrast:4,highlights:-10,shadows:10,vibrance:6,saturation:-3,clarity:2},
 'Vivid':{contrast:14,vibrance:28,saturation:8,clarity:8,dehaze:5},
 'B&W':{saturation:-100,contrast:18,highlights:-10,shadows:12,clarity:12},
 'Warm':{temp:22,tint:4,vibrance:12,highlights:-8},
 'Cool':{temp:-22,tint:-2,vibrance:8,shadows:5},
 'Matte':{contrast:-8,blacks:22,highlights:-12,saturation:-8,grain:18},
 'Punch':{contrast:24,blacks:-16,whites:12,clarity:18,dehaze:10,vibrance:16}
};
function reqP(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function initDB(){db=await new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'id'});if(!d.objectStoreNames.contains('albums'))d.createObjectStore('albums',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});try{await navigator.storage?.persist?.()}catch{}await refreshData()}
const getAll=s=>reqP(db.transaction(s).objectStore(s).getAll());
const put=(s,o)=>reqP(db.transaction(s,'readwrite').objectStore(s).put(o));
const del=(s,id)=>reqP(db.transaction(s,'readwrite').objectStore(s).delete(id));
const clearStore=s=>reqP(db.transaction(s,'readwrite').objectStore(s).clear());
async function refreshData(){photos=await getAll('photos');albums=await getAll('albums');for(const p of photos){p.edits={...defaultEdits(),...(p.edits||{})};p.albumIds=p.albumIds||[];p.rating=p.rating||0;p.flag=p.flag||'none'}render();updateStorage()}
const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2);
const fmtBytes=n=>!n?'0 MB':n<1048576?(n/1024).toFixed(0)+' KB':n<1073741824?(n/1048576).toFixed(n<10485760?1:0)+' MB':(n/1073741824).toFixed(2)+' GB';
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),1800)}
function blobUrl(p){if(!p._url)p._url=URL.createObjectURL(p.blob);return p._url}
function imageDimensions(blob){return new Promise((res,rej)=>{const i=new Image(),u=URL.createObjectURL(blob);i.onload=()=>{res({width:i.naturalWidth,height:i.naturalHeight});URL.revokeObjectURL(u)};i.onerror=e=>{URL.revokeObjectURL(u);rej(e)};i.src=u})}
async function importFiles(files){const imgs=[...files].filter(f=>f.type.startsWith('image/'));if(!imgs.length)return toast('No supported images selected');toast(`Importing ${imgs.length} photo${imgs.length>1?'s':''}…`);let imported=0;for(const f of imgs){try{const d=await imageDimensions(f);await put('photos',{id:uid(),name:f.name,type:f.type,size:f.size,created:Date.now()+imported,modified:f.lastModified||Date.now(),width:d.width,height:d.height,blob:f,edits:defaultEdits(),favorite:false,rating:0,flag:'none',albumIds:[]});imported++}catch(e){console.error('Import failed',f.name,e)}}await refreshData();toast(`${imported} photo${imported===1?'':'s'} added`)}
