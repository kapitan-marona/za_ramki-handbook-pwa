# Supabase Direct Dependencies Audit

Дата: 2026-06-19

## Цель

Проверить, где приложение всё ещё напрямую знает о Supabase после разделения
`ZRBackend` на модули.

## Итог

Основные data-запросы теперь идут через `ZRBackend` и его модули:

- `zr_backend_provider.js`
- `zr_backend_core.js`
- `zr_backend_projects.js`
- `zr_backend_people.js`
- `zr_backend_kb.js`
- `zr_backend_push.js`
- `zr_backend_tasks.js`
- `zr_backend_task_meta.js`
- `zr_backend_task_checklists.js`
- `zr_backend_task_content.js`

Это нормальный промежуточный этап: внутри модулей ещё используются Supabase
таблицы/RPC, но экраны приложения обращаются к фасаду `ZRBackend`, а не напрямую
к Supabase.

## Ожидаемые Supabase-зависимости

Оставлены намеренно:

- `js/config.js`
  - текущий public Supabase URL;
  - текущий anon key;
  - `backendMode: "supabase"`.

- `js/utils/supabase_client.js`
  - создаёт текущий Supabase browser client.

- `js/services/zr_backend_provider.js`
  - пока возвращает `window.SB`;
  - в будущем это точка переключения на российский backend provider.

- `index.html`
  - подключает `js/vendor/supabase-js-2.js`;
  - подключает `js/utils/supabase_client.js`.

- `sw.js`
  - кэширует Supabase vendor/client files;
  - не кэширует сетевые Supabase API-запросы `/rest/v1/`, `/auth/v1/`,
    `/storage/v1/`, `/functions/v1/`.

## Остаточные прямые места

### `js/utils/planner_push_sender.js`

Сейчас отправка push может идти напрямую через:

```js
window.SB.functions.invoke(PUSH_FUNCTION, ...)
```

Это известный остаток. Он намеренно оставлен на конец production-плана, потому
что:

- push не должен блокировать основные сценарии Planner/Projects/KB;
- для переезда в РФ лучше заменить его отдельным backend endpoint;
- преждевременный перенос push может добавить нестабильность без выигрыша для
  основных экранов.

Будущий вариант:

```text
POST /push/send
```

Или временно:

```js
window.ZR_CONFIG.pushEndpoint = "https://..."
```

### `js/views/_future/planner_v1_tabs_proto.js`

В старом прототипе есть прямой `window.SB`.

Файл находится в `_future` и не подключается к рабочим разделам через
`SECTION_SCRIPTS`. Это не production-зависимость, но перед будущим включением
этого прототипа его нужно привести к `ZRBackend`.

## Что не считается проблемой

- Документы с упоминанием Supabase.
- SQL-миграции и schema snapshots.
- Supabase vendor bundle.
- Текущие Supabase-запросы внутри `js/services/zr_backend_*.js`, потому что
  это и есть временный provider implementation.

## Следующий шаг

Не трогать `planner_push_sender.js` сейчас.

Вернуться к нему после:

1. финального smoke-test текущей модульной структуры;
2. предварительного production-итога;
3. решения, какой backend endpoint будет отвечать за push в российской схеме.

