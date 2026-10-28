'use strict';
const definitions = [['coins', 'Coins'], ['gems', 'Gems / cash'], ['draftPoints', 'Draft points'], ['xp', 'XP'], ['freeShots', 'Free shots'], ['goldenShots', 'Golden shots'], ['stats', 'Lifetime stats']];
let csrf; let player; let busy = false;
const status = (text, error = false) => { const el = document.getElementById('status'); el.textContent = text; el.classList.toggle('error', error); };
function draw() {
  document.getElementById('player-name').textContent = player.name;
  document.getElementById('player-meta').textContent = `User ${player.id} · Level ${player.level}`;
  const cards = document.getElementById('cards'); cards.replaceChildren();
  for (const [key, name] of definitions) {
    const card = document.createElement('article'); card.className = 'card' + (key === 'stats' ? ' stats-card' : '');
    const title = document.createElement('h3'); title.textContent = name;
    const amount = document.createElement('span'); amount.className = 'amount'; amount.textContent = player.infinite[key] ? '∞ UNLIMITED' : key === 'stats' ? `${player.stats.dunks.toLocaleString()} dunks` : player.balances[key].toLocaleString();
    card.append(title, amount);
    if (key !== 'stats') { const input = document.createElement('input'); input.type = 'number'; input.min = 0; input.max = key === 'xp' ? 1999999 : 1000000000; input.step = 1; input.value = player.balances[key]; input.name = key; input.setAttribute('aria-label', name + ' amount'); input.disabled = !!player.infinite[key]; card.append(input); }
    const label = document.createElement('label'); label.className = 'toggle'; const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.name = key + '-infinite'; toggle.checked = !!player.infinite[key]; toggle.addEventListener('change', () => { const input = card.querySelector('input[type=number]'); if (input) input.disabled = toggle.checked; });
    label.append(toggle, document.createTextNode('Infinite')); card.append(label); cards.append(card);
  }
}
async function request(path, data) {
  const response = await fetch('../api/admin/' + path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf }, body: JSON.stringify(data) } : {});
  const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not save'); return body;
}
async function load() { try { const data = await request('state'); csrf = data.csrf; player = data.player; draw(); status(!player.ready ? 'Waiting for the game to finish starting…' : player.revision > player.appliedRevision ? 'Saved. Return to the court to apply your boosts automatically.' : player.revision ? 'Your boosts have been applied in game.' : 'Your locker is ready.'); } catch (error) { status(error.message, true); } }
async function save(data) {
  if (busy || !player) return; busy = true; document.querySelectorAll('button').forEach(button => button.disabled = true);
  try { const result = await request('grant', data); player = result.player; draw(); status(result.message); } catch (error) { status(error.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(button => button.disabled = false); }
}
document.getElementById('grants').addEventListener('submit', event => { event.preventDefault(); const data = {}; for (const [key] of definitions) { const infinite = document.querySelector(`[name="${key}-infinite"]`); if (!infinite) return; data[key] = infinite.checked ? 'infinite' : key === 'stats' ? false : Number(document.querySelector(`[name="${key}"]`).value); } save(data); });
document.getElementById('infinite-all').addEventListener('click', () => save(Object.fromEntries(definitions.map(([key]) => [key, 'infinite']))));
document.getElementById('refresh').addEventListener('click', load);
setInterval(() => { if (player && !player.ready && !busy) load(); }, 2000);
load();
