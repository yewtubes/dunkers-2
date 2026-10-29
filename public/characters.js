'use strict';
(() => {
 const root=document.createElement('div');root.id='character-ui';root.innerHTML=`<button id="character-open" class="online-button" hidden>CHARACTERS</button>
 <div id="character-panel" hidden><section role="dialog" aria-modal="true" aria-labelledby="character-title"><button id="character-close" class="online-x" aria-label="Close character locker"><span class="gui-icon gui-close"></span></button>
 <h1 id="character-title">YOUR CHARACTERS</h1><div class="character-card"><img src="custom/ronaldo-2007/parts/head-neutral.png" alt="Ronaldo ’07"><div><h2>RONALDO ’07</h2><p>SPEED 100 · JUMP 100<br>HANDLING 100 · SHOT 100</p><p>F — SLIDE KICK</p></div></div>
 <div class="character-actions"><button id="character-default" class="online-button">DEFAULT</button><button id="character-ronaldo" class="online-button">EQUIP RONALDO</button></div><p id="character-message" role="status"></p></section></div>
 <button id="character-kick" class="online-button" hidden>F · SLIDE KICK</button>`;
 document.getElementById('game-container').append(root);const el=id=>document.getElementById('character-'+id);
 let state,match,loading=false,initialized=false,pending=false,readyAt=0;
 function render(){el('open').hidden=!initialized||state?.id!==1||['matched','waiting'].includes(match?.status);el('kick').hidden=match?.status!=='matched'||match.own?.id!==1||match.own?.character!=='ronaldo-2007';if(state){el('ronaldo').textContent=state.selected==='ronaldo-2007'?'EQUIPPED':'EQUIP RONALDO';el('default').textContent=state.selected===null?'DEFAULT ✓':'DEFAULT';el('ronaldo').disabled=pending||state.selected==='ronaldo-2007';el('default').disabled=pending||state.selected===null}}
 async function select(character){if(pending)return;pending=true;render();try{const response=await fetch(new URL('api/characters/select',location.href),{method:'POST',headers:{'Content-Type':'application/json','X-Character-CSRF':state.csrf},body:JSON.stringify({character})});const value=await response.json();if(!response.ok)throw Error(value.error);state=value;await dunkersCharacterNative.setOwner(state);el('message').textContent=character?'RONALDO EQUIPPED':'DEFAULT EQUIPPED'}catch(e){el('message').textContent=e.message}finally{pending=false;render()}}
 el('open').onclick=()=>{el('panel').hidden=false};el('close').onclick=()=>{el('panel').hidden=true;document.getElementById('game').focus()};el('ronaldo').onclick=()=>select('ronaldo-2007');el('default').onclick=()=>select(null);
 function kick(){if(el('kick').hidden||pending||Date.now()<readyAt)return;window.dispatchEvent(new Event('dunkers-slide-kick'))}
 el('kick').onclick=kick;
 window.addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(!el('kick').hidden){e.preventDefault();kick()}},true);
 window.addEventListener('dunkers-match-state',e=>{match=e.detail;readyAt=0;if(match?.status==='matched')el('panel').hidden=true;render()});
 window.addEventListener('dunkers-kick-cooldown',e=>{readyAt=e.detail.readyAt});
 window.addEventListener('dunkers-kick-error',e=>{el('kick').title=e.detail});
 async function init(){if(initialized||loading||!window.dunkersOnlineNative?.ready)return;loading=true;try{const response=await fetch(new URL('api/characters/state',location.href),{cache:'no-store'});if(!response.ok)return;state=await response.json();await dunkersCharacterNative.setOwner(state);initialized=true;render()}catch(e){console.error('Character locker:',e)}finally{loading=false}}
 setInterval(()=>{init();if(!el('kick').hidden){const remaining=Math.max(0,readyAt-Date.now());el('kick').disabled=remaining>0;el('kick').textContent=remaining?`SLIDE · ${(remaining/1000).toFixed(1)}s`:'F · SLIDE KICK'}},150);
})();
