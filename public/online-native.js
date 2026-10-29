'use strict';
// Native adapter for the SHA-pinned Dunkers 2 v4.5 build. The host owns physics;
// only the opposing motor's AI is replaced during a confirmed human match.
(() => {
  let game, m, table, installed = false, internal = false, capture, tier, active, intercepting = false;
  let input = { left: false, right: false, shoot: false }, inputAt = 0;
  const motors = new Map();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ptr = address => Number.isInteger(address) && address >= 4096 && address % 4 === 0 && address + 4 <= m.HEAPU8.length ? m.HEAPU32[address >>> 2] : 0;
  const put = (address, value) => { m.HEAPU32[address >>> 2] = value; };
  function is(object, name) {
    const start = ptr(ptr(object) + 8), bytes = m.HEAPU8;
    if (!start || start + name.length >= bytes.length) return false;
    for (let i = 0; i < name.length; i++) if (bytes[start + i] !== name.charCodeAt(i)) return false;
    return bytes[start + name.length] === 0;
  }
  function singleton(address, offset = 0) { return ptr(ptr(ptr(address) + 92) + offset); }
  function data() {
    if (!m) return;
    const holder = singleton(3397700, 4), offline = ptr(holder + 24);
    if (is(holder, 'MainGameDataHolder') && m.HEAPU8[holder + 236] && is(offline, 'OfflineProfileData')) return { holder, offline };
  }
  function controller() { const gc = singleton(3396256); return is(gc, 'GameplayController') && ptr(gc + 8) ? gc : 0; }
  function hostMotor() {
    // Avoid creating a gameplay singleton in the menu/scene construction.
    const gc = controller(); if (!gc || ptr(gc + 168) < 1) return 0;
    const ui = table.get(10980)(0), player = ptr(ui + 20), motor = ptr(player + 16);
    return is(motor, 'PlayerMotor') ? motor : 0;
  }
  function managedString(pointer) {
    if (!is(pointer, 'String')) return '';
    const length = ptr(pointer + 8);
    if (length > 1000) return '';
    return String.fromCharCode(...m.HEAPU16.subarray((pointer + 12) >>> 1, (pointer + 12) / 2 + length));
  }
  function wrapper(arity, callback) {
    const section = (id, bytes) => [id, bytes.length, ...bytes];
    const body = [0, ...Array.from({ length: arity }, (_, i) => [32, i]).flat(), 16, 0, 11];
    const binary = new Uint8Array([0,97,115,109,1,0,0,0,
      ...section(1, [1,96,arity,...Array(arity).fill(127),0]),
      ...section(2, [1,1,101,1,102,0,0]), ...section(3,[1,0]),
      ...section(7,[1,1,104,0,1]), ...section(10,[1,body.length,...body])]);
    return new WebAssembly.Instance(new WebAssembly.Module(binary), { e: { f: callback } }).exports.h;
  }
  function string(value) {
    let result = 0;
    capture = pointer => { result = pointer; };
    try { game.SendMessage('MainUI', 'ShowMenu', value); } finally { capture = null; }
    if (!is(result, 'String')) throw new Error('The native game could not create the player name.');
    return result;
  }
  function release() {
    input = { left: false, right: false, shoot: false }; inputAt = 0;
    for (const [motor, previous] of motors) if (is(motor, 'PlayerMotor') && ptr(motor + 8)) {
      table.get(10928)(motor, 1, 0, 0); table.get(10928)(motor, 0, 0, 0);
      if (previous.shoot) table.get(10939)(motor, 0);
    }
    motors.clear();
  }
  function install() {
    game = window.unityGame; m = game?.Module; table = m?.asm?.Sh;
    const d = table && data(), user = d && ptr(d.offline + 16);
    if (!d || !is(user, 'UserProfile') || ptr(user + 100) < 8) return false;
    const show = table.get(11916), play = table.get(11994), ai = table.get(8163);
    table.set(11916, wrapper(3, (self, menu, info) => {
      if (capture) { capture(menu); return; }
      const name = managedString(menu).toLowerCase();
      if (!internal && ['gamemodemenu','tiermenu','playoffs','playoffstiermenu','championshipmenu'].includes(name)) {
        window.dispatchEvent(new Event('dunkers-play')); return;
      }
      show(self, menu, info);
    }));
    table.set(11994, wrapper(2, (self, info) => {
      if (capture === 'tier') { tier = self; return; }
      if (!internal) { window.dispatchEvent(new Event('dunkers-play')); return; }
      play(self, info);
    }));
    table.set(8163, wrapper(2, (self, info) => {
      if (!active) {
        // Some native buttons call their methods directly instead of through
        // delegates. Catch those starts too, after the WASM stack has returned.
        if (!intercepting && controller()) {
          intercepting = true;
          setTimeout(() => { stop(); window.dispatchEvent(new Event('dunkers-play')); }, 0);
        }
        return;
      }
      const motor = ptr(self + 156), own = hostMotor();
      if (active.opponent.isBot) {
        active.cpuTicks++;
        if (is(motor, 'PlayerMotor') && own && m.HEAPU8[motor + 173] !== m.HEAPU8[own + 173]) active.enemy = motor;
        ai(self, info); return;
      }
      if (!is(motor, 'PlayerMotor') || !own || motor === own || m.HEAPU8[motor + 173] === m.HEAPU8[own + 173]) { ai(self, info); return; }
      active.enemy = motor;
      if (!m.HEAPU8[motor + 223]) { motors.delete(motor); return; }
      const desired = performance.now() - inputAt < 750 ? input : { left: false, right: false, shoot: false };
      const previous = motors.get(motor) || { left: false, right: false, shoot: false };
      // The opposing player faces left. Physical Left is its forward control.
      if (desired.left !== previous.left) table.get(10928)(motor, 1, +desired.left, 0);
      if (desired.right !== previous.right) table.get(10928)(motor, 0, +desired.right, 0);
      if (desired.shoot !== previous.shoot) table.get(desired.shoot ? 10938 : 10939)(motor, 0);
      motors.set(motor, { ...desired });
    }));
    installed = true; window.dispatchEvent(new Event('dunkers-native-ready')); return true;
  }
  async function start(match) {
    if (!installed) throw new Error('The native game is still starting.');
    if (active) throw new Error('A game is already running.');
    const d = data(); if (!d) throw new Error('Finish setting up your player first.');
    const native = await window.dunkersNativeRuntime.init();
    const session = { ...match, enemy: 0, cpuTicks: 0, roots: [] };
    active = session; intercepting = false; release();
    const keep = object => { native.pin(object); session.roots.push(object); return object; };
    const check = () => { if (active !== session) throw new Error('Match cancelled.'); };
    try {
      if (controller()) {
        game.SendMessage('++Main UI++', 'BTN_ReturnToMenu');
        for (let i = 0; i < 100 && controller(); i++) await sleep(100);
      }
      check();
      const name = keep(string(match.opponent.name));
      put(d.offline + 72, name); // A managed field roots the string for the GC.
      const ownTeam = keep(ptr(d.offline + 64));
      const teamCSV = /^-?\d+(,-?\d+){13}$/.test(match.opponent.team || '') ? match.opponent.team : '30,-1,-1,23456,28282,5,6,0,5,0,5,0,5,1';
      // Each side needs a distinct native team object, even with identical gear.
      // Sharing one team also shares the per-player runtime/controller state.
      let peerTeam;
      {
        try {
          table.get(10499)(d.offline, string(teamCSV), 0);
          peerTeam = keep(ptr(d.offline + 64)); put(d.offline + 64, ownTeam); put(d.offline + 68, peerTeam);
        } finally { put(d.offline + 64, ownTeam); }
      }
      internal = true;
      try { game.SendMessage('MainUI', 'ShowMenu', 'tiermenu'); } finally { internal = false; }
      await sleep(800);
      check();
      tier = 0; capture = 'tier';
      try { game.SendMessage('TierMenu', 'PlayButton_OnClick'); } finally { capture = null; }
      if (!is(tier, 'TierMenuController')) throw new Error('The native court menu is unavailable.');
      const list = ptr(tier + 92), items = ptr(list + 8), card = ptr(items + 16), level = ptr(card + 16);
      if (!level || !ptr(list + 12)) throw new Error('The native court is unavailable.');
      put(tier + 136, level); put(tier + 104, 1); m.HEAPU8[tier + 140] = 0;
      const fee = ptr(level + 24); put(level + 24, 0);
      try { table.get(11996)(tier, 0); } finally { put(level + 24, fee); }
      const loadingType = native.type('LoadingSceneController, Assembly-CSharp');
      for (let i = 0; i < 600; i++) {
        await sleep(100);
        check();
        const loading = native.array(native.call(28468, loadingType))[0];
        if (loading && ptr(loading + 8)) {
          // Keep the authenticated opponent throughout native scene loading.
          m.HEAPU8[loading + 74] = 0;
          put(d.offline + 68, peerTeam); put(d.offline + 72, name);
        }
        const gc = controller();
        if (gc && ptr(gc + 168) >= 1) {
          put(d.offline + 72, name);
          const ui = ptr(gc + 40); if (is(ui, 'MainUI')) table.get(9838)(ui, 0);
          return;
        }
      }
      throw new Error('The native court did not finish loading.');
    } catch (error) { if (active === session) { release(); active = null; } throw error; }
    finally { for (const root of session.roots) native.release(root); }
  }
  async function stop() {
    release(); active = null; intercepting = true;
    if (controller()) game.SendMessage('++Main UI++', 'BTN_ReturnToMenu');
    for (let i = 0; i < 100 && controller(); i++) await sleep(100);
    intercepting = false;
  }
  window.dunkersOnlineNative = {
    get ready() { return installed; }, start, stop,
    input(value) { input = { left: !!value.left, right: !!value.right, shoot: !!value.shoot }; inputAt = performance.now(); },
    info() {
      if (!installed) return { ready: false };
      const gc = controller(), own = hostMotor(), enemy = active?.enemy || 0;
      const motor = object => object ? { pointer: object, forward: m.HEAPU8[object + 133], backward: m.HEAPU8[object + 132], canMove: m.HEAPU8[object + 223], facingLeft: m.HEAPU8[object + 173] } : null;
      return { ready: true, gc, state: gc ? ptr(gc + 168) : null, gameType: gc ? ptr(gc + 252) : null, mode: active ? (active.opponent.isBot ? 'cpu' : 'human') : null, cpuTicks: active?.cpuTicks || 0, own: motor(own), enemy: motor(enemy) };
    },
  };
  const timer = setInterval(() => { try { if (!installed && install()) clearInterval(timer); } catch (error) { console.error('Online native adapter:', error); clearInterval(timer); } }, 200);
})();
