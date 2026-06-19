---
name: bugfix
description: Narrow workflow for fixing a concrete bug in the ZA RAMKI Handbook. Use when the user reports broken behavior, an error, a regression, incorrect data, failed UI interaction, or a specific scenario that should work differently. Do not use for broad refactors, redesigns, or feature discovery.
---

# Bugfix

## Workflow

1. Restate the broken behavior and expected behavior.
2. Inspect the smallest relevant path from UI entry point to data layer.
3. Identify the likely cause before editing.
4. Patch only the files needed for the bug.
5. Preserve unrelated user changes and existing style.
6. Verify the reported scenario with the best available local check.
7. Report cause, fix, verification, and any remaining risk.

## Project Checks

- For planner bugs, start with `js/views/planner.js`, then the relevant
  `js/planner/` module and `js/services/zr_backend.js`.
- For project-detail bugs, start with `js/views/projects.js`.
- For auth/role bugs, inspect `js/app.js`, `js/utils/supabase_client.js`,
  `js/services/zr_backend.js`, and relevant SQL policies/RPCs.
- For rendering bugs, check escaping and stale async DOM updates.

## Output

Keep the final answer short: what was broken, what changed, how it was checked,
and what risk remains.
