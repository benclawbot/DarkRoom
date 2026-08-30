(function(){
 const load=(src,next)=>{const script=document.createElement('script');script.src=src;script.async=false;script.onload=next;script.onerror=()=>{console.error(`Could not load ${src}`);if(src.includes('presetpro-presets'))next()};document.head.appendChild(script)};
 load('./presetpro-presets.js?v=22',()=>load('./app-base.js?v=22',()=>{}));
})();
