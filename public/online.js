'use strict';
(() => {
  // Only the streamed court is added to the page. Native Play owns matchmaking.
  const view=document.createElement('canvas');view.id='online-view';view.width=960;view.height=600;view.hidden=true;view.setAttribute('aria-label','Dunkers 2 court');
  document.getElementById('game-container').append(view);
  const loader=document.getElementById('loading-screen');
  const loading=show=>{loader.hidden=!show};
  let csrf, stream, connected = false, initialized = false, initializing = false, state = { status: 'idle' }, run = 0, matchId, seq = 0, lastFrame = 0, decoding = false, queuedFrame, hostPlaying = false;
  let playRequested=false, joining=false, receivedFrame=false;
  let input = { left: false, right: false, shoot: false }, dirty = false, sending = false, busyFrame = false;
  const keys = new Map(), pointers = new Map();
  const api = action => new URL('api/online/' + action, location.href);
  async function post(action, data = {}) {
    const response = await fetch(api(action), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Online-CSRF': csrf }, body: JSON.stringify(data) });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Could not reach the game server.'); return value;
  }
  function clearControls() { keys.clear(); pointers.clear(); updateControls(); window.dunkersOnlineNative?.input({}); }
  async function leave() {
    playRequested=false;clearControls();
    try { await post('leave'); } catch(error) { console.error('Match ended:',error.message);await applyState({status:'idle'}); }
  }
  async function join() {
    if(!playRequested||joining||!connected||!window.dunkersOnlineNative?.ready||state.status!=='idle')return;
    joining=true;
    // Use only the public queue. It always prefers humans, then supplies a CPU.
    try{await post('join')}catch(error){console.error('Matchmaking:',error.message)}finally{joining=false}
  }
  function play(){if(state.status==='matched'||state.status==='waiting'||playRequested)return;playRequested=true;loading(true);join()}
  async function applyState(next) {
    if (next.status === 'matched' && next.matchId === matchId) return;
    const previous = state; state = next;
    window.dispatchEvent(new CustomEvent('dunkers-match-state', { detail: next }));
    if (next.status !== 'matched') {
      run++; matchId = null; queuedFrame = null; hostPlaying = false; clearControls();
      view.hidden=true;loading(next.status==='waiting'||playRequested);
      if(next.status==='idle'&&previous.status!=='idle'){playRequested=false;loading(false)}
      if (previous.status === 'matched' && previous.role === 'host') await window.dunkersOnlineNative.stop();
      window.dunkersCharacterNative?.clearMatch();
      return;
    }
    matchId = next.matchId; const token = ++run; seq = 0; lastFrame = performance.now();receivedFrame=false;
    playRequested=false;loading(true);
    if (next.role === 'host') {
      try {
        await window.dunkersCharacterNative?.setMatch(next);
        if (token !== run) return;
        await window.dunkersOnlineNative.start(next);
        if (token !== run) return;
        hostPlaying = true;loading(false);
        if (!next.opponent.isBot) broadcast(token, next.matchId);
      } catch (error) { if (token !== run) return; console.error('Could not start match:',error.message);await leave(); }
    } else { await window.dunkersCharacterNative?.setMatch(next); }
  }
  const capture = document.createElement('canvas'); capture.width = 960; capture.height = 600;
  const captureContext = capture.getContext('2d', { alpha: false });
  function broadcast(token, id) {
    let previous = 0;
    function frame(time) {
      if (token !== run) return;
      requestAnimationFrame(frame);
      if (busyFrame || time - previous < 67) return;
      previous = time; busyFrame = true;
      try { captureContext.drawImage(document.getElementById('game'), 0, 0, 960, 600); }
      catch (error) { busyFrame = false; return; }
      capture.toBlob(async blob => {
        try {
          if (!blob || token !== run) return;
          const response = await fetch(api('frame'), { method: 'POST', headers: { 'Content-Type': 'image/webp', 'X-Online-CSRF': csrf, 'X-Online-Match': id }, body: blob });
          if (!response.ok && token === run) throw new Error('The shared court connection ended.');
        } catch (error) { if (token === run) { console.error('Could not start match:',error.message);await leave(); } }
        finally { busyFrame = false; }
      }, 'image/webp', 0.65);
    }
    requestAnimationFrame(frame);
  }
  async function displayFrame(value) {
    if (state.role !== 'guest' || value.matchId !== matchId) return;
    queuedFrame = value;
    if (decoding) return;
    decoding = true;
    try {
      while (queuedFrame) {
        const frame = queuedFrame; queuedFrame = null;
        const bytes = Uint8Array.from(atob(frame.data), c => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
        if (frame.matchId === matchId) {
          view.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, 960, 600);
          lastFrame = performance.now();receivedFrame=true;view.hidden=false;loading(false);
        }
        bitmap.close();
      }
    } catch (error) { console.error('Shared court frame:', error); } finally { decoding = false; }
  }
  function updateControls() {
    const controls = new Set([...keys.values(), ...pointers.values()]);
    input = { left: controls.has('left'), right: controls.has('right'), shoot: controls.has('shoot') }; dirty = true;
    sendControls();
  }
  async function sendControls() {
    if (state.role !== 'guest' || !matchId || sending || !dirty) return;
    dirty = false; sending = true;
    try { await post('input', { matchId, seq: ++seq, ...input }); } catch (error) { console.error('Online controls:', error.message); }
    finally { sending = false; if (dirty) sendControls(); }
  }
  const keyControls = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'shoot', ArrowUp: 'shoot', KeyW: 'shoot' };
  for (const type of ['keydown', 'keyup']) window.addEventListener(type, event => {
    if (state.role !== 'guest' || state.status !== 'matched') return;
    const control = keyControls[event.code]; if (!control) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (type === 'keydown') keys.set(event.code, control); else keys.delete(event.code); updateControls();
  }, true);
  // Touch input uses the court itself; there are no additional control widgets.
  view.addEventListener('pointerdown',event=>{if(state.role!=='guest'||state.status!=='matched')return;event.preventDefault();view.setPointerCapture(event.pointerId);const x=(event.clientX-view.getBoundingClientRect().left)/view.clientWidth;pointers.set(event.pointerId,x<.25?'left':x<.5?'right':'shoot');updateControls()});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(type,event=>{pointers.delete(event.pointerId);updateControls()});
  window.addEventListener('blur',clearControls);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls()});
  window.addEventListener('keydown',event=>{if(event.code==='Escape'&&(playRequested||state.status!=='idle')){event.preventDefault();event.stopImmediatePropagation();leave()}},true);
  window.addEventListener('dunkers-play',play);
  let kicking = false;
  window.addEventListener('dunkers-slide-kick', async () => {
    if (kicking || state.status !== 'matched' || state.own?.id !== 1 || state.own?.character !== 'ronaldo-2007') return;
    kicking = true;
    try { const value = await post('ability', { matchId }); window.dispatchEvent(new CustomEvent('dunkers-kick-cooldown', { detail: value })); }
    catch (error) { window.dispatchEvent(new CustomEvent('dunkers-kick-error', { detail: error.message })); }
    finally { kicking = false; }
  });
  async function init() {
    if (initialized || initializing || !window.dunkersOnlineNative?.ready) return;
    initializing = true;
    try {
      const response = await fetch(api('state'), { cache: 'no-store' }); if (!response.ok) return;
      const value = await response.json(); csrf = value.csrf;
      stream = new EventSource(api('stream')); initialized = true;
      stream.onopen = () => { connected = true;join(); };
      stream.onerror = () => { connected = false;clearControls(); };
      stream.addEventListener('state', event => applyState(JSON.parse(event.data)).catch(console.error));
      stream.addEventListener('input', event => { const value = JSON.parse(event.data); if (state.role === 'host' && value.matchId === matchId) window.dunkersOnlineNative.input(value); });
      stream.addEventListener('ability', event => { const value = JSON.parse(event.data); if (state.role === 'host' && value.matchId === matchId) window.dunkersCharacterNative?.kick(value); });
      stream.addEventListener('frame', event => displayFrame(JSON.parse(event.data)));
    } catch (error) { initialized = false; console.error('Online connection:', error.message); }
    finally { initializing = false; }
  }
  window.dunkersOnline={info:()=>({connected,initialized,joining,playRequested,state,hostPlaying,lastFrame}),leave};
  setInterval(() => {
    init();join();
    if (state.role === 'host' && hostPlaying && !window.dunkersOnlineNative.info().gc) { hostPlaying = false; leave(); }
    if (state.role === 'guest' && matchId) {
      dirty = true; sendControls();
      if(performance.now()-lastFrame>(receivedFrame?8000:120000))leave();
    }
  }, 200);
})();
