# Dunkers 2 — independent local host

This package contains the extracted Dunkers 2 version 4.5 Unity WebGL build and
an independently written Node.js compatibility server. The game files are
served locally. Game backend requests are routed to this server; there is no
proxy or fallback to the official service.

## Run

Install Node.js 22 or newer, unzip this package, and open a terminal in its folder:

```sh
npm start
```

Open **http://127.0.0.1:8787/** in Chrome, Edge, or Firefox with WebGL 2 enabled.
No npm dependencies or installation step are needed. The first load downloads
about 73 MB from your own server and compiles Unity's WebAssembly. Keep the
terminal running while playing. Opening index.html directly will not work.

Profiles are stored in `storage/profiles.json`. Keep the browser's session
cookie to resume the same profile. Back up the storage folder; it contains the
session secrets as well as save snapshots. Clearing cookies starts a new local
profile. This package does not import official accounts or purchases.

## Included behavior

- Local game files, launcher, connection check, guest login, and server time.
- Opaque game save snapshots persisted to disk and restored at login.
- Local leaderboard/opponent-profile responses, empty notifications and reward
  updates, and explicit rejection of unavailable promotional codes.
- A local SDK bridge so the game starts without Poki or advertising scripts.
  Rewarded advertisements return unavailable and do not award ad rewards.
- Same-origin network restrictions and no upstream HTTP client in the server.

This is a compatibility implementation for the observed WebGL build, not the
original backend. **Real-time online PvP is not implemented.** Local rankings
contain only profiles on this instance. Leaderboard statistics are supplied by
the local game client; the server does not provide anti-cheat verification.
Every gameplay mode and long-term progression path has not been tested.

## Host on your own machine or server

The default binds only to 127.0.0.1. To make it accessible on your LAN, configure
`HOST=0.0.0.0` in your environment. `PORT` defaults to 8787, and `DATA_DIR`
can point to a persistent directory. For Internet hosting, put it behind an
HTTPS reverse proxy and set `SECURE_COOKIES=1`. Use a single Node process for
each storage directory; the JSON store is not a distributed database.

For ryanmongwe.com, `deploy/ryanmongwe.nginx.conf` shows how to mount this app at
`/games/dunkers-2/` alongside the existing site. Backend routes follow that
prefix too. This requires a Node.js/Docker server; static hosting alone cannot
run the save backend. The example is configuration to install, not an already
deployed domain change.

Docker is also supported:

```sh
docker build -t dunkers-local .
docker run --rm -p 127.0.0.1:8787:8787 -v dunkers-data:/app/storage dunkers-local
```

## Admin locker

Open `/admin/` relative to the game's URL, for example
`/games/dunkers-2/admin/`. Start the game in the same browser first. Only the
authenticated local profile with user ID **1** can open the panel or call its
admin APIs; sending a user ID in the request does not grant access.

The panel can set coins, gems/cash, draft points, XP, and shot counters, or
enable unlimited replenishment for those counters and lifetime game statistics.
**∞ Everything** enables every unlimited flag. Return to the court after saving.
The runtime adapter applies the grant directly to the active game's spendable
counters, refreshes its native UI, and calls its native save routine. Open game
tabs pick up changes within two seconds. Unlimited counters refill during play
and incoming server snapshots are replenished too. Stale saves are ignored
until that particular browser has applied the current grant revision.
These are finite, safe integer caps internally (one billion for most counters,
1,999,999 for XP at level 249), not floating-point infinity. Lifetime statistics do not
change character movement physics or create new equipment.

The runtime adapter is specific to the pinned version 4.5 WebAssembly binary.
It verifies managed class names before writing the recovered integer fields;
if the expected objects are unavailable, it does not write. Updating the game
binary requires updating this adapter. Gems and cash are the same shipped
currency field. No browser save deletion or manual LOAD selection is required
to apply a grant to an existing local player.

The UI uses the shipped Lilita One font, generated GUI buttons, and the original
logo and basketball sprites. Asset provenance is in `docs/ui-assets.md`.

## Validation

```sh
npm test
```

The tests exercise login, save/load, restart persistence, profile isolation,
wire-format escaping, static WebAssembly MIME type, network policy, and
unsupported routes. A headless Chrome browser run reached the playable
tutorial and recorded zero external HTTP requests. Original-build warnings
about missing scripts and an unsupported optional shader were also observed.

## Source recovery

The original page embeds:

https://gamecomets.com/games/dunkers-2/

The shipped build uses Unity 2022.3.39f1 and IL2CPP/WebAssembly. The original
Unity project and C# method source were not recovered. `source-recovery/`
contains the shipped global metadata, recovered class/field/method indices,
selected game configuration CSV assets, and WebAssembly pseudocode of the
backend response parser. These are reverse-engineering aids, not a buildable
Unity source project. `server.mjs` and the launcher/bridge are editable source
for the new implementation.

`research/build-manifest.json` records exact source URLs, lengths, and SHA-256
hashes. The four extracted Unity files are unmodified. `tools/extract-build.py`
can re-download and verify them when the original host is available.

The GitHub source repository requires the large `.data` and `.wasm` files.
The complete downloadable package includes them. Alternatively, run
`python3 tools/extract-build.py` and `python3 tools/recover-metadata.py` once
before `npm start`. Subsequent play uses the local files and local backend.
The optional manually triggered GitHub import workflow can do this too, but
the original host rejected the tested GitHub runner with HTTP 403.

The original game and assets remain the work of their respective owners. No
license to those assets is supplied by this package.
