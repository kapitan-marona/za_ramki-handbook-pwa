---
name: release-check
description: Pre-release verification workflow for ZA RAMKI Handbook. Use before publishing/deploying, after a batch of changes, or when the user asks to check readiness, release risk, changed files, migrations, smoke tests, or deployment order. Do not use while adding new feature scope.
---

# Release Check

## Workflow

1. Review changed files and separate user-existing changes from new changes.
2. Check whether SQL migrations, Supabase functions, service worker, manifest,
   versioning, or cached assets are affected.
3. Identify critical smoke flows to verify.
4. Run available checks or explain why a check cannot be run.
5. Summarize release blockers, warnings, and safe-to-ship notes.

## Smoke Flow Ideas

- Login and role gate.
- Open Planner.
- Open a task detail.
- Open Projects and project detail.
- Admin-only section visibility.
- Push notification toggle if push code changed.
- Article/template rendering if knowledge-base code changed.

## Output

Use: blockers, warnings, checks performed, changed areas, and release
recommendation.
