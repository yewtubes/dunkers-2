import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('grants update native spendable counters, replenish spending, and reject incompatible objects', async () => {
  const buffer = new ArrayBuffer(5_000_000), HEAPU32 = new Uint32Array(buffer), HEAPU8 = new Uint8Array(buffer);
  let nextClass = 10000, nextName = 20000;
  const object = (pointer, name) => {
    HEAPU32[pointer / 4] = nextClass; HEAPU32[(nextClass + 8) / 4] = nextName;
    HEAPU8.set(new TextEncoder().encode(name + '\0'), nextName); nextClass += 256; nextName += 256;
  };
  const holder = 30000, offline = 40000, user = 50000;
  object(holder, 'MainGameDataHolder'); object(offline, 'OfflineProfileData'); object(user, 'UserProfile');
  HEAPU32[3397700 / 4] = 60000; HEAPU32[(60000 + 92) / 4] = 70000; HEAPU32[(70000 + 4) / 4] = holder;
  HEAPU32[(holder + 24) / 4] = offline; HEAPU32[(offline + 16) / 4] = user;
  HEAPU8[holder + 236] = 1;
  const read = index => HEAPU32[(user + 12 + index * 4) / 4];
  const write = (index, value) => { HEAPU32[(user + 12 + index * 4) / 4] = value; };
  write(1, 1); write(5, 7);
  const messages = [], timers = [];
  let state = { ready: true, revision: 1, level: 249, balances: { coins: 1000000000, gems: 1000000000, xp: 1999999, draftPoints: 1000000000, freeShots: 1000000000, goldenShots: 1000000000 }, infinite: { coins: true, gems: true, xp: true, draftPoints: true, freeShots: true, goldenShots: true, stats: true } };
  const scope = { URL, console, location: { href: 'https://example.test/games/dunkers-2/' }, Date,
    fetch: async url => { assert.equal(url.pathname, '/games/dunkers-2/api/admin/runtime'); return { ok: true, status: 200, json: async () => ({ player: state }) }; },
    setInterval: (fn, ms) => { timers.push({ fn, ms }); }, addEventListener() {}, document: { addEventListener() {} },
    unityGame: { Module: { HEAPU32, HEAPU8 }, SendMessage: (name, method) => { assert.equal(scope.dunkersAdminRevision, state.revision); messages.push([name, method]); } },
  }; scope.window = scope;
  vm.runInNewContext(fs.readFileSync(new URL('../public/runtime-admin.js', import.meta.url), 'utf8'), scope);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(read(3), 1000000000); assert.equal(read(4), 1000000000); assert.equal(read(2), 1999999); assert.equal(read(1), 249);
  assert.equal(read(24), 1000000000); assert.equal(read(25), 1000000000); assert.equal(read(27), 1000000000);
  assert.equal(read(5), 7); assert.equal(read(12), 1000000000);
  assert.ok(messages.some(([, method]) => method === 'SaveProfileData'));
  write(3, 999999500); write(4, 0); write(24, 0); timers.find(x => x.ms === 100).fn();
  assert.equal(read(3), 1000000000); assert.equal(read(4), 1000000000); assert.equal(read(24), 1000000000);
  state = { ...state, revision: 2, balances: { ...state.balances, coins: 123 }, infinite: {} };
  await timers.find(x => x.ms === 2000).fn(); assert.equal(read(3), 123);
  write(3, 100); timers.find(x => x.ms === 100).fn(); assert.equal(read(3), 100);
  object(user, 'DifferentProfile'); state = { ...state, revision: 3, balances: { ...state.balances, coins: 456 } };
  await timers.find(x => x.ms === 2000).fn(); assert.equal(read(3), 100); assert.equal(scope.dunkersAdminRevision, 2);
});
