import { randomBytes, timingSafeEqual } from 'node:crypto';

export const RONALDO = 'ronaldo-2007';
export const SLIDE_COOLDOWN = 1250;
export const selectedCharacter = profile => profile?.id === 1 && profile.character !== null ? RONALDO : null;
export const ronaldo = { id: RONALDO, name: 'Ronaldo ’07', portrait: 'custom/ronaldo-2007/parts/head-neutral.png',
  stats: { speed: 100, jumping: 100, handling: 100, shooting: 100 }, ability: { name: 'Slide kick', key: 'F', cooldown: SLIDE_COOLDOWN } };

export async function handleCharacters(req, res, url, profile, { save, reply, occupied }) {
  const json = (status, value) => reply(res, status, JSON.stringify(value), 'application/json');
  if (!profile) return json(401, { error: 'Start the game in this browser first.' });
  if (!profile.characterCsrf) { profile.characterCsrf = randomBytes(24).toString('hex'); save(); }
  const state = () => ({ id: profile.id, selected: selectedCharacter(profile), characters: profile.id === 1 ? [ronaldo] : [], csrf: profile.characterCsrf });
  if (req.method === 'GET' && url.pathname === '/api/characters/state') return json(200, state());
  if (req.method !== 'POST' || url.pathname !== '/api/characters/select') return json(404, { error: 'Unknown character action.' });
  if (profile.id !== 1) return json(403, { error: 'Ronaldo belongs to user ID 1.' });
  const token = Buffer.from(String(req.headers['x-character-csrf'] || '')), expected = Buffer.from(profile.characterCsrf);
  if (token.length !== expected.length || !timingSafeEqual(token, expected)) return json(403, { error: 'Refresh the character locker.' });
  if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'JSON required.' });
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 1024) return json(413, { error: 'Request too large.' }); chunks.push(chunk); }
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { return json(400, { error: 'Invalid JSON.' }); }
  if (!data || !Object.hasOwn(data, 'character') || ![null, RONALDO].includes(data.character)) return json(400, { error: 'Unknown character.' });
  if (occupied(profile.id)) return json(409, { error: 'Leave the match or queue before changing characters.' });
  profile.character = data.character; profile.updated = new Date().toISOString(); save();
  return json(200, state());
}
