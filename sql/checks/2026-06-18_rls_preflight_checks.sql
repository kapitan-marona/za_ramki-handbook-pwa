-- ZA RAMKI RLS preflight and postflight checks.
-- Date: 2026-06-18
--
-- This file is read-only: it does not change data, policies, or functions.
-- Run it in Supabase SQL Editor before applying:
--   sql/migrations/2026-06-18_rls_hardening_draft.sql
--
-- Run the same checks after applying the migration and compare the results.

-- ---------------------------------------------------------------------------
-- 1. Current task visibility values
-- Expected known roles:
-- - admin: admin-only task
-- - all: visible to staff/admin
-- - staff: visible to assigned performers
-- ---------------------------------------------------------------------------
select
  role,
  count(*) as tasks_count
from public.tasks
group by role
order by role;

-- Unknown task visibility values must be empty.
select
  role,
  count(*) as tasks_count
from public.tasks
where coalesce(role, 'all') not in ('admin', 'all', 'staff')
group by role
order by role;

-- Staff-only tasks without assignees must be empty.
-- If rows appear here, these tasks will be invisible to staff after hardening.
select
  t.id,
  t.title
from public.tasks t
where t.role = 'staff'
  and not exists (
    select 1
    from public.task_assignees ta
    where ta.task_id = t.id
  )
order by t.created_at desc nulls last;

-- Task assignee distribution by visibility mode.
select
  t.role,
  count(distinct t.id) as tasks_count,
  count(ta.user_id) as assignee_links_count
from public.tasks t
left join public.task_assignees ta on ta.task_id = t.id
group by t.role
order by t.role;

-- Orphan assignment links should be empty.
select
  ta.task_id,
  ta.user_id
from public.task_assignees ta
left join public.tasks t on t.id = ta.task_id
where t.id is null
order by ta.task_id;

-- ---------------------------------------------------------------------------
-- 2. Role source sanity
-- ---------------------------------------------------------------------------
select
  role,
  enabled,
  count(*) as users_count
from public.allowlist
group by role, enabled
order by role, enabled;

-- Unknown allowlist roles must be empty.
select
  email,
  role,
  enabled
from public.allowlist
where role not in ('admin', 'staff')
order by email;

-- ---------------------------------------------------------------------------
-- 3. Current broad policies before hardening
-- Before migration this should show the risky policies.
-- After migration this should be empty for the listed tables.
-- ---------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'allowlist',
    'profiles',
    'kb_articles',
    'kb_templates',
    'kb_checklists',
    'projects',
    'project_comments',
    'tasks',
    'task_activity',
    'task_assignees',
    'task_checklists',
    'task_checklist_items',
    'task_comments',
    'task_files',
    'task_links',
    'checklist_instances',
    'push_subscriptions'
  )
  and (
    trim(coalesce(qual, '')) = 'true'
    or trim(coalesce(with_check, '')) = 'true'
  )
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 4. RLS enabled check
-- All listed application tables should have relrowsecurity = true.
-- ---------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'allowlist',
    'profiles',
    'kb_articles',
    'kb_templates',
    'kb_checklists',
    'projects',
    'project_comments',
    'tasks',
    'task_activity',
    'task_assignees',
    'task_checklists',
    'task_checklist_items',
    'task_comments',
    'task_files',
    'task_links',
    'checklist_instances',
    'push_subscriptions'
  )
order by c.relname;

-- ---------------------------------------------------------------------------
-- 5. Security definer functions that must exist after hardening
-- After migration all listed functions should exist and be security definer.
-- ---------------------------------------------------------------------------
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin',
    'is_staff',
    'get_role',
    'can_read_task',
    'set_task_assignee',
    'set_task_primary_assignee',
    'log_task_activity',
    'add_task_comment',
    'set_task_status',
    'set_task_checklist_done'
  )
order by p.proname;

-- ---------------------------------------------------------------------------
-- 6. Policy count after hardening
-- After migration this should show the new policy set per table.
-- ---------------------------------------------------------------------------
select
  tablename,
  count(*) as policies_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'allowlist',
    'profiles',
    'kb_articles',
    'kb_templates',
    'kb_checklists',
    'projects',
    'project_comments',
    'tasks',
    'task_activity',
    'task_assignees',
    'task_checklists',
    'task_checklist_items',
    'task_comments',
    'task_files',
    'task_links',
    'checklist_instances',
    'push_subscriptions'
  )
group by tablename
order by tablename;
