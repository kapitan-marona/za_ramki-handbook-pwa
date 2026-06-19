-- Performance indexes for the production PWA rollout.
-- These indexes match the most common read paths in the client:
-- Planner active board, project task lists, task detail sections, and KB article indexes.

create index if not exists idx_tasks_active_due_updated
on public.tasks (due_date asc, updated_at desc)
where archived_at is null;

create index if not exists idx_tasks_project_active_created
on public.tasks (project_id, created_at desc)
where archived_at is null and status <> 'canceled';

create index if not exists idx_tasks_done_active
on public.tasks (status)
where archived_at is null;

create index if not exists idx_task_comments_task_created_active
on public.task_comments (task_id, created_at)
where deleted_at is null;

create index if not exists idx_task_files_task_created
on public.task_files (task_id, created_at);

create index if not exists idx_task_checklist_items_task_pos
on public.task_checklist_items (task_id, pos);

create index if not exists idx_kb_articles_status_updated
on public.kb_articles (status, updated_at desc);
