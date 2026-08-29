import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const listeners={};
const opened=[];
const deleted=[];
const context={
  URL,
  location:{origin:'https://darkroom.test'},
  fetch:async()=>({ok:true,clone(){return this}}),
  caches:{
    open:async name=>{opened.push(name);return{add:async()=>{},put:async()=>{}}},
    keys:async()=>['darkroom-v19','darkroom-v20'],
    delete:async name=>{deleted.push(name);return true},
    match:async()=>null,
  },
  self:{
    clients:{claim:async()=>{}},
    skipWaiting:async()=>{},
    addEventListener:(type,handler)=>{listeners[type]=handler},
  },
};
vm.runInNewContext(source,context,{filename:'sw.js'});

let installPromise;
listeners.install({waitUntil:promise=>{installPromise=promise}});
await installPromise;
assert.equal(opened[0],'darkroom-v20','the upgraded worker must populate a new cache generation');

let activatePromise;
listeners.activate({waitUntil:promise=>{activatePromise=promise}});
await activatePromise;
assert(deleted.includes('darkroom-v19'),'activation must remove the stale v19 app shell');
assert(!deleted.includes('darkroom-v20'),'activation must retain the current app shell');
console.log('Service worker upgrade test passed: stale app-shell assets are invalidated.');
