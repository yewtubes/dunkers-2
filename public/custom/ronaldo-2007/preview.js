import { draw } from './renderer.js';
const canvas=document.getElementById('character'),ctx=canvas.getContext('2d'),images={};
try {
 const [manifest,pose]=await Promise.all([fetch('character.json').then(r=>r.json()),fetch('sources/native-rest-pose.json').then(r=>r.json())]);
 await Promise.all(Object.entries(manifest.parts).map(async([name,part])=>{const image=new Image();image.src=part.file;await image.decode();images[name]=image}));
 let expression='neutral';const render=()=>draw(ctx,images,manifest,pose,expression);render();
 for(const value of manifest.expressions){const button=document.createElement('button');button.textContent=value.toUpperCase();button.setAttribute('aria-pressed',String(value===expression));button.onclick=()=>{expression=value;for(const b of button.parentNode.children)b.setAttribute('aria-pressed',String(b===button));render()};document.getElementById('expressions').append(button)}
 for(const type of ['character','parts'])document.getElementById(type+'-tab').onclick=()=>{document.getElementById('character').hidden=type!=='character';document.getElementById('parts').hidden=type!=='parts';document.getElementById('expressions').hidden=type!=='character';for(const t of ['character','parts'])document.getElementById(t+'-tab').setAttribute('aria-pressed',String(t===type))};
 document.getElementById('status').textContent='';
} catch(error){document.getElementById('status').textContent='Could not load the character artwork: '+error.message}
