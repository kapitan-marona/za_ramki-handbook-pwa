# Supabase RLS Audit

Date: 2026-06-18

This audit is based on exported structure files under `sql/Migration/`, not on
live user data.

Additional safe checks from Supabase SQL exports confirmed:

- `tasks.role = 'admin'` means admin-only task.
- `tasks.role = 'all'` means visible to staff/admin.
- `tasks.role = 'staff'` means visible to assigned performers.
- Current `staff` tasks all have at least one row in `task_assignees`.
- Current `tasks.assignee_id` is empty for all tasks, so performer checks must
  use `task_assignees`, not only `tasks.assignee_id`.

## Postflight After RLS Hardening

Applied on: 2026-06-18

Postflight checks confirmed:

- broad `true` policies are empty for the checked application tables;
- RLS is enabled on all 17 checked public application tables;
- `can_read_task` exists;
- protected RPC functions are `security definer` and use `search_path=public`;
- `set_task_checklist_done` now also has `search_path=public`.

Admin role hotfix:

- Applied after postflight because admin UI became empty while staff worked.
- Root cause: some `profiles.role` values use UI labels such as `Админ`, while
  RLS expects technical values such as `admin`.
- `get_role()` now keeps `allowlist` as the primary source and falls back to
  normalized `profiles.role` by `auth.uid()`.
- Admin access was manually rechecked successfully after the hotfix.

Follow-up data cleanup:

- The existing `profiles.role = 'satff'` typo was corrected to `staff` in
  Supabase and rechecked successfully.

## Plain Summary

RLS means "Row Level Security". In simple words, it is the database-level lock
that decides which rows a user can read, create, edit, or delete.

Frontend checks are helpful for UX, but they are not enough for security. If a
user can call the database directly, RLS is what protects the data.

Current state:

- admin-only areas exist for some tables;
- push subscriptions are correctly scoped to the current user;
- many core work tables are still broad: any authenticated user can read or
  update too much.

## Stronger Areas

These policies look directionally good:

- `allowlist`: admin-only select/insert/update/delete.
- `kb_templates`: published content can be read; writes are admin-only.
- `kb_checklists`: published content can be read; writes are admin-only.
- `push_subscriptions`: users can only select/insert/update/delete their own
  subscription rows.
- `public_requests`: anonymous insert is expected if this is a public request
  intake table.

## Main Risks Before Production

### 1. Core task/project tables are too open

These tables have policies with `USING true` or `WITH CHECK true` for
authenticated users:

- `tasks`
- `projects`
- `task_activity`
- `task_assignees`
- `task_checklist_items`
- `task_checklists`
- `task_comments`
- `task_files`
- `task_links`
- `checklist_instances`

Simple meaning: any logged-in user may be able to read and/or change rows that
should probably be limited by role, project membership, assignee, author, or
admin status.

This is the highest security item before broader production use.

### 2. `projects` delete is open to all authenticated users

Current policy:

- `projects_delete_auth`
- `DELETE`
- `USING true`

Simple meaning: any logged-in user may be able to delete projects.

Recommended direction: make project delete admin-only.

### 3. `task_links` delete is open to all authenticated users

Current policy:

- `task_links_delete_auth`
- `DELETE`
- `USING true`

Simple meaning: any logged-in user may be able to delete any task link.

Recommended direction: restrict by admin, author, task owner, or project role.

### 4. `kb_articles` writes are broad

Current policies include:

- insert with `WITH CHECK true`;
- update with `USING true` and `WITH CHECK true`;
- select with `USING true`;
- delete admin-only.

Simple meaning: any authenticated user may be able to insert or edit knowledge
base articles.

Recommended direction: match `kb_templates` and `kb_checklists`: published read
for staff, admin-only writes.

### 5. `profiles_select_all_auth` allows all users to read all profiles

This may be acceptable for an internal employee directory, but it should be an
intentional product decision.

Recommended direction: keep only if the team directory is meant to be visible
to all authenticated staff.

### 6. Policies using `{public}` deserve review

Tables with `{public}` policies:

- `checklist_template_items`
- `checklist_templates`
- `project_comments`
- `project_links`

Some of these still check `is_staff()` or `auth.role() = 'authenticated'`, so
they may be functionally safe. But for readability and future migration, prefer
using explicit `authenticated` role where anonymous access is not intended.

## Suggested Production Direction

### Minimum Before Wider Use

1. Make destructive actions admin-only unless there is a clear owner rule:
   - project delete;
   - task delete/archive if exposed;
   - link delete;
   - file delete;
   - checklist/template/admin content delete.

2. Make knowledge-base writes admin-only:
   - `kb_articles`;
   - `kb_templates`;
   - `kb_checklists`;
   - checklist templates/items.

3. Decide task visibility model:
   - all staff sees all tasks;
   - only assignee/project members see tasks;
   - admins see all, staff see assigned/project-related.

4. Decide project visibility model:
   - all staff sees all projects;
   - only project members see project data;
   - admins see all.

5. Restrict comments/links/files:
   - read follows parent task/project access;
   - edit/delete own rows or admin;
   - insert only when user can see parent task/project.

## Manual RLS Checks In Supabase

Create or use three accounts:

- admin;
- staff;
- authenticated user without assigned app role.

Check:

- no-role user cannot read `tasks`;
- no-role user cannot read `projects`;
- no-role user cannot update `kb_articles`;
- staff cannot delete `projects`;
- staff cannot update admin-only KB/template/checklist content;
- staff cannot edit another user's comment if ownership should matter;
- staff cannot delete another user's task links/files if ownership should
  matter;
- admin can perform expected admin actions.

## SQL Migration Recommendation

Do not apply a broad RLS rewrite blindly. First confirm desired business rules:

- should all staff see all tasks?
- should all staff edit all tasks?
- are projects private by department/team?
- who can edit instructions/templates/checklists?
- who can delete comments/files/links?

After that, create a focused RLS migration and test it with the three account
types above.

## Deferred Item

The direct Supabase Functions URL in `js/utils/planner_push_sender.js` is
intentionally deferred to the end of the production plan. It should be moved
behind the backend adapter before migrating away from Supabase.
