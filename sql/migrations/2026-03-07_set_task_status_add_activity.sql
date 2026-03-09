create or replace function public.set_task_status(p_task_id uuid, p_new_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $
declare
  v_task public.tasks%rowtype;
  v_status text := lower(p_new_status);
begin
  -- 1. Должен быть staff или admin
  if not public.is_staff() then
    raise exception 'Not allowed';
  end if;

  -- 2. Получаем задачу
  select *
    into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  -- 3. Admin может всё
  if public.is_admin() then
    update public.tasks
       set status = v_status,
           updated_at = now()
     where id = p_task_id;

    if coalesce(v_task.status, '') is distinct from v_status then
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

  -- 4. Проверка видимости для staff
  if v_task.role not in ('staff','all') then
    raise exception 'Staff cannot access this task';
  end if;

  if v_task.start_date is not null
     and v_task.start_date > current_date then
    raise exception 'Task not yet published';
  end if;

  if v_task.archived_at is not null then
    raise exception 'Task is archived';
  end if;

  if v_task.assignee_id is not null
     and v_task.assignee_id <> auth.uid() then
    raise exception 'Not your task';
  end if;

  -- 5. Запрещаем опасные статусы staff
  if v_status in ('canceled') then
    raise exception 'Staff cannot cancel task';
  end if;

  -- 6. Проверка допустимых статусов
  if v_status not in ('new','taken','in_progress','problem','done') then
    raise exception 'Invalid status';
  end if;

  -- 7. Правила переходов
  if v_task.status = 'new'
     and v_status not in ('new','taken') then
    raise exception 'Invalid transition from new';
  end if;

  if v_task.status = 'taken'
     and v_status not in ('taken','in_progress') then
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

  -- 8. Всё ок → обновляем
  update public.tasks
     set status = v_status,
         updated_at = now()
   where id = p_task_id;

  if coalesce(v_task.status, '') is distinct from v_status then
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
$;
