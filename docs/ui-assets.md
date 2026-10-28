# Loading screen and admin GUI assets

The custom loading screen uses unchanged sprite exports from the shipped
`sharedassets0.assets` Unity asset file:

- `public/loading/Dunkers2WhiteLogo.png`: Sprite 1140.
- `public/loading/GameBall.png`: Sprite 1064, `GameBall NoOutline`.
- `public/fonts/LilitaOne-Regular.ttf`: Font 677, original embedded font bytes.

The loader reproduces the blue screen, logo placement, and spinning basketball
in HTML/CSS before Unity starts. The assets are exact exports; the CSS animation
is a recreation, not an extracted Unity animation clip. The native Unity loading
screen takes over once the engine initializes. The browser title remains empty.

`public/admin/gui.webp` is generated GUI artwork. An unchanged copy at
`public/gui/buttons.webp` allows the online panel to use the red X without
requesting an admin-only URL. It contains a six-cell
atlas: red X, green confirm, blue back, orange refresh, gold coin, and purple
admin shield. CSS selects each cell without modifying its artwork. The original
generated PNG is converted to WebP for delivery. The generated court-background
concept was discarded and is not used in the panel.

Generation used the built-in image tool with this prompt:

> Create a transparent GUI sprite atlas for a playful 2D cartoon basketball game
> resembling Dunkers 2's interface: chunky rounded shapes, thick dark charcoal
> outlines, flat bright colors, small simple cel-shaded highlights and a hard
> offset dark shadow. Exact layout: three columns by two rows in a wide 3:2
> image, six equally sized square cells with generous even transparent gutters.
> Top row: red close button with white X, green confirm with white checkmark,
> blue back with white left arrow. Bottom row: orange refresh with white circular
> arrow, gold coin button, purple admin button with white shield and orange
> basketball. Identical dimensions, consistent outlines, centered cells,
> straight-on view, readable at 40 pixels. No scene, background, text labels,
> letters, or watermark; transparent outside the six button silhouettes.
