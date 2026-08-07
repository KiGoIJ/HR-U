/**

 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  get,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { firebaseConfig, HOST_KEY, ADMIN_KEY } from "./firebase-config.js";

/* ========== Firebase ========== */
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const paths = {
  positions: "rp/positions",
  applications: "rp/applications",
  calls: "rp/calls",
  results: "rp/results",
  logs: "rp/logs",
  scripts: "rp/scripts",
  settings: "rp/settings",
};

/* ========== Seed (first run) ========== */
const SEED_POSITIONS = [
  {
    id: "nach-otd",
    title: "Начальник отдела",
    department: "Территориальное подразделение",
    level: "руководитель",
    status: "open",
    slots: 2,
    tags: ["руководство", "ДС-обзвон"],
    summary: "Организация работы отдела, контроль исполнения, взаимодействие со смежными.",
    requirements: [
      "Опыт руководства от 3 лет (РП-бэк)",
      "Знание устава и субординации",
      "Готовность к ненормированному онлайну",
      "Адекват в войсе, без ООС-токсика на линии",
    ],
    duties: [
      "Руководство отделом",
      "Постановка задач и контроль",
      "Отчётность куратору",
      "Работа с личным составом",
    ],
  },
  {
    id: "zam-nach-otd",
    title: "Заместитель начальника отдела",
    department: "Территориальное подразделение",
    level: "заместитель",
    status: "open",
    slots: 3,
    tags: ["зам", "ДС-обзвон"],
    summary: "Замещение руководителя, координация направлений, контроль поручений.",
    requirements: [
      "Опыт от 2 лет в структуре (РП)",
      "Умение вести документацию / рапорты",
      "Стрессоустойчивость на войсе",
    ],
    duties: [
      "Замещение нач. отдела",
      "Координация направлений",
      "Наставничество новичков",
    ],
  },
  {
    id: "nach-analit",
    title: "Начальник аналитического направления",
    department: "Аналитический блок",
    level: "руководитель",
    status: "open",
    slots: 1,
    tags: ["аналитика"],
    summary: "Постановка задач аналитикам, качество докладов, методичка.",
    requirements: [
      "Сильный РП-бэк в аналитике / разведке",
      "Умение писать отчёты",
      "Опыт координации группы",
    ],
    duties: ["Руководство группой", "Проверка материалов", "Взаимодействие с заказчиками"],
  },
  {
    id: "zam-nach-upr",
    title: "Заместитель начальника управления",
    department: "Управленческий аппарат",
    level: "заместитель",
    status: "open",
    slots: 1,
    tags: ["управление", "старший состав"],
    summary: "Координация блоков, контроль KPI, участие в орг. решениях.",
    requirements: [
      "Существенный руководящий бэк",
      "Опыт замещения первого лица",
      "Готовность к многоэтапному отбору",
    ],
    duties: ["Координация блоков", "Контроль поручений", "Участие в совещаниях"],
  },
];

const SEED_SCRIPTS = {
  default: {
    title: "Базовый скрипт обзвона (Discord)",
    greeting:
      "Привет. Я {host}, провожу обзвон на должность «{position}». Сейчас удобно 10–15 минут в войсе / здесь в ЛС?",
    ifBusy: "Ок, напиши когда удобно — поставлю в очередь перезвона.",
    pitch:
      "Кратко: ищем человека на «{position}» ({department}). Это РП-отбор: смотрим бэк, адекват, понимание субординации и готовность к нагрузке. Трудоустройство в РП не гарантируем по звонку — только допуск дальше.",
    questions: [
      "Как давно в проекте / комьюнити и какой общий РП-стаж?",
      "Был ли опыт руководства сменой / отделом / фракцией? Расскажи коротко.",
      "Почему именно эта должность, а не соседняя?",
      "Как отреагируешь, если подчинённый сорвал задачу в важный момент?",
      "Готов(а) к проверкам, войсам с куратором и ненормированному онлайну?",
      "Есть ли конфликты / варны / блоки, о которых нам важно знать заранее?",
      "Свободные дни/часы для онлайна на этой неделе?",
    ],
    closePass:
      "Ок, фиксирую «пройден первичный обзвон». Дальше — очный этап / второй войс с куратором. Напишу в ЛС слот.",
    closeFail:
      "Спасибо за время. По этой позиции сейчас не проходим. Можем оставить контакт на другие роли — ок?",
    oocNote:
      "ООС: это игровой обзвон. Без реальных ПДн, без реальных номеров. Только Discord / игровой ник. Не давим, не токсим, не обещаем пост гарантированно.",
  },
};

const CALL_RESULTS = [
  { id: "noanswer", label: "Не ответил / оффлайн", status: "noanswer", public: "Недозвон" },
  { id: "callback", label: "Перезвонить позже", status: "callback", public: "Перезвон" },
  { id: "pass", label: "Прошёл обзвон", status: "pass", public: "Прошёл" },
  { id: "fail", label: "Не прошёл", status: "fail", public: "Не прошёл" },
  { id: "interview", label: "На второй этап", status: "interview", public: "2-й этап" },
  { id: "reject_self", label: "Сам отказался", status: "fail", public: "Отказ кандидата" },
];

const STATUS_META = {
  new: { label: "Новая заявка", cls: "b-new" },
  queued: { label: "В очереди", cls: "b-queued" },
  calling: { label: "На линии", cls: "b-calling" },
  noanswer: { label: "Недозвон", cls: "b-noanswer" },
  callback: { label: "Перезвонить", cls: "b-callback" },
  pass: { label: "Прошёл", cls: "b-pass" },
  fail: { label: "Не прошёл", cls: "b-fail" },
  interview: { label: "2-й этап", cls: "b-interview" },
};

/* ========== State ========== */
const state = {
  page: "home",
  positions: {},
  applications: {},
  calls: {},
  results: {},
  logs: {},
  scripts: {},
  selectedAppId: null,
  selectedResult: null,
  editingPosId: null,
  hostAuthed: sessionStorage.getItem("rp_host") === "1",
  adminAuthed: sessionStorage.getItem("rp_admin") === "1",
  hostName: localStorage.getItem("rp_host_name") || "Ведущий",
  adminName: localStorage.getItem("rp_admin_name") || "Начальство",
  connected: false,
  filter: { q: "", status: "", positionId: "" },
  dataTab: "positions",
  unsubscribers: [],
};

/* ========== Utils ========== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function toast(msg, type = "") {
  let host = $("#toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .2s";
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

function badge(status) {
  const m = STATUS_META[status] || { label: status || "—", cls: "b-draft" };
  return `<span class="badge ${m.cls}">${esc(m.label)}</span>`;
}

function posTitle(id) {
  const p = state.positions[id];
  return p ? p.title : id || "—";
}

function appList(filter = {}) {
  let list = Object.values(state.applications);
  if (filter.status) list = list.filter((a) => a.status === filter.status);
  if (filter.positionId) list = list.filter((a) => a.positionId === filter.positionId);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((a) =>
      [a.rpName, a.discord, a.staticId, a.city, a.notes, a.experience]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list;
}

function stats() {
  const apps = Object.values(state.applications);
  const by = (s) => apps.filter((a) => a.status === s).length;
  return {
    total: apps.length,
    queue: by("new") + by("queued") + by("calling"),
    callback: by("callback") + by("noanswer"),
    pass: by("pass"),
    fail: by("fail"),
    interview: by("interview"),
    calls: Object.keys(state.calls).length,
    openPos: Object.values(state.positions).filter((p) => p.status === "open").length,
  };
}

/* ========== Logging all IO ========== */
async function writeLog(direction, kind, payload) {
  try {
    const id = uid("log");
    await set(ref(db, `${paths.logs}/${id}`), {
      id,
      direction, // inbound | outbound | system
      kind,
      payload: payload || {},
      at: nowIso(),
      host: state.hostName || null,
    });
  } catch (e) {
    console.warn("log failed", e);
  }
}

/* ========== Seed if empty ========== */
async function ensureSeed() {
  const posSnap = await get(ref(db, paths.positions));
  if (!posSnap.exists()) {
    const obj = {};
    SEED_POSITIONS.forEach((p) => {
      obj[p.id] = { ...p, updatedAt: nowIso() };
    });
    await set(ref(db, paths.positions), obj);
    await writeLog("system", "seed_positions", { count: SEED_POSITIONS.length });
  }
  const scSnap = await get(ref(db, paths.scripts));
  if (!scSnap.exists()) {
    await set(ref(db, paths.scripts), SEED_SCRIPTS);
    await writeLog("system", "seed_scripts", {});
  }
}

/* ========== Subscribe ========== */
function bindData() {
  const pairs = [
    ["positions", paths.positions],
    ["applications", paths.applications],
    ["calls", paths.calls],
    ["results", paths.results],
    ["scripts", paths.scripts],
  ];
  pairs.forEach(([key, path]) => {
    const r = ref(db, path);
    const unsub = onValue(
      r,
      (snap) => {
        state[key] = snap.val() || {};
        state.connected = true;
        render();
      },
      (err) => {
        console.error(err);
        state.connected = false;
        toast("Firebase: " + (err.message || "ошибка чтения"), "err");
        render();
      }
    );
    state.unsubscribers.push(unsub);
  });

  // logs — last 100
  const logsRef = query(ref(db, paths.logs), limitToLast(120));
  const unsubLogs = onValue(logsRef, (snap) => {
    state.logs = snap.val() || {};
    if (state.page === "data" || state.page === "home") render();
  });
  state.unsubscribers.push(unsubLogs);
}

/* ========== Actions ========== */
async function submitApplication(data) {
  const id = uid("app");
  const record = {
    id,
    rpName: data.rpName.trim(),
    discord: data.discord.trim(),
    staticId: (data.staticId || "").trim(),
    city: (data.city || "").trim(),
    positionId: data.positionId,
    experience: (data.experience || "").trim(),
    timezone: (data.timezone || "").trim(),
    ageRp: (data.ageRp || "").trim(),
    notes: (data.notes || "").trim(),
    consent: true,
    status: "new",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    answers: {},
    lastCallAt: null,
    callbackAt: null,
    resultSummary: null,
  };
  await set(ref(db, `${paths.applications}/${id}`), record);
  await writeLog("inbound", "application", {
    id,
    rpName: record.rpName,
    discord: record.discord,
    positionId: record.positionId,
  });

  // public result stub
  await set(ref(db, `${paths.results}/${id}`), {
    id,
    rpName: record.rpName,
    discordTag: maskDiscord(record.discord),
    positionId: record.positionId,
    positionTitle: posTitle(record.positionId) || record.positionId,
    status: "new",
    statusLabel: STATUS_META.new.label,
    updatedAt: nowIso(),
    publicNote: "Заявка принята, ожидает обзвона",
  });
  await writeLog("outbound", "result_created", { id, status: "new" });
  return record;
}

function maskDiscord(d) {
  if (!d) return "—";
  // show full for RP board — it's already a nick; keep as is but strip #0000 noise optionally
  return d;
}

async function saveCallOutcome(appId, payload) {
  const appRec = state.applications[appId];
  if (!appRec) throw new Error("Заявка не найдена");

  const resultDef = CALL_RESULTS.find((r) => r.id === payload.resultId);
  if (!resultDef) throw new Error("Выберите результат");

  const callId = uid("call");
  const at = nowIso();
  const call = {
    id: callId,
    applicationId: appId,
    rpName: appRec.rpName,
    discord: appRec.discord,
    positionId: appRec.positionId,
    host: state.hostName,
    resultId: payload.resultId,
    resultLabel: resultDef.label,
    status: resultDef.status,
    note: payload.note || "",
    answers: payload.answers || {},
    callbackAt: payload.callbackAt || null,
    at,
  };

  await set(ref(db, `${paths.calls}/${callId}`), call);
  await writeLog("outbound", "call_saved", {
    callId,
    applicationId: appId,
    resultId: payload.resultId,
    host: state.hostName,
  });

  const appUpdate = {
    status: resultDef.status,
    updatedAt: at,
    lastCallAt: at,
    resultSummary: resultDef.label,
    answers: payload.answers || appRec.answers || {},
    lastNote: payload.note || "",
    lastHost: state.hostName,
  };
  if (payload.callbackAt) appUpdate.callbackAt = payload.callbackAt;

  await update(ref(db, `${paths.applications}/${appId}`), appUpdate);
  await writeLog("outbound", "application_updated", {
    id: appId,
    status: resultDef.status,
  });

  // public board
  const publicNote =
    payload.publicNote ||
    ({
      pass: "Прошёл первичный обзвон",
      fail: "Не прошёл обзвон",
      interview: "Приглашён на второй этап",
      callback: "Назначен перезвон",
      noanswer: "Не удалось связаться",
    }[resultDef.status] || resultDef.public);

  await set(ref(db, `${paths.results}/${appId}`), {
    id: appId,
    rpName: appRec.rpName,
    discordTag: maskDiscord(appRec.discord),
    positionId: appRec.positionId,
    positionTitle: posTitle(appRec.positionId),
    status: resultDef.status,
    statusLabel: STATUS_META[resultDef.status]?.label || resultDef.public,
    updatedAt: at,
    publicNote,
    host: state.hostName,
    callId,
  });
  await writeLog("outbound", "result_published", {
    id: appId,
    status: resultDef.status,
    publicNote,
  });

  return call;
}

async function setAppStatus(appId, status) {
  await update(ref(db, `${paths.applications}/${appId}`), {
    status,
    updatedAt: nowIso(),
  });
  const appRec = state.applications[appId];
  if (appRec) {
    await update(ref(db, `${paths.results}/${appId}`), {
      status,
      statusLabel: STATUS_META[status]?.label || status,
      updatedAt: nowIso(),
    });
  }
  await writeLog("outbound", "status_set", { id: appId, status });
}

async function deleteApplication(appId) {
  await remove(ref(db, `${paths.applications}/${appId}`));
  await remove(ref(db, `${paths.results}/${appId}`));
  await writeLog("system", "application_deleted", { id: appId });
}

/* ========== Positions CRUD (Начальство) ========== */
function slugifyPosId(title) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  let s = String(title || "")
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return s || uid("pos");
}

function parseLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseTags(text) {
  return String(text || "")
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function savePosition(data, existingId = null) {
  const title = (data.title || "").trim();
  if (!title) throw new Error("Укажите название должности");

  let id = existingId || (data.id || "").trim() || slugifyPosId(title);
  // unique if new
  if (!existingId && state.positions[id]) {
    id = id + "-" + Math.random().toString(36).slice(2, 5);
  }

  const prev = existingId ? state.positions[existingId] : null;
  const record = {
    id,
    title,
    department: (data.department || "").trim() || "Подразделение",
    level: (data.level || "руководитель").trim(),
    status: data.status === "closed" || data.status === "draft" ? data.status : "open",
    slots: Math.max(1, Number(data.slots) || 1),
    tags: Array.isArray(data.tags) ? data.tags : parseTags(data.tags),
    summary: (data.summary || "").trim(),
    requirements: Array.isArray(data.requirements)
      ? data.requirements
      : parseLines(data.requirements),
    duties: Array.isArray(data.duties) ? data.duties : parseLines(data.duties),
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso(),
    updatedBy: state.adminName || state.hostName || "admin",
  };

  await set(ref(db, `${paths.positions}/${id}`), record);
  await writeLog("outbound", existingId ? "position_updated" : "position_created", {
    id,
    title: record.title,
    status: record.status,
    by: record.updatedBy,
  });
  return record;
}

async function setPositionStatus(id, status) {
  const p = state.positions[id];
  if (!p) throw new Error("Должность не найдена");
  await update(ref(db, `${paths.positions}/${id}`), {
    status,
    updatedAt: nowIso(),
    updatedBy: state.adminName || "admin",
  });
  await writeLog("outbound", "position_status", {
    id,
    title: p.title,
    status,
    by: state.adminName || "admin",
  });
}

async function deletePosition(id) {
  const p = state.positions[id];
  if (!p) return;
  const linked = appList().filter((a) => a.positionId === id).length;
  if (linked > 0) {
    // soft-close instead of hard delete if there are applications
    await setPositionStatus(id, "closed");
    await writeLog("system", "position_soft_closed", { id, linked });
    return { soft: true, linked };
  }
  await remove(ref(db, `${paths.positions}/${id}`));
  await writeLog("system", "position_deleted", { id, title: p.title });
  return { soft: false };
}

/* ========== Router / Nav ========== */
function setPage(page) {
  state.page = page;
  const url = new URL(location.href);
  url.hash = page;
  history.replaceState(null, "", url.toString());
  render();
  window.scrollTo(0, 0);
}

function currentPage() {
  const h = (location.hash || "#home").replace("#", "") || "home";
  return h;
}

/* ========== Render shell ========== */
function shell(content) {
  const s = stats();
  const pages = [
    { id: "home", label: "Главная" },
    { id: "positions", label: "Должности" },
    { id: "apply", label: "Регистрация" },
    { id: "results", label: "Результаты" },
    { id: "host", label: "Кабинет ведущего" },
    { id: "admin", label: "Начальство" },
    { id: "data", label: "База / логи" },
  ];

  return `
  <nav class="topnav">
    <a class="brand" href="#home" data-nav="home">
      <div class="brand-mark">RP</div>
      <div>Call Desk<span class="sub">Discord-обзвоны · РП</span></div>
    </a>
    <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Меню">☰</button>
    <div class="nav-links" id="nav-links">
      ${pages
        .map(
          (p) =>
            `<a href="#${p.id}" data-nav="${p.id}" class="${
              state.page === p.id ? "active" : ""
            }">${p.label}</a>`
        )
        .join("")}
    </div>
    <div class="row" style="gap:8px">
      <span class="text-sm muted row" title="Firebase">
        <span class="live-dot ${state.connected ? "" : "off"}"></span>
        ${state.connected ? "online" : "…"}
      </span>
    </div>
  </nav>
  <main class="page">${content}</main>
  <footer class="footer">
    РП-инструмент для обзвонов в Discord · без реальных номеров и ПДн ·
    очередь ${s.queue} · результатов ${Object.keys(state.results).length}
  </footer>
  <div class="modal-bg" id="modal-bg"></div>
  `;
}

/* ========== Pages ========== */
function pageHome() {
  const s = stats();
  const recent = Object.values(state.results)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 8);
  const queue = appList()
    .filter((a) => ["new", "queued", "callback", "noanswer"].includes(a.status))
    .slice(0, 5);

  return `
  <div class="hero">
    <h1>Обзвоны на руководящие должности</h1>
    <p>
      РП-контур: игрок подаёт заявку → ведущий проводит обзвон в Discord →
      результат публикуется на табло. Все входящие и исходящие события пишутся в Firebase.
    </p>
    <div class="hero-actions">
      <a class="btn btn-primary btn-lg" href="#apply" data-nav="apply">Подать заявку</a>
      <a class="btn btn-lg" href="#results" data-nav="results">Смотреть результаты</a>
      <a class="btn btn-lg" href="#host" data-nav="host">Кабинет ведущего</a>
      <a class="btn btn-lg" href="#admin" data-nav="admin">Начальство</a>
    </div>
  </div>

  <div class="grid grid-4 mb-16">
    <div class="card stat accent"><div class="lbl">В очереди</div><div class="val">${s.queue}</div><div class="hint">новые + в работе</div></div>
    <div class="card stat warn"><div class="lbl">Перезвон</div><div class="val">${s.callback}</div><div class="hint">оффлайн / позже</div></div>
    <div class="card stat ok"><div class="lbl">Прошли</div><div class="val">${s.pass}</div><div class="hint">+ 2-й этап: ${s.interview}</div></div>
    <div class="card stat"><div class="lbl">Всего заявок</div><div class="val">${s.total}</div><div class="hint">звонков: ${s.calls}</div></div>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <div class="card-h"><h3>Очередь обзвона</h3><a class="btn btn-sm" href="#host" data-nav="host">Открыть</a></div>
      <div class="card-b" style="padding:0">
        ${
          queue.length
            ? `<div class="table-wrap"><table class="data"><thead><tr><th>Игрок</th><th>Должность</th><th>Статус</th></tr></thead><tbody>
            ${queue
              .map(
                (a) => `<tr>
                <td><div class="fw-700">${esc(a.rpName)}</div><div class="text-sm mono muted">${esc(
                  a.discord
                )}</div></td>
                <td>${esc(posTitle(a.positionId))}</td>
                <td>${badge(a.status)}</td>
              </tr>`
              )
              .join("")}
            </tbody></table></div>`
            : `<div class="empty"><h4>Очередь пуста</h4><p>Новые заявки появятся после регистрации.</p></div>`
        }
      </div>
    </div>
    <div class="card">
      <div class="card-h"><h3>Последние результаты</h3><a class="btn btn-sm" href="#results" data-nav="results">Все</a></div>
      <div class="card-b" style="padding:0">
        ${
          recent.length
            ? `<div class="table-wrap"><table class="data"><thead><tr><th>Игрок</th><th>Итог</th><th>Когда</th></tr></thead><tbody>
            ${recent
              .map(
                (r) => `<tr>
                <td class="fw-700">${esc(r.rpName)}</td>
                <td>${badge(r.status)}</td>
                <td class="text-sm muted">${esc(fmtDate(r.updatedAt))}</td>
              </tr>`
              )
              .join("")}
            </tbody></table></div>`
            : `<div class="empty"><h4>Пока пусто</h4><p>После обзвонов сюда уйдут публичные итоги.</p></div>`
        }
      </div>
    </div>
  </div>

  <div class="alert alert-info mt-16">
    <div>
      <strong>Это РП.</strong> Никаких реальных телефонов и паспортов.
      Идентификация — Discord и игровой ник. Обзвон только в Discord (войс / ЛС).
    </div>
  </div>
  `;
}

function pagePositions() {
  const all = Object.values(state.positions);
  const open = all.filter((p) => p.status === "open");
  const closed = all.filter((p) => p.status !== "open");

  function card(p, canApply) {
    const n = appList().filter((a) => a.positionId === p.id).length;
    const stLabel =
      p.status === "open" ? "Вакантна" : p.status === "draft" ? "Черновик" : "Снята";
    const stCls =
      p.status === "open" ? "b-open" : p.status === "draft" ? "b-draft" : "b-closed";
    return `
      <article class="card pos-card">
        <div class="row" style="justify-content:space-between">
          <div>
            <h3>${esc(p.title)}</h3>
            <div class="dept">${esc(p.department)} · ${esc(p.level || "")}</div>
          </div>
          <span class="badge ${stCls}">${esc(stLabel)}</span>
        </div>
        <div class="desc">${esc(p.summary || "")}</div>
        <div class="tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          <span class="tag">мест: ${esc(p.slots || 1)}</span>
          <span class="tag">заявок: ${n}</span>
        </div>
        <details class="mt-8">
          <summary class="text-sm secondary" style="cursor:pointer">Требования и обязанности</summary>
          <div class="mt-8 text-sm secondary">
            <strong>Требования</strong>
            <ul style="margin:6px 0 10px 16px">${(p.requirements || [])
              .map((x) => `<li>${esc(x)}</li>`)
              .join("") || "<li class='muted'>—</li>"}</ul>
            <strong>Обязанности</strong>
            <ul style="margin:6px 0 0 16px">${(p.duties || [])
              .map((x) => `<li>${esc(x)}</li>`)
              .join("") || "<li class='muted'>—</li>"}</ul>
          </div>
        </details>
        ${
          canApply
            ? `<a class="btn btn-primary btn-sm mt-8" href="#apply" data-nav="apply" data-pos="${esc(
                p.id
              )}">Подать заявку</a>`
            : `<div class="text-sm muted mt-8">Набор закрыт</div>`
        }
      </article>`;
  }

  return `
  <div class="row mb-16">
    <div class="section-title" style="margin:0">Вакантные должности <span class="count">${open.length}</span></div>
    <div class="spacer"></div>
    <a class="btn btn-sm" href="#admin" data-nav="admin">Управление (начальство)</a>
  </div>
  <div class="alert alert-info mb-16">
    Открытые позиции для РП-отбора. Ставит и снимает вакансии <strong>начальство</strong> в кабинете админа.
  </div>
  <div class="pos-grid">
    ${
      open.map((p) => card(p, true)).join("") ||
      `<div class="empty card"><h4>Нет открытых вакансий</h4><p>Начальство ещё не выставило должности или все сняты.</p></div>`
    }
  </div>
  ${
    closed.length
      ? `<div class="section-title mt-16">Снятые / черновики <span class="count">${closed.length}</span></div>
         <div class="pos-grid">${closed.map((p) => card(p, false)).join("")}</div>`
      : ""
  }`;
}

function pageApply() {
  const positions = Object.values(state.positions).filter((p) => p.status === "open");
  const pre = new URLSearchParams(location.search).get("position") || "";
  return `
  <div class="section-title">Регистрация на обзвон</div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-h"><h3>Заявка</h3></div>
      <div class="card-b">
        <div class="alert alert-warn mb-16">
          Только игровые данные: RP-имя, Discord, static ID. Реальные ФИО/телефон/адрес — не нужны и не собираем.
        </div>
        <form id="apply-form" class="form-grid">
          <div class="field">
            <label>RP-имя / позывной <span class="req">*</span></label>
            <input name="rpName" required maxlength="64" placeholder="Ivan Petrov" />
          </div>
          <div class="field">
            <label>Discord <span class="req">*</span></label>
            <input name="discord" required maxlength="64" placeholder="nickname или name#0001" />
            <div class="hint">По нему ведущий найдёт тебя для обзвона</div>
          </div>
          <div class="field">
            <label>Static / game ID</label>
            <input name="staticId" maxlength="32" placeholder="12345" />
          </div>
          <div class="field">
            <label>Город / регион (РП)</label>
            <input name="city" maxlength="64" placeholder="Ижевск" />
          </div>
          <div class="field full">
            <label>Должность <span class="req">*</span></label>
            <select name="positionId" required>
              <option value="">— выбери —</option>
              ${positions
                .map(
                  (p) =>
                    `<option value="${esc(p.id)}" ${pre === p.id ? "selected" : ""}>${esc(
                      p.title
                    )} · ${esc(p.department)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>Возраст персонажа</label>
            <input name="ageRp" maxlength="8" placeholder="34" />
          </div>
          <div class="field">
            <label>Часовой пояс / онлайн</label>
            <input name="timezone" maxlength="64" placeholder="МСК, вечера" />
          </div>
          <div class="field full">
            <label>Опыт (РП-бэк)</label>
            <textarea name="experience" placeholder="Где служил/руководил, сколько сезонов, ключевые моменты…"></textarea>
          </div>
          <div class="field full">
            <label>Комментарий ведущему</label>
            <textarea name="notes" placeholder="Удобное время для войса, ссылка на тикет…"></textarea>
          </div>
          <div class="field full">
            <label class="check">
              <input type="checkbox" name="consent" required />
              <span>Понимаю, что это РП-отбор в Discord; согласен на обработку указанных игровых данных на сайте и в Firebase</span>
            </label>
          </div>
          <div class="field full row">
            <button type="submit" class="btn btn-primary btn-lg">Отправить заявку</button>
          </div>
        </form>
        <div id="apply-ok" class="mt-16" style="display:none"></div>
      </div>
    </div>
    <div class="stack">
      <div class="card card-b">
        <h3 style="font-size:15px;margin-bottom:8px">Как проходит</h3>
        <ol style="margin-left:18px;color:var(--text-2);font-size:13.5px;display:flex;flex-direction:column;gap:8px">
          <li>Оставляешь заявку на сайте</li>
          <li>Попадаешь в очередь кабинета ведущего</li>
          <li>Обзвон в Discord (войс или ЛС)</li>
          <li>Результат появляется на вкладке «Результаты»</li>
        </ol>
      </div>
      <div class="card card-b">
        <h3 style="font-size:15px;margin-bottom:8px">Открыто сейчас</h3>
        <ul style="margin-left:18px;font-size:13.5px;color:var(--text-2)">
          ${positions.map((p) => `<li style="margin-bottom:6px"><strong>${esc(p.title)}</strong></li>`).join("") || "<li>Нет открытых</li>"}
        </ul>
      </div>
    </div>
  </div>`;
}

function pageResults() {
  const list = Object.values(state.results).sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );
  const fStatus = state.filter.status || "";
  const filtered = fStatus ? list.filter((r) => r.status === fStatus) : list;

  return `
  <div class="section-title">Публичные результаты <span class="count">${filtered.length}</span></div>
  <div class="filters">
    <select id="res-status">
      <option value="">Все статусы</option>
      ${Object.entries(STATUS_META)
        .map(
          ([k, v]) =>
            `<option value="${k}" ${fStatus === k ? "selected" : ""}>${esc(v.label)}</option>`
        )
        .join("")}
    </select>
    <input type="search" id="res-q" placeholder="Поиск по нику…" value="${esc(
      state.filter.q || ""
    )}" />
  </div>
  <div class="card">
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Игрок</th>
            <th>Discord</th>
            <th>Должность</th>
            <th>Статус</th>
            <th>Комментарий</th>
            <th>Обновлено</th>
          </tr>
        </thead>
        <tbody>
          ${
            filtered.length
              ? filtered
                  .filter((r) => {
                    const q = (state.filter.q || "").toLowerCase();
                    if (!q) return true;
                    return [r.rpName, r.discordTag, r.positionTitle, r.publicNote]
                      .join(" ")
                      .toLowerCase()
                      .includes(q);
                  })
                  .map(
                    (r) => `<tr>
                    <td class="fw-700">${esc(r.rpName)}</td>
                    <td class="mono text-sm">${esc(r.discordTag || "—")}</td>
                    <td>${esc(r.positionTitle || posTitle(r.positionId))}</td>
                    <td>${badge(r.status)}</td>
                    <td class="text-sm secondary">${esc(r.publicNote || "—")}</td>
                    <td class="text-sm muted">${esc(fmtDate(r.updatedAt))}</td>
                  </tr>`
                  )
                  .join("")
              : `<tr><td colspan="6"><div class="empty"><h4>Нет результатов</h4><p>После обзвонов таблица заполнится автоматически.</p></div></td></tr>`
          }
        </tbody>
      </table>
    </div>
  </div>`;
}

function pageHostGate() {
  return `
  <div class="section-title">Кабинет ведущего</div>
  <div class="card" style="max-width:420px">
    <div class="card-b">
      <p class="secondary text-sm mb-16">Доступ для проводящих обзвон. Ключ задаётся в <span class="mono">firebase-config.js</span> → <span class="mono">HOST_KEY</span>.</p>
      <div class="field mb-16">
        <label>Твой ник ведущего</label>
        <input id="host-name" value="${esc(state.hostName)}" maxlength="40" />
      </div>
      <div class="field mb-16">
        <label>Ключ доступа</label>
        <input id="host-key" type="password" placeholder="••••••••" />
      </div>
      <button type="button" class="btn btn-primary btn-block" id="host-login">Войти</button>
    </div>
  </div>`;
}

function pageHost() {
  if (!state.hostAuthed) return pageHostGate();

  const filterStatus = state.filter.hostStatus || "active";
  let list = appList();
  if (filterStatus === "active") {
    list = list.filter((a) =>
      ["new", "queued", "calling", "callback", "noanswer", "interview"].includes(a.status)
    );
  } else if (filterStatus !== "all") {
    list = list.filter((a) => a.status === filterStatus);
  }
  if (state.filter.positionId) {
    list = list.filter((a) => a.positionId === state.filter.positionId);
  }

  const selected =
    (state.selectedAppId && state.applications[state.selectedAppId]) || list[0] || null;
  if (selected && state.selectedAppId !== selected.id) state.selectedAppId = selected.id;

  const script = state.scripts.default || SEED_SCRIPTS.default;
  const pos = selected ? state.positions[selected.positionId] : null;

  const fill = (t) =>
    (t || "")
      .replaceAll("{host}", state.hostName)
      .replaceAll("{position}", pos?.title || posTitle(selected?.positionId))
      .replaceAll("{department}", pos?.department || "")
      .replaceAll("{name}", selected?.rpName || "");

  return `
  <div class="row mb-16">
    <div class="section-title" style="margin:0">Кабинет ведущего</div>
    <div class="spacer"></div>
    <span class="text-sm secondary">Ведущий: <strong>${esc(state.hostName)}</strong></span>
    <button type="button" class="btn btn-sm btn-ghost" id="host-logout">Выйти</button>
  </div>

  <div class="filters">
    <select id="host-filter-status">
      <option value="active" ${filterStatus === "active" ? "selected" : ""}>Активные</option>
      <option value="all" ${filterStatus === "all" ? "selected" : ""}>Все</option>
      ${Object.entries(STATUS_META)
        .map(
          ([k, v]) =>
            `<option value="${k}" ${filterStatus === k ? "selected" : ""}>${esc(v.label)}</option>`
        )
        .join("")}
    </select>
    <select id="host-filter-pos">
      <option value="">Все должности</option>
      ${Object.values(state.positions)
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${
              state.filter.positionId === p.id ? "selected" : ""
            }>${esc(p.title)}</option>`
        )
        .join("")}
    </select>
  </div>

  <div class="call-layout">
    <div class="card">
      <div class="card-h"><h3>Очередь</h3><span class="count" style="font-size:12px;color:var(--text-3)">${list.length}</span></div>
      <ul class="queue-list" id="queue-list">
        ${
          list.length
            ? list
                .map(
                  (a) => `<li class="queue-item ${
                    selected && a.id === selected.id ? "active" : ""
                  }" data-app="${esc(a.id)}">
                  <div class="row" style="justify-content:space-between">
                    <div class="name">${esc(a.rpName)}</div>
                    ${badge(a.status)}
                  </div>
                  <div class="meta">${esc(posTitle(a.positionId))}</div>
                  <div class="discord">${esc(a.discord)}</div>
                </li>`
                )
                .join("")
            : `<li class="empty"><h4>Пусто</h4></li>`
        }
      </ul>
    </div>

    <div class="card">
      <div class="card-h"><h3>Карточка обзвона</h3></div>
      <div class="card-b" id="call-card">
        ${
          selected
            ? `
          <div class="row" style="justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:22px;font-weight:800">${esc(selected.rpName)}</div>
              <div class="mono mt-8" style="color:#8ea1ff;font-size:16px">${esc(
                selected.discord
              )}</div>
              <div class="mt-8">${badge(selected.status)}</div>
            </div>
            <div class="stack" style="gap:8px">
              <button type="button" class="btn btn-primary btn-sm" id="btn-copy-discord">Копировать Discord</button>
              <a class="btn btn-sm" href="https://discord.com/channels/@me" target="_blank" rel="noopener">Открыть Discord</a>
            </div>
          </div>
          <div class="divider"></div>
          <div class="grid" style="gap:8px;font-size:13.5px">
            <div class="row"><span class="muted" style="min-width:120px">Должность</span><span>${esc(
              posTitle(selected.positionId)
            )}</span></div>
            <div class="row"><span class="muted" style="min-width:120px">Static</span><span>${esc(
              selected.staticId || "—"
            )}</span></div>
            <div class="row"><span class="muted" style="min-width:120px">Город</span><span>${esc(
              selected.city || "—"
            )}</span></div>
            <div class="row"><span class="muted" style="min-width:120px">Онлайн</span><span>${esc(
              selected.timezone || "—"
            )}</span></div>
            <div class="row"><span class="muted" style="min-width:120px">Подана</span><span>${esc(
              fmtDate(selected.createdAt)
            )}</span></div>
          </div>
          ${
            selected.experience
              ? `<div class="alert alert-info mt-16"><div><strong>Опыт:</strong> ${esc(
                  selected.experience
                )}</div></div>`
              : ""
          }
          ${
            selected.notes
              ? `<div class="alert alert-warn mt-8"><div><strong>Комментарий:</strong> ${esc(
                  selected.notes
                )}</div></div>`
              : ""
          }

          <div class="divider"></div>
          <h4 class="mb-16" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Ответы на вопросы</h4>
          <ul class="q-list" id="q-list">
            ${(script.questions || [])
              .map((q, i) => {
                const prev = (selected.answers && selected.answers["q" + i]) || "";
                return `<li class="q-item">
                  <div class="q-text">${i + 1}. ${esc(q)}</div>
                  <textarea data-qi="${i}" placeholder="Краткий ответ / пометки…">${esc(
                    prev
                  )}</textarea>
                </li>`;
              })
              .join("")}
          </ul>

          <div class="divider"></div>
          <h4 class="mb-16" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Результат</h4>
          <div class="result-grid" id="result-grid">
            ${CALL_RESULTS.map(
              (r) =>
                `<button type="button" class="result-btn ${
                  state.selectedResult === r.id ? "selected" : ""
                }" data-result="${esc(r.id)}">${esc(r.label)}</button>`
            ).join("")}
          </div>
          <div class="field mt-12" id="cb-field" style="display:${
            state.selectedResult === "callback" || state.selectedResult === "noanswer"
              ? "flex"
              : "none"
          }">
            <label>Когда перезвонить (локальное время)</label>
            <input type="datetime-local" id="callback-at" />
          </div>
          <div class="field mt-12">
            <label>Комментарий к звонку (внутренний)</label>
            <textarea id="call-note" placeholder="Что сказал, риски, договорённости…">${esc(
              selected.lastNote || ""
            )}</textarea>
          </div>
          <div class="field mt-12">
            <label>Публичная пометка на табло (опционально)</label>
            <input id="public-note" placeholder="Напр.: Прошёл, ждёт куратора" />
          </div>
          <div class="row mt-16">
            <button type="button" class="btn btn-success" id="btn-save-call">Сохранить результат</button>
            <button type="button" class="btn" id="btn-mark-calling">Взять в работу</button>
            <button type="button" class="btn btn-ghost" id="btn-del-app">Удалить заявку</button>
          </div>
        `
            : `<div class="empty"><h4>Выбери заявку</h4><p>Слева очередь кандидатов.</p></div>`
        }
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>Скрипт / вопросы</h3></div>
      <div class="card-b">
        ${
          selected
            ? `
          <div class="script-block"><h4>Приветствие</h4><div class="bubble">${esc(
            fill(script.greeting)
          )}</div></div>
          <div class="script-block"><h4>Если занят</h4><div class="bubble alt">${esc(
            fill(script.ifBusy)
          )}</div></div>
          <div class="script-block"><h4>Питч</h4><div class="bubble">${esc(
            fill(script.pitch)
          )}</div></div>
          <div class="script-block"><h4>Закрытие — прошёл</h4><div class="bubble">${esc(
            fill(script.closePass)
          )}</div></div>
          <div class="script-block"><h4>Закрытие — отказ</h4><div class="bubble alt">${esc(
            fill(script.closeFail)
          )}</div></div>
          <div class="script-block"><h4>ООС</h4><div class="bubble warn">${esc(
            script.oocNote
          )}</div></div>
        `
            : `<div class="empty"><p>Скрипт появится после выбора кандидата</p></div>`
        }
      </div>
    </div>
  </div>`;
}

function pageAdminGate(title = "Начальство") {
  return `
  <div class="section-title">${esc(title)}</div>
  <div class="card" style="max-width:440px">
    <div class="card-b">
      <p class="secondary text-sm mb-16">
        Кабинет <strong>начальства</strong>: вакансии, база, логи.
        Ключ: <span class="mono">ADMIN_KEY</span> в <span class="mono">firebase-config.js</span>
        (по умолчанию <span class="mono">rp-admin-2026</span>).
      </p>
      <div class="field mb-16">
        <label>Кто входит (позывной / должность в РП)</label>
        <input id="admin-name" value="${esc(state.adminName)}" maxlength="48" placeholder="Нач. управления" />
      </div>
      <div class="field mb-16">
        <label>Ключ доступа</label>
        <input id="admin-key" type="password" placeholder="••••••••" />
      </div>
      <button type="button" class="btn btn-primary btn-block" id="admin-login">Войти</button>
    </div>
  </div>`;
}

function positionFormHtml(p = null) {
  const isEdit = !!p;
  return `
  <form id="pos-form" class="form-grid">
    <input type="hidden" name="existingId" value="${esc(p?.id || "")}" />
    <div class="field full">
      <label>Название должности <span class="req">*</span></label>
      <input name="title" required maxlength="120" value="${esc(p?.title || "")}" placeholder="Начальник отдела …" />
    </div>
    <div class="field">
      <label>Подразделение</label>
      <input name="department" maxlength="120" value="${esc(p?.department || "")}" placeholder="Территориальное подразделение" />
    </div>
    <div class="field">
      <label>Уровень</label>
      <select name="level">
        ${["руководитель", "заместитель", "старший состав", "иное"]
          .map(
            (l) =>
              `<option value="${esc(l)}" ${
                (p?.level || "руководитель") === l ? "selected" : ""
              }>${esc(l)}</option>`
          )
          .join("")}
      </select>
    </div>
    <div class="field">
      <label>Статус вакансии</label>
      <select name="status">
        <option value="open" ${!p || p.status === "open" ? "selected" : ""}>Вакантна (открыта)</option>
        <option value="closed" ${p?.status === "closed" ? "selected" : ""}>Снята (закрыта)</option>
        <option value="draft" ${p?.status === "draft" ? "selected" : ""}>Черновик</option>
      </select>
    </div>
    <div class="field">
      <label>Число мест</label>
      <input name="slots" type="number" min="1" max="50" value="${esc(p?.slots ?? 1)}" />
    </div>
    <div class="field full">
      <label>Краткое описание</label>
      <textarea name="summary" placeholder="1–2 предложения для карточки">${esc(
        p?.summary || ""
      )}</textarea>
    </div>
    <div class="field full">
      <label>Теги (через запятую)</label>
      <input name="tags" value="${esc((p?.tags || []).join(", "))}" placeholder="руководство, ДС-обзвон" />
    </div>
    <div class="field full">
      <label>Требования (каждое с новой строки)</label>
      <textarea name="requirements" rows="5" placeholder="Опыт …">${esc(
        (p?.requirements || []).join("\n")
      )}</textarea>
    </div>
    <div class="field full">
      <label>Обязанности (каждое с новой строки)</label>
      <textarea name="duties" rows="5" placeholder="Руководство …">${esc(
        (p?.duties || []).join("\n")
      )}</textarea>
    </div>
    <div class="field full row">
      <button type="submit" class="btn btn-primary">${isEdit ? "Сохранить изменения" : "Поставить вакансию"}</button>
      ${isEdit ? `<button type="button" class="btn btn-ghost" id="pos-form-cancel">Отмена</button>` : ""}
    </div>
  </form>`;
}

function pageAdmin() {
  if (!state.adminAuthed) return pageAdminGate("Начальство");

  const list = Object.values(state.positions).sort((a, b) => {
    const order = { open: 0, draft: 1, closed: 2 };
    const d = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (d !== 0) return d;
    return (a.title || "").localeCompare(b.title || "", "ru");
  });
  const openN = list.filter((p) => p.status === "open").length;
  const editing = state.editingPosId ? state.positions[state.editingPosId] : null;

  return `
  <div class="row mb-16">
    <div class="section-title" style="margin:0">Начальство · вакансии</div>
    <div class="spacer"></div>
    <span class="text-sm secondary">${esc(state.adminName)}</span>
    <a class="btn btn-sm" href="#data" data-nav="data">База / логи</a>
    <button type="button" class="btn btn-sm btn-ghost" id="admin-logout">Выйти</button>
  </div>

  <div class="grid grid-3 mb-16">
    <div class="card stat ok"><div class="lbl">Вакантных</div><div class="val">${openN}</div><div class="hint">открыты для заявок</div></div>
    <div class="card stat"><div class="lbl">Всего в справочнике</div><div class="val">${list.length}</div><div class="hint">включая снятые</div></div>
    <div class="card stat accent"><div class="lbl">Заявок в базе</div><div class="val">${stats().total}</div><div class="hint">по всем должностям</div></div>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <div class="card-h">
        <h3>${editing ? "Редактирование вакансии" : "Поставить новую вакансию"}</h3>
      </div>
      <div class="card-b">
        <div class="alert alert-info mb-16">
          <div>
            <strong>Поставить</strong> — статус «Вакантна», появится в списке и в форме регистрации.<br>
            <strong>Снять</strong> — статус «Снята», заявки больше не принимают (старые в базе сохраняются).
          </div>
        </div>
        ${positionFormHtml(editing)}
      </div>
    </div>

    <div class="card">
      <div class="card-h">
        <h3>Справочник должностей</h3>
        <span class="text-sm muted">${list.length}</span>
      </div>
      <div class="card-b" style="padding:0">
        ${
          list.length
            ? `<div class="table-wrap"><table class="data">
          <thead>
            <tr>
              <th>Должность</th>
              <th>Статус</th>
              <th>Заявок</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map((p) => {
                const n = appList().filter((a) => a.positionId === p.id).length;
                const stLabel =
                  p.status === "open"
                    ? "Вакантна"
                    : p.status === "draft"
                      ? "Черновик"
                      : "Снята";
                const stCls =
                  p.status === "open"
                    ? "b-open"
                    : p.status === "draft"
                      ? "b-draft"
                      : "b-closed";
                return `<tr>
                  <td>
                    <div class="fw-700">${esc(p.title)}</div>
                    <div class="text-sm muted">${esc(p.department || "")} · мест: ${esc(
                      p.slots || 1
                    )}</div>
                  </td>
                  <td><span class="badge ${stCls}">${esc(stLabel)}</span></td>
                  <td>${n}</td>
                  <td>
                    <div class="row" style="gap:6px;justify-content:flex-end">
                      ${
                        p.status === "open"
                          ? `<button type="button" class="btn btn-sm" data-pos-close="${esc(
                              p.id
                            )}">Снять</button>`
                          : `<button type="button" class="btn btn-sm btn-success" data-pos-open="${esc(
                              p.id
                            )}">Открыть</button>`
                      }
                      <button type="button" class="btn btn-sm" data-pos-edit="${esc(
                        p.id
                      )}">Изменить</button>
                      <button type="button" class="btn btn-sm btn-ghost" data-pos-del="${esc(
                        p.id
                      )}" title="Удалить (если есть заявки — только снимет)">✕</button>
                    </div>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>`
            : `<div class="empty"><h4>Пока пусто</h4><p>Создайте первую вакансию слева.</p></div>`
        }
      </div>
    </div>
  </div>

  <div class="alert alert-warn mt-16">
    <div>
      Действия начальства пишутся в журнал IO (вкладка «База / логи»).
      Ключ админа общий для управления вакансиями и просмотра базы.
    </div>
  </div>
  `;
}

function pageDataGate() {
  return pageAdminGate("База и логи");
}

function pageData() {
  if (!state.adminAuthed) return pageDataGate();

  const logs = Object.values(state.logs).sort((a, b) =>
    (b.at || "").localeCompare(a.at || "")
  );
  const apps = appList();
  const calls = Object.values(state.calls).sort((a, b) =>
    (b.at || "").localeCompare(a.at || "")
  );
  const tab = state.dataTab || "logs";

  const raw = {
    positions: state.positions,
    applications: state.applications,
    calls: state.calls,
    results: state.results,
    scripts: state.scripts,
    logsCount: logs.length,
  };

  return `
  <div class="row mb-16">
    <div class="section-title" style="margin:0">База / входящие · исходящие</div>
    <div class="spacer"></div>
    <a class="btn btn-sm" href="#admin" data-nav="admin">← Вакансии</a>
    <button type="button" class="btn btn-sm" id="btn-export-json">Экспорт JSON</button>
    <button type="button" class="btn btn-sm btn-ghost" id="admin-logout">Выйти</button>
  </div>

  <div class="tabs" id="data-tabs">
    <button type="button" class="tab ${tab === "logs" ? "active" : ""}" data-dtab="logs">Логи IO (${logs.length})</button>
    <button type="button" class="tab ${tab === "apps" ? "active" : ""}" data-dtab="apps">Заявки (${apps.length})</button>
    <button type="button" class="tab ${tab === "calls" ? "active" : ""}" data-dtab="calls">Звонки (${calls.length})</button>
    <button type="button" class="tab ${tab === "positions" ? "active" : ""}" data-dtab="positions">Должности (${Object.keys(state.positions).length})</button>
    <button type="button" class="tab ${tab === "raw" ? "active" : ""}" data-dtab="raw">Raw JSON</button>
  </div>

  <div id="dtab-logs" class="card card-b" style="display:${tab === "logs" ? "" : "none"}">
    ${
      logs.length
        ? logs
            .map((l) => {
              const dir =
                l.direction === "inbound"
                  ? "⬇️ IN"
                  : l.direction === "outbound"
                    ? "⬆️ OUT"
                    : "⚙ SYS";
              return `<div class="log-item">
                <div class="when">${esc(fmtDate(l.at))} · ${esc(dir)} · ${esc(l.kind)} ${
                  l.host ? "· " + esc(l.host) : ""
                }</div>
                <div class="detail mono">${esc(JSON.stringify(l.payload || {}))}</div>
              </div>`;
            })
            .join("")
        : `<div class="empty"><h4>Логов нет</h4><p>Появятся после заявок, обзвонов и действий начальства.</p></div>`
    }
  </div>

  <div id="dtab-apps" class="card" style="display:${tab === "apps" ? "" : "none"}">
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>ID</th><th>Игрок</th><th>Discord</th><th>Должность</th><th>Статус</th><th>Создано</th></tr></thead>
        <tbody>
          ${apps
            .map(
              (a) => `<tr>
              <td class="mono text-sm">${esc(a.id)}</td>
              <td>${esc(a.rpName)}</td>
              <td class="mono text-sm">${esc(a.discord)}</td>
              <td>${esc(posTitle(a.positionId))}</td>
              <td>${badge(a.status)}</td>
              <td class="text-sm muted">${esc(fmtDate(a.createdAt))}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div id="dtab-calls" class="card" style="display:${tab === "calls" ? "" : "none"}">
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Когда</th><th>Игрок</th><th>Результат</th><th>Ведущий</th><th>Заметка</th></tr></thead>
        <tbody>
          ${
            calls
              .map(
                (c) => `<tr>
                <td class="text-sm">${esc(fmtDate(c.at))}</td>
                <td>${esc(c.rpName)}<div class="mono text-sm muted">${esc(c.discord)}</div></td>
                <td>${badge(c.status)} <span class="text-sm">${esc(c.resultLabel || "")}</span></td>
                <td>${esc(c.host || "—")}</td>
                <td class="text-sm secondary">${esc(c.note || "—")}</td>
              </tr>`
              )
              .join("") || `<tr><td colspan="5"><div class="empty">Нет звонков</div></td></tr>`
          }
        </tbody>
      </table>
    </div>
  </div>

  <div id="dtab-positions" class="card" style="display:${tab === "positions" ? "" : "none"}">
    <div class="card-b">
      <a class="btn btn-primary btn-sm" href="#admin" data-nav="admin">Открыть управление вакансиями</a>
      <pre class="code mt-12">${esc(JSON.stringify(state.positions, null, 2))}</pre>
    </div>
  </div>

  <div id="dtab-raw" style="display:${tab === "raw" ? "" : "none"}">
    <div class="card card-b">
      <pre class="code" id="raw-json">${esc(JSON.stringify(raw, null, 2))}</pre>
    </div>
  </div>
  `;
}

/* ========== Main render ========== */
function render() {
  state.page = currentPage();
  const root = $("#app");
  if (!root) return;

  let body = "";
  switch (state.page) {
    case "positions":
      body = pagePositions();
      break;
    case "apply":
      body = pageApply();
      break;
    case "results":
      body = pageResults();
      break;
    case "host":
      body = pageHost();
      break;
    case "admin":
      body = pageAdmin();
      break;
    case "data":
      body = pageData();
      break;
    default:
      body = pageHome();
  }

  root.innerHTML = shell(body);
  bindUi();
}

function bindUi() {
  // nav
  $$("[data-nav]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const pos = a.getAttribute("data-pos");
      if (pos) {
        const url = new URL(location.href);
        url.searchParams.set("position", pos);
        history.replaceState(null, "", url);
      }
      setPage(a.getAttribute("data-nav"));
    });
  });

  const toggle = $("#nav-toggle");
  const links = $("#nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  // apply form
  const form = $("#apply-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const rec = await submitApplication(data);
        toast("Заявка отправлена", "ok");
        const ok = $("#apply-ok");
        ok.style.display = "";
        ok.innerHTML = `<div class="alert alert-ok"><div>
          <strong>Готово.</strong> ${esc(rec.rpName)}, ты в очереди на «${esc(
            posTitle(rec.positionId)
          )}».<br>
          Discord: <span class="mono">${esc(rec.discord)}</span><br>
          Статус смотри во вкладке <a href="#results" data-nav="results">Результаты</a>.
        </div></div>`;
        form.reset();
        // rebind result link
        ok.querySelector("[data-nav]")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          setPage("results");
        });
      } catch (err) {
        console.error(err);
        toast(err.message || "Ошибка отправки. Проверь Rules Firebase.", "err");
      } finally {
        btn.disabled = false;
      }
    });
  }

  // results filters
  $("#res-status")?.addEventListener("change", (e) => {
    state.filter.status = e.target.value;
    render();
  });
  $("#res-q")?.addEventListener("input", (e) => {
    state.filter.q = e.target.value;
    // debounce-ish lightweight
    clearTimeout(state._qt);
    state._qt = setTimeout(() => render(), 200);
  });

  // host login
  $("#host-login")?.addEventListener("click", () => {
    const name = $("#host-name")?.value?.trim() || "Ведущий";
    const key = $("#host-key")?.value || "";
    if (key !== HOST_KEY) {
      toast("Неверный ключ", "err");
      return;
    }
    state.hostName = name;
    localStorage.setItem("rp_host_name", name);
    state.hostAuthed = true;
    sessionStorage.setItem("rp_host", "1");
    toast("Вход выполнен", "ok");
    render();
  });
  $("#host-logout")?.addEventListener("click", () => {
    state.hostAuthed = false;
    sessionStorage.removeItem("rp_host");
    render();
  });

  // host filters
  $("#host-filter-status")?.addEventListener("change", (e) => {
    state.filter.hostStatus = e.target.value;
    render();
  });
  $("#host-filter-pos")?.addEventListener("change", (e) => {
    state.filter.positionId = e.target.value;
    render();
  });

  // queue select
  $("#queue-list")?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-app]");
    if (!item) return;
    state.selectedAppId = item.getAttribute("data-app");
    state.selectedResult = null;
    render();
  });

  $("#btn-copy-discord")?.addEventListener("click", async () => {
    const a = state.applications[state.selectedAppId];
    if (!a) return;
    try {
      await navigator.clipboard.writeText(a.discord);
      toast("Discord скопирован", "ok");
    } catch {
      toast(a.discord, "ok");
    }
  });

  $("#result-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-result]");
    if (!btn) return;
    state.selectedResult = btn.getAttribute("data-result");
    $$(".result-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    const cb = $("#cb-field");
    if (cb) {
      cb.style.display =
        state.selectedResult === "callback" || state.selectedResult === "noanswer"
          ? "flex"
          : "none";
    }
  });

  $("#btn-mark-calling")?.addEventListener("click", async () => {
    if (!state.selectedAppId) return;
    try {
      await setAppStatus(state.selectedAppId, "calling");
      toast("В работе", "ok");
    } catch (e) {
      toast(e.message || "Ошибка", "err");
    }
  });

  $("#btn-del-app")?.addEventListener("click", async () => {
    if (!state.selectedAppId) return;
    if (!confirm("Удалить заявку из базы?")) return;
    try {
      const id = state.selectedAppId;
      state.selectedAppId = null;
      await deleteApplication(id);
      toast("Удалено", "ok");
    } catch (e) {
      toast(e.message || "Ошибка", "err");
    }
  });

  $("#btn-save-call")?.addEventListener("click", async () => {
    if (!state.selectedAppId) return;
    if (!state.selectedResult) {
      toast("Выбери результат", "warn");
      return;
    }
    const answers = {};
    $$("#q-list textarea").forEach((t) => {
      answers["q" + t.getAttribute("data-qi")] = t.value;
    });
    let callbackAt = null;
    const cbInput = $("#callback-at");
    if (cbInput?.value) callbackAt = new Date(cbInput.value).toISOString();

    const payload = {
      resultId: state.selectedResult,
      note: $("#call-note")?.value || "",
      publicNote: $("#public-note")?.value || "",
      answers,
      callbackAt,
    };

    const btn = $("#btn-save-call");
    btn.disabled = true;
    try {
      await saveCallOutcome(state.selectedAppId, payload);
      state.selectedResult = null;
      toast("Результат сохранён и опубликован", "ok");
    } catch (e) {
      console.error(e);
      toast(e.message || "Ошибка сохранения", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // admin login / logout
  $("#admin-login")?.addEventListener("click", () => {
    if ($("#admin-key")?.value !== ADMIN_KEY) {
      toast("Неверный ключ", "err");
      return;
    }
    const name = $("#admin-name")?.value?.trim() || "Начальство";
    state.adminName = name;
    localStorage.setItem("rp_admin_name", name);
    state.adminAuthed = true;
    sessionStorage.setItem("rp_admin", "1");
    toast("Вход начальства выполнен", "ok");
    render();
  });
  $("#admin-logout")?.addEventListener("click", () => {
    state.adminAuthed = false;
    state.editingPosId = null;
    sessionStorage.removeItem("rp_admin");
    render();
  });

  // position form (create / edit)
  const posForm = $("#pos-form");
  if (posForm) {
    posForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(posForm);
      const data = Object.fromEntries(fd.entries());
      const existingId = data.existingId || null;
      const btn = posForm.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const rec = await savePosition(data, existingId || null);
        state.editingPosId = null;
        toast(
          existingId ? `Сохранено: ${rec.title}` : `Вакансия поставлена: ${rec.title}`,
          "ok"
        );
      } catch (err) {
        console.error(err);
        toast(err.message || "Ошибка сохранения должности", "err");
      } finally {
        btn.disabled = false;
      }
    });
  }
  $("#pos-form-cancel")?.addEventListener("click", () => {
    state.editingPosId = null;
    render();
  });

  // position table actions
  $$("[data-pos-open]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-pos-open");
      try {
        await setPositionStatus(id, "open");
        toast("Вакансия открыта", "ok");
      } catch (e) {
        toast(e.message || "Ошибка", "err");
      }
    });
  });
  $$("[data-pos-close]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-pos-close");
      const p = state.positions[id];
      if (!confirm(`Снять вакансию «${p?.title || id}» с набора?`)) return;
      try {
        await setPositionStatus(id, "closed");
        toast("Вакансия снята", "ok");
      } catch (e) {
        toast(e.message || "Ошибка", "err");
      }
    });
  });
  $$("[data-pos-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.editingPosId = btn.getAttribute("data-pos-edit");
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $$("[data-pos-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-pos-del");
      const p = state.positions[id];
      if (
        !confirm(
          `Удалить «${p?.title || id}»?\nЕсли есть заявки — должность только снимется (closed), не сотрётся.`
        )
      )
        return;
      try {
        const res = await deletePosition(id);
        if (res?.soft) {
          toast(`Есть заявки (${res.linked}) — вакансия снята, не удалена`, "warn");
        } else {
          toast("Должность удалена", "ok");
        }
        if (state.editingPosId === id) state.editingPosId = null;
      } catch (e) {
        toast(e.message || "Ошибка", "err");
      }
    });
  });

  // data tabs
  $$("#data-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.getAttribute("data-dtab");
      state.dataTab = id;
      $$("#data-tabs .tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      ["logs", "apps", "calls", "positions", "raw"].forEach((k) => {
        const el = $("#dtab-" + k);
        if (el) el.style.display = k === id ? "" : "none";
      });
    });
  });

  $("#btn-export-json")?.addEventListener("click", () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: nowIso(),
            positions: state.positions,
            applications: state.applications,
            calls: state.calls,
            results: state.results,
            logs: state.logs,
            scripts: state.scripts,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rp-call-desk-export.json";
    a.click();
  });
}

/* ========== Boot ========== */
async function boot() {
  const root = $("#app");
  if (root) {
    root.innerHTML = shell(`<div class="empty"><h4>Подключение к Firebase…</h4><p>Realtime Database</p></div>`);
  }
  try {
    await ensureSeed();
    bindData();
  } catch (e) {
    console.error(e);
    toast("Не удалось подключиться. Проверь databaseURL и Rules.", "err");
    state.connected = false;
    render();
  }
  window.addEventListener("hashchange", () => render());
}

boot();
