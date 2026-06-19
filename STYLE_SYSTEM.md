# ZA RAMKI CSS System

This document describes the current CSS ownership model. The goal is to keep the
interface stable and dense while making future changes predictable.

## Load Order

CSS is loaded from `index.html` in this order:

1. `styles.rebuild.css`
2. `styles.editorial.css`
3. `colors.css`
4. `theme.css`

Later files can override earlier files, so overrides in `theme.css` should stay
small and intentional.

## File Ownership

### `colors.css`

Source of truth for design tokens:

- color palette and public color variables;
- soft surface helpers such as `--surface-soft`;
- shared radius tokens;
- shared spacing tokens;
- common focus and panel shadow tokens;
- BriefPro table color tokens.

Do not put component selectors here unless they are token-specific exceptions.

### `styles.rebuild.css`

Main UI layer:

- reset and base page shell;
- header, panels, viewer, tabs, lists, grid layout;
- shared controls: buttons, fields, pills, cards, rows;
- planner, projects, admin, checklist, comment, and modal UI;
- responsive shell and feature behavior.

Prefer adding reusable component rules here before adding overrides to
`theme.css`.

### `styles.editorial.css`

Editorial/content layer only:

- markdown body rhythm;
- article images;
- editorial image rows;
- article-specific responsive content rules.

Avoid app shell, planner, admin, or form controls here.

### `theme.css`

Small brand/theme override layer:

- local font registration;
- brand title typography;
- carefully scoped color tuning;
- input browser quirks such as autofill;
- table-specific overrides that are explicitly marked.

Avoid repeating shell/layout rules already owned by `styles.rebuild.css`.

## Cleanup Rules

- Remove a CSS class only after checking `index.html`, `js/`, and generated HTML
  strings.
- Treat `bp-*`, `mf-*`, `rr-*`, `pl-*`, `kb-*`, and many `zr-*` classes as
  dynamic-risk classes unless usage is obvious.
- Prefer tokens for repeated stable values such as common radii, gaps, focus
  rings, and shadows.
- Do not use `!important` unless the rule is a documented responsive escape
  hatch.
- Keep mobile rules grouped and explain any layout override that intentionally
  changes desktop behavior.

## Current Known Risks

- Some classes are generated dynamically in JavaScript, so a simple text search
  can mark active classes as unused.
- `theme.css` still contains a few intentional overrides because it is loaded
  last.
- A small number of `!important` rules remain for responsive layout constraints.

## Release Check

Run this before publishing CSS/PWA/static asset changes:

```bash
node tools/production-smoke-check.js
```

The check verifies:

- local files referenced from `index.html`;
- local assets referenced through CSS `url(...)`;
- static files listed in `sw.js`;
- CSS variables used through `var(...)`.

It also prints current CSS and base JS size totals.
