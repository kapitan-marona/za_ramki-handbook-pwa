# ZA RAMKI Production Readiness Summary

Дата: 2026-06-18

## Статус

Проект прошёл основной предпродакшн-этап подготовки:

- облегчены шрифты и часть статических ресурсов;
- добавлен production cache для PWA;
- включена ленивая загрузка тяжёлых разделов;
- стабилизирована CSS-система;
- подготовлены и применены индексы Supabase;
- подготовлена, применена и проверена RLS-модель;
- убран прямой Supabase Functions URL из клиентского кода;
- исправлена опечатка `profiles.role = 'satff'`.

## Что проверено

Локально:

- `node tools/production-smoke-check.js` - успешно;
- `node --check js/app.js` - успешно;
- `node --check js/views/login.js` - успешно;
- `node --check js/utils/planner_push_sender.js` - успешно;
- `node --check sw.js` - успешно.

В Supabase:

- preflight по ролям задач и исполнителям - успешно;
- RLS hardening migration - применена;
- postflight: широкие `true`-политики отсутствуют;
- RLS включён на всех проверенных таблицах;
- защищённые RPC-функции существуют и используют `search_path=public`;
- admin role hotfix применён;
- admin и staff вручную проверены после RLS.
- task admin RPC применён для создания/редактирования задач после RLS;
- Supabase schema cache был перезагружен через `notify pgrst, 'reload schema'`.
- direct task creation was manually rechecked successfully after the RPC/schema
  cache fix.

## Основная модель доступа

- `admin` видит и управляет всем рабочим контуром.
- `staff` видит задачи `all`.
- `staff` видит задачи `staff` только если назначен исполнителем через
  `task_assignees`.
- `staff` не управляет исполнителями и доступом задачи.
- `staff` не видит задачи `admin`.
- Создание и прямое редактирование задач выполняются через admin RPC, а не
  прямым `insert/update` в таблицу `tasks`.
- База знаний редактируется admin, опубликованное доступно staff.
- Push-подписки доступны только владельцу.

## Важные оставшиеся риски

- Доступ из РФ всё ещё зависит от Supabase. Если Supabase недоступен из сети
  пользователя, вход и загрузка данных могут не работать.
- PWA cache уже включён, поэтому после релиза важно проверять обновление
  установленного приложения на телефоне.
- Storage-политики для файлов не проходили такой же глубокий аудит, как RLS
  таблиц.
- Самые тяжёлые изображения инструкций лежат в Supabase Storage `kb-media`, а
  не в локальном репозитории: `kb-articles/obmer/photo-1.png` и
  `kb-articles/obmer/photo-2.png` примерно по 2.5 МБ.
- Heavy instruction images were converted to WebP, uploaded to Supabase Storage,
  and manually checked in the app.
- В проекте есть рабочие изменения в разных файлах; перед финальным релизом
  нужен отдельный аккуратный commit/release pass.
- Browser-проверка внутри Codex ограничена Windows-средой, поэтому визуальный
  smoke-test выполняется вручную в Chrome.

## Следующий этап

1. Провести финальный ручной smoke-test после всех изменений:
   - admin: Planner, задача, Projects, Articles, Templates, Checklists, Admin;
   - staff: свои задачи, общие задачи, отсутствие admin-задач, комментарии,
     статусы, отсутствие кнопок управления доступом.

2. Решить инфраструктурный вопрос доступа из РФ:
   - временный VPN для команды;
   - российский API-прокси перед Supabase;
   - полный перенос backend/database на РФ-инфраструктуру.

3. После стабилизации доступа продолжать продуктовые надстройки:
   - база знаний;
   - шаблоны;
   - проекты;
   - модуль мессенджера;
   - улучшения planner/workflow.
