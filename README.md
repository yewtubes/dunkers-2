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

The game fills the viewport in windowed, browser-fullscreen, and native-fullscreen
modes by scaling the complete 16:10 game frame. All UI stays visible without side
borders. Other screen shapes stretch the image. The drawing buffer retains the
original proportions and the existing device-pixel-ratio cap.

- Local game files, launcher, connection check, guest login, and server time.
- Opaque game save snapshots persisted to disk and restored at login.
- Local leaderboard/opponent-profile responses, empty notifications and reward
  updates, and explicit rejection of unavailable promotional codes.
- A local SDK bridge so the game starts without Poki or advertising scripts.
  Rewarded advertisements return unavailable and do not award ad rewards.
- Same-origin network restrictions and no upstream HTTP client in the server.

## Online play

Complete the native player setup, then use PLAY or ONLINE. Public matchmaking
pairs waiting players from this server first. After 12 seconds with no waiting
human opponent, it starts a clearly labeled CPU match. CPU opponents do not
create fake accounts. A friend room provides a six-character code; the other
player enters it on the same deployment. Private rooms wait for the friend and
never automatically start a CPU match. Separate browser profiles/devices need
separate local accounts; the same account cannot play itself.

Human matches use the original native court and physics on the first player's
browser. Our Node server relays compressed court frames to the second player
and their controls back to the host. The second player controls the opposing
native player; its AI is disabled for that match. Keyboard controls are Left/A,
Right/D and hold Space/Up/W to aim, release to shoot. Touch controls are shown
on the guest's court. Keep both tabs visible while playing. Leaving or losing
the connection ends the shared match. A server restart clears active rooms.

This is host-simulated friendly multiplayer, not a reconstructed official
multiplayer protocol or server-authoritative physics. Input/video latency and
host upload bandwidth affect play. Guest league progression and match rewards
are not synchronized; the native host retains its existing local progression.
Local rankings contain only this instance's profiles and client-supplied
statistics. This server does not provide anti-cheat verification. Every native
mode and long-term progression path has not been tested.

## Host on your own machine or server

The default binds only to 127.0.0.1. To make it accessible on your LAN, configure
`HOST=0.0.0.0` in your environment. `PORT` defaults to 8787, and `DATA_DIR`
can point to a persistent directory. For Internet hosting, put it behind an
HTTPS reverse proxy and set `SECURE_COOKIES=1`. Use a single Node process for
each storage directory; the JSON store is not a distributed database.

For ryanmongwe.com, `deploy/ryanmongwe.nginx.conf` shows how to mount this app at
`/games/dunkers-2/` alongside the existing site. Backend routes follow that
prefix too. This requires a Node.js/Docker server; static hosting alone cannot
run saves or online matches. Keep one Node process for the shared matchmaking
queue and disable proxy buffering for the SSE stream (the supplied configuration
does this). The example is configuration to install, not an already
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

The admin and online panels use the shipped Lilita One font and generated GUI
buttons. The loader restores the blue Dunkers screen with its original logo,
spinning basketball sprite, and Loading label. The favicon uses the original
basketball sprite. Asset provenance is in `docs/ui-assets.md`.

## Ronaldo 2007 playable character

Local user ID **1** owns Ronaldo automatically. Open the original **Locker Room** or **Ballers** menu and click the
**RONALDO 07** card to equip him. The adjacent default-player card restores the
normal character. The header **BALLERS** button opens the native Ballers menu.
Selection persists and cannot change during a queue or match.

His actual native motor has speed, jumping, handling, and shooting at **100**,
plus a higher speed cap. Press **F** (or the slide button) during human/CPU matches
to slide toward the opponent, knock them back, release their ball and briefly
stun them. The server authenticates ownership, routes the host/guest side, and
enforces a **1.25-second cooldown**. Other accounts keep normal characters.

`public/character-native.js` uses actual native SpriteRenderers, body joints,
hand poses and face animation. The retained Unity APIs create textures/materials
and account for packed-sprite trimming; custom assets survive scene cleanup.
The compatibility map targets the hash-pinned WebAssembly build and is generated
by `tools/map-native-runtime.py` after extracting the build and metadata.
Character loading waits for native player data and works before multiplayer onboarding
is complete. The locker uses native Unity card prefabs, fonts, portrait images and stat bars;
there is no separate HTML character picker. Selecting an ordinary native player
turns the Ronaldo skin off. Native item IDs and inventory CSV remain compatible.
This retains the existing host-simulated multiplayer trust model; it does not
provide authoritative server physics or anti-cheat.

The separate art inspector remains at `/custom/ronaldo-2007/preview.html`.
See its folder's README for sprite sources and rebuild tools.

## Validation

```sh
npm test
```

The tests exercise login, save/load, restart persistence, profile isolation,
wire-format escaping, static WebAssembly MIME type, network policy, and
unsupported routes, human-first queues, private rooms, CPU fallback, CSRF, and
match-specific frame/input/ability relay permissions, exclusive character ownership,
selection persistence, and ability cooldowns. Optional browser checks are:

```sh
npm install --no-save playwright
npx playwright install chromium
node tools/layout-browser-qa.cjs
node tools/online-browser-qa.cjs
node tools/character-browser-qa.cjs
node tools/character-browser-qa.cjs --guest-owner
node tools/locker-browser-qa.cjs
```

Set `CHROME_EXECUTABLE` to use an existing Chrome binary. Layout QA covers wide
and tall viewports, DPR 1/2, three fullscreen roots, the Dunkers logo/basketball loader and
reduced motion. Online QA runs a real native host and a separate authenticated
guest using the actual frame/input transport. It stubs the guest's unused Unity
menu to keep software-GPU costs down, checks independent native motor controls,
then exercises native Play and CPU fallback. A prior browser run reached the playable
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
