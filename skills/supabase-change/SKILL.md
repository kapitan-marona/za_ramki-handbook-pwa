---
name: supabase-change
description: Supabase workflow for ZA RAMKI Handbook. Use for database schema, SQL migrations, RLS policies, RPC functions, storage buckets, Supabase auth/roles, Edge Functions, and client data access changes. Do not use for purely visual/frontend-only changes.
---

# Supabase Change

## Workflow

1. Inspect current schema, migrations, policies, and affected client calls.
2. Identify whether the change needs SQL, client code, or both.
3. Preserve real security boundaries in RLS/RPC, not only hidden UI controls.
4. Add a dated migration under `sql/migrations/` when schema/policy changes.
5. Keep data access centralized in `js/services/zr_backend.js` or the relevant
   planner API/data module.
6. Check compatibility with existing records and nullable fields.
7. Report deployment order if SQL and client code must be applied together.

## Safety Rules

- Never add service-role keys to browser code.
- Treat the anon key in `index.html` as public client config.
- Do not invent new status values or roles without updating SQL and UI labels.
- For role behavior, inspect `get_role` and relevant RLS policies/RPCs.

## Output

Return schema/data impact, changed SQL/client files, migration/deployment notes,
and verification performed or still needed.
