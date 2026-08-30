import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const current=source.match(/const CACHE='(darkroom-v\d+)'/)?.[1];
assert(current,'service worker cache generation must be identifiable');
const previousNumber=Math.max(0,Number(current.match(/(\d+)$/)?.[1]||0)-1);
const previous=`darkroom-v${previousNumber}`;
const listeners={};
const opened=[];
const deleted=[];
const stale={marker:'stale-cache',ok:true,clone(){return this}};
const fresh={marker:'fresh-network',ok:true,clone(){return this}};
const context={
  URL,
  location:{origin:'https://darkroom.test'},
  fetch:async()=>fresh,
  caches:{
    open:async name=>{opened.push(name);return{add:async()=>{},put:async()=>{}}},
    keys:async()=>[previous,current],
    delete:async name=>{deleted.push(name);return true},
    match:async()=>stale,
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
assert.equal(opened[0],current,'the upgraded worker must populate the current cache generation');

let activatePromise;
listeners.activate({waitUntil:promise=>{activatePromise=promise}});
await activatePromise;
assert(deleted.includes(previous),'activation must remove the stale app shell');
assert(!deleted.includes(current),'activation must retain the current app shell');

let fetchPromise;
listeners.fetch({request:{method:'GET',mode:'cors',url:'https://darkroom.test/renderer.js'},respondWith:promise=>{fetchPromise=promise}});
const runtimeResponse=await fetchPromise;
assert.equal(runtimeResponse.marker,'fresh-network','runtime JavaScript must prefer the network so a cached renderer cannot survive a deployment');
console.log(`Service worker upgrade test passed for ${current}: stale shells are removed and runtime assets refresh from the network.`);
