# ZA RAMKI Pre-Production Checklist

This checklist is for the last manual pass before giving the app to real users.

## 1. Static Release Check

Run:

```bash
node tools/production-smoke-check.js
```

Expected result:

```text
OK: no missing local assets or CSS variables.
```

Also run syntax checks for recently changed JavaScript files, for example:

```bash
node --check js/app.js
node --check sw.js
```

## 2. Visual Smoke-Test

Check desktop and mobile width:

- `#/planner`
- open a Planner task
- `#/projects`
- open a project
- `#/articles`
- open an article
- `#/templates`
- open a template
- `#/checklists` as admin
- `#/admin` as admin

Check that:

- text does not overlap;
- action buttons are in the expected top-right area;
- comments background renders;
- dialogs and panels fit on mobile;
- no important buttons disappear.

## 3. Role Checks

### Admin

Admin should be able to:

- see the Admin tab;
- open `#/admin`;
- see the Checklists tab;
- open `#/checklists`;
- create/edit admin-managed content according to current product rules.

### Staff

Staff should be able to:

- open Planner;
- open Projects;
- open Articles;
- open Templates;
- use available task/project actions allowed by backend policies.

Staff should not be able to:

- see the Admin tab;
- open `#/admin`;
- see the Checklists tab;
- open `#/checklists` directly.

### User Without Role

A logged-in user without an assigned role should not enter the working app.
The login flow should show that access is not assigned.

## 4. Supabase / Backend Checks

Confirm in Supabase that RLS policies protect data on the server side.
Frontend route gates improve UX, but they are not a security boundary.

Read `SUPABASE_RLS_AUDIT.md` before changing policies.
Draft hardening migration: `sql/migrations/2026-06-18_rls_hardening_draft.sql`.
Manual verification plan: `RLS_MIGRATION_TEST_PLAN.md`.
Read-only SQL checks: `sql/checks/2026-06-18_rls_preflight_checks.sql`.

Do not apply the draft RLS migration to production until the admin/staff checks
from the test plan pass.

Check policies for:

- tasks;
- projects;
- comments;
- files;
- knowledge base articles;
- templates;
- checklists;
- admin tables;
- push subscriptions.

## 5. Network / Russia Access Risk

Current production access still depends on Supabase.
If Supabase is not reachable from the user's network, login and data loading can fail.

Before public use in Russia, decide on one of these paths:

- temporary VPN requirement for internal users;
- Russian-hosted API proxy;
- full backend/database migration to Russian infrastructure.

## 6. Known Technical Risks

- `js/utils/planner_push_sender.js` still has a direct Supabase Functions URL.
  This is intentionally deferred to the end of the current production plan.
  It should move behind the backend adapter before migration away from Supabase.
- The old `profiles.role = 'satff'` typo was corrected to `staff` in Supabase
  after the RLS smoke-test.
- Some CSS classes are generated dynamically and should not be removed based on
  a simple text search.
- Visual testing currently depends on manual Chrome checks because the in-app
  browser is blocked by the Windows environment.
