# Recovered WebGL protocol

Source of these details: the downloaded client metadata, compiled response
parser (WebAssembly function 39993), and local browser traffic. No calls to the
official backend were required for this implementation.

The original backend base URL is `https://d2.touchdowners2.com/`. The launcher
rewrites only that hostname to the same-origin `/backend/` prefix. External
fetch/XHR calls are rejected and the HTTP Content Security Policy restricts
connections to the local origin and blob URLs.

`GET /backend/Check.php` responds with the single character `a`.

`POST /backend/SetEventData.php` accepts URL-encoded fields:

- `userIDPOST`: the client's assigned local ID, or 0 before login.
- `eventIDPOST`: a numeric event ID.
- `eventDataPOST`: the first event value, often an opaque save snapshot.
- `eventData2POST`: an optional second event value.
- `ClientDateTime`: client-side timestamp; local server time is authoritative.

Responses are semicolon-separated JSON table envelopes. Each envelope's Items
array contains **JSON strings**, not row objects:

```json
{"TableName":"User","Items":["{\"UserId\":1,\"ProfileCSV\":\"\"}"]}
```

Semicolons in text are Unicode-escaped in the outer JSON. `ProfileCSV` is an
opaque multi-section game format; the server preserves it rather than
interpreting and rebuilding it.

| ID | Recovered name | Local behavior |
| --- | --- | --- |
| 0 | Login | Establish session; return User and ServerTime |
| 1 | Logout | Return time; retain local session for the next launch |
| 2 | BackupProfile | Save exact snapshot; ProfileEvent EventId 1 |
| 3 | RequestProfile | Return UserProfile snapshot |
| 4 | ReportWinnings | Add bounded client-reported amount to local tally |
| 5 | RequestLeaderboard | Return local rows in Leaderboard_N |
| 6 | GetServerTime | Return ServerTime |
| 7 | DeleteProfile | Keep recovery backup; reset snapshot; EventId 3 |
| 8 | ClaimPromoBundle | Return Invalid true |
| 9 | GetProfiles | Return public local opponent descriptors |
| 10 | RequestUserNotifications | Empty UserNotifications |
| 11 | AcknowledgeUserNotification | Empty UserNotifications |
| 12 | GetAssetUpdateTime | Local fixed update timestamp |
| 13 | RequestAssets | Empty LeaderboardRewards |

Login, backups, connection checks, public-profile requests, notifications, and
asset requests were observed in the browser. Other mappings come from the
client's metadata and response parser; full UI coverage is outstanding.

The legacy build references Authenticate.php and Login.php too, but they were
not requested during the tested startup. Unknown endpoints return 404 rather
than fabricated successful authentication. There is no official-account
authentication. The independent online transport is described below.

## Admin runtime synchronization

ID 1's authenticated browser reads `/api/admin/runtime` for its grant revision
and counter values. `public/runtime-admin.js` applies these to the pinned
version 4.5 native `UserProfile` integers after `MainGameDataHolder.Initialised`
is true, then invokes the game's own currency/stat notifications and save
routine. It checks managed class names at each pointer before writing.

The recovered singleton type slot is 3397700, its static-fields pointer is at
+92, and the singleton is static field +4. The holder's profile is at +24,
its `userProfile` is at +16, and CSV integer slot N maps to userProfile +12+4N.
Coins use slot 3, cash/gems 4, XP 2, free shots 24, golden shots 25, and the
**spendable** draft balance 27. The native `TrySpendDraftPoints` function reads
+120; slot 26 does not fund purchases. Pointer constants must be recovered
again if the WebAssembly binary is replaced.

After applying a revision, that browser attaches `X-Dunkers-Admin-Revision` to
backend requests. Backups without the current revision are acknowledged but
discarded, including after a new login or another tab's successful
synchronization. An HTTP error would incorrectly mark the native provider
offline. Ignoring these snapshots prevents an unapplied local snapshot from
replacing a finite grant. Infinite flags also
replenish the native counters during play and the server snapshot on backup.
Only a native backup carrying the revision advances `appliedRevision`.

## Independent online transport

`GET /api/online/state` and `/api/online/stream` require the same local session
cookie as saves. The stream uses SSE with buffering disabled. State supplies a
session CSRF token; all mutations require `X-Online-CSRF`. No supplied player ID
is trusted.

- `POST /api/online/join`: public FIFO queue, `{createRoom:true}` for a private
  room, or `{room:"ABC123"}` to join a friend. Humans are paired before CPU
  deadlines are processed. A disconnected stream leaves the queue immediately.
- `POST /api/online/leave`: cancel waiting or end the current match for both.
- `POST /api/online/frame`: host-only bounded WebP upload with `X-Online-Match`.
  The server emits frames only to that match's authenticated guest. Slow SSE
  consumers are disconnected instead of accumulating unlimited frame buffers.
- `POST /api/online/input`: guest-only `{matchId,seq,left,right,shoot}`. Monotonic
  sequence numbers discard stale controls; the host releases controls after
  750 ms without a heartbeat. Stream loss ends the match after a short grace
  period; a stalled host frame stream also ends the match.

`online-native.js` validates native class names and hooks the pinned WASM
indirect table. A human match replaces only the opposing side's AI update.
The native Tier menu initializes the original court; entry is free for these
friendly matches. Native public Play paths are routed through our queue.
The guest displays the same host frames instead of starting an unrelated
local simulation. No official server, WebRTC rendezvous, STUN or TURN service
is involved. This transport does not add guest economy/reward synchronization.
