# Cristiano Ronaldo — 2007 modular character art

This is a **character-art asset pack**, not an enabled game roster entry. Open
`/custom/ronaldo-2007/preview.html` on the existing server to inspect the assembled
character, six expressions, and separate parts. No gameplay is simulated by the
preview. Roster registration, native resource binding, and equipment/save support
still need implementation before this is selectable during a native match.

## Separate parts

`parts/` contains 26 transparent PNGs: six face expressions, six matching white
alpha masks for the native outline layer, torso, hips, left/right sleeves,
left/right shorts, left/right legs, left/right boots, and four hand states
(open/closed, front/back). `character.json` records every file, dimensions,
normalized Unity pivot, and pixels per unit. Keep the transparent canvas margins;
trimming them would move the native joints. Neutral/happy/angry/shocked/smug are
expression variants; blink is an additional optional state.

The body-part silhouettes are actual unmodified-shape exports from the pinned
Dunkers 2 v4.5 build. `base/` retains the original masks, and
`native-template.json` records original asset file/path IDs, rectangles, pivots,
and PPU values. The compiled kit is painted through those masks. The new head
art was generated from native Curry and Griffin face exports plus a 2006–07
Ronaldo portrait; it is new artwork, not an original shipped Dunkers character.
The native body geometry is reused exactly; matching the new head's style is a
visual judgment, not a claim that it was drawn by the original game artist.

The 2006–07 United home kit has a red shirt, white V-neck/cuffs, gold piping,
white AIG mark, Nike swoosh, club crest, white shorts with number 7, dark socks,
and red/white boots using the game's existing boot geometry.

## Native renderer investigation

Recovered `PlayerCharacterSpriteController` has distinct `face`, `arm`, `leg`,
`sock`, `frontHandSprite`, `backHandSprite`, `jerseyBase`, `pantsPelvis`,
`pantsShorts`, and `bootsBase` paths/renderers. Its `DrawFace`, `DrawPlayer`,
`DrawCharacterHands`, `DrawJersey`, `DrawPants`, and `DrawBoots` methods confirm
this is a modular pipeline. Outline and diffuse sprites are separate. Some packed
aliases decode to empty or contour-only alpha; the exported templates use the
corresponding populated native masks, checked during packaging.

The native face frame is 300×300, center pivot, 100 PPU. Arm1 uses 150×250,
pivot (0.67, 0.90), 50 PPU. Legs/shorts use 150×150, pivot (0.47, 0.75),
50 PPU. Hands use 128×128, centered, 25 PPU. The JSON retains precise values.
`sources/native-rest-pose.json` is an inspector rest pose, not an extracted
animation clip. The preview explicitly adjusts the unconfigured head/arm scale
for a neutral assembly; it does not certify native gameplay attachment.

## Rebuild

Install the optional development tool `@napi-rs/canvas`, then:

```sh
node tools/build-ronaldo-parts.cjs /path/to/generated-3x2-head-atlas.png
node tools/render-ronaldo-preview.cjs
```

The atlas is 1536×1024 with 512-pixel cells, ordered neutral, happy, angry,
shocked, smug, blink. Cropping/normalization and mask generation are deterministic
asset preparation. The PNGs in this pack are already built; running the game
server does not require the development tool or original atlas.

## Art sources and generation

- Body masks, pivots and renderer metadata: the hash-pinned Unity data build in
  `research/build-manifest.json`.
- Head style references: `Curry_Normal`, resources.assets Sprite 430, and
  `Griffin_Normal`, resources.assets Sprite 928.
- Ronaldo portrait: https://www.calciozz.it/img/planteis/new/51/67/65167_cristiano_ronaldo_20251117044353.jpg
- 2006–07 kit reference: https://i.ebayimg.com/images/g/ZtQAAOSwyOVcxcFu/s-l1200.jpg
- Club crest vector: https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg

Built-in image generation was used for the six-head atlas, with native sprites
as visual references and a true-alpha output request. The operative prompt was:
“2007 Cristiano Ronaldo, six fixed-position frontal expression sprites, tiny
native dot eyes, bar eyebrows, red-ochre two-blob nose, flat tan face, simple white
mouth, dark gelled quiff and silver studs; copy the native Dunkers face shapes
and sparse palette, no beard, no realistic rendering, no outline, no neck,
transparent background; neutral/happy/angry/shocked/smug/blink in a 3×2 grid.”
A refinement requested flat fills and removal of any halo. Invisible RGB outside
the generated alpha is discarded by normal Canvas rendering during export.

The original game assets and club marks remain their respective owners' work.
