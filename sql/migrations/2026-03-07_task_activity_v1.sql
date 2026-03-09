begin;

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid null references public.profiles(id) on delete set null,
  type text not null,
  body text null default ''::text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint task_activity_type_check
    check (type in ('comment', 'status_change', 'assignment_change', 'system'))
);

create index if not exists idx_task_activity_task_created
  on public.task_activity(task_id, created_at desc);

create index if not exists idx_task_activity_type_created
  on public.task_activity(type, created_at desc);

create index if not exists idx_task_activity_actor_created
  on public.task_activity(actor_id, created_at desc);

create index if not exists idx_task_activity_payload_gin
  on public.task_activity using gin (payload);

alter table public.task_activity enable row level security;

drop policy if exists task_activity_select_staff on public.task_activity;
create policy task_activity_select_staff
  on public.task_activity
  for select
  to public
  using (public.is_staff());

drop policy if exists task_activity_write_admin on public.task_activity;
create policy task_activity_write_admin
  on public.task_activity
  for all
  to public
  using (public.is_admin())
  with check (public.is_admin());

commit;
