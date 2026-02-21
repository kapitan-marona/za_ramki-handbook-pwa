window.Views = window.Views || {};
Views.Admin = (() => {
  const $ = (s) => document.querySelector(s);

  const PIN_KEY = "za_admin_pin_v1";
  const UNLOCK_KEY = "za_admin_unlocked_v1"; // sessionStorage

  const HAS_FSA = !!window.showSaveFilePicker;
  const DB_NAME = "za_admin_db_v1";
  const STORE = "handles";

  const CHK = (v) => (v === true || v === "true" || v === 1 || v === "1");

  function esc(str){
    return (str ?? "").toString().replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function setPanelTitle(t){ const el = $("#panelTitle"); if(el) el.textContent = t; }
  function setStatus(t){ const el = $("#status"); if(el) el.textContent = t; }

  function pretty(v){ try { return JSON.stringify(v, null, 2); } catch(e){ return ""; } }

  function nowId(){
    const d = new Date();
    const pad = (n) => (n<10 ? "0"+n : ""+n);
    return "tsk_" +
      d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + "_" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type:"application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  // ---------- IndexedDB ----------
  function openDB(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbGet(key){
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const st = tx.objectStore(STORE);
      const rq = st.get(key);
      rq.onsuccess = () => resolve(rq.result ?? null);
      rq.onerror = () => resolve(null);
    });
  }

  async function dbSet(key, val){
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  // ---------- JSON helpers ----------
  function setMsg(id, html){
    const el = document.querySelector(`.adm-msg[data-msg="${CSS.escape(id)}"]`);
    if(el) el.innerHTML = html || "";
  }

  function validateJson(id){
    const ta = document.getElementById(id);
    if(!ta) return false;
    try{
      const v = JSON.parse(ta.value || "null");
      const hint = Array.isArray(v) ? `Массив: ${v.length}` : (v && typeof v === "object" ? "Объект" : typeof v);
      setMsg(id, `<span class="tag">OK</span> <span class="tag">${esc(hint)}</span>`);
      return true;
    }catch(e){
      setMsg(id, `<span class="tag accent">Ошибка JSON</span> <span class="tag">${esc(e.message || "parse error")}</span>`);
      return false;
    }
  }

  function parseOrNull(id){
    const ta = document.getElementById(id);
    if(!ta) return null;
    try { return JSON.parse(ta.value || "null"); } catch(e){ return null; }
  }

  function writeJson(id, val){
    const ta = document.getElementById(id);
    if(!ta) return;
    ta.value = pretty(val) + "\n";
    validateJson(id);
  }

  // ---------- PIN ----------
  function isValidPin(pin){
    const p = (pin || "").trim();
    if(p.length < 4 || p.length > 8) return false;
    return /^\d+$/.test(p);
  }
  function isUnlocked(){ return sessionStorage.getItem(UNLOCK_KEY) === "1"; }
  function unlock(){ sessionStorage.setItem(UNLOCK_KEY, "1"); }
  function lock(){ sessionStorage.removeItem(UNLOCK_KEY); }

  function pinScreen(existing){
    const hasPin = !!(existing || "");
    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55);">
        <div class="article-title" style="margin:0 0 8px 0;">Доступ к админке</div>
        <div class="article-sub" style="margin:0 0 12px 0;">PIN — только от случайных заходов.</div>

        ${hasPin ? `
          <div class="article-sub" style="margin:0 0 6px 0;">Введите PIN</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
            <input id="admPinIn" class="input" inputmode="numeric" placeholder="PIN" style="min-width:180px; flex:1;" />
            <button type="button" class="btn" id="admPinEnter">🔓 Войти</button>
            <button type="button" class="btn" id="admPinReset">♻️ Сменить PIN</button>
          </div>
        ` : `
          <div class="article-sub" style="margin:0 0 6px 0;">Установить PIN (4–8 цифр)</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
            <input id="admPinNew" class="input" inputmode="numeric" placeholder="Новый PIN" style="min-width:180px; flex:1;" />
            <button type="button" class="btn" id="admPinSet">✅ Установить</button>
          </div>
        `}

        <div id="admPinMsg" style="margin-top:10px; opacity:.95;"></div>
      </div>
    `;
  }

  function setPinMsg(html){
    const el = $("#admPinMsg");
    if(el) el.innerHTML = html || "";
  }

  function wirePin(){
    const stored = (localStorage.getItem(PIN_KEY) || "");

    const btnSet = $("#admPinSet");
    if(btnSet){
      btnSet.onclick = () => {
        const pin = ($("#admPinNew")?.value || "").trim();
        if(!isValidPin(pin)){ setPinMsg(`<span class="tag accent">PIN: 4–8 цифр</span>`); return; }
        localStorage.setItem(PIN_KEY, pin);
        unlock();
        showEditor();
      };
    }

    const btnEnter = $("#admPinEnter");
    if(btnEnter){
      btnEnter.onclick = () => {
        const pin = ($("#admPinIn")?.value || "").trim();
        if(pin !== stored){ setPinMsg(`<span class="tag accent">Неверный PIN</span>`); return; }
        unlock();
        showEditor();
      };
    }

    const btnReset = $("#admPinReset");
    if(btnReset){
      btnReset.onclick = () => {
        const pin = ($("#admPinIn")?.value || "").trim();
        if(pin !== stored){ setPinMsg(`<span class="tag accent">Для смены введи текущий PIN</span>`); return; }
        localStorage.removeItem(PIN_KEY);
        lock();
        show();
      };
    }
  }

  // ---------- File binding + saving ----------
  async function ensureWritePermission(handle){
    if(!handle) return false;
    try{
      const q = await handle.queryPermission({ mode: "readwrite" });
      if(q === "granted") return true;
      const r = await handle.requestPermission({ mode: "readwrite" });
      return r === "granted";
    }catch(e){
      return false;
    }
  }

  async function bindFile(filename){
    if(!HAS_FSA) return false;
    try{
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      await dbSet("handle:" + filename, handle);
      return true;
    }catch(e){
      return false;
    }
  }

  async function saveBoundFile(filename, text){
    const handle = await dbGet("handle:" + filename);
    if(!handle) return { ok:false, reason:"not_bound" };

    const okPerm = await ensureWritePermission(handle);
    if(!okPerm) return { ok:false, reason:"no_perm" };

    try{
      const w = await handle.createWritable();
      await w.write((text || "").trim() + "\n");
      await w.close();
      return { ok:true };
    }catch(e){
      return { ok:false, reason:"write_failed" };
    }
  }

  async function bindAll(){
    const a = await bindFile("staff.json");
    const b = await bindFile("tasks.json");
    const c = await bindFile("tasks_archive.json");
    return a && b && c;
  }

  async function saveAll(){
    const ok1 = await trySaveUi("staff.json", "adm_staff_json");
    const ok2 = await trySaveUi("tasks.json", "adm_tasks_json");
    const ok3 = await trySaveUi("tasks_archive.json", "adm_tasks_archive_json");
    return ok1 && ok2 && ok3;
  }

  // ---------- UI blocks ----------
  function fileButtonsHtml(filename, taId){
    if(!HAS_FSA) return "";
    return `
      <button type="button" class="btn adm-bind" data-fn="${esc(filename)}">🔗 Привязать</button>
      <button type="button" class="btn adm-save" data-fn="${esc(filename)}" data-target="${esc(taId)}">💾 Сохранить</button>
    `;
  }

  function block(title, filename, initialText){
    const id = "adm_" + filename.replace(/\W+/g, "_");
    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55); margin-bottom:12px;">
        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
          <div>
            <div class="article-title" style="margin:0; font-size:18px;">${esc(title)}</div>
            <div class="article-sub" style="margin-top:6px;">${esc(filename)}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            ${fileButtonsHtml(filename, id)}
            <input type="file" class="adm-file" data-target="${esc(id)}" accept=".json,application/json" />
            <button type="button" class="btn adm-validate" data-target="${esc(id)}">✅ Проверить</button>
            <button type="button" class="btn adm-download" data-target="${esc(id)}" data-fn="${esc(filename)}">⬇️ Скачать</button>
          </div>
        </div>
        <textarea id="${esc(id)}" spellcheck="false"
          style="width:100%; margin-top:10px; min-height:240px; padding:12px; border-radius:14px; border:1px solid var(--border);
                 background: rgba(10,10,12,.35); color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                 line-height:1.35; resize:vertical;">${esc(initialText)}</textarea>
        <div class="adm-msg" data-msg="${esc(id)}" style="margin-top:8px; opacity:.9;"></div>
      </div>
    `;
  }

  function opsBlock(){
    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55); margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
          <div>
            <div class="article-title" style="margin:0 0 6px 0; font-size:18px;">Админ</div>
            <div class="article-sub" style="margin:0;">
              Режим: правишь → <span class="tag">💾 Сохранить</span> → <span class="tag">tools\\publish-data.ps1</span>.
              ${HAS_FSA ? "" : " (FSA недоступен — используй Скачать.)"}
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${HAS_FSA ? `<button type="button" class="btn" id="admBindAll">🔗 Привязать все</button>` : ""}
            ${HAS_FSA ? `<button type="button" class="btn" id="admSaveAll">💾 Сохранить все</button>` : ""}
            <button type="button" class="btn" id="admLock">🔒 Выйти</button>
          </div>
        </div>

        <div id="admOpsMsg" style="margin-top:10px; opacity:.95;"></div>
      </div>
    `;
  }

  function taskFormBlock(staffList, templates){
    const staffOpts = ['<option value="">—</option>']
      .concat((staffList||[]).map(n => `<option value="${esc(n)}">${esc(n)}</option>`))
      .join("");

    return `
      <div style="border:1px solid var(--border); border-radius:16px; padding:14px; background: rgba(26,23,20,.55); margin-bottom:12px;">
        <div class="article-title" style="margin:0 0 10px 0; font-size:18px;">Постановка задачи</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:0 0 10px 0;">
          <div style="min-width:260px; flex:1;">
            <div class="article-sub" style="margin:0 0 6px 0;">Шаблон задачи</div>
            <select id="admTpl" class="input" style="width:100%;">
              <option value="">—</option>
              ${(Array.isArray(templates)?templates:[]).map(t => `<option value="${esc(t.key||"")}">${esc(t.title||t.key||"Шаблон")}</option>`).join("")}
            </select>
          </div>
          <button type="button" class="btn" id="admTplApply">✨ Применить</button>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="min-width:220px; flex:1;">
            <div class="article-sub" style="margin:0 0 6px 0;">ID</div>
            <input id="admTId" class="input" placeholder="(пусто = авто)" style="width:100%;" />
          </div>
          <div style="min-width:220px; flex:1;">
            <div class="article-sub" style="margin:0 0 6px 0;">Дата (YYYY-MM-DD)</div>
            <input id="admTDate" class="input" placeholder="2026-02-21" style="width:100%;" />
          </div>
          <div style="min-width:220px; flex:1;">
            <div class="article-sub" style="margin:0 0 6px 0;">Исполнитель</div>
            <select id="admTAss" class="input" style="width:100%;">${staffOpts}</select>
          </div>
          <div style="min-width:180px;">
            <div class="article-sub" style="margin:0 0 6px 0;">Urgency</div>
            <select id="admTUrg" class="input" style="width:100%;">
              <option value="regular">regular</option>
              <option value="urgent">urgent</option>
            </select>
          </div>
        </div>

        <div style="height:10px;"></div>

        <div>
          <div class="article-sub" style="margin:0 0 6px 0;">Заголовок</div>
          <input id="admTTitle" class="input" placeholder="Коротко и ясно" style="width:100%;" />
        </div>

        <div style="height:10px;"></div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="min-width:240px; flex:1;">
            <div class="article-sub" style="margin:0 0 6px 0;">Ссылка (опц.)</div>
            <input id="admTLink" class="input" placeholder="https://..." style="width:100%;" />
          </div>
          <div style="min-width:240px; flex:1;">
            <div class="article-sub" style="margin:0 0 6px 0;">Картинка (опц., URL)</div>
            <input id="admTImg" class="input" placeholder="./assets/img/..." style="width:100%;" />
          </div>
        </div>

        <div style="height:10px;"></div>

        <div>
          <div class="article-sub" style="margin:0 0 6px 0;">Текст (опц.)</div>
          <textarea id="admTText" spellcheck="false"
            style="width:100%; min-height:110px; padding:12px; border-radius:14px; border:1px solid var(--border);
                   background: rgba(10,10,12,.35); color: var(--text); line-height:1.35; resize:vertical;"></textarea>
        </div>

        <div style="height:10px;"></div>

        <div>
          <div class="article-sub" style="margin:0 0 6px 0;">Чек-лист (каждая строка = пункт)</div>
          <textarea id="admTChk" spellcheck="false"
            style="width:100%; min-height:110px; padding:12px; border-radius:14px; border:1px solid var(--border);
                   background: rgba(10,10,12,.35); color: var(--text); line-height:1.35; resize:vertical;"
            placeholder="Пункт 1&#10;Пункт 2&#10;Пункт 3"></textarea>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          <button type="button" class="btn" id="admTFill">🔍 Подставить по ID</button>
          <button type="button" class="btn" id="admTAdd">➕ Добавить</button>
          <button type="button" class="btn" id="admTUpdate">💾 Обновить</button>
          <button type="button" class="btn" id="admTDelete">🗑 Удалить</button>
          <button type="button" class="btn" id="admTArchive">📦 В архив</button>
          <button type="button" class="btn" id="admTClear">🧹 Очистить</button>
        </div>

        <div id="admTMsg" style="margin-top:10px; opacity:.95;"></div>
      </div>
    `;
  }

  function setOpsMsg(html){
    const el = $("#admOpsMsg");
    if(el) el.innerHTML = html || "";
  }
  function setTMsg(html){
    const el = $("#admTMsg");
    if(el) el.innerHTML = html || "";
  }

  function getStaffNames(staff){
    if(!Array.isArray(staff)) return [];
    const isStrings = staff.every(x => typeof x === "string");
    if(isStrings) return staff.map(x => (x||"").trim()).filter(Boolean);
    return staff.map(s => (s?.name ?? s?.title ?? s?.fullname ?? "").toString().trim()).filter(Boolean);
  }

  function readTaskForm(){
    const id = ($("#admTId")?.value || "").trim();
    const title = ($("#admTTitle")?.value || "").trim();
    const date = ($("#admTDate")?.value || "").trim();
    const assignee = ($("#admTAss")?.value || "").trim();
    const urgency = ($("#admTUrg")?.value || "regular").trim();
    const link = ($("#admTLink")?.value || "").trim();
    const image = ($("#admTImg")?.value || "").trim();
    const text = ($("#admTText")?.value || "").trim();
    const chkRaw = ($("#admTChk")?.value || "");
    const checklist = chkRaw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    return {
      id,
      title,
      date,
      assignee,
      urgency,
      link,
      image,
      text,
      checklist
    };
  }

  function writeTaskForm(t){
    $("#admTId").value = t?.id || "";
    $("#admTTitle").value = t?.title || "";
    $("#admTDate").value = t?.date || "";
    $("#admTAss").value = t?.assignee || "";
    $("#admTUrg").value = t?.urgency || "regular";
    $("#admTLink").value = t?.link || "";
    $("#admTImg").value = t?.image || "";
    $("#admTText").value = t?.text || "";
    const list = Array.isArray(t?.checklist) ? t.checklist : [];
    $("#admTChk").value = list.map(x => (typeof x === "string" ? x : (x?.text || x?.title || ""))).filter(Boolean).join("\n");
  }

  function clearTaskForm(){
    writeTaskForm({ id:"", title:"", date:"", assignee:"", urgency:"regular", link:"", image:"", text:"", checklist:[] });
  }

  function upsertTask(tasks, t, mode){
    // mode: "add" | "update"
    const id = (t.id || "").trim() || nowId();
    const title = (t.title || "").trim();
    if(!title) return { ok:false, reason:"no_title" };

    const obj = {
      id,
      title,
      date: (t.date || "").trim(),
      assignee: (t.assignee || "").trim(),
      urgency: (t.urgency || "regular").trim(),
      text: (t.text || "").trim(),
    };

    if((t.link || "").trim()) obj.link = t.link.trim();
    if((t.image || "").trim()) obj.image = t.image.trim();
    if(Array.isArray(t.checklist) && t.checklist.length) obj.checklist = t.checklist.slice(0, 200);

    const idx = tasks.findIndex(x => x && x.id === id);

    if(mode === "add"){
      if(idx >= 0) return { ok:false, reason:"exists", id };
      tasks.unshift(obj);
      return { ok:true, id };
    } else {
      if(idx < 0) return { ok:false, reason:"not_found", id };
      // сохраняем порядок: заменяем
      tasks[idx] = { ...tasks[idx], ...obj, id };
      return { ok:true, id };
    }
  }

  function moveToArchiveById(tasks, arch, id){
    const idx = tasks.findIndex(x => x && x.id === id);
    if(idx < 0) return { ok:false, reason:"not_found" };
    const item = tasks.splice(idx, 1)[0];
    arch.unshift(item);
    return { ok:true };
  }

  function deleteById(tasks, id){
    const idx = tasks.findIndex(x => x && x.id === id);
    if(idx < 0) return { ok:false, reason:"not_found" };
    tasks.splice(idx, 1);
    return { ok:true };
  }

  async function trySaveUi(filename, textareaId){
    if(!HAS_FSA) return false;
    if(!validateJson(textareaId)) return false;
    const ta = document.getElementById(textareaId);
    const res = await saveBoundFile(filename, ta?.value || "");
    return !!res.ok;
  }

  function wireCommon(root){
    root.querySelectorAll(".adm-validate").forEach(b => {
      b.onclick = () => validateJson(b.dataset.target);
    });

    root.querySelectorAll(".adm-download").forEach(b => {
      b.onclick = () => {
        const id = b.dataset.target;
        if(!validateJson(id)) return;
        const ta = document.getElementById(id);
        downloadText(b.dataset.fn, (ta?.value || "").trim() + "\n");
      };
    });

    root.querySelectorAll(".adm-file").forEach(inp => {
      inp.onchange = async () => {
        const f = inp.files && inp.files[0];
        if(!f) return;
        const txt = await f.text();
        const id = inp.dataset.target;
        const ta = document.getElementById(id);
        if(ta) ta.value = txt;
        validateJson(id);
        inp.value = "";
      };
    });

    root.querySelectorAll(".adm-bind").forEach(b => {
      b.onclick = async () => {
        const fn = b.dataset.fn;
        const ok = await bindFile(fn);
        setOpsMsg(ok
          ? `<span class="tag">OK</span> Привязано: <span class="tag">${esc(fn)}</span>`
          : `<span class="tag accent">Отмена</span> Привязка не выполнена`);
      };
    });

    root.querySelectorAll(".adm-save").forEach(b => {
      b.onclick = async () => {
        const fn = b.dataset.fn;
        const target = b.dataset.target;
        if(!validateJson(target)) return;

        const ta = document.getElementById(target);
        const res = await saveBoundFile(fn, ta?.value || "");
        if(res.ok){
          setOpsMsg(`<span class="tag">OK</span> Сохранено: <span class="tag">${esc(fn)}</span>`);
          return;
        }
        if(res.reason === "not_bound"){
          setOpsMsg(`<span class="tag accent">Не привязано</span> Нажми “🔗 Привязать” для <span class="tag">${esc(fn)}</span>`);
          return;
        }
        if(res.reason === "no_perm"){
          setOpsMsg(`<span class="tag accent">Нет доступа</span> Разреши запись при запросе браузера`);
          return;
        }
        setOpsMsg(`<span class="tag accent">Ошибка</span> Не удалось сохранить <span class="tag">${esc(fn)}</span>`);
      };
    });

    const btnLock = $("#admLock");
    if(btnLock){
      btnLock.onclick = () => { lock(); show(); };
    }

    const btnBindAll = $("#admBindAll");
    if(btnBindAll){
      btnBindAll.onclick = async () => {
        const ok = await bindAll();
        setOpsMsg(ok ? `<span class="tag">OK</span> Привязано 3 файла` : `<span class="tag accent">Отмена</span> Не все файлы привязаны`);
      };
    }

    const btnSaveAll = $("#admSaveAll");
    if(btnSaveAll){
      btnSaveAll.onclick = async () => {
        const ok = await saveAll();
        setOpsMsg(ok ? `<span class="tag">OK</span> Сохранено 3 файла` : `<span class="tag accent">Ошибка</span> Не все файлы сохранены`);
      };
    }
  }

  function wireTaskForm(){
    const btnTpl = $("#admTplApply");
    const btnFill = $("#admTFill");
    const btnAdd = $("#admTAdd");
    const btnUpd = $("#admTUpdate");
    const btnDel = $("#admTDelete");
    const btnArch = $("#admTArchive");
    const btnClr = $("#admTClear");

    const getTpl = () => {
      const key = ($("#admTpl")?.value || "").trim();
      if(!key) return null;
      const raw = parseOrNull("adm_task_templates_json");
      const arr = Array.isArray(raw) ? raw : [];
      return arr.find(x => x && (x.key === key)) || null;
    };

    const getArrays = () => {
      const tasks = parseOrNull("adm_tasks_json");
      const arch = parseOrNull("adm_tasks_archive_json");
      if(!Array.isArray(tasks) || !Array.isArray(arch)) return null;
      return { tasks, arch };
    };

    const findTask = (arr, id) => arr.find(x => x && x.id === id) || null;

    if(btnTpl){
      btnTpl.onclick = () => {
        const raw = parseOrNull("adm_task_templates_json");
        const arr = Array.isArray(raw) ? raw : [];
        const key = ($("#admTpl")?.value || "").trim();
        const tpl = arr.find(x => x && (x.key === key));
        if(!tpl){ setTMsg(`<span class="tag accent">Выбери шаблон</span>`); return; }

        // НЕ трогаем assignee/date/urgency/id/link/image
        $("#admTTitle").value = (tpl.title || "").trim();
        $("#admTText").value  = (tpl.text  || "").trim();
        const list = Array.isArray(tpl.checklist) ? tpl.checklist : [];
        $("#admTChk").value = list.map(x => (typeof x === "string" ? x : (x?.text || x?.title || ""))).filter(Boolean).join("\n");

        // defaultUrgency применим только если сейчас пусто/regular
        const du = (tpl.defaultUrgency || "").trim();
        if(du && ($("#admTUrg").value || "regular") === "regular") $("#admTUrg").value = du;

        setTMsg(`<span class="tag">OK</span> Шаблон применён`);
      };
    }

    if(btnFill){
      btnFill.onclick = () => {
        const id = ($("#admTId")?.value || "").trim();
        if(!id){ setTMsg(`<span class="tag accent">Нужен ID</span>`); return; }
        const data = getArrays();
        if(!data){ setTMsg(`<span class="tag accent">JSON невалиден</span> Проверь tasks/archive`); return; }
        const t = findTask(data.tasks, id) || findTask(data.arch, id);
        if(!t){ setTMsg(`<span class="tag accent">Не найдено</span>`); return; }
        writeTaskForm(t);
        setTMsg(`<span class="tag">OK</span> Подставлено`);
      };
    }

    if(btnAdd){
      btnAdd.onclick = () => {
        const data = getArrays();
        if(!data){ setTMsg(`<span class="tag accent">JSON невалиден</span> Проверь tasks/archive`); return; }
        const form = readTaskForm();
        const res = upsertTask(data.tasks, form, "add");
        if(!res.ok){
          if(res.reason === "no_title") setTMsg(`<span class="tag accent">Нужен заголовок</span>`);
          else if(res.reason === "exists") setTMsg(`<span class="tag accent">ID уже существует</span>`);
          else setTMsg(`<span class="tag accent">Ошибка</span>`);
          return;
        }
        $("#admTId").value = res.id;
        writeJson("adm_tasks_json", data.tasks);
        setTMsg(`<span class="tag">OK</span> Добавлено: <span class="tag">${esc(res.id)}</span>`);
      };
    }

    if(btnUpd){
      btnUpd.onclick = () => {
        const data = getArrays();
        if(!data){ setTMsg(`<span class="tag accent">JSON невалиден</span> Проверь tasks/archive`); return; }
        const form = readTaskForm();
        const id = (form.id || "").trim();
        if(!id){ setTMsg(`<span class="tag accent">Нужен ID</span>`); return; }
        const res = upsertTask(data.tasks, form, "update");
        if(!res.ok){
          if(res.reason === "no_title") setTMsg(`<span class="tag accent">Нужен заголовок</span>`);
          else if(res.reason === "not_found") setTMsg(`<span class="tag accent">ID не найден в активных</span>`);
          else setTMsg(`<span class="tag accent">Ошибка</span>`);
          return;
        }
        writeJson("adm_tasks_json", data.tasks);
        setTMsg(`<span class="tag">OK</span> Обновлено: <span class="tag">${esc(id)}</span>`);
      };
    }

    if(btnDel){
      btnDel.onclick = () => {
        const data = getArrays();
        if(!data){ setTMsg(`<span class="tag accent">JSON невалиден</span> Проверь tasks/archive`); return; }
        const id = ($("#admTId")?.value || "").trim();
        if(!id){ setTMsg(`<span class="tag accent">Нужен ID</span>`); return; }
        const res = deleteById(data.tasks, id);
        if(!res.ok){ setTMsg(`<span class="tag accent">Не найдено</span>`); return; }
        writeJson("adm_tasks_json", data.tasks);
        setTMsg(`<span class="tag">OK</span> Удалено из активных: <span class="tag">${esc(id)}</span>`);
      };
    }

    if(btnArch){
      btnArch.onclick = () => {
        const data = getArrays();
        if(!data){ setTMsg(`<span class="tag accent">JSON невалиден</span> Проверь tasks/archive`); return; }
        const id = ($("#admTId")?.value || "").trim();
        if(!id){ setTMsg(`<span class="tag accent">Нужен ID</span>`); return; }
        const res = moveToArchiveById(data.tasks, data.arch, id);
        if(!res.ok){ setTMsg(`<span class="tag accent">Не найдено в активных</span>`); return; }
        writeJson("adm_tasks_json", data.tasks);
        writeJson("adm_tasks_archive_json", data.arch);
        setTMsg(`<span class="tag">OK</span> В архив: <span class="tag">${esc(id)}</span>`);
      };
    }

    if(btnClr){
      btnClr.onclick = () => { clearTaskForm(); setTMsg(""); };
    }
  }

  async function showEditor(){
    setPanelTitle("Админка");
    setStatus("—");

    const list = $("#list");
    const viewer = $("#viewer");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    const staff = await API.json("./content/data/staff.json").catch(()=>[]);
    const templates = await API.json("./content/data/task_templates.json").catch(()=>[]);
    const tasks = await API.json("./content/data/tasks.json").catch(()=>[]);
    const arch  = await API.json("./content/data/tasks_archive.json").catch(()=>[]);

    const staffNames = getStaffNames(staff);

    viewer.innerHTML = `
      <textarea id="adm_task_templates_json" style="display:none;">${esc(pretty(templates))}</textarea>

      ${opsBlock()}
      ${taskFormBlock(staffNames, templates)}
      ${block("Сотрудники", "staff.json", pretty(staff))}
      ${block("Задачи (активные)", "tasks.json", pretty(tasks))}
      ${block("Архив задач", "tasks_archive.json", pretty(arch))}
    `;

    wireCommon(viewer);
    wireTaskForm();

    validateJson("adm_staff_json");
    validateJson("adm_tasks_json");
    validateJson("adm_tasks_archive_json");

    // nice defaults
    const d = new Date();
    const pad = (n) => (n<10 ? "0"+n : ""+n);
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const dateInp = $("#admTDate");
    if(dateInp && !dateInp.value) dateInp.value = `${yyyy}-${mm}-${dd}`;
  }

  async function show(){
    setPanelTitle("Админка");
    setStatus("—");

    const list = $("#list");
    const viewer = $("#viewer");
    if(list) list.innerHTML = "";
    if(!viewer) return;

    const stored = (localStorage.getItem(PIN_KEY) || "");

    if(isUnlocked()){
      await showEditor();
      return;
    }

    viewer.innerHTML = pinScreen(stored);
    wirePin();
  }

  async function open(){ await show(); }
  return { show, open };
})();

