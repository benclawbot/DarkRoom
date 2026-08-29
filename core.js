const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DB_NAME='darkroom-db', DB_VERSION=5;
let db,photos=[],albums=[],currentPhoto=null,currentRoute='library',currentAlbumId=null,currentPanel='edit',gridMode=5,activeFilter='all',saveTimer,renderToken=0;
let zoom=1,panX=0,panY=0,drag=null,pinch=null,beforeMode=false,beforeSplit=false,beforeSplitPct=50,history=[],historyIndex=-1,editClipboard=null,focusView=false;
let editorMode=localStorage.getItem('darkroom-editor-mode')||'quick',activeLocalId=null,activeLayerId=null,activeImageLayerId=null,paintMode=null,paintStroke=null,selectedPhotoIds=new Set(),selectionMode=false,referencePhotoId=null;
let photoOnly=false,compositionOverlay='none',diagnosticOverlay='none',soloSections=localStorage.getItem('darkroom-solo-sections')==='1';
const clone=o=>typeof structuredClone==='function'?structuredClone(o):JSON.parse(JSON.stringify(o));
const defaultEdits=()=>({
 exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,temp:0,tint:0,vibrance:0,saturation:0,
 texture:0,clarity:0,dehaze:0,localContrast:0,gamma:100,vignette:0,grain:0,sharpness:0,noise:0,luminanceNoise:0,colorNoise:0,deblur:0,artifactReduction:0,dustRemoval:0,lineRemoval:0,faceRestore:0,fade:0,bloom:0,halation:0,
 curveBlacks:0,curveShadows:0,curveMidtones:0,curveHighlights:0,curveWhites:0,
 satRed:0,satOrange:0,satYellow:0,satGreen:0,satAqua:0,satBlue:0,satPurple:0,satMagenta:0,
 hueRed:0,hueOrange:0,hueYellow:0,hueGreen:0,hueAqua:0,hueBlue:0,huePurple:0,hueMagenta:0,
 lumRed:0,lumOrange:0,lumYellow:0,lumGreen:0,lumAqua:0,lumBlue:0,lumPurple:0,lumMagenta:0,
 gradeShadowHue:220,gradeShadowSat:0,gradeShadowLum:0,gradeMidHue:35,gradeMidSat:0,gradeMidLum:0,gradeHighHue:45,gradeHighSat:0,gradeHighLum:0,gradeBalance:0,gradeBlending:50,
 skinSmooth:0,skinTone:0,blemish:0,underEye:0,teeth:0,eyes:0,redEye:0,lips:0,shine:0,hair:0,contour:0,faceLight:0,frequencySmooth:0,frequencyDetail:0,
 relightForeground:0,relightBackground:0,rimLight:0,relightWarmth:0,relightDirection:50,relightSoftness:50,
 lensBlur:0,focusDepth:50,focusRange:35,bokehHighlights:0,
 rotation:0,angle:0,flipX:false,flipY:false,cropAspect:'original',cropX:50,cropY:50,cropZoom:100,geometryX:0,geometryY:0,geometryRotate:0,geometryScale:100,lensCorrection:0,chromatic:0,
 expand:0,superResolution:1,useAISource:false,lutIntensity:100,skyReplacementOpacity:100
});
const localDefaultAdjust=()=>({exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,temp:0,tint:0,vibrance:0,saturation:0,texture:0,clarity:0,dehaze:0,sharpness:0,noise:0});
const panelDefs={
 light:[['exposure','Exposure',-100,100],['contrast','Contrast',-100,100],['highlights','Highlights',-100,100],['shadows','Shadows',-100,100],['whites','Whites',-100,100],['blacks','Blacks',-100,100]],
 color:[['temp','Temperature',-100,100],['tint','Tint',-100,100],['vibrance','Vibrance',-100,100],['saturation','Saturation',-100,100]],
 curves:[['curveBlacks','Blacks',-100,100],['curveShadows','Shadows',-100,100],['curveMidtones','Midtones',-100,100],['curveHighlights','Highlights',-100,100],['curveWhites','Whites',-100,100]],
 effects:[['texture','Texture',-100,100],['clarity','Clarity',-100,100],['dehaze','Dehaze',-100,100],['localContrast','Local Contrast',-100,100],['gamma','Gamma',50,150],['fade','Fade',0,100],['bloom','Bloom',0,100],['halation','Halation',0,100],['vignette','Vignette',-100,100],['grain','Grain',0,100]],
 detail:[['sharpness','Sharpening',0,100],['noise','Luminance Noise',0,100],['colorNoise','Color Noise',0,100],['deblur','Deblur / Focus Recovery',0,100],['artifactReduction','Compression Artifacts',0,100]],
 optics:[['lensCorrection','Lens Correction',-100,100],['chromatic','Defringe',0,100]],
 geometry:[['geometryX','Horizontal',-100,100],['geometryY','Vertical',-100,100],['geometryRotate','Rotate',-45,45],['geometryScale','Scale',50,150]],
 retouch:[['skinSmooth','Skin Smooth',0,100],['skinTone','Even Skin',0,100],['blemish','Blemish Reduction',0,100],['underEye','Under-eye',0,100],['teeth','Teeth',0,100],['eyes','Eyes',0,100],['redEye','Red-eye',0,100],['lips','Lips',-100,100],['shine','Reduce Shine',0,100],['hair','Hair Detail',0,100],['contour','Face Contour',-100,100],['faceLight','Face Light',-100,100],['faceRestore','Face Restore',0,100],['frequencySmooth','Frequency Smooth',0,100],['frequencyDetail','Frequency Detail',-100,100]],
 restore:[['dustRemoval','Dust / Scratch Removal',0,100],['lineRemoval','Line / Power-line Removal',0,100]],
 relight:[['relightForeground','Foreground Light',-100,100],['relightBackground','Background Light',-100,100],['rimLight','Rim Light',-100,100],['relightWarmth','Light Warmth',-100,100],['relightDirection','Light Direction',0,100],['relightSoftness','Light Softness',0,100]],
 blur:[['lensBlur','Lens Blur',0,100],['focusDepth','Focus Point',0,100],['focusRange','Focus Range',5,100],['bokehHighlights','Bokeh Highlights',0,100]]
};
const presets={
 'Auto':{exposure:8,contrast:6,highlights:-18,shadows:18,whites:8,blacks:-8,vibrance:10},
 'Natural':{contrast:4,highlights:-10,shadows:10,vibrance:6,saturation:-3,clarity:2},
 'Vivid':{contrast:14,vibrance:28,saturation:8,clarity:8,dehaze:5},
 'B&W':{saturation:-100,contrast:18,highlights:-10,shadows:12,clarity:12},
 'Warm':{temp:22,tint:4,vibrance:12,highlights:-8},
 'Cool':{temp:-22,tint:-2,vibrance:8,shadows:5},
 'Matte':{contrast:-8,blacks:22,highlights:-12,saturation:-8,grain:18,fade:30},
 'Punch':{contrast:24,blacks:-16,whites:12,clarity:18,dehaze:10,vibrance:16},
 'Film':{contrast:-4,highlights:-18,shadows:8,saturation:-8,grain:28,fade:18,halation:18,temp:6}
};
const MODE_RANK={quick:0,advanced:1,pro:2};
const TOOL_TIERS={edit:'quick',masks:'quick',heal:'quick',transform:'quick',retouch:'advanced',ai:'quick',layers:'pro',info:'pro'};
const SECTION_TIERS={layers:'pro',lut:'pro',sky:'advanced',presets:'quick',light:'quick',color:'quick',curves:'advanced',mixer:'advanced',grading:'advanced',effects:'advanced',detail:'advanced',restore:'advanced',blur:'advanced',optics:'advanced',geometry:'pro',portrait:'advanced',relight:'advanced',reference:'pro',diagnostics:'pro',export:'advanced',composition:'advanced',expand:'advanced',smartMasks:'quick',rangeMasks:'advanced',peopleMasks:'advanced',localAdjust:'quick'};
const modeAllows=tier=>MODE_RANK[editorMode]>=MODE_RANK[tier||'quick'];
function reqP(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function initDB(){db=await new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'id'});if(!d.objectStoreNames.contains('albums'))d.createObjectStore('albums',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});try{await navigator.storage?.persist?.()}catch{}await refreshData()}
const getAll=s=>reqP(db.transaction(s).objectStore(s).getAll());
const put=(s,o)=>reqP(db.transaction(s,'readwrite').objectStore(s).put(o));
const del=(s,id)=>reqP(db.transaction(s,'readwrite').objectStore(s).delete(id));
const clearStore=s=>reqP(db.transaction(s,'readwrite').objectStore(s).clear());
function normalizePhoto(p){p.edits={...defaultEdits(),...(p.edits||{})};p.albumIds=p.albumIds||[];p.rating=p.rating||0;p.flag=p.flag||'none';p.colorLabel=p.colorLabel||'none';p.adjustmentLayers=(p.adjustmentLayers||[]).map(l=>({...l,enabled:l.enabled!==false,opacity:l.opacity??1,blend:l.blend||'normal',edits:{...defaultEdits(),...(l.edits||{})}}));p.imageLayers=(p.imageLayers||[]).map(l=>({...l,enabled:l.enabled!==false,opacity:l.opacity??1,blend:l.blend||'normal',scale:l.scale??100,x:l.x??0,y:l.y??0,rotation:l.rotation??0}));p.caption=p.caption||'';p.keywords=Array.isArray(p.keywords)?p.keywords:[];p.lut=p.lut||null;p.skyReplacementId=p.skyReplacementId||null;p.analysis=p.analysis||null;p.localEdits=(p.localEdits||[]).map(m=>({...m,enabled:m.enabled!==false,opacity:m.opacity??1,density:m.density??1,feather:m.feather??.6,flow:m.flow??.65,size:m.size??.08,adjust:{...localDefaultAdjust(),...(m.adjust||{})},strokes:m.strokes||[],modifiers:(m.modifiers||[]).map(x=>({...x,strokes:x.strokes||[]}))}));p.healOps=(p.healOps||[]).map(m=>({...m,enabled:m.enabled!==false,feather:m.feather??.55,flow:m.flow??1,size:m.size??.06,strokes:m.strokes||[]}));return p}
async function refreshData(){photos=await getAll('photos');albums=await getAll('albums');photos.forEach(normalizePhoto);render();updateStorage()}
const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2);
const fmtBytes=n=>!n?'0 MB':n<1048576?(n/1024).toFixed(0)+' KB':n<1073741824?(n/1048576).toFixed(n<10485760?1:0)+' MB':(n/1073741824).toFixed(2)+' GB';
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),1800)}
function blobUrl(p,thumb=false){if(thumb&&p.thumbnailBlob){if(!p._thumbUrl)p._thumbUrl=URL.createObjectURL(p.thumbnailBlob);return p._thumbUrl}if(!p._url)p._url=URL.createObjectURL(p.blob);return p._url}
async function makeThumbnail(blob,max=520){try{const bmp=await createImageBitmap(blob),scale=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,c.width,c.height);bmp.close?.();return await new Promise(r=>c.toBlob(r,'image/jpeg',.82))}catch{return null}}
function imageDimensions(blob){return new Promise((res,rej)=>{const i=new Image(),u=URL.createObjectURL(blob);i.onload=()=>{res({width:i.naturalWidth,height:i.naturalHeight});URL.revokeObjectURL(u)};i.onerror=e=>{URL.revokeObjectURL(u);rej(e)};i.src=u})}
async function importFiles(files){const candidates=[...files].filter(f=>f.type.startsWith('image/')||DarkRoomRAW?.isRaw?.(f));if(!candidates.length)return toast('No supported images selected');toast(`Importing ${candidates.length} photo${candidates.length>1?'s':''}…`);let imported=0;for(const f of candidates){try{let blob=f,width=0,height=0,raw=false,rawMeta=null,originalBlob=null;if(DarkRoomRAW?.isRaw?.(f)){toast(`Decoding RAW: ${f.name}`);const d=await DarkRoomRAW.decode(f);blob=d.blob;width=d.width;height=d.height;raw=true;rawMeta=d.metadata;originalBlob=f}else{const d=await imageDimensions(f);width=d.width;height=d.height}const thumbnailBlob=await makeThumbnail(blob);await put('photos',{id:uid(),name:f.name,type:f.type||blob.type||'image/raw',size:f.size,created:Date.now()+imported,modified:f.lastModified||Date.now(),width,height,blob,thumbnailBlob,originalBlob,raw,rawMeta,edits:defaultEdits(),adjustmentLayers:[],imageLayers:[],localEdits:[],healOps:[],caption:'',keywords:[],favorite:false,rating:0,flag:'none',albumIds:[]});imported++}catch(e){console.error('Import failed',f.name,e);toast(`Could not import ${f.name}`)}}await refreshData();toast(`${imported} photo${imported===1?'':'s'} added`)}
