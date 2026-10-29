'use strict';
(() => {
 let state,match,loading=false,initialized=false,pending=false,readyAt=0;
 const canKick=()=>match?.status==='matched'&&match.own?.id===1&&match.own?.character==='ronaldo-2007';
 async function select(character){
  if(pending)throw Error('Character selection is already in progress.');
  if(!state)throw Error('The locker is still connecting.');
  pending=true;
  try{
   const response=await fetch(new URL('api/characters/select',location.href),{method:'POST',headers:{'Content-Type':'application/json','X-Character-CSRF':state.csrf},body:JSON.stringify({character})});
   const value=await response.json();if(!response.ok)throw Error(value.error);
   state=value;await dunkersCharacterNative.setOwner(state);await dunkersLockerNative.setOwner(state);
   window.dispatchEvent(new CustomEvent('dunkers-character-selected',{detail:{selected:state.selected}}));return state;
  }finally{pending=false}
 }
 window.addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(canKick()&&!pending&&Date.now()>=readyAt){e.preventDefault();window.dispatchEvent(new Event('dunkers-slide-kick'))}},true);
 window.addEventListener('dunkers-match-state',e=>{match=e.detail;readyAt=0});
 window.addEventListener('dunkers-kick-cooldown',e=>{readyAt=e.detail.readyAt});
 async function init(){if(initialized||loading||!window.unityGame?.Module)return;loading=true;try{if(!await dunkersLockerNative.available())return;const response=await fetch(new URL('api/characters/state',location.href),{cache:'no-store'});if(!response.ok)return;state=await response.json();await dunkersCharacterNative.setOwner(state);await dunkersLockerNative.setOwner(state);initialized=true}catch(e){console.error('Character locker:',e)}finally{loading=false}}
 window.dunkersCharacters={select,get state(){return state},get busy(){return pending}};
 setInterval(init,150);
})();
