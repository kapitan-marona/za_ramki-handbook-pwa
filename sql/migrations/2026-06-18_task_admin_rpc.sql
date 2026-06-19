-- ZA RAMKI task admin RPC.
-- Date: 2026-06-18
--
-- Task creation and direct task editing are admin-only operations.
-- Use SECURITY DEFINER RPCs so the client does not depend on direct table
-- INSERT/UPDATE policies for public.tasks.

begin;

create or replace function public.create_task_admin(
  p_title text,
  p_body text default '',
  p_start_date date default current_date,
  p_due_date date default null,
  p_project_id uuid default null,
  p_role text default 'all',
  p_urgency text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_role text := coalesce(nullif(trim(p_role), ''), 'all');
  v_urgency text := coalesce(nullif(trim(p_urgency), ''), 'normal');
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  if v_title = '' then
    raise exception 'Task title is required';
  end if;

  if v_role not in ('admin', 'all', 'staff') then
    raise exception 'Invalid task visibility';
  end if;

  insert into public.tasks (
    title,
    body,
    status,
    start_date,
    due_date,
    project_id,
    role,
    urgency
  )
  values (
    v_title,
    coalesce(p_body, ''),
    'new',
    coalesce(p_start_date, current_date),
    p_due_date,
    p_project_id,
    v_role,
    v_urgency
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.update_task_admin(
  p_task_id uuid,
  p_title text,
  p_body text default '',
  p_start_date date default null,
  p_due_date date default null,
  p_project_id uuid default null,
  p_role text default 'all',
  p_urgency text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_role text := coalesce(nullif(trim(p_role), ''), 'all');
  v_urgency text := coalesce(nullif(trim(p_urgency), ''), 'normal');
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  if p_task_id is null then
    raise exception 'Task id is required';
  end if;

  if v_title = '' then
    raise exception 'Task title is required';
  end if;

  if v_role not in ('admin', 'all', 'staff') then
    raise exception 'Invalid task visibility';
  end if;

  update public.tasks
  set
    title = v_title,
    body = coalesce(p_body, ''),
    start_date = p_start_date,
    due_date = p_due_date,
    project_id = p_project_id,
    role = v_role,
    urgency = v_urgency,
    updated_at = now()
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  return p_task_id;
end;
$function$;

grant execute on function public.create_task_admin(
  text,
  text,
  date,
  date,
  uuid,
  text,
  text
) to authenticated;

grant execute on function public.update_task_admin(
  uuid,
  text,
  text,
  date,
  date,
  uuid,
  text,
  text
) to authenticated;

notify pgrst, 'reload schema';

commit;
