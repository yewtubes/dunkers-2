'use strict';
// Adapter for the pinned Dunkers 2 v4.5 IL2CPP build (78187090...wasm).
// Offsets come from its native CSV parser and MainGameDataHolder singleton.
// Validate every managed object's class before touching integer fields. A new
// game binary needs a new adapter; never guess pointers in a different build.
(() => {
  const fields = { coins: 3, gems: 4, xp: 2, draftPoints: 27, freeShots: 24, goldenShots: 25 };
  const stats = [8, 9, 10, 11, 12, 13, 14, 15, 16];
  const holderName = '+++Interscene Game Data+++';
  let target, appliedRevision, lastPointer = 0, dirty = false, lastSave = 0, syncing = false, disabled = false;

  function nativeProfile() {
    const game = window.unityGame, module = game?.Module;
    if (!module?.HEAPU32 || !module.HEAPU8) return;
    const heap = module.HEAPU32, bytes = module.HEAPU8;
    const pointer = address => {
      if (!Number.isInteger(address) || address < 4096 || address % 4 || address + 4 > bytes.length) return 0;
      return heap[address / 4];
    };
    const classIs = (object, expected) => {
      let name = pointer(pointer(object) + 8);
      if (!name || name + expected.length >= bytes.length) return false;
      for (let i = 0; i < expected.length; i++) if (bytes[name + i] !== expected.charCodeAt(i)) return false;
      return bytes[name + expected.length] === 0;
    };
    const type = pointer(3397700), staticFields = pointer(type + 92), holder = pointer(staticFields + 4);
    if (!classIs(holder, 'MainGameDataHolder')) return;
    // Do not serialize an incomplete starter team over an existing profile.
    // get_Initialised in this build reads the byte at holder +236.
    if (bytes[holder + 236] !== 1) return;
    const offline = pointer(holder + 24);
    if (!classIs(offline, 'OfflineProfileData')) return;
    const user = pointer(offline + 16);
    if (!classIs(user, 'UserProfile') || user + 132 > bytes.length) return;
    const level = heap[(user + 16) / 4];
    if (level < 1 || level > 250) return;
    return { game, heap, user };
  }

  function apply() {
    if (!target?.ready || !target.revision) return;
    const native = nativeProfile();
    if (!native) return;
    const { game, heap, user } = native;
    const fresh = appliedRevision !== target.revision || lastPointer !== user;
    const write = (index, value) => {
      if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error('Invalid native counter');
      const address = (user + 12 + index * 4) / 4;
      if (heap[address] !== value) { heap[address] = value; dirty = true; }
    };
    for (const [key, index] of Object.entries(fields)) {
      if (fresh || target.infinite[key]) write(index, target.balances[key]);
    }
    if (fresh || target.infinite.xp) write(1, target.level);
    if (target.infinite.stats) for (const index of stats) write(index, 1_000_000_000);
    // Mark only this browser's subsequent native saves as having consumed the
    // grant. Another open tab cannot make an old snapshot overwrite it.
    window.dunkersAdminRevision = target.revision;
    appliedRevision = target.revision; lastPointer = user;
    const now = Date.now();
    if (fresh || (dirty && now - lastSave >= 1000)) {
      dirty = false; lastSave = now;
      game.SendMessage(holderName, 'ProfileData_CurrencyChanged');
      if (fresh) {
        game.SendMessage(holderName, 'ProfileData_StatsChanged');
        game.SendMessage(holderName, 'SaveProfileData');
      }
    }
  }

  async function sync() {
    if (syncing || disabled) return;
    syncing = true;
    try {
      const response = await fetch(new URL('api/admin/runtime', location.href), { cache: 'no-store' });
      if (response.status === 403) { target = undefined; disabled = true; return; }
      if (response.ok) { target = (await response.json()).player; apply(); }
    } catch (error) { console.error('Could not sync admin boosts:', error.message); }
    finally { syncing = false; }
  }
  // Replenish the actual spendable fields after gameplay changes them, rather
  // than just rewriting the server's copy of the CSV.
  setInterval(() => { try { apply(); } catch (error) { console.error('Could not apply admin boosts:', error.message); } }, 100);
  setInterval(sync, 2000);
  window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  sync();
})();
