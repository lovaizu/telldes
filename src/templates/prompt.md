# Telldes Design Spec — Coding Prompt

## 1. Overview

This zip contains a complete design specification exported from Figma by the Telldes plugin. Your task is to produce pixel-perfect HTML/CSS that matches the design comp exactly.

**Contents:**
- `spec.json` — structured design spec (node tree, layout, text, fills, tokens)
- `tokens.json` — design tokens in W3C DTCG format (if Variables are defined)
- `screenshots/` — reference images for sections and blocks
- `assets/images/` — raster images (PNG 2x)
- `assets/icons/` — vector icons (SVG)
- `steering.md` — pre-coding checklist, task list, and rules
- `prompt.md` — this file

**Viewport width:** {{VIEWPORT_WIDTH}}px

## 2. Reading the Input Data

### tokens.json
W3C Design Tokens format. Each token has `$type` (color, number) and `$value`. Use these to define CSS custom properties.

### spec.json
Recursive node tree. Each node has:
- `name` — layer name
- `type` — `section` | `block` | `element`
- `path` — full layer path (`>` separated)
- `layout` — Auto Layout properties (direction, gap, padding, alignment, and `sizing`). `sizing` may include `minWidth`/`maxWidth`/`minHeight`/`maxHeight` — apply as `min-width`/`max-width`/`min-height`/`max-height`.
- `text` — text content and typography (characters, fontSize, fontFamily, fontWeight, fill). `fillOpacity` (0–1, when present) is the text color opacity.
- `fills` — fills (array). Each entry has a `type`:
  - `SOLID` → `color` (#RRGGBB) as background-color
  - `IMAGE` → `scaleMode` (FILL/FIT/CROP/TILE); the image is in `assets/images/` under the node's path
  - `GRADIENT_LINEAR`/`GRADIENT_RADIAL`/`GRADIENT_ANGULAR`/`GRADIENT_DIAMOND` → `gradientStops` (`[{ position, color }]`) as a CSS gradient
  - `opacity` (0–1, when present) is that fill's opacity. Multiple fills stack back-to-front (later entries paint on top) — e.g. an image fill plus a semi-transparent SOLID overlay.
- `cornerRadius` — border radius. Either a number (uniform) or `{ topLeft, topRight, bottomRight, bottomLeft }` (per-corner) → `border-radius: TL TR BR BL`.
- `note` — designer annotations (behavior, links, interactions)
- `screenshot` — reference image path
- `*Token` fields — token name when a Variable is applied

### screenshots/
Visual reference for each section and block. Use to verify your output matches the design.

### assets/
- `assets/images/` — raster images, pre-exported at 2x. Use as `<img>` sources.
- `assets/icons/` — SVG icons. Use as inline SVG or `<img>`.

## 3. Before You Start

1. Read `steering.md` carefully
2. Fill in steering.md items you can determine from spec.json and notes
3. Ask the user about items you cannot determine
4. Get user agreement on all steering.md items before coding

## 4. Coding Procedure

Follow this order:

1. **CSS custom properties** — If tokens.json exists, define CSS variables from tokens
2. **HTML structure** — Build DOM from spec.json hierarchy (section → block → element)
3. **Layout (CSS flexbox)** — Apply flexbox from layout properties (see mapping table below)
4. **Visual styles** — Apply fills, text styles, cornerRadius from spec
5. **Assets** — Place images and icons using asset paths
6. **Visual verification** — Compare against screenshots/ for each section and block
7. **Notes** — Implement behaviors, interactions, and links from note fields

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
| `padding` | `padding` |
| `primaryAxisAlign: "MIN"` | `justify-content: flex-start` |
| `primaryAxisAlign: "CENTER"` | `justify-content: center` |
| `primaryAxisAlign: "MAX"` | `justify-content: flex-end` |
| `primaryAxisAlign: "SPACE_BETWEEN"` | `justify-content: space-between` |
| `counterAxisAlign: "MIN"` | `align-items: flex-start` |
| `counterAxisAlign: "CENTER"` | `align-items: center` |
| `counterAxisAlign: "MAX"` | `align-items: flex-end` |
| `sizing.width: "FILL"` | `width: 100%` |
| `sizing.width: "HUG"` | `width: fit-content` |
| `sizing.width: "FIXED"` | `width: {sizing.widthPx}px` |
| `sizing.height: "FILL"` | `height: 100%` |
| `sizing.height: "HUG"` | `height: auto` |
| `sizing.height: "FIXED"` | `height: {sizing.heightPx}px` |
| `sizing.minWidth/maxWidth/minHeight/maxHeight` | `min-width`/`max-width`/`min-height`/`max-height` |
| node `layoutAlign: "STRETCH"` | `align-self: stretch` |
| node `layoutGrow: 1` | `flex-grow: 1` |
| `counterAxisAlignContent: "SPACE_BETWEEN"` (wrap) | `align-content: space-between` |

Notes:
- For a `FIXED` axis, the pixel value is in `sizing.widthPx` / `sizing.heightPx`. A non-container element that is an Auto Layout child carries its `sizing` under `layout` with no `direction`.
- `layoutAlign` and `layoutGrow` appear at the node root (not inside `layout`).
- For a `GRADIENT_*` fill, build the CSS gradient from `gradientStops` (each `{ position, color }`) and derive direction from `gradientTransform` (a 2x3 matrix; for `GRADIENT_LINEAR` the angle comes from the transformed gradient axis).
- Asset filenames are the node's layer path with ` > ` replaced by `--` (e.g. `header > logo > icon` → `assets/icons/header--logo--icon.svg`); `IMAGE` fills map to `assets/images/{that path}.png`.

## 7. Completion

When done, verify against the steering.md checklist:
- Every section and block matches its screenshot
- All notes have been implemented
- All tokens are used as CSS variables (if tokens.json exists)
- HTML semantics follow the derivation rules
- Layout matches the flexbox mapping exactly
