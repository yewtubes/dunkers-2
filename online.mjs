import { randomBytes, timingSafeEqual } from 'node:crypto';
import { selectedCharacter, SLIDE_COOLDOWN } from './characters.mjs';

// Match membership comes exclusively from the same HttpOnly session as saves.
// The host runs the pinned Unity simulation; frames and controls stay on this server.
export function createOnline({ save, reply, botDelay = 12000, now = Date.now }) {
  const players = new Map(), queue = new Map(), matches = new Map();
  const json = (res, code, value) => reply(res, code, JSON.stringify(value), 'application/json');
  const team = profile => {
    const csv = profile.csv?.split('§')[2] || '';
    return /^-?\d+(,-?\d+){13}$/.test(csv) && csv.split(',').every(v => Number.isSafeInteger(Number(v)) && Number(v) >= -1 && Number(v) <= 1000000) ? csv : '30,-1,-1,23456,28282,5,6,0,5,0,5,0,5,1';
  };
  const identity = profile => ({ id: profile.id, name: profile.csv.split(',')[0].slice(0, 40), team: team(profile), character: selectedCharacter(profile) });
  function state(p) {
    const waiting = queue.get(p.id), match = matches.get(p.match);
    if (match) return { status: 'matched', matchId: match.id, role: match.host === p.id ? 'host' : 'guest',
      own: identity(p.profile), opponent: match.guest === null ? { id: null, name: 'CPU opponent', isBot: true } : identity(players.get(match.host === p.id ? match.guest : match.host).profile) };
    if (waiting) return { status: 'waiting', room: waiting.room, deadline: waiting.room ? null : waiting.at + botDelay };
    return { status: 'idle', notice: p.notice || '' };
  }
  function send(p, event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of p.streams) {
      // Drop slow streams instead of buffering an unlimited video backlog.
      if (res.writableLength > 512 * 1024) { res.destroy(); continue; }
      res.write(message);
    }
  }
  const publish = p => send(p, 'state', state(p));
  function end(match, notice = 'Opponent disconnected.') {
    if (!match || !matches.delete(match.id)) return;
    for (const id of [match.host, match.guest]) {
      const p = players.get(id);
      if (p) { p.match = null; p.notice = notice; publish(p); }
    }
  }
  function pair(a, b) {
    queue.delete(a.id); if (b) queue.delete(b.id);
    const match = { id: randomBytes(16).toString('hex'), host: a.id, guest: b?.id ?? null, at: now(), frameAt: 0, seq: -1 };
    matches.set(match.id, match); a.match = match.id; if (b) b.match = match.id;
    publish(a); if (b) publish(b);
  }
  function matchmaking() {
    const waiting = [...queue.values()].filter(q => players.get(q.id)?.streams.size);
    // Finish every possible human pairing before considering any CPU deadline.
    const publicQueue = waiting.filter(q => !q.room);
    while (publicQueue.length > 1) pair(players.get(publicQueue.shift().id), players.get(publicQueue.shift().id));
    const rooms = new Map();
    for (const q of waiting.filter(q => q.room)) {
      if (rooms.has(q.room)) { pair(players.get(rooms.get(q.room)), players.get(q.id)); rooms.delete(q.room); }
      else rooms.set(q.room, q.id);
    }
    for (const q of publicQueue) if (now() - q.at >= botDelay && queue.has(q.id)) pair(players.get(q.id));
  }
  async function body(req, limit) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) { const error = new Error('Request too large'); error.status = 413; throw error; }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async function handle(req, res, url, profile) {
    if (!profile) return json(res, 401, { error: 'Start the game in this browser first.' });
    if (!profile.onlineCsrf) { profile.onlineCsrf = randomBytes(24).toString('hex'); save(); }
    let p = players.get(profile.id);
    if (!p) { p = { id: profile.id, profile, streams: new Set(), disconnected: now(), match: null }; players.set(p.id, p); }
    p.profile = profile;
    const action = url.pathname.slice('/api/online/'.length);
    if (req.method === 'GET' && action === 'state') return json(res, 200, { ...state(p), csrf: profile.onlineCsrf, botDelay });
    if (req.method === 'GET' && action === 'stream') {
      if (p.streams.size >= 3) return json(res, 409, { error: 'Too many open game tabs.' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      p.streams.add(res); p.disconnected = null; res.write('retry: 1000\n\n'); send(p, 'state', state(p));
      res.on('close', () => {
        p.streams.delete(res);
        if (!p.streams.size) { p.disconnected = now(); queue.delete(p.id); }
      });
      return;
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'POST required.' });
    const csrf = String(req.headers['x-online-csrf'] || '');
    if (Buffer.byteLength(csrf) !== Buffer.byteLength(profile.onlineCsrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(profile.onlineCsrf))) return json(res, 403, { error: 'Invalid session token.' });
    try {
      if (action === 'frame') {
        const match = matches.get(p.match);
        if (!match || match.host !== p.id || match.guest === null || req.headers['x-online-match'] !== match.id) return json(res, 403, { error: 'Not the host of this match.' });
        const data = await body(req, 200 * 1024);
        if (req.headers['content-type'] !== 'image/webp' || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') return json(res, 400, { error: 'WebP frame required.' });
        if (now() - match.frameAt >= 40) { match.frameAt = now(); send(players.get(match.guest), 'frame', { matchId: match.id, data: data.toString('base64') }); }
        return json(res, 200, { ok: true });
      }
      let data;
      try { data = JSON.parse((await body(req, 2048)).toString() || '{}'); } catch (error) { if (error.status) throw error; return json(res, 400, { error: 'Invalid JSON.' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'JSON object required.' });
      if (action === 'leave') {
        queue.delete(p.id); const match = matches.get(p.match);
        if (match) end(match, 'Match ended.'); else { p.notice = ''; publish(p); }
        return json(res, 200, state(p));
      }
      if (action === 'join') {
        if (!p.streams.size) return json(res, 409, { error: 'Connect to the game stream first.' });
        if (p.match || queue.has(p.id)) return json(res, 200, state(p));
        const fields = profile.csv?.split('§')[0].split(',') || [];
        // userStage tracks optional native onboarding/offers as well as setup.
        // Named, saved players must not be locked out by those offers.
        if (fields.length < 30 || !fields[0].trim() || !Number.isInteger(Number(fields[1])) || Number(fields[1]) < 1) return json(res, 409, { error: 'Finish setting up your player first.' });
        let room = '';
        if (data.createRoom) { do { room = randomBytes(3).toString('hex').toUpperCase(); } while ([...queue.values()].some(q => q.room === room)); }
        else if (data.room) {
          room = String(data.room).trim().toUpperCase();
          if (!/^[A-F0-9]{6}$/.test(room) || ![...queue.values()].some(q => q.id !== p.id && q.room === room && players.get(q.id)?.streams.size)) return json(res, 404, { error: 'Friend room not found.' });
        }
        p.notice = ''; queue.set(p.id, { id: p.id, room, at: now() }); publish(p); matchmaking(); return json(res, 200, state(p));
      }
      if (action === 'input') {
        const match = matches.get(p.match);
        if (!match || match.guest !== p.id || data.matchId !== match.id) return json(res, 403, { error: 'Not the guest of this match.' });
        if (!Number.isSafeInteger(data.seq) || data.seq < 0 || !['left', 'right', 'shoot'].every(k => typeof data[k] === 'boolean')) return json(res, 400, { error: 'Invalid controls.' });
        if (data.seq > match.seq) { match.seq = data.seq; send(players.get(match.host), 'input', { matchId: match.id, left: data.left, right: data.right, shoot: data.shoot }); }
        return json(res, 200, { ok: true });
      }
      if (action === 'ability') {
        const match = matches.get(p.match);
        if (!match || data.matchId !== match.id) return json(res, 403, { error: 'Not in this match.' });
        if (!selectedCharacter(profile)) return json(res, 403, { error: 'Equip Ronaldo on user ID 1 to use this ability.' });
        if (match.kickReadyAt > now()) return json(res, 429, { error: 'Slide kick is recharging.', readyAt: match.kickReadyAt });
        match.kickReadyAt = now() + SLIDE_COOLDOWN;
        const ability = { matchId: match.id, kind: 'slide-kick', side: match.host === p.id ? 'host' : 'guest', seq: (match.kickSeq || 0) + 1, readyAt: match.kickReadyAt };
        match.kickSeq = ability.seq; send(players.get(match.host), 'ability', ability);
        return json(res, 200, { ok: true, ...ability });
      }
      return json(res, 404, { error: 'Unknown online endpoint.' });
    } catch (error) { if (error.status) return json(res, error.status, { error: error.message }); throw error; }
  }
  const timer = setInterval(() => {
    const time = now();
    for (const p of players.values()) {
      for (const res of p.streams) res.write(': heartbeat\n\n');
      if (p.disconnected !== null && time - p.disconnected > 5000) end(matches.get(p.match));
    }
    for (const match of matches.values()) if (match.guest !== null && time - (match.frameAt || match.at) > (match.frameAt ? 8000 : 120000)) end(match, 'The shared game stopped responding.');
    matchmaking();
  }, 1000);
  timer.unref();
  function close() { clearInterval(timer); for (const p of players.values()) for (const res of p.streams) res.end(); }
  return { handle, close, matchmaking, occupied: id => queue.has(id) || !!players.get(id)?.match };
}
