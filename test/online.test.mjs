import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameServer } from '../server.mjs';

test('local human matchmaking before onboarding stage 8, private rooms, CPU fallback and authenticated relays', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dunkers-online-'));
  const server = createGameServer({ dataDir, botDelay: 120, log() {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const streams = [];
  async function player(name) {
    const login = await fetch(base + '/backend/SetEventData.php', { method: 'POST', body: new URLSearchParams({ eventIDPOST: '0' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const id = JSON.parse(JSON.parse((await login.text()).split(';')[0]).Items[0]).UserId;
    const fields = Array(30).fill('0'); fields[0] = name; fields[1] = '1'; fields[22] = '7';
    await fetch(base + '/backend/SetEventData.php', { method: 'POST', headers: { cookie }, body: new URLSearchParams({ eventIDPOST: '2', userIDPOST: String(id), eventDataPOST: fields.join(',') }) });
    const state = async () => (await fetch(base + '/api/online/state', { headers: { cookie } })).json();
    const csrf = (await state()).csrf;
    const request = (action, data = {}, headers = {}) => fetch(base + '/api/online/' + action, { method: 'POST', headers: { cookie, 'X-Online-CSRF': csrf, 'Content-Type': 'application/json', ...headers }, body: typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data) });
    const controller = new AbortController();
    const response = await fetch(base + '/api/online/stream', { headers: { cookie }, signal: controller.signal });
    const reader = response.body.getReader(), events = []; let pending = '';
    const read = (async () => { try { while (true) {
      const { done, value } = await reader.read(); if (done) break;
      pending += new TextDecoder().decode(value);
      let end;
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const raw = pending.slice(0, end); pending = pending.slice(end + 2);
        const event = raw.match(/^event: (.+)$/m)?.[1], data = raw.match(/^data: (.+)$/m)?.[1];
        if (event && data) events.push({ event, data: JSON.parse(data) });
      }
    } } catch {} })();
    streams.push({ controller, read });
    return { id, cookie, csrf, state, request, events, controller };
  }
  async function waitFor(predicate) {
    for (let i = 0; i < 200; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Timed out waiting for the relay');
  }
  try {
    assert.equal((await fetch(base + '/api/online/state')).status, 401);
    const a = await player('First'), b = await player('Friend'), c = await player('Third');
    assert.equal((await a.request('join', {}, { 'X-Online-CSRF': 'é'.repeat(48) })).status, 403);
    assert.equal((await a.request('join', 'null')).status, 400);
    const waiting = await (await a.request('join')).json(); assert.equal(waiting.status, 'waiting');
    // A human arriving after the nominal CPU deadline still wins if the queue
    // has not dispatched a CPU match yet. Join pairs humans before deadlines.
    await new Promise(resolve => setTimeout(resolve, 160));
    const guest = await (await b.request('join')).json(), host = await a.state();
    assert.equal(guest.status, 'matched'); assert.equal(guest.role, 'guest'); assert.equal(host.role, 'host');
    assert.equal(host.own.character, 'ronaldo-2007'); assert.equal(guest.own.character, null); assert.equal(guest.opponent.character, 'ronaldo-2007');
    assert.equal((await b.request('ability', { matchId: host.matchId, userId: 1, side: 'host' })).status, 403);
    assert.equal((await a.request('ability', { matchId: 'stale' })).status, 403);
    assert.equal((await c.request('ability', { matchId: host.matchId })).status, 403);
    const kick = await (await a.request('ability', { matchId: host.matchId, side: 'guest' })).json();
    assert.equal(kick.side, 'host'); assert.equal(kick.kind, 'slide-kick');
    assert.equal((await a.request('ability', { matchId: host.matchId })).status, 429);
    await waitFor(() => a.events.some(e => e.event === 'ability' && e.data.seq === 1));
    const locker = await (await fetch(base + '/api/characters/state', { headers: { cookie: a.cookie } })).json();
    assert.equal((await fetch(base + '/api/characters/select', { method: 'POST', headers: { cookie: a.cookie, 'Content-Type': 'application/json', 'X-Character-CSRF': locker.csrf }, body: JSON.stringify({ character: null }) })).status, 409);
    assert.equal(host.matchId, guest.matchId); assert.equal(host.opponent.id, b.id); assert.equal(guest.opponent.id, a.id);
    const controls = { matchId: host.matchId, seq: 1, left: true, right: false, shoot: false };
    assert.equal((await c.request('input', controls)).status, 403);
    assert.equal((await a.request('input', controls)).status, 403);
    assert.equal((await b.request('input', { ...controls, left: 1 })).status, 400);
    assert.equal((await b.request('input', controls)).status, 200);
    await waitFor(() => a.events.some(e => e.event === 'input' && e.data.left));
    const count = a.events.filter(e => e.event === 'input').length;
    await b.request('input', { ...controls, left: false }); // stale sequence is ignored
    await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(a.events.filter(e => e.event === 'input').length, count);
    const image = fs.readFileSync(new URL('../public/admin/gui.webp', import.meta.url));
    const frameHeaders = { 'Content-Type': 'image/webp', 'X-Online-Match': host.matchId };
    assert.equal((await b.request('frame', image, frameHeaders)).status, 403);
    assert.equal((await a.request('frame', 'not an image', frameHeaders)).status, 400);
    assert.equal((await a.request('frame', image, frameHeaders)).status, 200);
    await waitFor(() => b.events.some(e => e.event === 'frame' && Buffer.from(e.data.data, 'base64').equals(image)));
    await a.request('leave'); assert.equal((await b.state()).status, 'idle');
    const room = await (await a.request('join', { createRoom: true })).json(); assert.match(room.room, /^[A-F0-9]{6}$/);
    assert.equal((await b.request('join', { room: 'ZZZZZZ' })).status, 404);
    await c.request('join');
    await waitFor(async () => (await c.state()).status === 'matched');
    assert.equal((await c.state()).opponent.isBot, true); assert.equal((await a.state()).status, 'waiting');
    const friend = await (await b.request('join', { room: room.room.toLowerCase() })).json();
    assert.equal(friend.opponent.id, a.id); assert.equal((await a.state()).opponent.id, b.id);
    await a.request('leave'); await c.request('leave');
    // User 1's ability also routes to the real host when user 1 is the guest.
    await b.request('join'); const away = await (await a.request('join')).json();
    assert.equal(away.role, 'guest');
    const guestKick = await (await a.request('ability', { matchId: away.matchId })).json(); assert.equal(guestKick.side, 'guest');
    await waitFor(() => b.events.some(e => e.event === 'ability' && e.data.matchId === away.matchId && e.data.side === 'guest'));
    await a.request('leave');
    await a.request('join'); a.controller.abort();
    await new Promise(resolve => setTimeout(resolve, 100)); assert.equal((await a.state()).status, 'idle');
  } finally {
    for (const stream of streams) stream.controller.abort();
    await Promise.all(streams.map(s => s.read));
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dataDir, { recursive: true });
  }
});
