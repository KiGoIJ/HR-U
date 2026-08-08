/**
 * АСУЛС · Модуль обзвонов
 * Визуальный контур как у https://kigoij.github.io/ACULS/
 * Firebase RTDB + Discord RP (без реальных номеров)
 */
const firebaseConfig = {
  apiKey: "AIzaSyA2RxdMUGwhXBe-rpZjQQfDYG1T9UMmaV0",
  authDomain: "aculs-a5fe1.firebaseapp.com",
  databaseURL: "https://aculs-a5fe1-default-rtdb.firebaseio.com",
  projectId: "aculs-a5fe1",
  storageBucket: "aculs-a5fe1.firebasestorage.app",
  messagingSenderId: "176811002068",
  appId: "1:176811002068:web:bd20e3258111cd27c5d341",
  measurementId: "G-L8K98NSV61",
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

auth.signInAnonymously().catch((e) => {
  console.error(e);
  toast("Ошибка Firebase Auth: " + e.message, "err");
});

/* ===== Paths (отдельное дерево, не ломает employees АСУЛС) ===== */
const P = {
  users: "calldesk/users",
  positions: "calldesk/positions",
  applications: "calldesk/applications",
  calls: "calldesk/calls",
  results: "calldesk/results",
  logs: "calldesk/logs",
  scripts: "calldesk/scripts",
};

const usersRef = database.ref(P.users);
const positionsRef = database.ref(P.positions);
const applicationsRef = database.ref(P.applications);
const callsRef = database.ref(P.calls);
const resultsRef = database.ref(P.results);
const logsRef = database.ref(P.logs);
const scriptsRef = database.ref(P.scripts);

/* ===== Master password (как в АСУЛС) ===== */
const MASTER_KEY = "asuls_calls_master_password";
const DEFAULT_MASTER = "123456";

function getMasterPassword() {
  let stored = localStorage.getItem(MASTER_KEY);
  if (!stored) {
    localStorage.setItem(MASTER_KEY, btoa(DEFAULT_MASTER));
    return DEFAULT_MASTER;
  }
  try {
    return atob(stored);
  } catch {
    return DEFAULT_MASTER;
  }
}

/* ===== Seed ===== */
const SEED_POSITIONS = {
  "nach-otd": {
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
      "Адекват в войсе",
    ],
    duties: ["Руководство отделом", "Постановка задач", "Отчётность куратору", "Работа с Л/С"],
  },
  "zam-nach-otd": {
    id: "zam-nach-otd",
    title: "Заместитель начальника отдела",
    department: "Территориальное подразделение",
    level: "заместитель",
    status: "open",
    slots: 3,
    tags: ["зам", "ДС-обзвон"],
    summary: "Замещение руководителя, координация направлений, контроль поручений.",
    requirements: ["Опыт от 2 лет в структуре (РП)", "Рапорты / документация", "Стрессоустойчивость"],
    duties: ["Замещение нач. отдела", "Координация направлений", "Наставничество"],
  },
  "nach-analit": {
    id: "nach-analit",
    title: "Начальник аналитического направления",
    department: "Аналитический блок",
    level: "руководитель",
    status: "open",
    slots: 1,
    tags: ["аналитика"],
    summary: "Постановка задач аналитикам, качество докладов, методичка.",
    requirements: ["РП-бэк в аналитике", "Умение писать отчёты", "Координация группы"],
    duties: ["Руководство группой", "Проверка материалов", "Взаимодействие с заказчиками"],
  },
  "zam-nach-upr": {
    id: "zam-nach-upr",
    title: "Заместитель начальника управления",
    department: "Управленческий аппарат",
    level: "заместитель",
    status: "open",
    slots: 1,
    tags: ["управление", "старший состав"],
    summary: "Координация блоков, контроль поручений, орг. решения.",
    requirements: ["Существенный руководящий бэк", "Опыт замещения первого лица"],
    duties: ["Координация блоков", "Контроль поручений", "Совещания"],
  },
};

const SEED_SCRIPT = {
  title: "Скрипт обзвона (Discord)",
  greeting:
    "Привет. Я {host}, провожу обзвон на должность «{position}». Сейчас удобно 10–15 минут в войсе / ЛС?",
  ifBusy: "Ок, напиши когда удобно — поставлю перезвон.",
  pitch:
    "Кратко: ищем человека на «{position}» ({department}). РП-отбор: бэк, адекват, субординация, нагрузка. Пост по звонку не гарантируем — только допуск дальше.",
  questions: [
    "Как давно в проекте и какой общий РП-стаж?",
    "Был ли опыт руководства сменой / отделом / фракцией?",
    "Почему именно эта должность?",
    "Как отреагируешь, если подчинённый сорвал задачу?",
    "Готов(а) к проверкам, войсам с куратором и ненормированному онлайну?",
    "Есть конфликты / варны / блоки, о которых важно знать?",
    "Свободные слоты онлайна на этой неделе?",
  ],
  closePass: "Фиксирую «пройден первичный обзвон». Дальше — второй этап / войс с куратором.",
  closeFail: "Спасибо за время. По этой позиции сейчас не проходим. Оставить контакт на другие роли?",
  oocNote:
    "ООС: игровой обзвон. Без реальных ПДн и номеров. Только Discord / ник. Не токсим, не давим, не обещаем пост.",
};

const CALL_RESULTS = [
  { id: "noanswer", label: "Не ответил / оффлайн", status: "noanswer" },
  { id: "callback", label: "Перезвонить позже", status: "callback" },
  { id: "pass", label: "Прошёл обзвон", status: "pass" },
  { id: "fail", label: "Не прошёл", status: "fail" },
  { id: "interview", label: "На второй этап", status: "interview" },
  { id: "reject_self", label: "Сам отказался", status: "fail" },
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

/* ===== State ===== */
const state = {
  currentUser: null,
  users: [],
  positions: {},
  applications: {},
  calls: {},
  results: {},
  logs: {},
  scripts: { default: SEED_SCRIPT },
  connected: false,
  tab: "home",
  selectedAppId: null,
  selectedResult: null,
  editingPosId: null,
  hostFilterStatus: "active",
  hostFilterPos: "",
  resStatus: "",
  resQ: "",
};

/* ===== Utils ===== */
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
  const host = $("#toast-host");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .2s";
    setTimeout(() => el.remove(), 200);
  }, 3200);
}
function badge(status) {
  const m = STATUS_META[status] || { label: status || "—", cls: "b-draft" };
  return `<span class="badge ${m.cls}">${esc(m.label)}</span>`;
}
function posTitle(id) {
  return state.positions[id]?.title || id || "—";
}
function isAdmin() {
  return state.currentUser?.role === "admin";
}
function isHost() {
  const r = state.currentUser?.role;
  return r === "admin" || r === "host";
}
function parseLines(t) {
  return String(t || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function parseTags(t) {
  return String(t || "")
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function slugify(title) {
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
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || uid("pos");
}

function appList() {
  return Object.values(state.applications).sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}
function stats() {
  const apps = appList();
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

/* ===== Logging ===== */
async function writeLog(direction, kind, payload) {
  try {
    const id = uid("log");
    await logsRef.child(id).set({
      id,
      direction,
      kind,
      payload: payload || {},
      at: nowIso(),
      user: state.currentUser?.fullName || null,
    });
  } catch (e) {
    console.warn("log", e);
  }
}

function addLogEntry(message) {
  writeLog("system", "ui", { message });
}

/* ===== Seed / ensure ===== */
async function ensureSeed() {
  const [posSnap, scSnap, usSnap] = await Promise.all([
    positionsRef.once("value"),
    scriptsRef.once("value"),
    usersRef.once("value"),
  ]);
  if (!posSnap.exists()) {
    const stamped = {};
    Object.values(SEED_POSITIONS).forEach((p) => {
      stamped[p.id] = { ...p, updatedAt: nowIso() };
    });
    await positionsRef.set(stamped);
    await writeLog("system", "seed_positions", { count: Object.keys(stamped).length });
  }
  if (!scSnap.exists()) {
    await scriptsRef.set({ default: SEED_SCRIPT });
  }
  if (!usSnap.exists()) {
    await usersRef.set([
      { fullName: "Администратор", password: "admin", role: "admin" },
      { fullName: "Ведущий", password: "host", role: "host" },
    ]);
    await writeLog("system", "seed_users", {});
  }
}

/* ===== Bind RTDB ===== */
function bindData() {
  const bind = (ref, key, cb) => {
    ref.on(
      "value",
      (snap) => {
        let val = snap.val();
        if (key === "users") {
          state.users = val
            ? Array.isArray(val)
              ? val
              : Object.values(val)
            : [];
        } else {
          state[key] = val || {};
        }
        state.connected = true;
        updateLive();
        if (state.currentUser) renderAll();
        if (cb) cb();
      },
      (err) => {
        console.error(err);
        state.connected = false;
        updateLive();
        toast("RTDB: " + err.message, "err");
      }
    );
  };
  bind(usersRef, "users");
  bind(positionsRef, "positions");
  bind(applicationsRef, "applications");
  bind(callsRef, "calls");
  bind(resultsRef, "results");
  bind(scriptsRef, "scripts");
  logsRef.limitToLast(100).on("value", (snap) => {
    state.logs = snap.val() || {};
    if (state.currentUser && state.tab === "protocol") renderProtocol();
    if (state.currentUser && state.tab === "home") renderHome();
  });
}

function updateLive() {
  const el = $("#liveStatus");
  if (!el) return;
  el.className = "live-pill" + (state.connected ? "" : " off");
  el.innerHTML = `<span class="dot"></span> ${state.connected ? "RTDB ONLINE" : "RTDB …"}`;
}

/* ===== CRUD ===== */
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
    submittedBy: state.currentUser?.fullName || null,
  };
  await applicationsRef.child(id).set(record);
  await writeLog("inbound", "application", {
    id,
    rpName: record.rpName,
    discord: record.discord,
    positionId: record.positionId,
  });
  await resultsRef.child(id).set({
    id,
    rpName: record.rpName,
    discordTag: record.discord,
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

async function saveCallOutcome(appId, payload) {
  const appRec = state.applications[appId];
  if (!appRec) throw new Error("Заявка не найдена");
  const resultDef = CALL_RESULTS.find((r) => r.id === payload.resultId);
  if (!resultDef) throw new Error("Выберите результат");

  const callId = uid("call");
  const at = nowIso();
  const host = state.currentUser?.fullName || "Ведущий";
  const call = {
    id: callId,
    applicationId: appId,
    rpName: appRec.rpName,
    discord: appRec.discord,
    positionId: appRec.positionId,
    host,
    resultId: payload.resultId,
    resultLabel: resultDef.label,
    status: resultDef.status,
    note: payload.note || "",
    answers: payload.answers || {},
    callbackAt: payload.callbackAt || null,
    at,
  };
  await callsRef.child(callId).set(call);
  await writeLog("outbound", "call_saved", {
    callId,
    applicationId: appId,
    resultId: payload.resultId,
    host,
  });

  const appUpdate = {
    status: resultDef.status,
    updatedAt: at,
    lastCallAt: at,
    resultSummary: resultDef.label,
    answers: payload.answers || {},
    lastNote: payload.note || "",
    lastHost: host,
  };
  if (payload.callbackAt) appUpdate.callbackAt = payload.callbackAt;
  await applicationsRef.child(appId).update(appUpdate);

  const publicNote =
    payload.publicNote ||
    ({
      pass: "Прошёл первичный обзвон",
      fail: "Не прошёл обзвон",
      interview: "Приглашён на второй этап",
      callback: "Назначен перезвон",
      noanswer: "Не удалось связаться",
    }[resultDef.status] || resultDef.label);

  await resultsRef.child(appId).set({
    id: appId,
    rpName: appRec.rpName,
    discordTag: appRec.discord,
    positionId: appRec.positionId,
    positionTitle: posTitle(appRec.positionId),
    status: resultDef.status,
    statusLabel: STATUS_META[resultDef.status]?.label || resultDef.label,
    updatedAt: at,
    publicNote,
    host,
    callId,
  });
  await writeLog("outbound", "result_published", {
    id: appId,
    status: resultDef.status,
    publicNote,
  });
  return call;
}

async function setAppStatus(id, status) {
  await applicationsRef.child(id).update({ status, updatedAt: nowIso() });
  await resultsRef.child(id).update({
    status,
    statusLabel: STATUS_META[status]?.label || status,
    updatedAt: nowIso(),
  });
  await writeLog("outbound", "status_set", { id, status });
}

async function deleteApplication(id) {
  await applicationsRef.child(id).remove();
  await resultsRef.child(id).remove();
  await writeLog("system", "application_deleted", { id });
}

async function savePosition(data, existingId) {
  const title = (data.title || "").trim();
  if (!title) throw new Error("Укажите название");
  let id = existingId || slugify(title);
  if (!existingId && state.positions[id]) id = id + "-" + Math.random().toString(36).slice(2, 5);
  const prev = existingId ? state.positions[existingId] : null;
  const record = {
    id,
    title,
    department: (data.department || "").trim() || "Подразделение",
    level: (data.level || "руководитель").trim(),
    status: ["open", "closed", "draft"].includes(data.status) ? data.status : "open",
    slots: Math.max(1, Number(data.slots) || 1),
    tags: parseTags(data.tags),
    summary: (data.summary || "").trim(),
    requirements: parseLines(data.requirements),
    duties: parseLines(data.duties),
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso(),
    updatedBy: state.currentUser?.fullName || "admin",
  };
  await positionsRef.child(id).set(record);
  await writeLog("outbound", existingId ? "position_updated" : "position_created", {
    id,
    title: record.title,
    status: record.status,
  });
  return record;
}

async function setPositionStatus(id, status) {
  const p = state.positions[id];
  if (!p) throw new Error("Не найдено");
  await positionsRef.child(id).update({
    status,
    updatedAt: nowIso(),
    updatedBy: state.currentUser?.fullName || "admin",
  });
  await writeLog("outbound", "position_status", { id, title: p.title, status });
}

async function deletePosition(id) {
  const p = state.positions[id];
  if (!p) return;
  const linked = appList().filter((a) => a.positionId === id).length;
  if (linked > 0) {
    await setPositionStatus(id, "closed");
    return { soft: true, linked };
  }
  await positionsRef.child(id).remove();
  await writeLog("system", "position_deleted", { id, title: p.title });
  return { soft: false };
}

/* ===== Boot animation (лёгкая) ===== */
function runBoot(done) {
  const screen = $("#decryptingScreen");
  const log = $("#terminalLog");
  const fill = $("#cyberProgressFill");
  const pct = $("#cyberPercent");
  if (!screen) return done();
  screen.style.display = "flex";
  const lines = [
    "> INIT CALLDESK MODULE…",
    "> LINK FIREBASE RTDB…",
    "> LOAD POSITIONS / QUEUE…",
    "> AUTH GATE READY…",
    "> CHANNEL SECURE",
  ];
  let i = 0;
  let p = 0;
  const t = setInterval(() => {
    if (i < lines.length && log) {
      log.innerHTML += `<div>${lines[i++]}</div>`;
      log.scrollTop = log.scrollHeight;
    }
    p = Math.min(100, p + 12);
    if (fill) fill.style.width = p + "%";
    if (pct) pct.textContent = p + "%";
    if (p >= 100) {
      clearInterval(t);
      setTimeout(() => {
        screen.style.display = "none";
        done();
      }, 250);
    }
  }, 120);
}

/* ===== Matrix bg (лёгкий) ===== */
function initMatrix() {
  const c = $("#loginMatrixCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  let w, h, cols, drops;
  function resize() {
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
    cols = Math.floor(w / 18);
    drops = Array(cols).fill(1);
  }
  resize();
  window.addEventListener("resize", resize);
  const chars = "01АСУЛСОБЗВОН█▓▒░";
  function draw() {
    if ($("#loginScreen")?.style.display === "none") {
      requestAnimationFrame(draw);
      return;
    }
    ctx.fillStyle = "rgba(5,7,12,0.12)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(207,161,52,0.35)";
    ctx.font = "12px monospace";
    for (let i = 0; i < drops.length; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 18, drops[i] * 16);
      if (drops[i] * 16 > h && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    requestAnimationFrame(draw);
  }
  draw();
}

/* ===== Auth UI ===== */
function showLoginError(msg) {
  const el = $("#loginError");
  if (!el) return;
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}
function showRegError(msg) {
  const el = $("#registerError");
  if (!el) return;
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}

function enterApp(user) {
  state.currentUser = user;
  sessionStorage.setItem("asuls_calls_user", JSON.stringify(user));
  $("#loginScreen").style.display = "none";
  $("#appContent").style.display = "block";
  $("#userDisplay").textContent = `${user.fullName} · ${roleLabel(user.role)}`;
  $("#manageUsersBtn").style.display = isAdmin() ? "" : "none";
  $("#tabAdminBtn").style.display = isAdmin() ? "" : "none";
  $("#usersAdminCard").style.display = isAdmin() ? "" : "none";
  $("#hostLabel").textContent = user.fullName;
  addLogEntry(`Авторизация: ${user.fullName} (${user.role})`);
  switchTab("home");
  renderAll();
}

function roleLabel(r) {
  if (r === "admin") return "Начальство";
  if (r === "host") return "Ведущий";
  return "Оператор";
}

function logout() {
  if (state.currentUser) addLogEntry(`Выход: ${state.currentUser.fullName}`);
  state.currentUser = null;
  sessionStorage.removeItem("asuls_calls_user");
  $("#appContent").style.display = "none";
  $("#loginScreen").style.display = "flex";
  $("#loginPassword").value = "";
  $("#loginMasterPassword").value = "";
}

/* ===== Tabs ===== */
function switchTab(tab) {
  state.tab = tab;
  $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
  if (tab === "host") renderHost();
  if (tab === "admin") renderAdmin();
  if (tab === "protocol") renderProtocol();
  if (tab === "results") renderResults();
  if (tab === "positions") renderPositions();
  if (tab === "apply") renderApply();
  if (tab === "home") renderHome();
}

/* ===== Renderers ===== */
function renderAll() {
  const s = stats();
  $("#stQueue").textContent = s.queue;
  $("#stCallback").textContent = s.callback;
  $("#stPass").textContent = s.pass;
  $("#stTotal").textContent = s.total;
  $("#stOpenPos").textContent = s.openPos;
  $("#stCalls").textContent = s.calls;
  $("#tabPosCount").textContent = s.openPos;
  $("#tabQueueCount").textContent = s.queue + s.callback;

  // status select options
  const resSel = $("#resStatus");
  if (resSel && resSel.options.length <= 1) {
    Object.entries(STATUS_META).forEach(([k, v]) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = v.label;
      resSel.appendChild(o);
    });
  }

  if (state.tab === "home") renderHome();
  if (state.tab === "positions") renderPositions();
  if (state.tab === "apply") renderApply();
  if (state.tab === "host") renderHost();
  if (state.tab === "results") renderResults();
  if (state.tab === "admin") renderAdmin();
  if (state.tab === "protocol") renderProtocol();
}

function renderHome() {
  const queue = appList()
    .filter((a) => ["new", "queued", "callback", "noanswer", "calling"].includes(a.status))
    .slice(0, 6);
  const recent = Object.values(state.results)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 6);

  $("#homeQueue").innerHTML = queue.length
    ? `<div class="data-table-wrap"><table class="data"><thead><tr><th>Игрок</th><th>Должность</th><th>Статус</th></tr></thead><tbody>
      ${queue
        .map(
          (a) => `<tr>
        <td><div class="fw-700">${esc(a.rpName)}</div><div class="text-sm mono muted">${esc(a.discord)}</div></td>
        <td>${esc(posTitle(a.positionId))}</td>
        <td>${badge(a.status)}</td>
      </tr>`
        )
        .join("")}
      </tbody></table></div>`
    : `<div class="empty-state"><i class="fas fa-inbox"></i><h4>Очередь пуста</h4></div>`;

  $("#homeResults").innerHTML = recent.length
    ? `<div class="data-table-wrap"><table class="data"><thead><tr><th>Игрок</th><th>Итог</th><th>Когда</th></tr></thead><tbody>
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
    : `<div class="empty-state"><i class="fas fa-flag"></i><h4>Пока нет результатов</h4></div>`;
}

function renderPositions() {
  const open = Object.values(state.positions).filter((p) => p.status === "open");
  const closed = Object.values(state.positions).filter((p) => p.status !== "open");
  const card = (p, canApply) => {
    const n = appList().filter((a) => a.positionId === p.id).length;
    const st =
      p.status === "open" ? ["Вакантна", "b-open"] : p.status === "draft" ? ["Черновик", "b-draft"] : ["Снята", "b-closed"];
    return `<article class="card pos-card-body">
      <div class="inline-actions" style="justify-content:space-between;margin-bottom:8px;">
        <div>
          <h3>${esc(p.title)}</h3>
          <div class="dept">${esc(p.department)} · ${esc(p.level || "")}</div>
        </div>
        <span class="badge ${st[1]}">${st[0]}</span>
      </div>
      <div class="desc">${esc(p.summary || "")}</div>
      <div class="tags">
        ${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        <span class="tag">мест: ${esc(p.slots || 1)}</span>
        <span class="tag">заявок: ${n}</span>
      </div>
      <details>
        <summary class="text-sm muted" style="cursor:pointer">Требования и обязанности</summary>
        <div class="text-sm muted mt-8">
          <strong style="color:#cfa134">Требования</strong>
          <ul style="margin:6px 0 10px 16px">${(p.requirements || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>—</li>"}</ul>
          <strong style="color:#cfa134">Обязанности</strong>
          <ul style="margin:6px 0 0 16px">${(p.duties || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>—</li>"}</ul>
        </div>
      </details>
      ${
        canApply
          ? `<button type="button" class="btn btn--gold mt-12" data-goto-apply="${esc(p.id)}"><i class="fas fa-file-signature"></i> Подать заявку</button>`
          : `<div class="text-sm muted mt-12">Набор закрыт</div>`
      }
    </article>`;
  };
  $("#positionsGrid").innerHTML =
    (open.map((p) => card(p, true)).join("") ||
      `<div class="empty-state"><i class="fas fa-briefcase"></i><h4>Нет открытых вакансий</h4><p>Начальство ещё не выставило должности</p></div>`) +
    (closed.length
      ? `<div class="full" style="grid-column:1/-1;margin-top:8px;color:#718096;font-weight:700;text-transform:uppercase;font-size:0.75rem;letter-spacing:.06em;">Снятые / черновики</div>` +
        closed.map((p) => card(p, false)).join("")
      : "");

  $$("[data-goto-apply]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-goto-apply");
      switchTab("apply");
      const sel = $("#applyPositionSelect");
      if (sel) sel.value = id;
    });
  });
}

function renderApply() {
  const open = Object.values(state.positions).filter((p) => p.status === "open");
  const sel = $("#applyPositionSelect");
  const cur = sel?.value || "";
  if (sel) {
    sel.innerHTML =
      `<option value="">— выберите —</option>` +
      open
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${cur === p.id ? "selected" : ""}>${esc(p.title)} · ${esc(p.department)}</option>`
        )
        .join("");
  }
  $("#applyOpenList").innerHTML = open.length
    ? open.map((p) => `<li style="margin-bottom:6px"><strong>${esc(p.title)}</strong></li>`).join("")
    : "<li>Нет открытых</li>";
}

function renderHost() {
  if (!isHost() && !isAdmin()) {
    $("#queueList").innerHTML = `<li class="empty-state"><h4>Недостаточно прав</h4><p>Нужна роль ведущего или администратора</p></li>`;
    $("#callCard").innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><h4>Доступ ограничен</h4></div>`;
    return;
  }

  // fill pos filter
  const pf = $("#hostFilterPos");
  if (pf) {
    const cur = state.hostFilterPos;
    pf.innerHTML =
      `<option value="">Все должности</option>` +
      Object.values(state.positions)
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${cur === p.id ? "selected" : ""}>${esc(p.title)}</option>`
        )
        .join("");
  }
  const sf = $("#hostFilterStatus");
  if (sf) sf.value = state.hostFilterStatus;

  let list = appList();
  if (state.hostFilterStatus === "active") {
    list = list.filter((a) =>
      ["new", "queued", "calling", "callback", "noanswer", "interview"].includes(a.status)
    );
  } else if (state.hostFilterStatus !== "all") {
    list = list.filter((a) => a.status === state.hostFilterStatus);
  }
  if (state.hostFilterPos) list = list.filter((a) => a.positionId === state.hostFilterPos);

  const selected =
    (state.selectedAppId && state.applications[state.selectedAppId]) || list[0] || null;
  if (selected) state.selectedAppId = selected.id;

  $("#queueList").innerHTML = list.length
    ? list
        .map(
          (a) => `<li class="queue-item ${selected && a.id === selected.id ? "active" : ""}" data-app="${esc(a.id)}">
        <div class="inline-actions" style="justify-content:space-between">
          <div class="qi-name">${esc(a.rpName)}</div>
          ${badge(a.status)}
        </div>
        <div class="qi-meta">${esc(posTitle(a.positionId))}</div>
        <div class="qi-dc">${esc(a.discord)}</div>
      </li>`
        )
        .join("")
    : `<li class="empty-state"><h4>Пусто</h4></li>`;

  $$("#queueList [data-app]").forEach((el) => {
    el.addEventListener("click", () => {
      state.selectedAppId = el.getAttribute("data-app");
      state.selectedResult = null;
      renderHost();
    });
  });

  renderCallCard(selected);
  renderScript(selected);
}

function renderCallCard(selected) {
  const box = $("#callCard");
  if (!selected) {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-user"></i><h4>Выберите кандидата</h4></div>`;
    return;
  }
  const script = state.scripts.default || SEED_SCRIPT;
  box.innerHTML = `
    <div class="inline-actions" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div class="candidate-title">${esc(selected.rpName)}</div>
        <div class="discord-lg mt-8">${esc(selected.discord)}</div>
        <div class="mt-8">${badge(selected.status)}</div>
      </div>
      <div class="inline-actions" style="flex-direction:column;align-items:stretch">
        <button type="button" class="btn btn--gold" id="btnCopyDc"><i class="fas fa-copy"></i> Discord</button>
        <a class="btn btn--secondary" href="https://discord.com/channels/@me" target="_blank" rel="noopener"><i class="fab fa-discord"></i> Открыть</a>
      </div>
    </div>
    <div class="divider"></div>
    <div class="info-rows">
      <div class="ir"><span class="k">Должность</span><span class="v">${esc(posTitle(selected.positionId))}</span></div>
      <div class="ir"><span class="k">Static</span><span class="v">${esc(selected.staticId || "—")}</span></div>
      <div class="ir"><span class="k">Город</span><span class="v">${esc(selected.city || "—")}</span></div>
      <div class="ir"><span class="k">Онлайн</span><span class="v">${esc(selected.timezone || "—")}</span></div>
      <div class="ir"><span class="k">Подана</span><span class="v">${esc(fmtDate(selected.createdAt))}</span></div>
    </div>
    ${
      selected.experience
        ? `<div class="alert-box info mt-12"><strong>Опыт:</strong> ${esc(selected.experience)}</div>`
        : ""
    }
    ${
      selected.notes
        ? `<div class="alert-box warn mt-8"><strong>Комментарий:</strong> ${esc(selected.notes)}</div>`
        : ""
    }
    <div class="divider"></div>
    <h3 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.06em;color:#718096;margin-bottom:10px;">Ответы на вопросы</h3>
    <ul class="q-list" id="qList">
      ${(script.questions || [])
        .map((q, i) => {
          const prev = (selected.answers && selected.answers["q" + i]) || "";
          return `<li class="q-item">
            <div class="q-text">${i + 1}. ${esc(q)}</div>
            <textarea data-qi="${i}" placeholder="Краткий ответ / пометки…">${esc(prev)}</textarea>
          </li>`;
        })
        .join("")}
    </ul>
    <div class="divider"></div>
    <h3 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.06em;color:#718096;margin-bottom:10px;">Результат</h3>
    <div class="result-grid" id="resultGrid">
      ${CALL_RESULTS.map(
        (r) =>
          `<button type="button" class="result-btn ${
            state.selectedResult === r.id ? "selected" : ""
          }" data-result="${esc(r.id)}">${esc(r.label)}</button>`
      ).join("")}
    </div>
    <div class="form-group mt-12" id="cbField" style="display:${
      state.selectedResult === "callback" || state.selectedResult === "noanswer" ? "" : "none"
    }">
      <label>Когда перезвонить</label>
      <input type="datetime-local" id="callbackAt" />
    </div>
    <div class="form-group mt-12">
      <label>Комментарий к звонку</label>
      <textarea id="callNote" rows="3" placeholder="Что сказал, риски…">${esc(
        selected.lastNote || ""
      )}</textarea>
    </div>
    <div class="form-group mt-12">
      <label>Публичная пометка на табло</label>
      <input id="publicNote" placeholder="Напр.: Прошёл, ждёт куратора" />
    </div>
    <div class="inline-actions mt-16">
      <button type="button" class="btn btn--gold" id="btnSaveCall"><i class="fas fa-save"></i> Сохранить результат</button>
      <button type="button" class="btn btn--primary" id="btnMarkCalling"><i class="fas fa-play"></i> В работу</button>
      ${
        isAdmin()
          ? `<button type="button" class="btn btn--danger" id="btnDelApp"><i class="fas fa-trash"></i> Удалить</button>`
          : ""
      }
    </div>
  `;

  $("#btnCopyDc")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(selected.discord);
      toast("Discord скопирован", "ok");
    } catch {
      toast(selected.discord, "ok");
    }
  });
  $("#resultGrid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-result]");
    if (!btn) return;
    state.selectedResult = btn.getAttribute("data-result");
    $$(".result-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    const cb = $("#cbField");
    if (cb)
      cb.style.display =
        state.selectedResult === "callback" || state.selectedResult === "noanswer" ? "" : "none";
  });
  $("#btnMarkCalling")?.addEventListener("click", async () => {
    try {
      await setAppStatus(selected.id, "calling");
      toast("В работе", "ok");
    } catch (e) {
      toast(e.message, "err");
    }
  });
  $("#btnDelApp")?.addEventListener("click", async () => {
    if (!confirm("Удалить заявку?")) return;
    try {
      state.selectedAppId = null;
      await deleteApplication(selected.id);
      toast("Удалено", "ok");
    } catch (e) {
      toast(e.message, "err");
    }
  });
  $("#btnSaveCall")?.addEventListener("click", async () => {
    if (!state.selectedResult) {
      toast("Выберите результат", "warn");
      return;
    }
    const answers = {};
    $$("#qList textarea").forEach((t) => {
      answers["q" + t.getAttribute("data-qi")] = t.value;
    });
    let callbackAt = null;
    const cb = $("#callbackAt");
    if (cb?.value) callbackAt = new Date(cb.value).toISOString();
    const btn = $("#btnSaveCall");
    btn.disabled = true;
    try {
      await saveCallOutcome(selected.id, {
        resultId: state.selectedResult,
        note: $("#callNote")?.value || "",
        publicNote: $("#publicNote")?.value || "",
        answers,
        callbackAt,
      });
      state.selectedResult = null;
      toast("Результат сохранён и опубликован", "ok");
    } catch (e) {
      console.error(e);
      toast(e.message || "Ошибка", "err");
    } finally {
      btn.disabled = false;
    }
  });
}

function renderScript(selected) {
  const body = $("#scriptBody");
  if (!selected) {
    body.innerHTML = `<div class="empty-state"><p>Скрипт появится после выбора</p></div>`;
    return;
  }
  const script = state.scripts.default || SEED_SCRIPT;
  const pos = state.positions[selected.positionId];
  const fill = (t) =>
    (t || "")
      .replaceAll("{host}", state.currentUser?.fullName || "Ведущий")
      .replaceAll("{position}", pos?.title || posTitle(selected.positionId))
      .replaceAll("{department}", pos?.department || "")
      .replaceAll("{name}", selected.rpName || "");
  body.innerHTML = `
    <div class="script-block"><h4>Приветствие</h4><div class="bubble">${esc(fill(script.greeting))}</div></div>
    <div class="script-block"><h4>Если занят</h4><div class="bubble alt">${esc(fill(script.ifBusy))}</div></div>
    <div class="script-block"><h4>Питч</h4><div class="bubble">${esc(fill(script.pitch))}</div></div>
    <div class="script-block"><h4>Закрытие — прошёл</h4><div class="bubble">${esc(fill(script.closePass))}</div></div>
    <div class="script-block"><h4>Закрытие — отказ</h4><div class="bubble alt">${esc(fill(script.closeFail))}</div></div>
    <div class="script-block"><h4>ООС</h4><div class="bubble warn">${esc(script.oocNote)}</div></div>
  `;
}

function renderResults() {
  let list = Object.values(state.results).sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );
  if (state.resStatus) list = list.filter((r) => r.status === state.resStatus);
  if (state.resQ) {
    const q = state.resQ.toLowerCase();
    list = list.filter((r) =>
      [r.rpName, r.discordTag, r.positionTitle, r.publicNote].join(" ").toLowerCase().includes(q)
    );
  }
  const tb = $("#resultsTable tbody");
  tb.innerHTML = list.length
    ? list
        .map(
          (r) => `<tr>
      <td class="fw-700">${esc(r.rpName)}</td>
      <td class="mono text-sm">${esc(r.discordTag || "—")}</td>
      <td>${esc(r.positionTitle || posTitle(r.positionId))}</td>
      <td>${badge(r.status)}</td>
      <td class="text-sm muted">${esc(r.publicNote || "—")}</td>
      <td class="text-sm muted">${esc(fmtDate(r.updatedAt))}</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="6"><div class="empty-state"><h4>Нет результатов</h4></div></td></tr>`;
}

function renderAdmin() {
  if (!isAdmin()) {
    $("#adminPosTable tbody").innerHTML = `<tr><td colspan="4"><div class="empty-state"><h4>Только для начальства</h4></div></td></tr>`;
    return;
  }
  const list = Object.values(state.positions).sort((a, b) => {
    const order = { open: 0, draft: 1, closed: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || (a.title || "").localeCompare(b.title || "", "ru");
  });
  $("#adminPosTable tbody").innerHTML = list.length
    ? list
        .map((p) => {
          const n = appList().filter((a) => a.positionId === p.id).length;
          const st =
            p.status === "open"
              ? ["Вакантна", "b-open"]
              : p.status === "draft"
                ? ["Черновик", "b-draft"]
                : ["Снята", "b-closed"];
          return `<tr>
            <td>
              <div class="fw-700">${esc(p.title)}</div>
              <div class="text-sm muted">${esc(p.department || "")} · мест: ${esc(p.slots || 1)}</div>
            </td>
            <td><span class="badge ${st[1]}">${st[0]}</span></td>
            <td>${n}</td>
            <td>
              <div class="table-actions">
                ${
                  p.status === "open"
                    ? `<button type="button" class="btn btn--secondary" style="padding:6px 10px;font-size:0.78rem" data-pos-close="${esc(p.id)}">Снять</button>`
                    : `<button type="button" class="btn btn--gold" style="padding:6px 10px;font-size:0.78rem" data-pos-open="${esc(p.id)}">Открыть</button>`
                }
                <button type="button" class="btn btn--primary" style="padding:6px 10px;font-size:0.78rem" data-pos-edit="${esc(p.id)}">Изменить</button>
                <button type="button" class="btn btn--danger" style="padding:6px 10px;font-size:0.78rem" data-pos-del="${esc(p.id)}">✕</button>
              </div>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4"><div class="empty-state"><h4>Пусто — создайте вакансию</h4></div></td></tr>`;

  $$("[data-pos-open]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await setPositionStatus(b.getAttribute("data-pos-open"), "open");
        toast("Вакансия открыта", "ok");
      } catch (e) {
        toast(e.message, "err");
      }
    })
  );
  $$("[data-pos-close]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-pos-close");
      if (!confirm("Снять вакансию с набора?")) return;
      try {
        await setPositionStatus(id, "closed");
        toast("Вакансия снята", "ok");
      } catch (e) {
        toast(e.message, "err");
      }
    })
  );
  $$("[data-pos-edit]").forEach((b) =>
    b.addEventListener("click", () => {
      fillPosForm(b.getAttribute("data-pos-edit"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );
  $$("[data-pos-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-pos-del");
      if (!confirm("Удалить? При наличии заявок — только снятие.")) return;
      try {
        const res = await deletePosition(id);
        toast(res?.soft ? `Есть заявки (${res.linked}) — снята` : "Удалено", res?.soft ? "warn" : "ok");
        if (state.editingPosId === id) resetPosForm();
      } catch (e) {
        toast(e.message, "err");
      }
    })
  );
}

function fillPosForm(id) {
  const p = state.positions[id];
  if (!p) return;
  state.editingPosId = id;
  $("#posFormTitle").textContent = "Редактирование вакансии";
  $("#posExistingId").value = id;
  $("#posTitle").value = p.title || "";
  $("#posDept").value = p.department || "";
  $("#posLevel").value = p.level || "руководитель";
  $("#posStatus").value = p.status || "open";
  $("#posSlots").value = p.slots || 1;
  $("#posSummary").value = p.summary || "";
  $("#posTags").value = (p.tags || []).join(", ");
  $("#posReq").value = (p.requirements || []).join("\n");
  $("#posDuties").value = (p.duties || []).join("\n");
  $("#posFormCancel").style.display = "";
}

function resetPosForm() {
  state.editingPosId = null;
  $("#posFormTitle").textContent = "Поставить вакансию";
  $("#posForm").reset();
  $("#posExistingId").value = "";
  $("#posFormCancel").style.display = "none";
}

function renderProtocol() {
  const logs = Object.values(state.logs).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  $("#protocolLog").innerHTML = logs.length
    ? logs
        .map((l) => {
          const cls =
            l.direction === "inbound" ? "plog-in" : l.direction === "outbound" ? "plog-out" : "plog-sys";
          const tag =
            l.direction === "inbound" ? "IN" : l.direction === "outbound" ? "OUT" : "SYS";
          return `<div class="plog-line">
            <span class="plog-time">${esc(fmtDate(l.at))}</span>
            <span class="${cls}">[${tag}]</span>
            ${esc(l.kind)}
            ${l.user ? "· " + esc(l.user) : ""}
            · <span class="mono">${esc(JSON.stringify(l.payload || {}))}</span>
          </div>`;
        })
        .join("")
    : `<div class="plog-line"><span class="plog-sys">[СИСТЕМА]</span> Журнал пуст. События появятся после заявок и обзвонов.</div>`;

  const apps = appList();
  $("#rawAppsTable tbody").innerHTML = apps
    .map(
      (a) => `<tr>
      <td>${esc(a.rpName)}</td>
      <td class="mono text-sm">${esc(a.discord)}</td>
      <td>${esc(posTitle(a.positionId))}</td>
      <td>${badge(a.status)}</td>
    </tr>`
    )
    .join("") || `<tr><td colspan="4" class="muted">Нет заявок</td></tr>`;

  const calls = Object.values(state.calls).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  $("#rawCallsTable tbody").innerHTML =
    calls
      .map(
        (c) => `<tr>
      <td class="text-sm">${esc(fmtDate(c.at))}</td>
      <td>${esc(c.rpName)}</td>
      <td>${badge(c.status)}</td>
      <td>${esc(c.host || "—")}</td>
    </tr>`
      )
      .join("") || `<tr><td colspan="4" class="muted">Нет звонков</td></tr>`;

  if (isAdmin()) renderUsers();
}

function renderUsers() {
  const tb = $("#usersTable tbody");
  if (!tb) return;
  tb.innerHTML = state.users
    .map(
      (u, i) => `<tr>
      <td>${esc(u.fullName)}</td>
      <td><span class="role-badge ${esc(u.role)}">${esc(roleLabel(u.role))}</span></td>
      <td class="table-actions">
        <button type="button" class="btn btn--secondary" style="padding:6px 10px;font-size:0.78rem" data-user-role="${i}">Роль</button>
        <button type="button" class="btn btn--danger" style="padding:6px 10px;font-size:0.78rem" data-user-del="${i}">✕</button>
      </td>
    </tr>`
    )
    .join("");

  $$("[data-user-role]").forEach((b) =>
    b.addEventListener("click", async () => {
      const i = Number(b.getAttribute("data-user-role"));
      const u = state.users[i];
      if (!u) return;
      const cycle = { user: "host", host: "admin", admin: "user" };
      u.role = cycle[u.role] || "user";
      await usersRef.set(state.users);
      await writeLog("system", "user_role", { name: u.fullName, role: u.role });
      toast(`${u.fullName} → ${roleLabel(u.role)}`, "ok");
    })
  );
  $$("[data-user-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const i = Number(b.getAttribute("data-user-del"));
      const u = state.users[i];
      if (!u || u.fullName === state.currentUser?.fullName) {
        toast("Нельзя удалить себя", "warn");
        return;
      }
      if (!confirm("Удалить пользователя " + u.fullName + "?")) return;
      state.users.splice(i, 1);
      await usersRef.set(state.users);
      await writeLog("system", "user_deleted", { name: u.fullName });
      toast("Удалено", "ok");
    })
  );
}

/* ===== Bind UI once ===== */
function bindUi() {
  // tabs
  $$("#mainTabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // login
  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#loginFullName").value.trim();
    const pass = $("#loginPassword").value;
    const master = $("#loginMasterPassword").value;
    if (master !== getMasterPassword()) {
      showLoginError("Неверный мастер-пароль");
      return;
    }
    const user = state.users.find(
      (u) => u.fullName.toLowerCase() === name.toLowerCase() && u.password === pass
    );
    if (!user) {
      showLoginError("Неверные учётные данные");
      return;
    }
    showLoginError("");
    enterApp(user);
  });

  $("#registerBtn").addEventListener("click", () => {
    $("#registerModal").style.display = "flex";
  });
  $("#registerClose").addEventListener("click", () => {
    $("#registerModal").style.display = "none";
  });
  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = $("#regFullName").value.trim();
    const password = $("#regPassword").value;
    const master = $("#regMasterPassword").value;
    if (master !== getMasterPassword()) {
      showRegError("Неверный мастер-пароль");
      return;
    }
    if (state.users.some((u) => u.fullName.toLowerCase() === fullName.toLowerCase())) {
      showRegError("Такой пользователь уже есть");
      return;
    }
    state.users.push({ fullName, password, role: "user" });
    await usersRef.set(state.users);
    await writeLog("system", "user_registered", { fullName });
    showRegError("");
    $("#registerModal").style.display = "none";
    toast("Зарегистрирован. Войдите.", "ok");
    $("#loginFullName").value = fullName;
  });

  $("#logoutBtn").addEventListener("click", logout);
  $("#manageUsersBtn").addEventListener("click", () => {
    switchTab("protocol");
    $("#usersAdminCard").scrollIntoView({ behavior: "smooth" });
  });

  $("#exportJsonBtn").addEventListener("click", () => {
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
            users: state.users.map((u) => ({ fullName: u.fullName, role: u.role })),
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "asuls-calldesk-export.json";
    a.click();
    addLogEntry("Экспорт JSON");
  });

  // apply
  $("#applyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const rec = await submitApplication(data);
      toast("Заявка отправлена", "ok");
      const ok = $("#applyOk");
      ok.style.display = "";
      ok.innerHTML = `<div class="alert-box ok"><strong>Готово.</strong> ${esc(rec.rpName)} в очереди на «${esc(
        posTitle(rec.positionId)
      )}». Discord: <span class="mono">${esc(rec.discord)}</span></div>`;
      e.target.reset();
      renderApply();
    } catch (err) {
      console.error(err);
      toast(err.message || "Ошибка. Проверьте Rules Firebase.", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // host filters
  $("#hostFilterStatus")?.addEventListener("change", (e) => {
    state.hostFilterStatus = e.target.value;
    renderHost();
  });
  $("#hostFilterPos")?.addEventListener("change", (e) => {
    state.hostFilterPos = e.target.value;
    renderHost();
  });

  // results filters
  $("#resStatus")?.addEventListener("change", (e) => {
    state.resStatus = e.target.value;
    renderResults();
  });
  $("#resQ")?.addEventListener("input", (e) => {
    state.resQ = e.target.value;
    clearTimeout(state._qt);
    state._qt = setTimeout(() => renderResults(), 180);
  });

  // admin form
  $("#posForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Нет прав", "err");
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const existingId = data.existingId || null;
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const rec = await savePosition(data, existingId || null);
      toast(existingId ? "Сохранено" : "Вакансия поставлена: " + rec.title, "ok");
      resetPosForm();
    } catch (err) {
      toast(err.message || "Ошибка", "err");
    } finally {
      btn.disabled = false;
    }
  });
  $("#posFormCancel")?.addEventListener("click", resetPosForm);

  $("#btnRefreshLog")?.addEventListener("click", () => renderProtocol());

  $("#newUserForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin()) return;
    const fullName = $("#newUserName").value.trim();
    const password = $("#newUserPass").value;
    const role = $("#newUserRole").value;
    if (state.users.some((u) => u.fullName.toLowerCase() === fullName.toLowerCase())) {
      return toast("Уже существует", "warn");
    }
    state.users.push({ fullName, password, role });
    await usersRef.set(state.users);
    await writeLog("system", "user_created", { fullName, role });
    e.target.reset();
    toast("Пользователь добавлен", "ok");
    renderUsers();
  });
}

/* ===== Start ===== */
async function start() {
  initMatrix();
  bindUi();
  try {
    await ensureSeed();
    bindData();
  } catch (e) {
    console.error(e);
    toast("Не удалось подключить Firebase. Проверьте Rules.", "err");
  }

  // session restore
  try {
    const raw = sessionStorage.getItem("asuls_calls_user");
    if (raw) {
      const u = JSON.parse(raw);
      // wait a tick for users cache
      setTimeout(() => {
        const found = state.users.find(
          (x) => x.fullName === u.fullName && x.password === u.password
        );
        if (found) enterApp(found);
      }, 600);
    }
  } catch (_) {}
}

// boot then start
runBoot(() => start());
