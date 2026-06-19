# ZA RAMKI Backend API Contract

Дата: 2026-06-19

## Зачем нужен этот документ

Сейчас приложение работает через Supabase. Чтобы позже заменить Supabase на
российский сервер без переписывания всего интерфейса, нужен понятный контракт.

Контракт - это список действий, которые frontend ожидает от backend:

- войти в систему;
- узнать роль пользователя;
- загрузить задачи;
- создать или изменить задачу;
- загрузить проекты, инструкции, шаблоны, чек-листы;
- сохранить комментарии, ссылки, файлы и push-подписки.

Идея простая: интерфейс не должен знать, где лежат данные. Сегодня это
Supabase, завтра это может быть российский API. Если новый сервер отвечает в
том же формате, PWA продолжит работать.

## Общие правила

- Все запросы, кроме входа, должны идти от авторизованного пользователя.
- Роль пользователя возвращается как нормализованное значение:
  - `admin` - администратор;
  - `staff` - сотрудник;
  - `guest` или пусто - нет доступа.
- Ошибки backend должен отдавать человечески понятными сообщениями, а не
  техническими текстами вроде `row-level security` или `PGRST`.
- Даты лучше отдавать в ISO-формате: `2026-06-19T12:00:00.000Z`.
- Пустой список должен быть `[]`, а не ошибка.
- Если запись не найдена или не видна пользователю, лучше вернуть `null` или
  `404`, в зависимости от endpoint.

## Минимальный стартовый API

Этого достаточно для первого российского backend-прототипа.

### `GET /health`

Проверяет, жив ли сервер.

Ответ:

```json
{
  "ok": true,
  "version": "2026-06-19"
}
```

### `GET /me`

Возвращает текущего пользователя и его роль.

Ответ:

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "Имя",
  "role": "admin"
}
```

### `GET /tasks`

Возвращает активные задачи, которые пользователь имеет право видеть.

Минимальные поля задачи:

```json
[
  {
    "id": "task-id",
    "title": "Название задачи",
    "body": "Описание",
    "status": "new",
    "urgency": "normal",
    "role": "all",
    "project_id": null,
    "project_title": null,
    "assignee_id": null,
    "assignee_ids": [],
    "start_date": "2026-06-19",
    "due_date": "2026-06-20",
    "archived_at": null,
    "created_at": "2026-06-19T12:00:00.000Z",
    "updated_at": "2026-06-19T12:00:00.000Z"
  }
]
```

### `GET /tasks/:id`

Возвращает одну задачу со всеми полями, которые нужны экрану задачи.

Важно: staff видит задачу только если ему разрешено:

- задача назначена на него;
- или задача имеет видимость `all`.

### `POST /tasks`

Создаёт задачу. Только для `admin`.

Тело запроса:

```json
{
  "title": "Название задачи",
  "body": "Описание",
  "start_date": "2026-06-19",
  "due_date": "2026-06-20",
  "project_id": null,
  "role": "all",
  "urgency": "normal"
}
```

Ответ:

```json
{
  "id": "new-task-id"
}
```

### `PATCH /tasks/:id`

Редактирует задачу. Только для `admin`.

### `POST /tasks/:id/status`

Меняет статус задачи.

Тело запроса:

```json
{
  "status": "done"
}
```

Важное правило: проблемную задачу нельзя сразу завершить. Вместо технической
ошибки backend должен вернуть понятный текст:

```json
{
  "error": "Нельзя завершить проблемную задачу, проблема решена?"
}
```

### `POST /tasks/:id/assignees`

Заменяет список исполнителей. Только для `admin`.

Тело запроса:

```json
{
  "user_ids": ["user-id-1", "user-id-2"]
}
```

Staff не может назначать исполнителей и не может менять видимость задачи.

## База знаний

### `GET /articles`

Возвращает опубликованные инструкции для текущей роли.

Минимальные поля:

```json
[
  {
    "id": "article-id",
    "title": "Инструкция",
    "category": "Категория",
    "tags": [],
    "roles": [],
    "updated_at": "2026-06-19T12:00:00.000Z",
    "pinned": false,
    "actions": []
  }
]
```

### `GET /articles/:id`

Возвращает содержимое инструкции.

Поле `content_md` - markdown-текст инструкции.

### `GET /templates`

Возвращает опубликованные шаблоны.

### `GET /checklists`

Возвращает опубликованные чек-листы.

## Проекты

### `GET /projects`

Возвращает список проектов.

### `GET /projects/:id/tasks`

Возвращает активные задачи проекта.

## Комментарии, ссылки, файлы

Эти endpoints можно переносить после задач и базы знаний:

- `GET /tasks/:id/comments`
- `POST /tasks/:id/comments`
- `DELETE /comments/:id`
- `GET /tasks/:id/links`
- `POST /tasks/:id/links`
- `DELETE /task-links/:id`
- `GET /projects/:id/comments`
- `POST /projects/:id/comments`
- `GET /projects/:id/links`
- `POST /projects/:id/links`
- `DELETE /project-links/:id`

## Администрирование

Admin-only endpoints:

- `GET /admin/profiles`
- `GET /admin/allowlist`
- `PUT /admin/allowlist/:email`
- `DELETE /admin/allowlist/:email`
- `POST /admin/articles`
- `DELETE /admin/articles/:id`
- `POST /admin/templates`
- `DELETE /admin/templates/:id`
- `POST /admin/checklists`
- `DELETE /admin/checklists/:id`

## Что переносить первым

1. `GET /health`
2. `GET /me`
3. `GET /tasks`
4. `GET /tasks/:id`
5. `POST /tasks`
6. `PATCH /tasks/:id`
7. `POST /tasks/:id/status`
8. `GET /articles`
9. `GET /articles/:id`
10. `GET /templates`
11. `GET /checklists`
12. Storage для картинок и файлов
13. Push endpoint
14. Direct Supabase Functions URL - отложенная задача в самом конце, если
    решим временно оставить Supabase Functions вместо собственного push API.

