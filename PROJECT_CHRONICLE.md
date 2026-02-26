# ZA RAMKI — Project Chronicle (летопись проекта)
Дата обновления: утро 2026-02-25

Это документ для передачи контекста следующему ассистенту: текущее состояние PWA, Supabase, гибрид статей, зачатки auth, артефакты/грабли, и план продолжения.

---

## 0) Коротко о проекте

**ZA RAMKI** — статическая офлайн PWA на GitHub Pages (без сервера). SPA на `index.html` с hash-router.

Исторически “Инструкции” читались из файлов `content/index.json` + `.md`.  
Сейчас идёт постепенный переход на **Supabase** (статьи + будущая админка + задачи), поэтому нужен **гибрид**:

> Supabase = приоритет, файлы = fallback (особенно для офлайна).

Важно: пользователь (marona) не разработчик, но уверенно работает в PowerShell и предпочитает копипаст-команды, бэкапы и минимальные правки.

---

## 1) Где что живёт (онлайн/офлайн)

### Офлайн / файловое (в репозитории)
- `content/index.json` — индекс статей (fallback)
- `.md` статьи по `path` из индекса
- Чек-листы (офлайн)
- Шаблоны (офлайн, включая BriefPro → Excel)

### Онлайн / Supabase (приоритет)
- `kb_articles` — статьи/инструкции/шаблоны (online-first)
- `tasks` + связанные таблицы — планировщик задач
- `task-files` (Storage bucket) — вложения
- `profiles`, `allowlist` — инфраструктурные таблицы
- RLS включён (см. ниже)

---

## 2) Репозиторий и ключевые файлы PWA

Обязательные для понимания:
- `index.html` — подключение скриптов, supabase CDN, marked, views, app
- `js/app.js` — главный контроллер SPA: tabs + render() + boot()
- `js/router.js` — Router.parse/go (hash routes)
- `js/api.js` — `API.json`/`API.text` для чтения файлов
- `js/utils/supabase_client.js` — инициализация `window.SB`
- `js/views/articles.js` — статьи в гибридном режиме Supabase → fallback files
- `content/index.json` — офлайн индекс
- `js/views/login.js` — UI логина (экран есть, но auth-подключение в процессе)

UI:
- `styles.css` + `theme.css` (theme трогать осторожно; “синюшность” запрещена)

---

## 3) Статьи (гибрид Supabase → files)

### Цель
Чтобы старые статьи из файлов не “пропали”, пока идёт миграция в Supabase.

### Как должно работать
- При инициализации статей:
  - пробуем Supabase `kb_articles` (published)
  - если ошибка или пусто — берём `content/index.json`
- При открытии статьи:
  - если есть `content_md` (Supabase) — рендерим его
  - иначе `path` (file) — `API.text(path)` и рендерим
- Callouts декорируются (Важно/Осторожно/Недавнее/Не забудь)
- Если одинаковый `id` есть и в Supabase, и в файлах — показываем Supabase версию

Статус: **гибрид реализован и работает**.

---

## 4) Supabase: текущее состояние

### Таблицы (public)
Есть:
- `kb_articles`
- `profiles`
- `allowlist`
- `tasks`
- `task_comments`
- `task_checklist_items`
- `task_files`

### Storage
- Bucket: `task-files` (private) — создан.

### RLS
- RLS включён на таблицах (подтверждено в UI).
- Была критичная ошибка `42P17 infinite recursion` (RLS recursion) на `profiles`.
- Решение: `SECURITY DEFINER` функция `public.is_admin()` и политики, которые проверяют админа через неё.

### Роли (MVP)
- `admin`
- `staff`
Всего ожидается 2 админа и ~10 staff.

### Логика прав (задумано)
- Admin: всё (статьи, шаблоны, задачи, статусы, архив, вложения)
- Staff: видит все задачи и может комментировать любые; статус меняет только в своей задаче (assignee).

---

## 5) Auth: текущее состояние и артефакты

### Важный факт
Пользователь был создан при настройке magic link, **пароль не был задан**.  
Email подтверждён.

### Что происходило
- При password reset Supabase редиректил в **production URL** (GitHub Pages), поэтому пользователь попадал на “старую версию” PWA с кучей разделов.
- Это не баг PWA, это настройки Supabase Auth redirect URLs.

### Что сейчас есть в PWA
- В шапке есть `#authArea` и кнопка “Войти”.
- Экран `#/login` открывается.
- Реальная авторизация (signInWithPassword) пока не завершена, потому что пароль у пользователя ещё не установлен (или установлен через reset, но надо подтвердить в текущем домене).

### Артефакты, которые могут встретиться
- Supabase warning в production console:
  - `Session as retrieved from URL was issued over 120s ago, URL could be stale`
  Это связано с recovery/magic-link URL токенами; не критично.

- `favicon.ico 404` на GitHub Pages — косметика.

---

## 6) UI и "куча разделов" в production

Иногда production показывал больше вкладок (Задачи/Контакты/Обновления/Админка и т.д.).  
Причина: production был на старом коммите/версии.

После синхронизации через `git push` production должен соответствовать текущему main.

---

## 7) Грабли, которые уже случались (и как их избегать)

1) **PowerShell replace ломает JS**
   - Были случаи, когда получалось `el.innerHTML = <a ...>` без кавычек, и `app.js` падал с `Unexpected token '<'`.
   - Рекомендация: либо вставлять HTML строго в строках, либо добавлять новые блоки через “prepend”/явные here-strings и минимальные ручные вставки.

2) `#authArea` внезапно `null`
   - Причина: открывали не тот `index.html` (не тот root Live Server / production vs localhost) или правки не сохранились.
   - Проверка: в Elements убедиться, что `<div id="authArea">` реально есть.

3) `setActiveTab is not defined`
   - Возникало при поломке структуры `app.js` (скобки/вложенность) после авто-вставок.

---

## 8) Правильный следующий шаг (что делать дальше)

### A) Завершить email+password login (без magic link)
1) В Supabase Auth задать пароль пользователю:
   - либо через UI “Reset password” (но redirect URLs должны включать localhost и production)
   - либо через создание нового пользователя с паролем (как admin)
2) Проверить в PWA консоли:
   - `await SB.auth.signInWithPassword({ email, password })`
   - `await SB.auth.getSession()`

### B) Подключить initAuth в PWA (аккуратно)
Цель:
- на старте: `getSession()`, если есть — определить `admin/staff` через `SB.rpc('is_admin')`
- отрисовать в `#authArea`: pill с ролью + logout
- подписка на `onAuthStateChange`

Важно: внедрять без ломания `render()` и tabs.

### C) После auth — Задачи (UI)
- `#/tasks` список
- `#/tasks/<id>` карточка
- комменты, чеклист, статусы, вложения (Storage)

---

## 9) Как тестировать после правок
- Только через `localhost:5500` (Live Server)
- Проверять:
  - статьи: Supabase и fallback files
  - `#/login` открывается
  - после логина `getSession()` не null
  - RLS: staff не может менять чужую задачу
  - bucket upload/download (auth required)

---

## 10) Мини-набор команд для marona (обычный цикл)

Проверка статуса:
```powershell
git status --porcelain


## 13) Изменения, внесённые вечером 25–26.02.2026 (Auth стабилизация + allowlist + RLS-фундамент)

### 13.1 Переход на email+password авторизацию (без magic link)

Реализован полноценный вход через:

```
SB.auth.signInWithPassword({ email, password })
```

Magic link больше не используется как основной сценарий.

Причины:

* redirect в production ломал локальную отладку,
* recovery URL создавал “Session issued 120s ago” warnings,
* появлялись визуальные несоответствия версии PWA.

Текущее состояние:

* вход работает без перезагрузки страницы,
* logout работает без reload,
* `onAuthStateChange` корректно обновляет UI,
* кнопка в header меняется `Войти` ↔ `Выйти`,
* роль отображается через pill (`admin` / `staff`).

---

### 13.2 Таблица allowlist как источник ролей

Текущая схема:

`public.allowlist`
Колонки:

* `email` (PRIMARY KEY)
* `enabled` (bool)
* `role` (text, CHECK: 'admin' | 'staff')

⚠️ Важное:

* Колонки `is_admin` нет.
* Любые попытки вставки `Сотрудник` / `Админ` ломаются из-за CHECK-констрейнта.
* Используются только `'admin'` и `'staff'`.

Пример корректного upsert:

```sql
insert into public.allowlist(email, enabled, role)
values ('user@gmail.com', true, 'staff')
on conflict (email) do update
set enabled = excluded.enabled,
    role    = excluded.role;
```

---

### 13.3 RPC get_role()

Создана функция:

```
public.get_role() → returns text
```

Возвращает:

* `'admin'`
* `'staff'`
* `null`

Особенности:

* `SECURITY DEFINER`
* использует `auth.jwt() ->> 'email'`
* проверяет `enabled = true`
* возвращает `null`, если email не найден

Разрешение:

```
grant execute on function public.get_role() to authenticated;
```

В PWA:

```
SB.rpc("get_role")
```

---

### 13.4 Архитектура auth в PWA (app.js)

Добавлены:

* `window.fetchRole()`
* `window.applySession(user)`
* `window.initAuth()`
* `window.renderAuthArea()`
* `window.clearMainArea()`

Логика:

1. При старте:

   * `getSession()`
   * если есть user → `get_role()`
   * если роли нет → signOut + редирект на login
2. Подписка `onAuthStateChange`
3. UI-гейтинг:

   * любой route кроме `login` требует `App.session.user`

Это устранило:

* бесконечные reload
* “тихий” сброс формы
* дублирование session-перезаписи
* потерю role после логина

---

### 13.5 RLS состояние

RLS включён.

Промежуточные проблемы:

* infinite recursion (42P17)
* политики, читающие profiles внутри policy
* залипшие promise (pending) при RPC

Исправлено через:

* SECURITY DEFINER функции
* разделение логики ролей от policy
* отказ от сложных вложенных проверок

Текущее состояние:

* get_role работает
* staff/admin определяются корректно
* UI-гейтинг работает

---

### 13.6 Опасные артефакты и риски

1. ⚠️ PowerShell here-strings могут вставить мусор в начало JS (например путь `C:\Users\...`)
   → вызывает `Unexpected identifier 'C'`

2. ⚠️ Дублирование кода в `app.js` (повторное обнуление `App.session.role`)
   → приводило к отображению `—` вместо роли

3. ⚠️ RLS + SECURITY DEFINER
   Если в будущем изменить search_path или структуру allowlist, get_role может начать возвращать null.

4. ⚠️ CHECK constraint allowlist_role_check
   Любые значения кроме `'admin' | 'staff'` будут ломать вставку.

5. ⚠️ Production vs localhost
   При тестировании auth нужно работать только через localhost.

---

### 13.7 Текущее стабильное состояние

* Login работает
* Logout работает
* Role отображается
* allowlist управляет доступом
* RPC get_role стабилен
* UI-гейтинг стабилен
* reload больше не используется

Фундамент можно считать production-ready для внутренней системы.


## 12) Изменения, внесённые 23.02.2026 (PWA / Templates / UI)

### 12.1 Рефакторинг шаблонов (js/views/templates.js)

* Полностью удалён BriefPro из интерфейса PWA (оставлен как отдельный файл вне системы).
* Создан новый шаблон: **“Ссылки проекта + Excel”** вместо BriefPro.
* Реализована двухколоночная форма с блоками:

  * Адрес объекта
  * Ссылка на свет (PDF)
  * План мебели (DWG + PDF)
  * Обмерный план (PDF)
  * Концепт + ТЗ визуализатору
  * Ведомость материалов
* Данные сохраняются в `localStorage` (`tpl:project_links_excel:v1`).

### 12.2 Excel-экспорт (js/utils/links_xlsx.js)

* Создан отдельный модуль `links_xlsx.js` для генерации Excel-файла.
* Реализовано:

  * Формирование имени файла из адреса объекта (sanitized).
  * Добавление строки “Адрес объекта” в начало Excel.
  * Кликабельные ссылки через `cell.l = { Target: ... }`.
  * Отделение UI-логики от Excel-логики (чтобы изменения UI не ломали экспорт).
* Заголовки таблицы стилизованы (жирный шрифт).
* Excel использует стандартный hyperlink-стиль (синий — допустим только внутри Excel).

### 12.3 UI-правки формы

* Убрана “синюшность” инпутов (приведение к единому стилю `.zr-input`).
* Убраны системные синие outline/focus-эффекты.
* Приведены отступы и выравнивание кнопок.
* Форма переработана в аккуратный grid-layout (без создания новых CSS-файлов).

### 12.4 Исправленные ошибки

В процессе правок возникали синтаксические поломки:

* Склейка комментария и `const fields = {}` → `Unexpected token ':'`
* Дублирование `function readValues()`
* Потеря закрывающих скобок внутри ветки `project_links_excel`
* Лишние вставки кода в середину других шаблонов

Все ошибки устранены.
`templates.js` приведён к стабильной цельной версии.

### 12.5 Попытка реализации оглавления

* Были реализованы:

  * Верхнее оглавление “Пункт — Пункт”
  * Sticky-панель справа
  * Подсветка активного пункта
* Возникли сложности:

  * конфликт scroll-контейнера (window vs viewer),
  * перезапись активного пункта после smooth-scroll,
  * нестабильность поведения.

Принято решение:

> Полностью откатить оглавление и вернуться к чистой версии `articles.js`.

Оглавление временно исключено из PWA до разработки более устойчивого решения.

### 12.6 Архитектурное решение

Принято принципиальное разделение:

* Инструкции остаются файловыми (офлайн-first).
* Supabase не используется для KB на этом этапе.
* Онлайн-функционал будет добавляться отдельно (Tasks / Planner).
* PWA остаётся фундаментом системы.




