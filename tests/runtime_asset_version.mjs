import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const listeners={};
const opened=[];
const cached=[];
const context={
  URL,
  location:{origin:'https://darkroom.test'},
  fetch:async()=>({ok:true,clone(){return this}}),
  caches:{
    open:async name=>{opened.push(name);return{add:async path=>{cached.push(path)},put:async()=>{}}},
    keys:async()=>[],delete:async()=>true,match:async()=>null,
  },
  self:{clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,handler)=>{listeners[type]=handler}},
};
vm.runInNewContext(worker,context,{filename:'sw.js'});
let installPromise;listeners.install({waitUntil:promise=>{installPromise=promise}});await installPromise;
const generation=opened[0].match(/darkroom-v(\d+)/)?.[1];
assert(generation,'service worker cache generation must be identifiable');

const runtimeUrls=[...html.matchAll(/<(?:script[^>]+src|link[^>]+rel="stylesheet"[^>]+href)="([^"]+)"/g)].map(match=>match[1]);
assert(runtimeUrls.length>=11,'page must expose all local JavaScript and CSS runtime assets');
for(const url of runtimeUrls){
  assert(url.endsWith(`?v=${generation}`),`runtime URL must bypass an older controlling worker: ${url}`);
  assert(cached.includes(`./${url}`),`offline shell must cache the exact versioned runtime URL used by the page: ${url}`);
}
console.log(`Runtime asset version test passed: HTML and offline cache use generation v${generation}.`);
