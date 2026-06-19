-- ZA RAMKI RLS hardening draft.
-- Date: 2026-06-18
--
-- This migration is intentionally conservative and must be reviewed in
-- Supabase SQL Editor before production use.
--
-- Plain language model:
-- - allowlist decides who is admin/staff.
-- - staff/admin can read and operate day-to-day workspace data.
-- - only admin can create tasks, edit task visibility, or assign performers.
-- - admin-only areas stay admin-only: allowlist, knowledge-base writes,
--   project deletion, task archiving.
-- - user-owned rows stay user-owned: push subscriptions, personal checklist
--   instances, own comments.
--
-- Do not apply together with unrelated schema changes.

begin;

-- ---------------------------------------------------------------------------
-- Helpers used by policies
-- ---------------------------------------------------------------------------
-- Existing functions expected:
-- - public.is_admin()
-- - public.is_staff()
-- - public.get_role()

-- Staff must not be able to assign performers even by calling RPC directly.
-- These functions are SECURITY DEFINER, so RLS alone is not enough here.
create or replace function public.set_task_assignee(
  p_task_id uuid,
  p_assignee_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_task public.tasks%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select *
    into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  update public.tasks
     set assignee_id = p_assignee_id,
         updated_at = now()
   where id = p_task_id;

  if coalesce(v_task.assignee_id::text,'')
     is distinct from coalesce(p_assignee_id::text,'') then
    perform public.log_task_activity(
      p_task_id,
      'assignment_change',
      '',
      jsonb_build_object(
        'from_assignee_id', v_task.assignee_id,
        'to_assignee_id', p_assignee_id
      )
    );
  end if;
end;
$function$;

create or replace function public.set_task_primary_assignee(
  p_task_id uuid,
  p_assignee_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_task public.tasks%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select *
    into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  update public.tasks
     set assignee_id = p_assignee_id,
         updated_at = now()
   where id = p_task_id;

  if p_assignee_id is not null then
    insert into public.task_assignees(task_id, user_id)
    values (p_task_id, p_assignee_id)
    on conflict (task_id, user_id) do nothing;
  end if;

  if coalesce(v_task.assignee_id::text,'')
     is distinct from coalesce(p_assignee_id::text,'') then
    perform public.log_task_activity(
      p_task_id,
      'assignment_change',
      '',
      jsonb_build_object(
        'from_assignee_id', v_task.assignee_id,
        'to_assignee_id', p_assignee_id
      )
    );
  end if;
end;
$function$;

create or replace function public.can_read_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        public.is_admin()
        or (
          public.is_staff()
          and coalesce(t.role, 'all') = 'all'
        )
        or (
          public.is_staff()
          and coalesce(t.role, 'all') = 'staff'
          and (
            t.assignee_id = auth.uid()
            or exists (
              select 1
              from public.task_assignees ta
              where ta.task_id = t.id
                and ta.user_id = auth.uid()
            )
          )
        )
      )
  );
$function$;

create or replace function public.log_task_activity(
  p_task_id uuid,
  p_type text,
  p_body text default ''::text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid;
  v_id uuid;
begin
  if not public.can_read_task(p_task_id) then
    raise exception 'Not allowed';
  end if;

  if p_type not in ('comment','status_change','assignment_change','system') then
    raise exception 'invalid activity type';
  end if;

  v_actor := auth.uid();

  if v_actor is not null and not exists (
    select 1
    from public.profiles
    where id = v_actor
  ) then
    v_actor := null;
  end if;

  insert into public.task_activity(
    task_id,
    actor_id,
    type,
    body,
    payload
  )
  values (
    p_task_id,
    v_actor,
    p_type,
    coalesce(p_body,''),
    coalesce(p_payload,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.add_task_comment(
  p_task_id uuid,
  p_body text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_comment_id uuid;
begin
  if not public.can_read_task(p_task_id) then
    raise exception 'Not allowed';
  end if;

  if coalesce(trim(p_body),'') = '' then
    raise exception 'Empty comment';
  end if;

  insert into public.task_comments (
    task_id,
    author_id,
    body
  )
  values (
    p_task_id,
    auth.uid(),
    trim(p_body)
  )
  returning id into v_comment_id;

  perform public.log_task_activity(
    p_task_id,
    'comment',
    '',
    jsonb_build_object(
      'comment_id', v_comment_id
    )
  );

  return true;
end;
$function$;

create or replace function public.set_task_status(
  p_task_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_task public.tasks%rowtype;
  v_status text := lower(p_new_status);
begin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;

  select *
    into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  if public.is_admin() then
    update public.tasks
       set status = v_status,
           updated_at = now()
     where id = p_task_id;

    if coalesce(v_task.status,'') is distinct from v_status then
      perform public.log_task_activity(
        p_task_id,
        'status_change',
        '',
        jsonb_build_object(
          'from', v_task.status,
          'to', v_status
        )
      );
    end if;

    return;
  end if;

  if not public.can_read_task(p_task_id) then
    raise exception 'Not allowed';
  end if;

  if v_task.start_date is not null
     and v_task.start_date > current_date then
    raise exception 'Task not yet published';
  end if;

  if v_task.archived_at is not null then
    raise exception 'Task is archived';
  end if;

  if v_status in ('canceled') then
    raise exception 'Staff cannot cancel task';
  end if;

  if v_status not in ('new','taken','in_progress','problem','done') then
    raise exception 'Invalid status';
  end if;

  if v_task.status = 'new'
     and v_status not in ('new','taken') then
    raise exception 'Invalid transition from new';
  end if;

  if v_task.status = 'taken'
     and v_status not in ('taken','in_progress','problem') then
    raise exception 'Invalid transition from taken';
  end if;

  if v_task.status = 'in_progress'
     and v_status not in ('in_progress','problem','done') then
    raise exception 'Invalid transition from in_progress';
  end if;

  if v_task.status = 'problem'
     and v_status not in ('problem','in_progress') then
    raise exception 'Invalid transition from problem';
  end if;

  if v_task.status = 'done'
     and v_status <> 'done' then
    raise exception 'Cannot modify completed task';
  end if;

  update public.tasks
     set status = v_status,
         updated_at = now()
   where id = p_task_id;

  if coalesce(v_task.status,'') is distinct from v_status then
    perform public.log_task_activity(
      p_task_id,
      'status_change',
      '',
      jsonb_build_object(
        'from', v_task.status,
        'to', v_status
      )
    );
  end if;
end;
$function$;

create or replace function public.set_task_checklist_done(
  p_item_id uuid,
  p_done boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_task_id uuid;
  v_task record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select task_id
    into v_task_id
  from public.task_checklist_items
  where id = p_item_id;

  if v_task_id is null then
    raise exception 'Checklist item not found';
  end if;

  if not public.can_read_task(v_task_id) then
    raise exception 'Not allowed';
  end if;

  select id, status, start_date, archived_at
    into v_task
  from public.tasks
  where id = v_task_id;

  if v_task.id is null then
    raise exception 'Task not found';
  end if;

  if v_task.archived_at is not null then
    raise exception 'Task archived';
  end if;

  if not public.is_admin()
     and v_task.start_date is not null
     and v_task.start_date > current_date then
    raise exception 'Task not published yet';
  end if;

  update public.task_checklist_items
  set
    done = p_done,
    done_at = case when p_done then now() else null end
  where id = p_item_id;

  if not found then
    raise exception 'Update blocked';
  end if;

  if v_task.status = 'taken' then
    perform public.set_task_status(v_task_id, 'in_progress');
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- allowlist
-- ---------------------------------------------------------------------------
alter table public.allowlist enable row level security;

drop policy if exists allowlist_admin_delete on public.allowlist;
drop policy if exists allowlist_admin_insert on public.allowlist;
drop policy if exists allowlist_admin_select on public.allowlist;
drop policy if exists allowlist_admin_update on public.allowlist;

create policy allowlist_admin_select
on public.allowlist
for select
to authenticated
using (public.is_admin());

create policy allowlist_admin_insert
on public.allowlist
for insert
to authenticated
with check (public.is_admin());

create policy allowlist_admin_update
on public.allowlist
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy allowlist_admin_delete
on public.allowlist
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles
-- Staff needs profile lists for assignees and comment authors.
-- Non-staff authenticated users can only see/update their own profile.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_all_auth on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_staff_or_own
on public.profiles
for select
to authenticated
using (
  public.is_staff()
  or auth.uid() = id
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Knowledge base
-- Articles use status = 'published'.
-- Templates/checklists use published = true.
-- Admin can see drafts and write. Staff can read published content.
-- ---------------------------------------------------------------------------
alter table public.kb_articles enable row level security;
alter table public.kb_templates enable row level security;
alter table public.kb_checklists enable row level security;

drop policy if exists kb_articles_delete_admin on public.kb_articles;
drop policy if exists kb_articles_insert_auth on public.kb_articles;
drop policy if exists kb_articles_select_auth on public.kb_articles;
drop policy if exists kb_articles_update_auth on public.kb_articles;

drop policy if exists kb_templates_admin_delete on public.kb_templates;
drop policy if exists kb_templates_admin_insert on public.kb_templates;
drop policy if exists kb_templates_admin_update on public.kb_templates;
drop policy if exists kb_templates_select_published on public.kb_templates;

drop policy if exists kb_checklists_admin_delete on public.kb_checklists;
drop policy if exists kb_checklists_admin_insert on public.kb_checklists;
drop policy if exists kb_checklists_admin_update on public.kb_checklists;
drop policy if exists kb_checklists_select_published on public.kb_checklists;

create policy kb_articles_select_staff_published_or_admin
on public.kb_articles
for select
to authenticated
using (
  public.is_admin()
  or (public.is_staff() and status = 'published')
);

create policy kb_articles_admin_insert
on public.kb_articles
for insert
to authenticated
with check (public.is_admin());

create policy kb_articles_admin_update
on public.kb_articles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy kb_articles_admin_delete
on public.kb_articles
for delete
to authenticated
using (public.is_admin());

create policy kb_templates_select_staff_published_or_admin
on public.kb_templates
for select
to authenticated
using (
  public.is_admin()
  or (public.is_staff() and published = true)
);

create policy kb_templates_admin_insert
on public.kb_templates
for insert
to authenticated
with check (public.is_admin());

create policy kb_templates_admin_update
on public.kb_templates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy kb_templates_admin_delete
on public.kb_templates
for delete
to authenticated
using (public.is_admin());

create policy kb_checklists_select_staff_published_or_admin
on public.kb_checklists
for select
to authenticated
using (
  public.is_admin()
  or (public.is_staff() and published = true)
);

create policy kb_checklists_admin_insert
on public.kb_checklists
for insert
to authenticated
with check (public.is_admin());

create policy kb_checklists_admin_update
on public.kb_checklists
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy kb_checklists_admin_delete
on public.kb_checklists
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Projects
-- Staff can work with projects. Deletion is admin-only because it is destructive.
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists projects_delete_auth on public.projects;
drop policy if exists projects_insert_auth on public.projects;
drop policy if exists projects_select_auth on public.projects;
drop policy if exists projects_update_auth on public.projects;

create policy projects_staff_select
on public.projects
for select
to authenticated
using (public.is_staff());

create policy projects_staff_insert
on public.projects
for insert
to authenticated
with check (public.is_staff());

create policy projects_staff_update
on public.projects
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy projects_admin_delete
on public.projects
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Project comments
-- Staff can read/add comments. Authors and admins can soft-delete by update.
-- ---------------------------------------------------------------------------
alter table public.project_comments enable row level security;

drop policy if exists "Users can update own project comments" on public.project_comments;
drop policy if exists project_comments_insert on public.project_comments;
drop policy if exists project_comments_select on public.project_comments;

create policy project_comments_staff_select
on public.project_comments
for select
to authenticated
using (public.is_staff());

create policy project_comments_staff_insert
on public.project_comments
for insert
to authenticated
with check (
  public.is_staff()
  and author_id = auth.uid()
);

create policy project_comments_author_or_admin_update
on public.project_comments
for update
to authenticated
using (
  public.is_admin()
  or (public.is_staff() and author_id = auth.uid())
)
with check (
  public.is_admin()
  or (public.is_staff() and author_id = auth.uid())
);

-- No hard DELETE policy for project_comments.
-- The app uses soft delete by setting deleted_at.

-- ---------------------------------------------------------------------------
-- Tasks
-- Staff can read work, but task creation, direct task editing, visibility
-- changes, and assignee changes are admin-only. Staff status transitions still
-- go through public.set_task_status(), which has its own business rules.
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;

drop policy if exists tasks_insert_auth on public.tasks;
drop policy if exists tasks_select_auth on public.tasks;
drop policy if exists tasks_update_auth on public.tasks;

create policy tasks_staff_select
on public.tasks
for select
to authenticated
using (public.can_read_task(id));

create policy tasks_admin_insert
on public.tasks
for insert
to authenticated
with check (public.is_admin());

create policy tasks_admin_update
on public.tasks
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Task activity
-- Activity should be append-only for staff. Updates/deletes are not needed by
-- the current client.
-- ---------------------------------------------------------------------------
alter table public.task_activity enable row level security;

drop policy if exists task_activity_insert_auth on public.task_activity;
drop policy if exists task_activity_select_auth on public.task_activity;
drop policy if exists task_activity_update_auth on public.task_activity;

create policy task_activity_staff_select
on public.task_activity
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_activity_staff_insert
on public.task_activity
for insert
to authenticated
with check (public.can_read_task(task_id));

-- ---------------------------------------------------------------------------
-- Task assignees
-- Staff can see who is assigned. Only admin can change performers.
-- ---------------------------------------------------------------------------
alter table public.task_assignees enable row level security;

drop policy if exists task_assignees_delete_admin on public.task_assignees;
drop policy if exists task_assignees_insert_auth on public.task_assignees;
drop policy if exists task_assignees_select_auth on public.task_assignees;
drop policy if exists task_assignees_update_auth on public.task_assignees;

create policy task_assignees_staff_select
on public.task_assignees
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_assignees_admin_insert
on public.task_assignees
for insert
to authenticated
with check (public.is_admin());

create policy task_assignees_admin_update
on public.task_assignees
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy task_assignees_admin_delete
on public.task_assignees
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Task checklists and checklist items
-- Staff can attach/maintain checklist content inside tasks.
-- ---------------------------------------------------------------------------
alter table public.task_checklists enable row level security;
alter table public.task_checklist_items enable row level security;

drop policy if exists task_checklists_insert_auth on public.task_checklists;
drop policy if exists task_checklists_select_auth on public.task_checklists;
drop policy if exists task_checklists_update_auth on public.task_checklists;

drop policy if exists task_checklist_items_delete_admin on public.task_checklist_items;
drop policy if exists task_checklist_items_insert_auth on public.task_checklist_items;
drop policy if exists task_checklist_items_select_auth on public.task_checklist_items;
drop policy if exists task_checklist_items_update_auth on public.task_checklist_items;

create policy task_checklists_staff_select
on public.task_checklists
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_checklists_staff_insert
on public.task_checklists
for insert
to authenticated
with check (public.can_read_task(task_id));

create policy task_checklists_staff_update
on public.task_checklists
for update
to authenticated
using (public.can_read_task(task_id))
with check (public.can_read_task(task_id));

create policy task_checklists_staff_delete
on public.task_checklists
for delete
to authenticated
using (public.can_read_task(task_id));

create policy task_checklist_items_staff_select
on public.task_checklist_items
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_checklist_items_staff_insert
on public.task_checklist_items
for insert
to authenticated
with check (public.can_read_task(task_id));

create policy task_checklist_items_staff_update
on public.task_checklist_items
for update
to authenticated
using (public.can_read_task(task_id))
with check (public.can_read_task(task_id));

create policy task_checklist_items_staff_delete
on public.task_checklist_items
for delete
to authenticated
using (public.can_read_task(task_id));

-- ---------------------------------------------------------------------------
-- Task comments
-- Staff can read/add comments. Authors and admins can soft-delete by update.
-- The add_task_comment() RPC already writes author_id = auth.uid().
-- ---------------------------------------------------------------------------
alter table public.task_comments enable row level security;

drop policy if exists task_comments_insert_auth on public.task_comments;
drop policy if exists task_comments_select_auth on public.task_comments;
drop policy if exists task_comments_update_auth on public.task_comments;

create policy task_comments_staff_select
on public.task_comments
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_comments_staff_insert
on public.task_comments
for insert
to authenticated
with check (
  public.can_read_task(task_id)
  and author_id = auth.uid()
);

create policy task_comments_author_or_admin_update
on public.task_comments
for update
to authenticated
using (
  public.is_admin()
  or (public.can_read_task(task_id) and author_id = auth.uid())
)
with check (
  public.is_admin()
  or (public.can_read_task(task_id) and author_id = auth.uid())
);

-- No hard DELETE policy for task_comments.
-- The app uses soft delete by setting deleted_at.

-- ---------------------------------------------------------------------------
-- Task files and links
-- Staff can attach/read/update/remove task links and file metadata.
-- Storage bucket rules still need a separate storage policy review.
-- ---------------------------------------------------------------------------
alter table public.task_files enable row level security;
alter table public.task_links enable row level security;

drop policy if exists task_files_insert_auth on public.task_files;
drop policy if exists task_files_select_auth on public.task_files;
drop policy if exists task_files_update_auth on public.task_files;

drop policy if exists task_links_delete_auth on public.task_links;
drop policy if exists task_links_insert_auth on public.task_links;
drop policy if exists task_links_select_auth on public.task_links;
drop policy if exists task_links_update_auth on public.task_links;

create policy task_files_staff_select
on public.task_files
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_files_staff_insert
on public.task_files
for insert
to authenticated
with check (public.can_read_task(task_id));

create policy task_files_staff_update
on public.task_files
for update
to authenticated
using (public.can_read_task(task_id))
with check (public.can_read_task(task_id));

create policy task_files_staff_delete
on public.task_files
for delete
to authenticated
using (public.can_read_task(task_id));

create policy task_links_staff_select
on public.task_links
for select
to authenticated
using (public.can_read_task(task_id));

create policy task_links_staff_insert
on public.task_links
for insert
to authenticated
with check (public.can_read_task(task_id));

create policy task_links_staff_update
on public.task_links
for update
to authenticated
using (public.can_read_task(task_id))
with check (public.can_read_task(task_id));

create policy task_links_staff_delete
on public.task_links
for delete
to authenticated
using (public.can_read_task(task_id));

-- ---------------------------------------------------------------------------
-- Checklist instances
-- Personal checklist rows are visible/editable to their owner and admin.
-- Task-scoped checklist rows are visible/editable to staff because they are part
-- of shared task work.
-- ---------------------------------------------------------------------------
alter table public.checklist_instances enable row level security;

drop policy if exists checklist_instances_insert_auth on public.checklist_instances;
drop policy if exists checklist_instances_select_auth on public.checklist_instances;
drop policy if exists checklist_instances_update_auth on public.checklist_instances;

create policy checklist_instances_staff_or_owner_select
on public.checklist_instances
for select
to authenticated
using (
  public.is_admin()
  or auth.uid() = user_id
  or (task_id is not null and public.can_read_task(task_id))
);

create policy checklist_instances_staff_or_owner_insert
on public.checklist_instances
for insert
to authenticated
with check (
  public.is_admin()
  or auth.uid() = user_id
  or (task_id is not null and public.can_read_task(task_id))
);

create policy checklist_instances_staff_or_owner_update
on public.checklist_instances
for update
to authenticated
using (
  public.is_admin()
  or auth.uid() = user_id
  or (task_id is not null and public.can_read_task(task_id))
)
with check (
  public.is_admin()
  or auth.uid() = user_id
  or (task_id is not null and public.can_read_task(task_id))
);

-- No hard DELETE policy for checklist_instances until the product needs it.

-- ---------------------------------------------------------------------------
-- Push subscriptions
-- Keep strict owner-only access. This was already mostly correct.
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

drop policy if exists push_delete_own on public.push_subscriptions;
drop policy if exists push_insert_own on public.push_subscriptions;
drop policy if exists push_select_own on public.push_subscriptions;
drop policy if exists push_update_own on public.push_subscriptions;

create policy push_select_own
on public.push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy push_insert_own
on public.push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy push_update_own
on public.push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy push_delete_own
on public.push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

commit;
