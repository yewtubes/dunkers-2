import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameServer } from '../server.mjs';

test('only ID 1 can grant counters; infinite grants survive spending and restarts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dunkers-admin-'));
  let server = createGameServer({ dataDir: dir, log() {} });
  const start = () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
  const stop = () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  let base = await start();
  const game = (cookie, event, data = '', user = 1) => fetch(base + '/backend/SetEventData.php', { method: 'POST', headers: { cookie }, body: new URLSearchParams({ eventIDPOST: event, userIDPOST: user, eventDataPOST: data }) });
  const admin = (cookie, csrf, body) => fetch(base + '/api/admin/grant', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf }, body: JSON.stringify(body) });
  try {
    const login = await game('', 0); const cookie = login.headers.get('set-cookie').split(';')[0];
    const second = await game('', 0); const other = second.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base + '/api/admin/state')).status, 401);
    assert.equal((await fetch(base + '/api/admin/state', { headers: { cookie: other } })).status, 403);
    assert.equal((await fetch(base + '/admin%2Findex.html', { headers: { cookie: other } })).status, 403);
    assert.equal((await fetch(base + '/admin/', { headers: { cookie } })).status, 200);
    const state = await (await fetch(base + '/api/admin/state', { headers: { cookie } })).json();
    assert.equal((await admin(cookie, '', { coins: 'infinite' })).status, 403);
    assert.equal((await admin(other, state.csrf, { coins: 'infinite' })).status, 403);
    assert.equal((await admin(cookie, state.csrf, { coins: 'infinite' })).status, 409);
    const values = Array(30).fill('0'); values[0] = 'Locker Baller'; values[1] = '1';
    const snapshot = values.join(',') + '§INVENTORY_UNCHANGED§TEAM_UNCHANGED';
    await game(cookie, 2, snapshot);
    assert.equal((await admin(cookie, state.csrf, { coins: 'infinite', gems: 'infinite', draftPoints: 'infinite', xp: 'infinite', stats: 'infinite' })).status, 200);
    assert.equal((await game(cookie, 2, snapshot)).status, 409);
    const loaded = await (await game(cookie, 0)).text(); assert.match(loaded, /1000000000/);
    assert.equal((await game(cookie, 2, snapshot)).status, 200);
    let current = await (await fetch(base + '/api/admin/state', { headers: { cookie } })).json();
    assert.equal(current.player.balances.coins, 1000000000); assert.equal(current.player.balances.gems, 1000000000); assert.equal(current.player.stats.dunks, 1000000000);
    assert.equal(current.player.balances.xp, 1999999); assert.equal(current.player.level, 249);
    assert.equal((await admin(cookie, state.csrf, { coins: 10, gems: -1 })).status, 400);
    current = await (await fetch(base + '/api/admin/state', { headers: { cookie } })).json(); assert.equal(current.player.balances.coins, 1000000000);
    await stop(); server = createGameServer({ dataDir: dir, log() {} }); base = await start();
    current = await (await fetch(base + '/api/admin/state', { headers: { cookie } })).json(); assert.equal(current.player.infinite.coins, true);
    const stored = JSON.parse(fs.readFileSync(path.join(dir, 'profiles.json'))); const profile = Object.values(stored.sessions).find(p => p.id === 1); assert.ok(profile.csv.endsWith('§INVENTORY_UNCHANGED§TEAM_UNCHANGED'));
    assert.equal(profile.csv.split('§')[0].split(',')[5], '0');
  } finally { await stop(); fs.rmSync(dir, { recursive: true }); }
});
