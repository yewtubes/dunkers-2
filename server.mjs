import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { applyInfinite, handleAdmin } from './admin.mjs';
import { handleCharacters } from './characters.mjs';
import { createOnline } from './online.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(here, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.webp': 'image/webp', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.png': 'image/png' };
// The Unity parser splits the wire payload on semicolons before parsing JSON.
// Escape semicolons at the outer JSON layer so player text cannot split tables.
export const table = (name, rows) => JSON.stringify({ TableName: name, Items: rows.map(row => JSON.stringify(row)) }).replaceAll(';', '\\u003b');

// One opaque CSV snapshot is supplied by the game. Keep it byte-for-byte; do not
// attempt to reimplement the game economy or accept official-service credentials.
export function createGameServer({ dataDir = process.env.DATA_DIR || path.join(here, 'storage'), secureCookies = process.env.SECURE_COOKIES === '1', botDelay = 12000, log = console.log } = {}) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const storePath = path.join(dataDir, 'profiles.json');
  let store = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { nextId: 1, sessions: {} };
  const save = () => {
    fs.writeFileSync(storePath + '.tmp', JSON.stringify(store), { mode: 0o600 });
    fs.renameSync(storePath + '.tmp', storePath);
  };
  const serverTime = () => table('ServerTime', [{ Timestamp: new Date().toISOString() }]);
  const reply = (res, status, body, contentType = 'text/plain; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' }); res.end(body);
  };
  const online = createOnline({ save, reply, botDelay });
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = { pathname: decodeURIComponent(new URL(req.url, 'http://localhost').pathname) };
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return reply(res, 403, 'Origin rejected');
      const cookieToken = Object.fromEntries((req.headers.cookie || '').split(';').map(value => value.trim().split('='))).dunkers_session;
      const signedIn = cookieToken && Object.hasOwn(store.sessions, cookieToken) ? store.sessions[cookieToken] : undefined;
      if (url.pathname.startsWith('/api/characters/')) return await handleCharacters(req, res, url, signedIn, { save, reply, occupied: online.occupied });
      if (url.pathname.startsWith('/api/online/')) return await online.handle(req, res, url, signedIn);
      if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(req, res, url, signedIn, { save, reply });
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        if (!signedIn) return reply(res, 401, 'Start the game in this browser first.');
        if (signedIn.id !== 1) return reply(res, 403, 'Admin access belongs to user ID 1.');
        if (url.pathname === '/admin') { res.writeHead(302, { Location: './admin/' }); return res.end(); }
        if (url.pathname === '/admin/') url.pathname = '/admin/index.html';
      }
      if (url.pathname === '/health') return reply(res, 200, JSON.stringify({ ok: true, backend: 'local', upstreamRequests: 0 }), 'application/json');
      if (url.pathname === '/backend/Check.php' && ['GET', 'HEAD'].includes(req.method)) return reply(res, 200, req.method === 'HEAD' ? '' : 'a');
      if (url.pathname.startsWith('/backend/')) {
        if (url.pathname !== '/backend/SetEventData.php') return reply(res, 404, 'Unsupported backend endpoint');
        if (req.method !== 'POST') return reply(res, 405, 'POST required');
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return reply(res, 413, 'Profile too large'); chunks.push(chunk); }
        const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        const event = Number(form.get('eventIDPOST'));
        if (!form.has('eventIDPOST') || !Number.isInteger(event)) return reply(res, 400, 'Missing event ID');
        const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(value => value.trim().split('=')));
        let token = cookies.dunkers_session;
        let profile = token && Object.hasOwn(store.sessions, token) ? store.sessions[token] : undefined;
        if (event === 0 && !profile) {
          token = randomBytes(32).toString('hex');
          profile = { id: store.nextId++, csv: '', winnings: 0, created: new Date().toISOString(), updated: null };
          store.sessions[token] = profile; save();
          res.setHeader('Set-Cookie', `dunkers_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secureCookies ? '; Secure' : ''}`);
        }
        // The game asks for public opponent profiles before its own login completes.
        if (event === 9) {
          const rows = Object.values(store.sessions).filter(p => p.csv).slice(0, 100).map(p => {
            const first = p.csv.split('§')[0].split(',');
            return { Username: first[0] || `Local Baller ${p.id}`, Flag: Number(first[23]) || 0, Level: Number(first[1]) || 1 };
          });
          return reply(res, 200, table('ServerProfiles', rows));
        }
        if (!profile) return reply(res, 401, 'Local login required');
        const claimedId = Number(form.get('userIDPOST') || 0);
        if (event !== 0 && claimedId !== profile.id) return reply(res, 403, 'Profile does not belong to this session');
        const data = form.get('eventDataPOST') || '';
        let response;
        switch (event) {
          case 0:
            profile.csv = applyInfinite(profile); save();
            response = table('User', [{ UserId: profile.id, ProfileCSV: profile.csv }]) + ';' + serverTime(); break;
          case 1: response = serverTime(); break;
          case 2:
            // Each browser must actually apply the grant to its native counters.
            // Logging in, or another tab applying it, must not authorize stale saves.
            if ((Number(req.headers['x-dunkers-admin-revision']) || 0) !== (profile.adminRevision || 0)) {
              // A failed UnityWebRequest marks the game's provider offline.
              // Acknowledge transport success while discarding this old save;
              // the adapter will apply the pending grant and submit a fresh one.
              res.setHeader('X-Dunkers-Admin-Pending', String(profile.adminRevision || 0));
              return reply(res, 200, table('ProfileEvent', [{ UserId: profile.id, EventId: 1 }]));
            }
            profile.csv = applyInfinite(profile, data); profile.updated = new Date().toISOString();
            profile.appliedAdminRevision = profile.adminRevision || 0; save();
            response = table('ProfileEvent', [{ UserId: profile.id, EventId: 1 }]); break;
          case 3: response = table('UserProfile', [{ UserId: profile.id, ProfileCSV: profile.csv }]); break;
          case 4:
            // This private server trusts local clients, as the shipped client owns
            // its match simulation. It is not an anti-cheat competitive service.
            profile.winnings += Math.max(0, Math.min(1000000, Number(data) || 0)); save(); response = serverTime(); break;
          case 5: {
            const index = Math.max(-1, Math.min(9, Number(data) || 0));
            const rows = Object.values(store.sessions).filter(p => p.csv).sort((a, b) => b.winnings - a.winnings).slice(0, 100).map((p, rank) => ({ UserId: p.id, Rank: rank + 1, UserName: p.csv.split(',')[0] || `Local Baller ${p.id}`, Winnings: p.winnings, Flag: 0, Team: 0, Kit: 0 }));
            response = table(`Leaderboard_${index}`, rows); break;
          }
          case 6: response = serverTime(); break;
          case 7:
            // Keep a recovery copy before the game's reset action.
            fs.writeFileSync(path.join(dataDir, `reset-backup-${profile.id}-${Date.now()}.json`), JSON.stringify(profile), { mode: 0o600 });
            profile.csv = ''; profile.winnings = 0; save();
            response = table('ProfileEvent', [{ UserId: profile.id, EventId: 3 }]); break;
          case 8: response = table('PromoBundle', [{ Invalid: true }]); break;
          case 10: response = table('UserNotifications', []); break;
          case 11: response = table('UserNotifications', []); break;
          case 12: response = table('AssetUpdateTime', [{ AssetType: Number(data) || 1, UpdatedAt: '1970-01-01T00:00:00Z' }]); break;
          case 13: response = table('LeaderboardRewards', []); break;
          default: return reply(res, 400, 'Unsupported game event');
        }
        log(`local event=${event} user=${profile.id}`);
        return reply(res, 200, response);
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, 'Method not allowed');
      const pathname = url.pathname;
      const file = path.resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(publicRoot + path.sep) || pathname.includes('\0')) return reply(res, 403, 'Forbidden');
      let stat;
      try { stat = fs.statSync(file); } catch { return reply(res, 404, 'Not found'); }
      if (!stat.isFile()) return reply(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': file.includes('/Build/') ? 'public, max-age=86400' : 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) { log(error.message); if (!res.headersSent) reply(res, 500, 'Local server error'); else res.destroy(); }
  });
  server.on('close', online.close);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8787);
  createGameServer().listen(port, host, () => console.log(`Dunkers 2: http://${host}:${port} — independent local backend`));
}
