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
- `layout` — Auto Layout properties (direction, gap, padding, sizing, alignment)
- `text` — text content and typography (characters, fontSize, fontFamily, fontWeight, fill)
- `fills` — background fills
- `cornerRadius` — border radius
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
| `sizing.width: "FIXED"` | `width: {value}px` |
| `sizing.height: "FILL"` | `height: 100%` |
| `sizing.height: "HUG"` | `height: auto` |
| `sizing.height: "FIXED"` | `height: {value}px` |
| `layoutAlign: "STRETCH"` (child) | `align-self: stretch` |
| `layoutGrow: 1` (child) | `flex-grow: 1` |
| `counterAxisAlignContent: "SPACE_BETWEEN"` (wrap) | `align-content: space-between` |

## 7. Completion

When done, verify against the steering.md checklist:
- Every section and block matches its screenshot
- All notes have been implemented
- All tokens are used as CSS variables (if tokens.json exists)
- HTML semantics follow the derivation rules
- Layout matches the flexbox mapping exactly
