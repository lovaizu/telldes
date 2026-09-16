# Steering — Pre-Coding Checklist & Rules

## Confirmation Items

Before coding, fill in each item. Items marked `[auto]` can be determined from spec.json and notes. Ask the user about items marked `[ask]`.

| # | Item | Source | Value |
|---|---|---|---|
| 1 | Output format (single HTML / multi-file) | `[ask]` | |
| 2 | CSS approach (inline style / `<style>` / external CSS) | `[ask]` | |
| 3 | Responsive (single / desktop+mobile) | `[auto]` from spec structure | |
| 4 | Viewport width | `[auto]` from spec.json viewport.width | {{VIEWPORT_WIDTH}}px |
| 5 | Image path base | `[ask]` deployment-dependent | |
| 6 | Component granularity | `[auto]` from spec.json sections | |
| 7 | Font loading (Google Fonts / local / system) | `[auto]` from spec.json text.fontFamily | |
| 8 | Deploy target (static hosting / CMS / etc.) | `[ask]` | |
| 9 | OGP / meta information | `[ask]` | |
| 10 | Language / charset | `[ask]` | |

## Task List

### Setup
- [ ] Read spec.json and understand the page structure
- [ ] Define CSS custom properties from tokens.json (if present)
- [ ] Set up HTML boilerplate with correct viewport and charset

### Coding (per section)
{{SECTION_TASKS}}

### Completion Checks
- [ ] Every section matches its screenshot
- [ ] All notes have been implemented
- [ ] All tokens are used as CSS variables
- [ ] HTML semantics follow the derivation rules
- [ ] Layout matches the spec exactly (padding, gap, sizing)
- [ ] Text content matches spec (characters, fontSize, fontFamily, fontWeight, color)
- [ ] All images and icons are placed correctly
- [ ] Responsive behavior works (if applicable)

## Rules

1. **Pixel-perfect** — The output must match the design comp exactly. Use screenshots as the source of truth.
2. **Spec-first** — Derive all values from spec.json. Do not guess or approximate.
3. **Token-first** — If a `*Token` field exists, use the CSS variable instead of the raw value.
4. **Semantic HTML** — Follow the HTML derivation rules for element mapping.
5. **Flexbox layout** — Use the Auto Layout → CSS mapping table. Do not use grid or absolute positioning unless explicitly noted.
6. **No frameworks** — Output vanilla HTML/CSS unless the user specifies otherwise in the confirmation items.
7. **Asset paths** — Use relative paths matching the zip structure unless the user specifies a different base path.
8. **Notes are instructions** — Every note must be implemented. If a note is ambiguous, ask the user.
