(function(){
'use strict';
function trigger(){return document.querySelector('#presetTrigger')}
function popup(){return document.querySelector('#presetPopup')}
function closePopup(){const t=trigger(),p=popup();if(!t||!p)return false;p.hidden=true;t.setAttribute('aria-expanded','false');t.focus();return true}
document.addEventListener('keydown',event=>{
 const t=event.target?.closest?.('#presetTrigger'),p=popup();
 if(t&&p&&p.hidden&&(event.key==='ArrowDown'||event.key==='ArrowUp')){
  const options=[...p.querySelectorAll('[data-preset-option]')];if(!options.length)return;
  event.preventDefault();event.stopImmediatePropagation();
  const selected=options.findIndex(option=>option.getAttribute('aria-selected')==='true'),delta=event.key==='ArrowDown'?1:-1,index=selected<0?(delta>0?0:options.length-1):(selected+delta+options.length)%options.length;
  options[index].click();return;
 }
 if(event.key==='Escape'&&p&&!p.hidden){event.preventDefault();event.stopImmediatePropagation();closePopup()}
},true);
})();
