# 🛡 ZA RAMKI — Safe PowerShell Toolkit

## 0️⃣ Всегда перед правками

```powershell
git status
```

Если есть неожиданные изменения → сначала понять почему.

---

# 1️⃣ Быстрый backup одного файла

```powershell
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item .\js\app.js ".\js\app.js.bak_$ts"
```

Для нескольких файлов:

```powershell
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item .\index.html ".\index.html.bak_$ts"
Copy-Item .\js\app.js ".\js\app.js.bak_$ts"
Copy-Item .\js\router.js ".\js\router.js.bak_$ts"
```

---

# 2️⃣ Проверка, что файл не пустой

```powershell
(Get-Item .\js\app.js).Length
```

Если меньше ~100 байт → что-то не так.

---

# 3️⃣ Безопасный поиск по проекту

По одному слову:

```powershell
Select-String -Path .\js\*.js -Pattern 'planner' -Recurse
```

По нескольким:

```powershell
Select-String -Path .\js\*.js -Pattern 'Router\.go','planner','articles' -Recurse
```

---

# 4️⃣ Точечная замена (без перезаписи всего файла)

⚠️ Использовать только для маленьких replace.

```powershell
$content = Get-Content .\js\router.js -Raw
$content = $content -replace 'articles','planner'
Set-Content .\js\router.js $content -Encoding UTF8
```

---

# 5️⃣ Вставка строки перед конкретным текстом

```powershell
$content = Get-Content .\index.html -Raw
$content = $content -replace '(</body>)', '<script src="./js/views/planner.js"></script>' + "`n" + '$1'
Set-Content .\index.html $content -Encoding UTF8
```

⚠️ Всегда проверять после:

```powershell
Select-String -Path .\index.html -Pattern 'planner.js'
```

---

# 6️⃣ Проверка, что строка есть только один раз

```powershell
Select-String -Path .\index.html -Pattern 'data-tab="planner"' | Measure-Object
```

Если Count > 1 → дубль.

---

# 7️⃣ Быстрое восстановление файла из git

```powershell
git restore --source=HEAD -- .\js\app.js
```

Если нужно всё вернуть:

```powershell
git restore .
```

(но осторожно)

---

# 8️⃣ Поиск последних backup’ов

```powershell
Get-ChildItem -Recurse -Filter "*.bak_*" |
Sort-Object LastWriteTime -Descending |
Select-Object -First 10 FullName, LastWriteTime
```

---

# 9️⃣ Проверка RLS / SQL сессии

(напоминание, чтобы не путаться)

В SQL Editor `auth.jwt()` = null.
Тестировать роли нужно из приложения.

---

# 🔟 Проверка service worker (если UI “странный”)

В браузере:
DevTools → Application → Service Workers → Unregister → Hard reload.

---

# 🧠 Золотое правило

Никогда не делать:

```powershell
Set-Content file.js @' ... '@
```

если это не полный осознанный rewrite.

---

# 📌 Мини-чеклист 

Перед любым изменением:

1. Показать `Select-String` доказательство, где находится нужная строка
2. Сделать backup
3. Применить точечный replace
4. Проверить `Measure-Object`
5. Только потом двигаться дальше




---

# 🗺 Паспорт проекта ZA RAMKI 

## Структура и роли файлов

### `index.html`

**Назначение:** оболочка приложения (двухпанельный layout) + подключение всех скриптов.
**Критичные элементы:**

* контейнеры: `#list`, `#viewer`, `#tabs`
* табы: кнопки `<button class="tab" data-tab="...">`

  * обязательно: `data-tab="planner"` (PLANNER)
  * обязательно: `data-tab="admin"` с классом `zr-admin-tab` и `style="display:none;"` (показывается только админам)
* scripts: подключены `js/router.js`, `js/supabase_client.js`, `js/app.js`, и все `js/views/*.js`, включая `js/views/planner.js`

**Анти-ошибка:** не дублировать подключение одного и того же view (например `checklists.js`).

---

### `styles.css`

**Назначение:** общий стиль всей системы.
**Важно:** новые модули (PLANNER) должны по максимуму использовать существующие классы:

* карточки: `.item`, `.item-title`, `.item-meta`
* кнопки: `.btn`, `.actions`
* пустые состояния: `.empty`
* теги/чипы: `.tag`

**Правило:** не добавлять глобальные конфликты, не делать “новую сетку” для PLANNER.

---

### `js/router.js`

**Назначение:** разбор `location.hash` → `{ section, param }` и навигация `Router.go()`.
**Текущее правило:** default section = `"planner"`.

**Якорная строка для проверки:**

* `const section = m ? decodeURIComponent(m[1]) : "planner";`

---

### `js/supabase_client.js`

**Назначение:** инициализация Supabase клиента.
**Якорь:** глобальный клиент обычно доступен как `SB` (используется во views).

---

### `js/app.js`

**Назначение:** главный контроллер: сессия, роль, переключение табов, вызов `Views.*.show()`.
**Ключевые обязанности:**

* старт после логина → `planner`
* редиректы “нет доступа / неизвестный раздел” → `planner`
* показ таба админки только если `App.session.role === 'admin'`
* единая структура рендера: наполнение `#list` и `#viewer` через views

**Якоря для поиска:**

* `if(section === "planner") { ... Views.Planner.show() ... }`
* `if(!location.hash) Router.go(App.session && App.session.user ? "planner" : "login");`
* `zr-admin-tab` (логика показа админки)

---

## Views (паттерн единый)

Все view-модули реализованы в стиле:

* `window.Views = window.Views || {};`
* `Views.<Name> = (() => { async function show(...) {...}; return { show }; })();`

И все используют **существующие** `#list` и `#viewer`.

---

### `js/views/login.js`

**Назначение:** вход/сессия.
**Требование:** после успешного логина должен вести в `planner` (если где-то ещё остался `articles` — заменить).

**Проверка:**

* `Select-String login.js 'Router.go'`

---

### `js/views/admin.js`

**Назначение:** админка (allowlist + KB + заготовки).
**Важно:** PLANNER — НЕ внутри admin.
Admin — отдельный tab, виден только админу.

---

### `js/views/articles.js`

**Назначение:** Инструкции (сложный модуль).
**Фичи:** file fallback + Supabase merge, TOC, подсветка новых строк, бейджи обновлений.
**Правило:** не трогать без необходимости, это стабильная часть.

---

### `js/views/templates.js` + `js/template_runtime.js`

**Назначение:** шаблоны и их runtime-рендер.
**Правило:** не смешивать с planner.

---

### `js/views/checklists.js`

**Назначение:** чек-листы (локальная логика).
**Анти-ошибка:** не подключать дважды в `index.html`.

---

### `js/views/planner.js`

**Назначение:** PLANNER экран.
**Сейчас:** skeleton/empty state:

* staff → 😎 “Новых задач нет. Всё разобрали.”
* admin → “PLANNER пуст. Создайте задачу.”

**Следующий этап:** подключить чтение задач из Supabase (`tasks`) без изменений/создания.

---

## Supabase: текущая схема (важно ассистенту)

### Таблица `tasks`

Поля:

* `id, title, body, status, urgency, role, assignee_id, start_date, due_date, archived_at, created_by, created_at, updated_at`

Стратегия:

* `role` = видимость (`staff/admin/all`)
* staff видит только если `start_date <= today` (publish date навсегда)
* архив = `archived_at`
* просрочено = вычисляемо (`due_date < today AND status != 'done' AND archived_at is null`)

### RLS

Включён на: `tasks`, `task_comments`, `task_files`, `task_checklist_items`.

### Роли

allowlist → `get_role()` → `is_staff()` / `is_admin()`.

### RPC

Есть функция `set_task_status(task_id, new_status)`:

* staff меняет статус только через RPC
* staff не может cancel/archive и не может менять чужие задачи
* admin может всё

---

## Чтобы быстро продолжить разработку PLANNER, пришлю тебе:

1. `js/views/planner.js`
2. кусок `js/app.js` где роутит секции + boot default
3. `index.html` tabs + scripts block
4. подтверждение, что Supabase таблицы/функции на месте (без правок)

напиши что готов их принять.
---

