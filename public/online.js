'use strict';
(() => {
  const root = document.createElement('div'); root.id = 'online-ui';
  root.innerHTML = `<button id="online-open" class="online-button" hidden>ONLINE</button>
    <div id="online-panel" hidden><section role="dialog" aria-modal="true" aria-labelledby="online-title">
      <button id="online-close" class="online-x" aria-label="Close"><span class="gui-icon gui-close"></span></button>
      <h1 id="online-title">PLAY ONLINE</h1><p id="online-message" aria-live="polite">Players from this server. Real players come first.</p>
      <div id="online-actions"><button id="online-play" class="online-button">PLAY</button><button id="online-create" class="online-button">PLAY A FRIEND</button>
      <form id="online-room-form"><input id="online-room" aria-label="Friend room code" placeholder="ROOM CODE" maxlength="6" autocomplete="off"><button class="online-button">JOIN</button></form></div>
      <button id="online-cancel" class="online-button" hidden>CANCEL</button>
    </section></div>
    <canvas id="online-view" width="960" height="600" hidden aria-label="Shared Dunkers 2 court"></canvas>
    <div id="online-match" hidden><span id="online-opponent"></span><button id="online-leave" aria-label="Leave match">LEAVE</button></div>
    <div id="online-controls" hidden><button data-control="left" aria-label="Move left">◀</button><button data-control="right" aria-label="Move right">▶</button><button data-control="shoot" aria-label="Hold to aim, release to shoot">SHOOT</button></div>`;
  document.getElementById('game-container').append(root);
  const el = id => document.getElementById('online-' + id);
  let csrf, stream, connected = false, initialized = false, initializing = false, state = { status: 'idle' }, run = 0, matchId, seq = 0, lastFrame = 0, decoding = false, queuedFrame, hostPlaying = false;
  let input = { left: false, right: false, shoot: false }, dirty = false, sending = false, busyFrame = false;
  const keys = new Map(), pointers = new Map();
  const api = action => new URL('api/online/' + action, location.href);
  async function post(action, data = {}) {
    const response = await fetch(api(action), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Online-CSRF': csrf }, body: JSON.stringify(data) });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Could not reach the game server.'); return value;
  }
  function message(text) { el('message').textContent = text; }
  function panel(show = true) { el('panel').hidden = !show; }
  function clearControls() { keys.clear(); pointers.clear(); updateControls(); window.dunkersOnlineNative?.input({}); }
  async function leave() {
    clearControls();
    try { await post('leave'); } catch (error) { await applyState({ status: 'idle' }); message(error.message); panel(); }
  }
  async function join(data = {}) {
    panel();
    if (!connected || !window.dunkersOnlineNative?.ready) { message('The game is still connecting. Try again in a moment.'); return; }
    // State changes arrive in order on SSE. A delayed HTTP waiting response
    // must never overwrite a match that arrived on the stream in the meantime.
    try { await post('join', data); } catch (error) { message(error.message); }
  }
  function render() {
    const waiting = state.status === 'waiting', matched = state.status === 'matched';
    el('actions').hidden = waiting || matched; el('cancel').hidden = !(waiting || matched); el('close').hidden = waiting || matched;
    el('cancel').textContent = matched ? 'LEAVE MATCH' : 'CANCEL';
    el('open').hidden = !initialized || !connected || matched || waiting;
    if (waiting) {
      el('title').textContent = state.room ? 'FRIEND ROOM' : 'FINDING A PLAYER';
      if (state.room) message(`Room ${state.room} — share this code with your friend. This room waits for them.`);
      else {
        const seconds = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
        message(`Looking for players on this server… CPU fallback in ${seconds}s. Real players always come first.`);
      }
    } else if (!matched) { el('title').textContent = 'PLAY ONLINE'; message(state.notice || 'Players from this server. Real players come first.'); }
  }
  async function applyState(next) {
    if (next.status === 'matched' && next.matchId === matchId) return;
    const previous = state; state = next; render();
    if (next.status !== 'matched') {
      run++; matchId = null; queuedFrame = null; hostPlaying = false; clearControls();
      el('view').hidden = true; el('controls').hidden = true; el('match').hidden = true;
      if (previous.status === 'matched' && previous.role === 'host') await window.dunkersOnlineNative.stop();
      if (next.status === 'waiting' || next.notice || previous.status === 'matched') panel();
      return;
    }
    matchId = next.matchId; const token = ++run; seq = 0; lastFrame = performance.now();
    el('opponent').textContent = next.opponent.isBot ? 'CPU OPPONENT' : `VS ${next.opponent.name}`;
    el('title').textContent = next.opponent.isBot ? 'CPU MATCH' : 'PLAYER FOUND';
    message(next.opponent.isBot ? 'No player was waiting. Starting the CPU match…' : `Connected to ${next.opponent.name}. Loading the shared court…`);
    panel();
    if (next.role === 'host') {
      try {
        await window.dunkersOnlineNative.start(next);
        if (token !== run) return;
        hostPlaying = true; panel(false); el('match').hidden = false;
        if (!next.opponent.isBot) broadcast(token, next.matchId);
      } catch (error) { if (token !== run) return; await leave(); message(error.message); panel(); }
    } else { el('view').hidden = false; el('controls').hidden = false; el('match').hidden = false; }
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
        } catch (error) { if (token === run) { await leave(); message(error.message); panel(); } }
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
          el('view').getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, 960, 600);
          lastFrame = performance.now(); panel(false);
        }
        bitmap.close();
      }
    } catch (error) { console.error('Shared court frame:', error); } finally { decoding = false; }
  }
  function updateControls() {
    const controls = new Set([...keys.values(), ...pointers.values()]);
    input = { left: controls.has('left'), right: controls.has('right'), shoot: controls.has('shoot') }; dirty = true;
    for (const button of el('controls').querySelectorAll('button')) button.classList.toggle('pressed', input[button.dataset.control]);
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
  for (const button of el('controls').querySelectorAll('button')) {
    button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); pointers.set(event.pointerId, button.dataset.control); updateControls(); });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, event => { pointers.delete(event.pointerId); updateControls(); });
  }
  window.addEventListener('blur', clearControls);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearControls(); });
  el('open').onclick = () => { render(); panel(); };
  el('close').onclick = () => panel(false);
  el('play').onclick = () => join(); el('create').onclick = () => join({ createRoom: true });
  el('room-form').onsubmit = event => { event.preventDefault(); join({ room: el('room').value }); };
  el('cancel').onclick = leave; el('leave').onclick = leave;
  window.addEventListener('dunkers-play', () => join());
  async function init() {
    if (initialized || initializing || !window.dunkersOnlineNative?.ready) return;
    initializing = true;
    try {
      const response = await fetch(api('state'), { cache: 'no-store' }); if (!response.ok) return;
      const value = await response.json(); csrf = value.csrf;
      stream = new EventSource(api('stream')); initialized = true;
      stream.onopen = () => { connected = true; render(); };
      stream.onerror = () => { connected = false; render(); clearControls(); if (state.status === 'matched') { message('Reconnecting to the game server…'); panel(); } };
      stream.addEventListener('state', event => applyState(JSON.parse(event.data)).catch(console.error));
      stream.addEventListener('input', event => { const value = JSON.parse(event.data); if (state.role === 'host' && value.matchId === matchId) window.dunkersOnlineNative.input(value); });
      stream.addEventListener('frame', event => displayFrame(JSON.parse(event.data)));
      await applyState(value);
    } catch (error) { initialized = false; console.error('Online connection:', error.message); }
    finally { initializing = false; }
  }
  setInterval(() => {
    init(); if (state.status === 'waiting') render();
    if (state.role === 'host' && hostPlaying && !window.dunkersOnlineNative.info().gc) { hostPlaying = false; leave(); }
    if (state.role === 'guest' && matchId) {
      dirty = true; sendControls();
      if (performance.now() - lastFrame > 8000) { message('Waiting for the host’s court…'); panel(); }
    }
  }, 200);
})();
