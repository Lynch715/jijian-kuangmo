const noop=()=>{};
const fakeEl=()=>new Proxy({},{get:(t,k)=>k==='classList'?{add:noop,remove:noop,toggle:noop}:k==='style'?{}:(typeof k==='string'&&/^(appendChild|remove|setAttribute|addEventListener|querySelector|querySelectorAll|closest)$/.test(k))?(()=>null):t[k],set:(t,k,v)=>{t[k]=v;return true}});
globalThis.window=globalThis;globalThis.addEventListener=noop;
globalThis.document={addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>fakeEl(),documentElement:fakeEl(),body:fakeEl()};
const store={};globalThis.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
globalThis.matchMedia=()=>({matches:false,addEventListener:noop,addListener:noop});
globalThis.navigator={clipboard:{writeText:()=>Promise.resolve()}};globalThis.scrollTo=noop;globalThis.requestAnimationFrame=noop;
