# Telldes Design Spec — Coding Prompt

## 1. Overview

This zip contains a complete design specification exported from Figma by the Telldes plugin. Your task is to produce pixel-perfect HTML/CSS that matches the design comp exactly.

**Contents:**

Root-level files (shared across all frames):
- `prompt.md` — this file
- `steering.md` — pre-coding checklist, task list, and rules
- `tokens.json` — design tokens (only if the file defines Variables, Text Styles, gradient/multi-fill Color Styles, or Effect Styles with shadows)
- `settings.json` — the designer's export settings (always present)
- `README.md` — zip contents overview, plus what this export did not include and why
- `site/` — favicon and OG image (only if set in the export settings)

One folder per top-level Figma frame, each containing that frame's spec and media:
- `{frame}/spec.json` — structured design spec (node tree, layout, text, fills, strokes, effects, background)
- `{frame}/screenshots/` — reference images for sections and blocks
- `{frame}/screenshots-dark/` — the same images in dark mode (only when dark mode is on)
- `{frame}/assets/images/` — raster images
- `{frame}/assets/icons/` — vector images (SVG)
- `{frame}/assets-dark/` — dark versions of the assets whose look changes in dark mode (only when dark mode is on; same subfolders and file names as `assets/`)

An LP has a single frame folder (e.g. `lp/`); a multi-page or responsive design has one folder per page/viewport (e.g. `top-desktop/`, `top-mobile/`). Build each frame folder as its own page/viewport.

**Paths:** paths inside `spec.json` (`screenshot`, `asset`, `strokeAsset`) are relative to that frame folder. Paths inside `settings.json` (`site.favicon`, `site.ogImage`) are relative to the zip root.

**Viewport width:** {{VIEWPORT_WIDTH}}px

## 2. Reading the Input Data

### settings.json

There is one `settings.json` for the whole site, at the zip root. Read it before building each page. Fields that the designer did not set are absent.

| Field | What to do |
|---|---|
| `responsive` | Rows of `{ minWidth, frame, contentWidth }`. Build mobile-first `min-width` media queries: from each row's `minWidth`, use the spec in the `frame` folder as the structure, and apply `contentWidth` (`"1120px"` or `"100%"`) to the content container. If absent, the page has one width and no media queries. |
| `darkMode` | `true`: build both light and dark (see tokens.json, `screenshots-dark/`, `assets-dark/`). `false`: light only. |
| `site` | Put the values as-is into `<html lang>`, `<title>`, `<meta name="description">`, `<meta name="theme-color">`, `<link rel="icon">` (`favicon.svg`, `favicon.ico`, `apple-touch-icon`) and the OG `<meta>` tags (`ogImage`, `ogTitle`, `ogDescription`). `themeColorToken` names a token in tokens.json: if its value is a light/dark pair, output two `theme-color` tags with `media="(prefers-color-scheme: …)"`; `themeColor` is the resolved value to use when tokens.json is absent. |
| `rules` | Site-wide instructions written by the designer. If a node's `note` disagrees with `rules`, follow the `note` (it is the narrower decision). |

### tokens.json

Tokens use the structure of the W3C Design Tokens (DTCG) format — `$type`, `$value`, groups nested by the `/`-separated name, `$extensions` — but the values are **not** standard DTCG: colors are `#RRGGBB`/`#RRGGBBAA` strings, numbers have no unit, typography `lineHeight`/`letterSpacing` are CSS strings, and a theme pair is `{ "light": …, "dark": … }`. Do not feed this file to DTCG tools; read it as described here.

`$type` is one of `color`, `number`, `fontFamily`, `typography`, `shadow`. A group's own value (when a name is both a token and a group, e.g. `color` and `color/primary`) is stored under the key `$root`.

Every token carries, in `$extensions["com.github.lovaizu.telldes"]`:
- `cssVariable` — the CSS custom property name. Use exactly this name to define the property and in `var()`. Do not build names from the token path.
- `cssValue` — the exact CSS value for that property (units and quoting included, e.g. `"16px"`, `"50%"`, `"700"`, `"\"Noto Sans JP\""`). Define the property with this value. Do not add units or convert `$value` yourself. `$value` is the raw Figma value, kept for matching against spec.json numbers.

A token without `cssValue` (a number whose unit could not be determined; README.md lists it) is not defined as a CSS variable; use the resolved values in spec.json wherever it would appear.

For composite tokens, `cssVariable` and `cssValue` are objects with one entry per CSS property:
- `typography` — keys `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`.
- `shadow` (group `effects`, from an Effect Style) — keys `boxShadow` (always), `textShadow` (only when every shadow is an outer shadow with no spread), `filter` (a `drop-shadow(…)`, only for a single outer shadow with no spread). Use the key that matches the node's `shadowProperty` (see spec.json).

**Light/dark:** when `cssValue` (or an entry of it) is `{ "light": …, "dark": … }`, define the light value in `:root` and the dark value in `[data-theme="dark"]`. A plain value goes in `:root` only.

**Color Style tokens** (group `fills`): one `color` token per paint, named `<style>/<paint number>`; a gradient paint is a group with one `color` token per stop, `<style>/<paint number>/<stop number>`. Paints are numbered from the bottom, starting at 1; image paints and hidden paints have no token but keep their number. These colors already include the paint's opacity. Gradients themselves are not tokens: build them from spec.json and use these variables for the stop colors.

### spec.json

Top level: `page`, `viewport.width`, an optional `background` (the frame's own fill, same shape as `fills` — apply to the page/body), and `children`.

Recursive node tree. Only visible layers, paints and effects are included. Each node may have:
- `name` — layer name
- `type` — `section` | `block` | `element`
- `path` — full layer path (`>` separated)
- `layout` — Auto Layout properties (direction, wrap, gap, counterAxisGap, padding, alignment, and `sizing`). `sizing` may include `minWidth`/`maxWidth`/`minHeight`/`maxHeight` — apply as `min-width`/`max-width`/`min-height`/`max-height`.
- `text` — text content and typography: `characters`, `fontSize`, `fontFamily`, `fontWeight`, and when present `fontStyle` (`italic`), `lineHeight` (`24px`/`150%`), `letterSpacing` (`0.5px`/`0.02em`), `textAlign`, `textCase` (→ `text-transform`, or `font-variant` for `small-caps`), `textDecoration`. Color is either:
  - `fill` (+ `fillToken`, and `fillOpacity` 0–1 when present) → `color`, or
  - `fills` (same shape as node `fills`, computed on the text box) → write them as `background`, then `background-clip: text; -webkit-background-clip: text; color: transparent`.
  - `stroke` (when present) `{ width, color, colorToken?, paintOrder? }` → `-webkit-text-stroke: {width}px {color}` and, if `paintOrder` is present, `paint-order: {paintOrder}`.
  - `link` (when present) → wrap the text in `<a>`: a string is the URL; `{ "path": … }` points at another node in the spec — link to that element within the page (give it an `id`).
  - `runs` (when present) — the whole text split in order into pieces `{ characters, …fields }`. The `text` values above are the base style; each piece lists only the fields that differ from the base (same names and shapes as in `text`, e.g. `fontWeight`, `fill`, `fillToken`, `typographyToken`, `link`). Write pieces with fields as `<span>` (or `<a>` when they have `link`); pieces with only `characters` are plain text. Their `characters` joined together equal `text.characters`.
- `fills` — see Fills below.
- `strokes` — see Strokes below.
- `cornerRadius` — a number (uniform) or `{ topLeft, topRight, bottomRight, bottomLeft }` → `border-radius`.
- `clipsContent: true` → `overflow: hidden`.
- `effects`, `shadowProperty` — see Effects below.
- `opacity` — node-level opacity (0–1, when < 1) → CSS `opacity`.
- `blendMode` — node blend mode (CSS name) → `mix-blend-mode`.
- `position` — for children that Auto Layout does not place (children of a Group, and absolutely positioned children): the CSS offsets and size relative to the parent box, e.g. `{ "left": "24px", "top": "16px", "width": "120px", "height": "40px" }` or `{ "left": "0px", "right": "0px", "bottom": "calc(50% + 4px)", "height": "10%" }`. Give the parent `position: relative` and the child `position: absolute`, and write exactly the keys given. `width`/`height` are the size before rotation; a missing `width` or `height` means the element is stretched between `left`/`right` (or `top`/`bottom`) — do not add one. A node with `position` has no `layout.sizing`, and the sizing table below does not apply to it.
- `rotate` — CSS angle in degrees (clockwise) → `transform-origin: 0 0; transform: rotate({rotate}deg)`.
- `asset` (+ `assetOverflow`) — see Assets below.
- `note` — designer annotations (behavior, links, interactions)
- `screenshot` — reference image path
- `*Token` fields — the token for that value when a Variable or Style is applied. Find the token in tokens.json (the `/`-separated name is its path) and use `var(<its cssVariable>)`. If a `cssVariable` is an object, use the entry for the property you are writing.

Hidden Figma layers are not in spec.json, screenshots or assets. Drawing that CSS cannot reproduce exactly is also left out. README.md lists both. Do not build them or invent a substitute.

#### Fills

`fills` is an array, bottom paint first. Each entry has a `type`:

| type | Fields | CSS |
|---|---|---|
| `SOLID` | `color`, `colorToken?`, `opacity?` | a color |
| `IMAGE` | `asset`, `backgroundSize`, `backgroundPosition`, `backgroundRepeat` | `url(asset) {backgroundPosition} / {backgroundSize} {backgroundRepeat}` |
| `GRADIENT_LINEAR` | `angle`, `gradientStops`, `opacity?` | `linear-gradient({angle}deg, {color} {position×100}%, …)` |
| `GRADIENT_RADIAL` | `size {x,y}`, `center {x,y}`, `gradientStops`, `opacity?` | `radial-gradient({size.x}% {size.y}% at {center.x}% {center.y}%, …)` |
| `GRADIENT_ANGULAR` | `angle`, `center {x,y}`, `gradientStops`, `opacity?` | `conic-gradient(from {angle}deg at {center.x}% {center.y}%, …)` |
| any gradient or image with only `asset` (no stops / background fields) | `asset` | `url(asset) 0 0 / 100% 100% no-repeat` — CSS cannot draw this paint (diamond or skewed gradient; semi-transparent, rotated or adjusted image), so Figma rendered it as an image |

- `gradientStops` is `[{ position, color, colorToken? }]`. All gradient values are already converted to CSS: `position` is the CSS stop position (may be below 0 or above 1 — write it as is), `angle` is a CSS angle (0 = up, clockwise), `size`/`center` are percentages of the box. Do not recompute them.
- Several fills → one `background` with the layers in reverse order (CSS lists the top layer first). A SOLID layer that is not the bottom one becomes `linear-gradient(color, color)`, because a plain color is allowed only as the bottom layer.
- `opacity` (0–1, SOLID and gradients only) is that paint's opacity. CSS backgrounds have no per-layer opacity: multiply it into the color's alpha; for a token color write `color-mix(in srgb, var(--x) {opacity×100}%, transparent)`.
- `blendMode` (CSS name, when not normal) → `background-blend-mode` for that layer.
- `fillsToken` (when present) names the Color Style on the node. Then every `colorToken` in its fills points at that style's tokens, and colors already include opacity (no `opacity` field).
- Use a `colorToken` whenever present; otherwise use the literal `color`.

#### Strokes

**Box strokes** (any node except text) come as `strokes` (same entry shape as `fills`), `strokeWeight` (number, or `{ top, right, bottom, left }`), `strokeAlign` (`INSIDE`/`CENTER`/`OUTSIDE`), optionally `strokesToken`, `strokeWeightToken`, `strokesIncludedInLayout`. They are **not** a CSS `border` on the element (that would push the content inward). Draw them on an overlay pseudo-element that does not affect layout:

```css
.node { position: relative; }
.node::after {
  content: ""; position: absolute; pointer-events: none; box-sizing: border-box;
  inset: /* INSIDE: 0 · CENTER: -{W/2}px · OUTSIDE: -{W}px (per side if weights differ) */;
  border-radius: /* node radius + the outward part (INSIDE: 0, CENTER: W/2, OUTSIDE: W); a 0 corner stays 0 */;
  border-top: {W}px solid {color}; /* one per side; skip sides with weight 0 */
}
```

- With per-side weights, grow each corner's horizontal radius by its left/right side's outward part and its vertical radius by its top/bottom side's outward part.
- If `strokeAsset` is present instead of `strokes`, Figma exported the stroke as an SVG (dashed, gradient/image, multiple strokes, or a blend mode). Set the `::after` `inset` to `-{strokeAssetOverflow side}px` per side and draw it with `background: url(strokeAsset) 0 0 / 100% 100%`. Do not draw the stroke yourself.
- `strokesIncludedInLayout: true` → the stroke takes space: add each side's stroke weight to that side's padding (`calc(var(--…) + 1px)` if the padding is a token). The stroke is still drawn on `::after`.
- If the node has `clipsContent: true` and a `CENTER`/`OUTSIDE` stroke, `overflow: hidden` would cut the part of `::after` outside the box. Draw that outward part as `box-shadow: 0 0 0 {outward width}px {color}` (first in the shadow list) and only the inward part on `::after`.

**Text strokes** come as `text.stroke` (see spec.json above), never as `strokes`.

#### Effects

`effects` is an array, bottom effect first. CSS shadow lists put the top shadow first, so write them in reverse order.

| type | Fields | CSS |
|---|---|---|
| `DROP_SHADOW` | `color`, `offsetX`, `offsetY`, `blur`, `spread?` | the node's `shadowProperty` (below) |
| `INNER_SHADOW` | same + `inset: true` | `box-shadow: inset …` |
| `LAYER_BLUR` | `blur` | `filter: blur({blur}px)` |
| `BACKGROUND_BLUR` | `blur` | `backdrop-filter: blur({blur}px)` |

`shadowProperty` tells which property draws the shadows:
- `box-shadow` → `box-shadow: [inset] offsetX offsetY blur spread color, …`
- `text-shadow` → `text-shadow: offsetX offsetY blur color, …`
- `filter` → `filter: drop-shadow(offsetX offsetY blur color)`; if the node also has `LAYER_BLUR`, write `filter: drop-shadow(…) blur(…)`.

`effectsToken` (when present) names the Effect Style: use `var()` of its `cssVariable` entry for that property (`boxShadow`, `textShadow` or `filter`). Blurs are not in the token; write them from `effects`.

#### Assets

- A node with `asset` is exported whole: an SVG (vectors) or a PNG at 2x (image leaf nodes). Its fills, strokes and effects are baked into the file and are not in spec.json. Place it at the node's size (from `layout.sizing`, or from `position` for nodes outside Auto Layout); if `assetOverflow { top, right, bottom, left }` is present, the image extends that many px beyond the node box (outside strokes, shadows) — let it overflow by those amounts (negative margins or absolute positioning) rather than shrinking it.
- `IMAGE` fills point at the original image file (`asset`); place it with the entry's `backgroundSize` / `backgroundPosition` / `backgroundRepeat` exactly as given.
- Use the paths exactly as given. Do not build file names yourself.

### screenshots/ and screenshots-dark/
Visual reference for each section and block. Use them to verify your output matches the design. With dark mode on, `screenshots-dark/` has the same file names showing the dark look.

### assets/ and assets-dark/
- `assets/images/` — raster images. Use as `<img>` sources or backgrounds, as spec.json says.
- `assets/icons/` — SVG. Use as inline SVG or `<img>`.
- `assets-dark/` — only the assets whose look changes in dark mode, under the same relative path as in `assets/`. Switch to them under `[data-theme="dark"]`. An asset with no dark file looks the same in both themes.

### site/
Favicon and OG image files referenced from `settings.json` → `site` (zip-root relative).

## 3. Before You Start

1. Read `steering.md` carefully
2. Read `settings.json`
3. Fill in steering.md items you can determine from spec.json, settings.json and notes
4. Ask the user about items you cannot determine
5. Get user agreement on all steering.md items before coding

## 4. Coding Procedure

Follow this order:

1. **CSS custom properties** — If tokens.json exists, define each token as `{cssVariable}: {cssValue}` in `:root` (and the dark values in `[data-theme="dark"]`)
2. **HTML structure** — Build DOM from spec.json hierarchy (section → block → element)
3. **Layout (CSS flexbox)** — Apply flexbox from layout properties (see mapping table below). Use `box-sizing: border-box` on every element: Figma sizes include padding.
4. **Visual styles** — Apply fills, strokes, text styles, cornerRadius, clipping, effects, opacity and blend modes from spec, as described above
5. **Assets** — Place images and icons using the asset paths in spec.json
6. **Responsive and dark mode** — Apply `settings.json` (`responsive`, `darkMode`, `site`)
7. **Visual verification** — Compare against screenshots/ (and screenshots-dark/) for each section and block
8. **Notes** — Implement behaviors, interactions, and links from note fields and `settings.json` → `rules`

## 5. HTML Derivation Rules

Map layer names to HTML elements:

| Layer name | HTML element |
|---|---|
| `header` (section) | `<header>` |
| `footer` (section) | `<footer>` |
| block containing `nav` | `<nav>` |
| other sections | `<section>` |
| `heading` (first in page) | `<h1>` |
| `heading` (direct child of section) | `<h2>` |
| `heading` (inside block) | `<h3>` |
| other text | `<p>` |
| element containing `cta` or `button` | `<button>` |

If a note specifies a link destination, use `<a>` instead.

Default: `<div>` for blocks, `<p>` for text without a special name.

## 6. Auto Layout → CSS Flexbox Mapping

| Figma Auto Layout | CSS |
|---|---|
| `direction: "HORIZONTAL"` | `flex-direction: row` |
| `direction: "VERTICAL"` | `flex-direction: column` |
| `wrap: "WRAP"` | `flex-wrap: wrap` |
| `gap` | `gap` |
| `counterAxisGap` (wrap) | HORIZONTAL: `column-gap: {gap}` + `row-gap: {counterAxisGap}`; VERTICAL: `row-gap: {gap}` + `column-gap: {counterAxisGap}` |
| `padding` | `padding` |
| `primaryAxisAlign: "MIN"` | `justify-content: flex-start` |
| `primaryAxisAlign: "CENTER"` | `justify-content: center` |
| `primaryAxisAlign: "MAX"` | `justify-content: flex-end` |
| `primaryAxisAlign: "SPACE_BETWEEN"` | `justify-content: space-between` |
| `counterAxisAlign: "MIN"` (also when absent — always write it; the CSS default `stretch` would stretch HUG children) | `align-items: flex-start` |
| `counterAxisAlign: "CENTER"` | `align-items: center` |
| `counterAxisAlign: "MAX"` | `align-items: flex-end` |
| `counterAxisAlign: "BASELINE"` | `align-items: baseline` |
| `sizing.minWidth/maxWidth/minHeight/maxHeight` | `min-width`/`max-width`/`min-height`/`max-height` |
| `counterAxisAlignContent: "SPACE_BETWEEN"` (wrap) | `align-content: space-between` |

**Sizing** (`sizing.width` / `sizing.height`) depends on whether that axis is the parent's main axis: `width` is the main axis when the parent's `direction` is HORIZONTAL, the cross axis when VERTICAL (and the reverse for `height`).

| Mode | Main axis | Cross axis |
|---|---|---|
| `FILL` | `flex: 1 1 0` + `min-width: 0` (`min-height: 0` in a VERTICAL parent); if `sizing.minWidth`/`minHeight` exists, use that value instead of 0 | `align-self: stretch` |
| `HUG` | no size + `flex-shrink: 0` | no size |
| `FIXED` | `width: {widthPx}px` (`height: {heightPx}px` in a VERTICAL parent) + `flex-shrink: 0` | `width: {widthPx}px` / `height: {heightPx}px` |

Do not use `width: 100%` / `height: 100%` for FILL: next to FIXED or HUG siblings it overflows and shrinks them, and `height: 100%` does nothing inside a HUG parent.

Notes:
- A non-container element that is an Auto Layout child carries its `sizing` under `layout` with no `direction`.

## 7. Completion

When done, verify against the steering.md checklist:
- Every section and block matches its screenshot (and its dark screenshot when dark mode is on)
- All notes and `settings.json` → `rules` have been implemented
- All tokens are defined from `cssVariable`/`cssValue` and used through `var()` (if tokens.json exists)
- HTML semantics follow the derivation rules
- Layout matches the flexbox mapping exactly
