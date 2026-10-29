'use strict';
// Pinned Unity/IL2CPP v31 bridge. Invoke retained native APIs without build changes.
(() => {
 // Keep method indices on the same cache version as the bridge scripts.
 const mapURL=new URL('native-runtime-map.json',location.href);mapURL.search=new URL(document.currentScript.src).search;
 const mapPromise=fetch(mapURL).then(r=>{if(!r.ok)throw Error('Native runtime map unavailable');return r.json()});
 let map,m,table;const typeCache=new Map(),fieldCache=new Map(),pins=new Map();
 const ptr=a=>Number.isInteger(a)&&a>=4096&&a%4===0&&a+4<=m.HEAPU8.length?m.HEAPU32[a>>>2]:0;
 const write=(a,v)=>{m.HEAPU32[a>>>2]=v};
 function cstring(a){let out='';for(let i=0;a&&i<200&&a+i<m.HEAPU8.length&&m.HEAPU8[a+i];i++)out+=String.fromCharCode(m.HEAPU8[a+i]);return out}
 function className(o){return cstring(ptr(ptr(o)+8))}
 const is=(o,name)=>className(o)===name;
 function call(id,...args){const entry=map[id];if(!entry?.slot)throw Error('Native method unavailable: '+id);return table.get(entry.slot)(...args,0)}
 function string(value){const bytes=new TextEncoder().encode(value+'\0'),p=m._malloc(bytes.length);try{m.HEAPU8.set(bytes,p);return call(5511,p)}finally{m._free(p)}}
 function text(p){if(!is(p,'String'))return '';const count=ptr(p+8);if(count>1000)return '';return String.fromCharCode(...m.HEAPU16.subarray((p+12)/2,(p+12)/2+count))}
 function pin(o){if(o){const p=pins.get(o);if(p)p.count++;else pins.set(o,{handle:call(5491,o),count:1})}return o}
 function release(o){const p=pins.get(o);if(p&&--p.count===0){call(5498,p.handle);pins.delete(o)}}
 function type(name){if(!typeCache.has(name)){const p=call(2107,string(name));if(!p)throw Error('Native type unavailable: '+name);typeCache.set(name,pin(p))}return typeCache.get(name)}
 function create(name,ctor,...args){const p=pin(call(4928,type(name)));if(!p)throw Error('Could not allocate '+name);if(ctor)call(ctor,p,...args);return p}
 function fields(object){const klass=ptr(object);if(fieldCache.has(klass))return fieldCache.get(klass);const result={};let k=klass;
  for(let parent=0;k&&parent<12;parent++,k=ptr(k+44)){
   const start=ptr(k+64);if(!start)continue;
   for(let i=0;i<300;i++){const at=start+i*20;if(ptr(at+8)!==k)break;const name=cstring(ptr(at)),offset=m.HEAP32[(at+12)>>>2];if(!name||offset<0||offset>8192)continue;if(!Object.hasOwn(result,name))result[name]=offset;}
  }
  fieldCache.set(klass,result);return result;
 }
 function get(o,name){const offset=fields(o)[name];if(offset===undefined)throw Error('Native field missing: '+className(o)+'.'+name);return ptr(o+offset)}
 function array(o){if(!o)return [];const name=className(o);let data=o+16,n=ptr(o+12);if(!name.endsWith('[]')){o=ptr(o+8);data=o+16}if(n>4096)return [];return Array.from(m.HEAPU32.subarray(data>>>2,(data>>>2)+n))}
 function floats(values,fn){const p=m._malloc(values.length*4);try{m.HEAPF32.set(values,p>>>2);return fn(p)}finally{m._free(p)}}
 async function init(){map=await mapPromise;m=window.unityGame?.Module;table=m?.asm?.Sh;if(!table||!m._malloc)throw Error('Native game not ready');return api}
 function setVec(id,object,value){return floats(value,p=>call(id,object,p))}
 function readVec(id,object,count=2){return floats(Array(count).fill(0),p=>{call(id,object,p);return Array.from(m.HEAPF32.subarray(p>>>2,(p>>>2)+count))})}
 function hook(cacheAddress,arity,callback){const slot=ptr(cacheAddress);if(!slot)return false;const original=table.get(slot);const section=(id,b)=>[id,b.length,...b],body=[0,...Array.from({length:arity},(_,i)=>[32,i]).flat(),16,0,11];const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,arity,...Array(arity).fill(127),0]),...section(2,[1,1,101,1,102,0,0]),...section(3,[1,0]),...section(7,[1,1,104,0,1]),...section(10,[1,body.length,...body])]);const fn=new WebAssembly.Instance(new WebAssembly.Module(bytes),{e:{f:(...args)=>callback(original,...args)}}).exports.h;table.set(slot,fn);return true}
 const api={hook,init,call,ptr,write,string,text,pin,release,type,create,is,className,fields,get,array,floats,setVec,readVec,cstring,
  get module(){return m},get table(){return table},get map(){return map},
  getFieldFloat(o,name){return m.HEAPF32[(o+fields(o)[name])>>>2]},
  setFieldInt(o,name,value){const off=fields(o)[name];if(off===undefined)throw Error('Native field missing: '+name);m.HEAP32[(o+off)>>>2]=value},
  setFieldFloat(o,name,value){const off=fields(o)[name];if(off===undefined)throw Error('Native field missing: '+name);m.HEAPF32[(o+off)>>>2]=value},
 };
 window.dunkersNativeRuntime=api;
})();
