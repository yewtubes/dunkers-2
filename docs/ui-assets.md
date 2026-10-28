# Loading screen and admin GUI assets

The console-style custom loader displays only `public/loading/Dunkers2Icon.png`,
the exact user-supplied 96×96 PNG (`image(9).png`), copied without editing.
CSS supplies the perspective, floating tile, subtle reflection, sideways entry,
and exit. Real Unity download progress moves the tile toward the center. There
are no visible labels, menus, progress bars, or spinners. Dragging or arrow keys
pan the single tile; reduced-motion preferences disable the animations.
The browser title remains empty.

The earlier sprite exports remain available from the shipped
`sharedassets0.assets` Unity asset file:

- `public/loading/Dunkers2WhiteLogo.png`: Sprite 1140 (earlier loader).
- `public/loading/GameBall.png`: Sprite 1064, `GameBall NoOutline` (favicon).
- `public/fonts/LilitaOne-Regular.ttf`: Font 677, original embedded font bytes.

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
