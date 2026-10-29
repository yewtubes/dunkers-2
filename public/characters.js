'use strict';
(() => {
 const root=document.createElement('div');root.id='character-ui';root.innerHTML=`<button id="character-open" class="online-button" hidden>BALLERS</button><button id="character-kick" class="online-button" hidden>F · SLIDE KICK</button>`;
 document.getElementById('game-container').append(root);const el=id=>document.getElementById('character-'+id);
 let state,match,loading=false,initialized=false,pending=false,readyAt=0;
 function render(){el('open').hidden=!initialized||state?.id!==1||['matched','waiting'].includes(match?.status);el('kick').hidden=match?.status!=='matched'||match.own?.id!==1||match.own?.character!=='ronaldo-2007'}
 async function select(character){
  if(pending)throw Error('Character selection is already in progress.');
  if(!state)throw Error('The locker is still connecting.');
  pending=true;
  try{
   const response=await fetch(new URL('api/characters/select',location.href),{method:'POST',headers:{'Content-Type':'application/json','X-Character-CSRF':state.csrf},body:JSON.stringify({character})});
   const value=await response.json();if(!response.ok)throw Error(value.error);
   state=value;await dunkersCharacterNative.setOwner(state);await dunkersLockerNative.setOwner(state);
   window.dispatchEvent(new CustomEvent('dunkers-character-selected',{detail:{selected:state.selected}}));return state;
  }finally{pending=false;render()}
 }
 el('open').onclick=()=>window.dunkersLockerNative.open();
 function kick(){if(el('kick').hidden||pending||Date.now()<readyAt)return;window.dispatchEvent(new Event('dunkers-slide-kick'))}
 el('kick').onclick=kick;
 window.addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(!el('kick').hidden){e.preventDefault();kick()}},true);
 window.addEventListener('dunkers-match-state',e=>{match=e.detail;readyAt=0;render()});
 window.addEventListener('dunkers-kick-cooldown',e=>{readyAt=e.detail.readyAt});
 window.addEventListener('dunkers-kick-error',e=>{el('kick').title=e.detail});
 async function init(){if(initialized||loading||!window.unityGame?.Module)return;loading=true;try{if(!await dunkersLockerNative.available())return;const response=await fetch(new URL('api/characters/state',location.href),{cache:'no-store'});if(!response.ok)return;state=await response.json();await dunkersCharacterNative.setOwner(state);await dunkersLockerNative.setOwner(state);initialized=true;render()}catch(e){console.error('Character locker:',e)}finally{loading=false}}
 window.dunkersCharacters={select,get state(){return state},get busy(){return pending}};
 setInterval(()=>{init();if(!el('kick').hidden){const remaining=Math.max(0,readyAt-Date.now());el('kick').disabled=remaining>0;el('kick').textContent=remaining?`SLIDE · ${(remaining/1000).toFixed(1)}s`:'F · SLIDE KICK'}},150);
})();
