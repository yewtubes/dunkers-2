import { randomBytes, timingSafeEqual } from 'node:crypto';

const limit = 1_000_000_000;
const fields = { coins: 3, gems: 4, xp: 2, draftPoints: 26, freeShots: 24, goldenShots: 25 };
// currentDunks (field 5) is spendable reward progress, not a lifetime stat.
const statFields = [8, 9, 10, 11, 12, 13, 14, 15, 16];
export function applyInfinite(profile, csv = profile.csv) {
  if (!csv || !profile.infinite) return csv;
  const sections = csv.split('§'); const values = sections[0].split(',');
  for (const [key, index] of Object.entries(fields)) if (profile.infinite[key]) values[index] = String(key === 'xp' ? 1_999_999 : limit);
  // Pair cumulative XP with the matching tier instead of queuing hundreds of
  // level-up rewards or advancing beyond the shipped XP table's final level.
  if (profile.infinite.xp) values[1] = '249';
  if (profile.infinite.stats) for (const index of statFields) values[index] = String(limit);
  sections[0] = values.join(','); return sections.join('§');
}
export function adminView(profile) {
  const values = profile.csv?.split('§')[0].split(',') || [];
  return { id: profile.id, name: values[0] || `Baller ${profile.id}`, ready: !!profile.csv, level: Number(values[1]) || 1,
    balances: Object.fromEntries(Object.entries(fields).map(([key, index]) => [key, Number(values[index]) || 0])),
    stats: { dunks: Number(values[12]) || 0, steals: Number(values[11]) || 0, points: Number(values[10]) || 0, wins: Number(values[9]) || 0 }, infinite: profile.infinite || {}, revision: profile.adminRevision || 0 };
}
export async function handleAdmin(req, res, url, profile, { save, reply }) {
  const json = (status, value) => reply(res, status, JSON.stringify(value), 'application/json');
  if (!profile) return json(401, { error: 'Start the game in this browser to sign in.' });
  if (profile.id !== 1) return json(403, { error: 'Admin access belongs to user ID 1.' });
  if (req.method === 'GET' && url.pathname === '/api/admin/state') {
    if (!profile.adminCsrf) { profile.adminCsrf = randomBytes(24).toString('hex'); save(); }
    return json(200, { player: adminView(profile), csrf: profile.adminCsrf });
  }
  if (req.method !== 'POST' || url.pathname !== '/api/admin/grant') return json(404, { error: 'Unknown admin action.' });
  const actual = Buffer.from(String(req.headers['x-admin-csrf'] || '')); const expected = Buffer.from(profile.adminCsrf || '');
  if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return json(403, { error: 'Refresh the admin panel before saving.' });
  if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required.' });
  let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) return json(413, { error: 'Request too large.' }); }
  let data; try { data = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON.' }); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json(400, { error: 'Invalid grant.' });
  if (!profile.csv) return json(409, { error: 'Finish starting the game before granting items.' });
  const sections = profile.csv.split('§'); const values = sections[0].split(',');
  const infinite = { ...(profile.infinite || {}) };
  for (const [key, value] of Object.entries(data)) {
    if (!Object.hasOwn(fields, key) && key !== 'stats') return json(400, { error: `Unknown field: ${key}` });
    if (value === 'infinite') infinite[key] = true;
    else if (value === false) delete infinite[key];
    else if (Object.hasOwn(fields, key) && Number.isSafeInteger(value) && value >= 0 && value <= (key === 'xp' ? 1_999_999 : limit)) { delete infinite[key]; values[fields[key]] = String(value); }
    else return json(400, { error: `Invalid value for ${key}` });
  }
  sections[0] = values.join(','); profile.infinite = infinite; profile.csv = applyInfinite(profile, sections.join('§'));
  profile.adminRevision = (profile.adminRevision || 0) + 1; profile.updated = new Date().toISOString(); save();
  return json(200, { player: adminView(profile), message: 'Saved. Reload the game and choose LOAD if prompted.' });
}
