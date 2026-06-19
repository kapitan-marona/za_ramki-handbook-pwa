---
name: frontend-change
description: UI and frontend workflow for the ZA RAMKI Handbook. Use for visual layout, responsive behavior, DOM rendering, interaction states, Russian interface copy, and browser-facing changes in index.html, stylesheets, js/views, js/planner, or js/utils. Do not use for pure SQL/backend work.
---

# Frontend Change

## Workflow

1. Inspect the existing screen and nearby UI pattern before editing.
2. Reuse current classes, global objects, and plain JavaScript style.
3. Keep Russian UI text consistent with the app's tone.
4. Escape dynamic HTML with existing `esc` helpers.
5. Avoid introducing new dependencies unless the user asks.
6. Check desktop/mobile risk when layout changes.
7. Verify that text does not overlap, overflow badly, or hide controls.

## Project Patterns

- Views render into `#list` and `#viewer`.
- Routes are hash-based via `js/router.js`.
- Section scripts are lazy-loaded in `js/app.js`.
- Planner UI is split across `js/views/planner.js` and `js/planner/`.
- Main styles live in `styles.rebuild.css`, then editorial/color/theme layers.

## Output

Summarize UI behavior changed, files touched, and visual/manual checks
performed.
