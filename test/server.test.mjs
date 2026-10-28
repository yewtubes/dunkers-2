import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameServer } from '../server.mjs';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const stop = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const unpack = text => text.split(';').filter(Boolean).map(part => { const table = JSON.parse(part); return { name: table.TableName, rows: table.Items.map(JSON.parse) }; });

test('game login, snapshot save/restart, and session isolation', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dunkers-test-'));
  let server = createGameServer({ dataDir: dir, log() {} });
  let base = await listen(server);
  let cookie;
  const event = async (id, data = '', user = 0, sendCookie = cookie) => {
    const response = await fetch(base + '/backend/SetEventData.php', { method: 'POST', headers: sendCookie ? { cookie: sendCookie } : {}, body: new URLSearchParams({ eventIDPOST: String(id), userIDPOST: String(user), eventDataPOST: data }) });
    return { response, text: await response.text() };
  };
  try {
    assert.equal(await (await fetch(base + '/backend/Check.php')).text(), 'a');
    assert.equal((await event(9)).response.status, 200);
    const login = await event(0, 'device-id');
    cookie = login.response.headers.get('set-cookie').split(';')[0];
    const id = unpack(login.text)[0].rows[0].UserId;
    assert.equal(id, 1);
    assert.equal(unpack(login.text)[0].rows[0].ProfileCSV, '');
    const snapshot = 'Test Baller,1,0,27,0§1,2,3§opaque;punctuation,"✓"';
    assert.equal((await event(2, snapshot, id)).response.status, 200);
    assert.equal(unpack((await event(3, '', id)).text)[0].rows[0].ProfileCSV, snapshot);
    const otherLogin = await event(0, 'other-device', 0, '');
    const otherCookie = otherLogin.response.headers.get('set-cookie').split(';')[0];
    assert.equal((await event(2, 'corrupt', id, otherCookie)).response.status, 403);
    assert.equal((await event(2, 'corrupt', id, '')).response.status, 401);
    const csp = (await fetch(base + '/')).headers.get('content-security-policy');
    assert.ok(csp.includes("connect-src 'self' blob:"));
    assert.equal((await fetch(base + '/Build/78187090b012beed2d50f0f0f2623bf2.wasm', { method: 'HEAD' })).headers.get('content-type'), 'application/wasm');
    assert.equal((await fetch(base + '/server.mjs')).status, 404);
    assert.equal((await fetch(base + '/backend/Unknown.php')).status, 404);
    assert.equal((await event(99, '', id)).response.status, 400);
    await stop(server);
    server = createGameServer({ dataDir: dir, log() {} }); base = await listen(server);
    const restored = unpack((await event(0, 'device-id')).text)[0].rows[0];
    assert.equal(restored.UserId, id);
    assert.equal(restored.ProfileCSV, snapshot);
  } finally { await stop(server); fs.rmSync(dir, { recursive: true }); }
});
