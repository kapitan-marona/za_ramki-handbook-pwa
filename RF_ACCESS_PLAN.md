# ZA RAMKI RF Access Plan

Дата: 2026-06-19

## Цель

Сделать так, чтобы ZA RAMKI стабильно открывалась и работала у пользователей из
РФ без VPN.

Сейчас приложение всё ещё зависит от Supabase Cloud:

- вход;
- таблицы PostgreSQL через Supabase REST/RPC;
- Storage для изображений и файлов;
- Edge Function для push.

Если Supabase или `api.supabase.com` недоступны из сети пользователя, логин,
данные, Storage и админка могут ломаться.

## Варианты

### Вариант A. Временный VPN

Самый быстрый путь, но не production-решение.

Плюсы:

- ничего не нужно переписывать;
- можно продолжать тестирование.

Минусы:

- каждый сотрудник зависит от VPN;
- нестабильно для PWA на телефонах;
- не решает долгосрочную задачу.

### Вариант B. Российский API-прокси перед Supabase

Промежуточный путь: приложение ходит не напрямую в Supabase, а в российский
сервер-прослойку. Сервер уже общается с Supabase.

Плюсы:

- можно сохранить Supabase как базу на время;
- меньше изменений в приложении;
- можно постепенно переносить таблицы/Storage/авторизацию.

Минусы:

- если сам российский сервер не сможет достучаться до Supabase, проблема
  останется;
- нужно аккуратно переносить auth-схему;
- появится сервер, который надо обслуживать.

### Вариант C. Self-host Supabase на РФ/VPS-инфраструктуре

Supabase официально поддерживает self-hosting; рекомендуемый способ запуска -
Docker Compose. Но при self-hosting команда сама отвечает за серверы,
обновления, безопасность, Postgres, бэкапы, мониторинг и отказоустойчивость.

Плюсы:

- меньше переписывания текущей архитектуры;
- остаются знакомые Postgres/RLS/RPC/Storage/Auth-подходы;
- можно сохранить текущий `zr_backend.js` почти как есть, поменяв адреса.

Минусы:

- заметная DevOps-нагрузка;
- self-host не равен managed Supabase: часть платформенных возможностей
  недоступна;
- нужно очень аккуратно настроить backups, HTTPS, env-секреты, SMTP и Storage.

### Вариант D. Российский backend + managed PostgreSQL + S3 Storage

Более правильный долгосрочный путь: приложение ходит в собственный backend на
российской инфраструктуре, база - managed PostgreSQL, файлы - S3-compatible
Object Storage, push - отдельный backend endpoint.

Например, в Yandex Cloud есть Managed Service for PostgreSQL, Object Storage и
Cloud Functions. Object Storage совместим с Amazon S3 API.

Плюсы:

- стабильный доступ из РФ;
- меньше зависимости от Supabase;
- проще развивать мессенджер, права, аудит, серверные интеграции;
- можно оставить приложение PWA.

Минусы:

- это уже миграция backend-архитектуры;
- нужно заменить Supabase Auth/REST/RPC/Storage на собственные API;
- потребуется отдельная система авторизации и ролей.

## Рекомендованный путь

Не делать резкий перенос всей системы сразу.

Оптимальный путь:

1. **Подготовить backend adapter внутри проекта.**
   Сейчас `zr_backend.js` уже играет роль прослойки. Нужно усилить этот подход:
   чтобы views/planner/projects/articles не знали, Supabase там или другой
   сервер.

2. **Вынести конфигурацию окружения.**
   Сейчас Supabase URL/anon key лежат в `index.html`. Для production лучше
   иметь один конфиг-файл или server-injected config:
   - API base URL;
   - Storage base URL;
   - push endpoint;
   - feature flags.

3. **Сделать минимальный российский backend-прототип.**
   Начать не со всего приложения, а с 2-3 endpoints:
   - `GET /health`;
   - `GET /me`;
   - `GET /tasks`;
   - `POST /tasks/:id/status`.

4. **Выбрать инфраструктурную цель.**
   Для долгосрочной версии логичнее:
   - managed PostgreSQL;
   - S3-compatible object storage;
   - backend на Node.js/TypeScript или другом простом серверном runtime;
   - reverse proxy + HTTPS;
   - регулярные backups.

5. **Мигрировать по модулям.**
   Порядок:
   - auth/session;
   - profiles/allowlist;
   - planner/tasks;
   - projects;
   - knowledge base;
   - templates/checklists;
   - files/storage;
   - push;
   - messenger;
   - direct Supabase Functions URL - только в конце, если временно оставляем
     Supabase Functions для push.

## Ближайшие практические задачи

1. Сделать `js/config.js` или аналогичный runtime config.
2. Убрать Supabase URL/anon key из прямой логики views; оставить только в
   backend/provider adapter.
3. Разделить `zr_backend.js` на:
   - interface layer: что умеет backend;
   - supabase provider: текущая реализация;
   - future provider: место для российского API.
4. Описать минимальный API-контракт для задач и базы знаний.
5. Подготовить список таблиц и RPC, которые нужно перенести первыми.
6. Вернуться к direct Supabase Functions URL в самом конце, после основных
   production-задач.

## Источники

- Supabase self-hosting docs: `https://supabase.com/docs/guides/self-hosting`
- Yandex Managed Service for PostgreSQL docs:
  `https://yandex.cloud/ru/docs/managed-postgresql/`
- Yandex Object Storage docs: `https://yandex.cloud/ru/docs/storage/`
- Yandex Cloud Functions docs: `https://yandex.cloud/ru/docs/functions/`
