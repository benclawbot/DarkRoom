function filteredPhotos(){return [...photos].sort((a,b)=>(a.created||0)-(b.created||0))}

function renderPhotos(){
  const grid=$('#photoGrid'),empty=$('#emptyState'),recent=$('#recentPhotos');
  if(!grid||!empty)return;
  const list=filteredPhotos();
  empty.hidden=!!list.length;
  grid.hidden=!list.length;
  recent?.classList.toggle('hidden',!list.length);
  grid.innerHTML=list.map(p=>`<button class="photo-card focused-photo-card" data-photo="${p.id}" aria-label="Edit ${esc(p.name)}"><img data-photo-thumb="${p.id}" src="${blobUrl(p,true)}" alt=""><span>${esc(p.name)}</span></button>`).join('');
  $$('[data-photo-thumb]').forEach(img=>{img.onerror=()=>{img.onerror=null;const photo=photos.find(p=>p.id===img.dataset.photoThumb),fallback=photo&&blobUrl(photo,false);if(fallback)img.src=fallback}});
  $$('[data-photo]').forEach(card=>{card.onclick=()=>openEditor(card.dataset.photo);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}}});
}

function render(){renderPhotos();if(typeof renderSessionFilmstrip==='function')renderSessionFilmstrip()}
async function updateStorage(){}
