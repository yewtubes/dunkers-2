import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('transport redirects to the game mount and rejects remote services', async () => {
  const calls = [];
  function XHR() {}
  XHR.prototype.open = function(...args) { calls.push(args); };
  XHR.prototype.send = function(body) { calls.push(['xhr-send', body]); };
  const scope = {
    URL, Request, Headers, XMLHttpRequest: XHR, navigator: { language: 'en-US' }, console, setTimeout,
    location: { href: 'https://ryanmongwe.com/games/dunkers-2/', origin: 'https://ryanmongwe.com' },
    fetch: async (url, options) => { calls.push([url, options]); return 'local response'; },
  };
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(new URL('../public/local-bridge.js', import.meta.url), 'utf8'), scope);
  assert.equal(await scope.fetch('https://d2.touchdowners2.com/SetEventData.php', { method: 'POST', body: 'x=1' }), 'local response');
  assert.equal(calls[0][0], 'https://ryanmongwe.com/games/dunkers-2/backend/SetEventData.php');
  assert.equal(calls[0][1].body, 'x=1');
  new XHR().open('GET', 'https://d2.touchdowners2.com/Check.php');
  assert.equal(calls[1][1], 'https://ryanmongwe.com/games/dunkers-2/backend/Check.php');
  await assert.rejects(scope.fetch('https://unrelated.example/track'), /External request disabled/);
  assert.equal(await scope.PokiSDK.rewardedBreak(), false);
  scope.dunkersAdminRevision = 3;
  await scope.fetch('https://d2.touchdowners2.com/SetEventData.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
  assert.equal(calls.at(-1)[1].headers.get('X-Dunkers-Admin-Revision'), '3');
  assert.equal(calls.at(-1)[1].headers.get('Content-Type'), 'application/x-www-form-urlencoded');
  let xhrHeader;
  XHR.prototype.setRequestHeader = (key, value) => { xhrHeader = [key, value]; };
  const xhr = new XHR(); xhr.open('POST', 'https://d2.touchdowners2.com/SetEventData.php'); xhr.send('x=1');
  assert.deepEqual(xhrHeader, ['X-Dunkers-Admin-Revision', '3']);
});
