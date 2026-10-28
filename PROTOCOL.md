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
authentication and no live match transport in this implementation.
