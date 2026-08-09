/**
 * АСУЛС · Заявки на должности (premium)
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
const db = firebase.database();
firebase.auth().signInAnonymously().catch(console.error);

const R = {
  users: db.ref("apps/users"),
  positions: db.ref("apps/positions"),
  applications: db.ref("apps/applications"),
  logs: db.ref("apps/logs"),
};

const MASTER_KEY = "asuls_apps_master";
const DEFAULT_MASTER = "123456";
function getMaster() {
  let s = localStorage.getItem(MASTER_KEY);
  if (!s) {
    localStorage.setItem(MASTER_KEY, btoa(DEFAULT_MASTER));
    return DEFAULT_MASTER;
  }
  try {
    return atob(s);
  } catch {
    return DEFAULT_MASTER;
  }
}

const STATUS = {
  new: { label: "Подана", cls: "b-new", icon: "fa-inbox" },
  review: { label: "Рассмотрение", cls: "b-calling", icon: "fa-search" },
  interview: { label: "Собеседование", cls: "b-interview", icon: "fa-comments" },
  accepted: { label: "Принята", cls: "b-pass", icon: "fa-check" },
  rejected: { label: "Отказ", cls: "b-fail", icon: "fa-times" },
  withdrawn: { label: "Отозвана", cls: "b-noanswer", icon: "fa-undo" },
};

const state = {
  user: null,
  users: [],
  positions: {},
  applications: {},
  logs: {},
  view: "home",
  selectedPosId: null,
  selectedAppId: null,
  revFilter: "active",
  revSearch: "",
  posSearch: "",
  connected: false,
  editingPosId: null,
  editingUserIndex: null,
  localLog: [],
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function uid(p = "id") {
  return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function nowIso() {
  return new Date().toISOString();
}
function fmt(iso) {
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
function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}
function progress(on) {
  $("#topProgress")?.classList.toggle("on", !!on);
}
function toast(msg, type = "") {
  const h = $("#toast-host");
  if (!h) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = `<i class="fas ${
    type === "ok" ? "fa-check-circle" : type === "err" ? "fa-exclamation-circle" : "fa-info-circle"
  }"></i> ${esc(msg)}`;
  h.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .2s";
    setTimeout(() => el.remove(), 200);
  }, 3000);
}
function badge(st) {
  const m = STATUS[st] || { label: st || "—", cls: "b-draft" };
  return `<span class="badge ${m.cls}">${esc(m.label)}</span>`;
}
function isAdmin() {
  return state.user?.role === "admin";
}
function isReviewer() {
  const r = state.user?.role;
  return r === "admin" || r === "reviewer";
}
function roleLabel(r) {
  return { admin: "Начальство", reviewer: "Кадровик", user: "Кандидат" }[r] || "Кандидат";
}
function posTitle(id) {
  return state.positions[id]?.title || id || "—";
}
function parseLines(t) {
  return String(t || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function openPositions() {
  return Object.values(state.positions)
    .filter((p) => p.status === "open")
    .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.title || "").localeCompare(b.title || "", "ru"));
}
function allApps() {
  return Object.values(state.applications).sort((a, b) =>
    (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
  );
}
function myApps() {
  const name = state.user?.fullName;
  return allApps().filter((a) => a.owner === name);
}
function appsForPos(id) {
  return allApps().filter((a) => a.positionId === id);
}
function stats() {
  const apps = allApps();
  const by = (s) => apps.filter((a) => a.status === s).length;
  return {
    open: openPositions().length,
    queue: by("new") + by("review") + by("interview"),
    mine: myApps().length,
    accepted: by("accepted"),
    total: apps.length,
  };
}

async function writeLog(kind, message, extra = {}) {
  const entry = {
    id: uid("log"),
    kind,
    message,
    extra,
    at: nowIso(),
    user: state.user?.fullName || null,
  };
  state.localLog.unshift(entry);
  state.localLog = state.localLog.slice(0, 40);
  try {
    await R.logs.child(entry.id).set(entry);
  } catch (_) {}
  renderSideLog();
}

/* ===== Seed ===== */
async function ensureSeed() {
  const u = await R.users.once("value");
  if (!u.exists()) {
    await R.users.set([
      { fullName: "Администратор", password: "admin", role: "admin" },
      { fullName: "Кадровик", password: "kadry", role: "reviewer" },
    ]);
  }
}

/* ===== Users CRUD ===== */
async function saveUser(data, index = null) {
  const fullName = (data.fullName || "").trim();
  const password = (data.password || "").trim();
  const role = ["admin", "reviewer", "user"].includes(data.role) ? data.role : "user";
  if (!fullName) throw new Error("Укажите ФИО");
  if (index == null && !password) throw new Error("Укажите пароль");

  const list = state.users.slice();
  const dup = list.findIndex(
    (u, i) => u.fullName.toLowerCase() === fullName.toLowerCase() && i !== index
  );
  if (dup >= 0) throw new Error("Такой пользователь уже есть");

  if (index == null) {
    list.push({ fullName, password, role });
    await writeLog("out", `Пользователь создан: ${fullName}`, { role });
  } else {
    if (!list[index]) throw new Error("Пользователь не найден");
    list[index] = {
      fullName,
      password: password || list[index].password,
      role,
    };
    await writeLog("out", `Пользователь изменён: ${fullName}`, { role });
  }
  await R.users.set(list);
  state.users = list;
  return list;
}

async function deleteUser(index) {
  const list = state.users.slice();
  const u = list[index];
  if (!u) throw new Error("Не найден");
  if (u.fullName === state.user?.fullName) throw new Error("Нельзя удалить себя");
  const admins = list.filter((x) => x.role === "admin");
  if (u.role === "admin" && admins.length <= 1) throw new Error("Нужен хотя бы один администратор");
  list.splice(index, 1);
  await R.users.set(list);
  state.users = list;
  await writeLog("sys", `Пользователь удалён: ${u.fullName}`);
}

/* ===== Bind ===== */
function bind() {
  const ok = () => {
    state.connected = true;
    live();
    if (state.user) render();
  };
  R.users.on(
    "value",
    (s) => {
      const v = s.val();
      state.users = v ? (Array.isArray(v) ? v : Object.values(v)) : [];
      ok();
    },
    onErr
  );
  R.positions.on(
    "value",
    (s) => {
      state.positions = s.val() || {};
      ok();
    },
    onErr
  );
  R.applications.on(
    "value",
    (s) => {
      state.applications = s.val() || {};
      ok();
    },
    onErr
  );
  R.logs.limitToLast(50).on(
    "value",
    (s) => {
      state.logs = s.val() || {};
      if (state.user) renderSideLog();
    },
    () => {}
  );
}
function onErr(e) {
  console.error(e);
  state.connected = false;
  live();
  toast("Нет связи с базой", "err");
}
function live() {
  const el = $("#liveStatus");
  if (!el) return;
  el.className = "live-pill" + (state.connected ? "" : " off");
  el.innerHTML = `<span class="dot"></span> ${state.connected ? "ONLINE" : "…"}`;
}

/* ===== Applications ===== */
async function submitApp(data) {
  progress(true);
  try {
    const id = uid("app");
    const at = nowIso();
    const rec = {
      id,
      positionId: data.positionId,
      positionTitle: posTitle(data.positionId),
      owner: state.user.fullName,
      name: data.name.trim(),
      staticId: data.staticId.trim(),
      discord: data.discord.trim(),
      age: (data.age || "").trim(),
      online: (data.online || "").trim(),
      currentRole: (data.currentRole || "").trim(),
      experience: data.experience.trim(),
      motivation: data.motivation.trim(),
      extra: (data.extra || "").trim(),
      status: "new",
      note: "",
      createdAt: at,
      updatedAt: at,
      reviewer: null,
      history: [
        {
          at,
          status: "new",
          by: state.user.fullName,
          note: "Заявка подана",
        },
      ],
    };
    await R.applications.child(id).set(rec);
    await writeLog("in", `Заявка: ${rec.name} → ${rec.positionTitle}`, { id });
    return rec;
  } finally {
    progress(false);
  }
}

async function setAppStatus(id, status, note) {
  progress(true);
  try {
    const a = state.applications[id];
    if (!a) throw new Error("Не найдена");
    const at = nowIso();
    const history = Array.isArray(a.history) ? a.history.slice() : [];
    history.unshift({
      at,
      status,
      by: state.user.fullName,
      note: note || STATUS[status]?.label || status,
    });
    await R.applications.child(id).update({
      status,
      note: note != null ? note : a.note || "",
      updatedAt: at,
      reviewer: state.user.fullName,
      history: history.slice(0, 30),
    });
    await writeLog("out", `${STATUS[status]?.label || status}: ${a.name}`, { id, status });
  } finally {
    progress(false);
  }
}

async function withdrawApp(id) {
  const a = state.applications[id];
  if (!a || a.owner !== state.user.fullName) throw new Error("Нет доступа");
  if (!["new", "review"].includes(a.status)) throw new Error("Нельзя отозвать");
  await setAppStatus(id, "withdrawn", "Отозвано кандидатом");
}

/* ===== Positions ===== */
async function savePos(data, existingId) {
  progress(true);
  try {
    const title = data.title.trim();
    if (!title) throw new Error("Укажите название");
    let id =
      existingId ||
      title
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) ||
      uid("pos");
    if (!existingId && state.positions[id]) id = id + "-" + Math.random().toString(36).slice(2, 5);
    const prev = existingId ? state.positions[existingId] : null;
    const rec = {
      id,
      title,
      department: (data.department || "").trim() || "Подразделение",
      status: data.status === "closed" ? "closed" : "open",
      slots: Math.max(1, Number(data.slots) || 1),
      summary: (data.summary || "").trim(),
      requirements: parseLines(data.requirements),
      duties: parseLines(data.duties),
      order: prev?.order ?? Date.now() % 100000,
      updatedAt: nowIso(),
      updatedBy: state.user.fullName,
    };
    await R.positions.child(id).set(rec);
    await writeLog("out", existingId ? `Должность обновлена: ${title}` : `Должность открыта: ${title}`);
    return rec;
  } finally {
    progress(false);
  }
}
async function setPosStatus(id, status) {
  await R.positions.child(id).update({
    status,
    updatedAt: nowIso(),
    updatedBy: state.user.fullName,
  });
  await writeLog("out", `Должность ${status === "open" ? "открыта" : "закрыта"}: ${posTitle(id)}`);
}
async function deletePos(id) {
  if (appsForPos(id).length) {
    await setPosStatus(id, "closed");
    return { soft: true };
  }
  const t = posTitle(id);
  await R.positions.child(id).remove();
  await writeLog("sys", `Должность удалена: ${t}`);
  return { soft: false };
}

/* ===== Views ===== */
function show(view) {
  state.view = view;
  ["home", "my", "review", "admin", "users"].forEach((v) => {
    const el = $("#view-" + v);
    if (el) el.classList.toggle("page-hidden", v !== view);
  });
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  if (!state.user) return;
  const s = stats();
  $("#stOpen").textContent = s.open;
  $("#stQueue").textContent = s.queue;
  $("#stMine").textContent = s.mine;
  $("#stAccepted").textContent = s.accepted;
  $("#vacCount").textContent = s.open;
  $("#cmdSub").textContent = `${roleLabel(state.user.role)} · ${state.user.fullName}`;
  $("#sideUser").innerHTML = `
    <div style="color:#fff;font-weight:800;font-size:1.05rem;margin-bottom:6px;">${esc(state.user.fullName)}</div>
    <span class="role-badge ${esc(state.user.role)}">${esc(roleLabel(state.user.role))}</span>
    <div class="text-sm muted mt-12">Заявок в системе: <b style="color:#fff">${s.total}</b></div>
  `;

  if (state.view === "home") renderHome();
  if (state.view === "my") renderMy();
  if (state.view === "review") renderReview();
  if (state.view === "admin") renderAdmin();
  if (state.view === "users") renderUsers();
  renderSideRecent();
  renderSideLog();
}

function renderSideRecent() {
  const list = (isReviewer() ? allApps() : myApps()).slice(0, 6);
  $("#sideRecent").innerHTML = list.length
    ? list
        .map(
          (a) => `<div class="side-user" style="cursor:pointer" data-jump-app="${esc(a.id)}">
      <div class="av">${esc((a.name || "?").slice(0, 1).toUpperCase())}</div>
      <div style="min-width:0">
        <div style="color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(
          a.positionTitle || posTitle(a.positionId)
        )}</div>
        <div class="text-sm muted">${badge(a.status)} · ${esc(fmtTime(a.updatedAt || a.createdAt))}</div>
      </div>
    </div>`
        )
        .join("")
    : `<div class="text-sm muted">Нет заявок</div>`;

  $$("[data-jump-app]").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-jump-app");
      if (isReviewer()) {
        state.selectedAppId = id;
        show("review");
      } else show("my");
    })
  );
}

function renderSideLog() {
  const remote = Object.values(state.logs || {}).sort((a, b) =>
    (b.at || "").localeCompare(a.at || "")
  );
  const merged = [...state.localLog, ...remote]
    .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, 18);

  const el = $("#sideLog");
  if (!el) return;
  el.innerHTML = merged.length
    ? merged
        .map((l) => {
          const cls = l.kind === "in" ? "plog-in" : l.kind === "out" ? "plog-out" : "plog-sys";
          const tag = l.kind === "in" ? "IN" : l.kind === "out" ? "OUT" : "SYS";
          return `<div class="plog-line"><span class="plog-time">${esc(
            fmtTime(l.at)
          )}</span> <span class="${cls}">[${tag}]</span> ${esc(l.message)}</div>`;
        })
        .join("")
    : `<div class="plog-line"><span class="plog-sys">[SYS]</span> Готов</div>`;
}

function renderHome() {
  let list = openPositions();
  const q = (state.posSearch || "").toLowerCase().trim();
  if (q) {
    list = list.filter((p) =>
      [p.title, p.department, p.summary].join(" ").toLowerCase().includes(q)
    );
  }
  const closed = Object.values(state.positions)
    .filter((p) => p.status !== "open")
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));

  if (!state.selectedPosId && list[0]) state.selectedPosId = list[0].id;
  if (state.selectedPosId && !state.positions[state.selectedPosId]) state.selectedPosId = list[0]?.id || null;

  $("#vacancyList").innerHTML = list.length
    ? list
        .map((p) => {
          const n = appsForPos(p.id).length;
          return `<article class="vacancy-item ${
            state.selectedPosId === p.id ? "active" : ""
          }" data-pos="${esc(p.id)}" tabindex="0">
          <h3>${esc(p.title)}</h3>
          <div class="meta">
            <span><i class="fas fa-building"></i> ${esc(p.department || "—")}</span>
            <span><i class="fas fa-user-friends"></i> ${esc(p.slots || 1)}</span>
            <span><i class="fas fa-file-alt"></i> ${n}</span>
          </div>
          <div class="summary">${esc(p.summary || "")}</div>
          <div class="tags">
            <span class="chip ok">Открыта</span>
            ${n ? `<span class="chip gold">${n} заявок</span>` : ""}
          </div>
        </article>`;
        })
        .join("")
    : `<div class="empty-state"><i class="fas fa-briefcase"></i><h4>Нет открытых должностей</h4></div>`;

  if (closed.length && !q) {
    $("#vacancyList").innerHTML += closed
      .slice(0, 8)
      .map(
        (p) => `<article class="vacancy-item closed">
        <h3>${esc(p.title)}</h3>
        <div class="meta"><span>${esc(p.department || "")}</span></div>
        <div class="tags"><span class="chip">Закрыта</span></div>
      </article>`
      )
      .join("");
  }

  $$("#vacancyList [data-pos]").forEach((el) => {
    const go = () => {
      state.selectedPosId = el.getAttribute("data-pos");
      closeApplyModal();
      renderHome();
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });

  const p = state.positions[state.selectedPosId];
  const box = $("#posDetail");
  if (!p || p.status !== "open") {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-hand-pointer"></i><h4>Выберите должность</h4></div>`;
    return;
  }
  const n = appsForPos(p.id).length;
  const already = myApps().some((a) => a.positionId === p.id && !["withdrawn", "rejected"].includes(a.status));
  box.innerHTML = `
    <div class="detail-title">${esc(p.title)}</div>
    <div class="text-sm muted mb-12">
      <i class="fas fa-building"></i> ${esc(p.department || "—")}
      · мест: <b style="color:#fff">${esc(p.slots || 1)}</b>
      · заявок: <b style="color:#fff">${n}</b>
    </div>
    <div class="detail-block"><label>Описание</label>${esc(p.summary || "—")}</div>
    <div class="detail-block"><label>Требования</label>${
      (p.requirements || []).length
        ? `<ul class="req-list">${(p.requirements || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : "—"
    }</div>
    <div class="detail-block"><label>Обязанности</label>${
      (p.duties || []).length
        ? `<ul class="duty-list">${(p.duties || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : "—"
    }</div>
    <div class="inline-actions">
      <button type="button" class="btn btn--gold" id="btnStartApply" ${
        already ? "disabled" : ""
      }><i class="fas fa-file-signature"></i> ${already ? "Уже подано" : "Подать заявку"}</button>
      ${already ? `<button type="button" class="btn btn--secondary" id="btnGoMy">Мои заявки</button>` : ""}
    </div>
  `;
  $("#btnStartApply")?.addEventListener("click", () => openApplyModal(p));
  $("#btnGoMy")?.addEventListener("click", () => show("my"));
}

function openApplyModal(p) {
  if (!p) return;
  const modal = $("#applyModal");
  if (!modal) return;
  $("#applyPosId").value = p.id;
  $("#applyPosTitle").textContent = p.title;
  const meta = $("#applyPosMeta");
  if (meta) {
    meta.innerHTML = `<i class="fas fa-building"></i> ${esc(p.department || "—")} · мест: ${esc(
      p.slots || 1
    )}`;
  }
  $("#aName").value = state.user?.fullName || "";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  // focus first empty required field
  setTimeout(() => {
    const name = $("#aName");
    if (name && !name.value) name.focus();
    else $("#aStatic")?.focus();
  }, 50);
}

function closeApplyModal() {
  const modal = $("#applyModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  const form = $("#applyForm");
  if (form) form.reset();
  const id = $("#applyPosId");
  if (id) id.value = "";
}

function statusSteps(st) {
  const order = ["new", "review", "interview", "accepted"];
  const fail = st === "rejected" || st === "withdrawn";
  const idx = order.indexOf(st);
  return `<div class="status-steps">
    ${order
      .map((s, i) => {
        const on = !fail && idx >= 0 && i <= idx;
        return `<span class="status-step ${on ? "on" : ""}">${esc(STATUS[s].label)}</span>`;
      })
      .join("")}
    ${fail ? `<span class="status-step fail-on">${esc(STATUS[st]?.label || st)}</span>` : ""}
  </div>`;
}

function historyHtml(a) {
  const h = Array.isArray(a.history) ? a.history : [];
  if (!h.length) return "";
  return `<div class="timeline">
    ${h
      .slice(0, 8)
      .map(
        (x) => `<div class="tl-item">
        <div class="t">${esc(fmt(x.at))} · ${esc(x.by || "")}</div>
        <div class="b">${badge(x.status)} ${esc(x.note || "")}</div>
      </div>`
      )
      .join("")}
  </div>`;
}

function renderMy() {
  const list = myApps();
  $("#myList").innerHTML = list.length
    ? list
        .map(
          (a) => `<div class="app-card">
      <div class="app-top">
        <div>
          <div class="app-title">${esc(a.positionTitle || posTitle(a.positionId))}</div>
          <div class="app-sub">${esc(a.name)} · ${esc(a.staticId)} · ${esc(fmt(a.createdAt))}</div>
        </div>
        ${badge(a.status)}
      </div>
      ${statusSteps(a.status)}
      ${a.note ? `<div class="detail-block mt-12"><label>Комментарий</label>${esc(a.note)}</div>` : ""}
      ${historyHtml(a)}
      ${
        ["new", "review"].includes(a.status)
          ? `<button type="button" class="btn btn--secondary mt-12" data-withdraw="${esc(a.id)}"><i class="fas fa-undo"></i> Отозвать</button>`
          : ""
      }
    </div>`
        )
        .join("")
    : `<div class="empty-state"><i class="fas fa-folder-open"></i><h4>Заявок нет</h4></div>`;

  $$("[data-withdraw]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Отозвать заявку?")) return;
      try {
        await withdrawApp(b.getAttribute("data-withdraw"));
        toast("Отозвано", "ok");
      } catch (e) {
        toast(e.message, "err");
      }
    })
  );
}

function renderReview() {
  if (!isReviewer()) {
    $("#revList").innerHTML = `<div class="empty-state"><h4>Нет доступа</h4></div>`;
    return;
  }
  let list = allApps();
  const f = state.revFilter;
  if (f === "active") list = list.filter((a) => ["new", "review", "interview"].includes(a.status));
  else if (f !== "all") list = list.filter((a) => a.status === f);

  const q = (state.revSearch || "").toLowerCase().trim();
  if (q) {
    list = list.filter((a) =>
      [a.name, a.discord, a.staticId, a.positionTitle, a.owner].join(" ").toLowerCase().includes(q)
    );
  }

  const selected =
    (state.selectedAppId && state.applications[state.selectedAppId] && list.find((x) => x.id === state.selectedAppId)) ||
    list[0] ||
    null;
  if (selected) state.selectedAppId = selected.id;
  $("#revCount").textContent = list.length;

  $("#revList").innerHTML = list.length
    ? list
        .map(
          (a) => `<div class="review-item ${selected?.id === a.id ? "active" : ""}" data-app="${esc(a.id)}">
        <div class="fw-700" style="color:#fff;">${esc(a.name)}</div>
        <div class="text-sm muted">${esc(a.positionTitle || posTitle(a.positionId))}</div>
        <div class="text-sm muted mono mt-8">${esc(a.discord || "")}</div>
        <div class="mt-8">${badge(a.status)}</div>
      </div>`
        )
        .join("")
    : `<div class="empty-state"><i class="fas fa-inbox"></i><h4>Пусто</h4></div>`;

  $$("#revList [data-app]").forEach((el) =>
    el.addEventListener("click", () => {
      state.selectedAppId = el.getAttribute("data-app");
      renderReview();
    })
  );

  const box = $("#revCard");
  if (!selected) {
    box.innerHTML = `<div class="empty-state"><i class="fas fa-user"></i><h4>Выберите заявку</h4></div>`;
    return;
  }
  box.innerHTML = `
    <div class="inline-actions" style="justify-content:space-between;margin-bottom:14px;align-items:flex-start;">
      <div>
        <div class="detail-title">${esc(selected.name)}</div>
        <div class="text-sm muted mt-8">${esc(selected.positionTitle || posTitle(selected.positionId))}</div>
        <div class="mt-8">${badge(selected.status)}</div>
      </div>
      <button type="button" class="btn btn--gold" id="btnCopyDc"><i class="fas fa-copy"></i> ${esc(selected.discord)}</button>
    </div>
    ${statusSteps(selected.status)}
    <div class="detail-block mt-12"><label>Static ID</label>${esc(selected.staticId || "—")}</div>
    <div class="detail-block"><label>Discord</label>${esc(selected.discord || "—")}</div>
    <div class="detail-block"><label>Возраст / онлайн</label>${esc(selected.age || "—")} · ${esc(selected.online || "—")}</div>
    <div class="detail-block"><label>Текущая должность</label>${esc(selected.currentRole || "—")}</div>
    <div class="detail-block"><label>Опыт</label>${esc(selected.experience || "—")}</div>
    <div class="detail-block"><label>Мотивация</label>${esc(selected.motivation || "—")}</div>
    ${selected.extra ? `<div class="detail-block"><label>Дополнительно</label>${esc(selected.extra)}</div>` : ""}
    <div class="form-group mt-12">
      <label>Комментарий</label>
      <textarea id="revNote" rows="3">${esc(selected.note || "")}</textarea>
    </div>
    <div class="inline-actions mt-12">
      <button type="button" class="btn btn--primary" data-st="review"><i class="fas fa-search"></i> Рассмотрение</button>
      <button type="button" class="btn btn--gold" data-st="interview"><i class="fas fa-comments"></i> Собеседование</button>
      <button type="button" class="btn btn--gold" data-st="accepted" style="background:linear-gradient(135deg,#2f9e5f,#48bb78);"><i class="fas fa-check"></i> Принять</button>
      <button type="button" class="btn btn--danger" data-st="rejected"><i class="fas fa-times"></i> Отказ</button>
    </div>
    <div class="text-sm muted mt-12">Подана: ${esc(fmt(selected.createdAt))} · ${esc(selected.owner || "—")}</div>
    <div class="mt-12"><label style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.06em;color:#718096;font-weight:800;">История</label>${historyHtml(selected) || '<div class="text-sm muted">—</div>'}</div>
  `;

  $("#btnCopyDc")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(selected.discord);
      $("#btnCopyDc").classList.add("copy-flash");
      toast("Скопировано", "ok");
    } catch {
      toast(selected.discord, "ok");
    }
  });
  $$("#revCard [data-st]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await setAppStatus(selected.id, b.getAttribute("data-st"), $("#revNote")?.value || "");
        toast("Сохранено", "ok");
      } catch (e) {
        toast(e.message || "Ошибка", "err");
      }
    })
  );
}

function renderAdmin() {
  if (!isAdmin()) {
    $("#adminTable tbody").innerHTML = `<tr><td colspan="4">Нет доступа</td></tr>`;
    return;
  }
  const list = Object.values(state.positions).sort(
    (a, b) => (a.order || 0) - (b.order || 0) || (a.title || "").localeCompare(b.title || "", "ru")
  );
  $("#adminTable tbody").innerHTML = list.length
    ? list
        .map((p) => {
          const n = appsForPos(p.id).length;
          return `<tr>
          <td><div class="fw-700">${esc(p.title)}</div><div class="text-sm muted">${esc(p.department || "")}</div></td>
          <td><span class="badge ${p.status === "open" ? "b-open" : "b-closed"}">${
            p.status === "open" ? "Открыта" : "Закрыта"
          }</span></td>
          <td>${n}</td>
          <td>
            <div class="table-actions">
              ${
                p.status === "open"
                  ? `<button type="button" class="btn btn--secondary" style="padding:6px 10px;font-size:0.78rem" data-close="${esc(p.id)}">Закрыть</button>`
                  : `<button type="button" class="btn btn--gold" style="padding:6px 10px;font-size:0.78rem" data-open="${esc(p.id)}">Открыть</button>`
              }
              <button type="button" class="btn btn--primary" style="padding:6px 10px;font-size:0.78rem" data-edit="${esc(p.id)}">Изменить</button>
              <button type="button" class="btn btn--danger" style="padding:6px 10px;font-size:0.78rem" data-del="${esc(p.id)}">✕</button>
            </div>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-briefcase"></i><h4>Пусто</h4></div></td></tr>`;

  $$("[data-open]").forEach((b) =>
    b.addEventListener("click", () =>
      setPosStatus(b.getAttribute("data-open"), "open").then(() => toast("Открыта", "ok"))
    )
  );
  $$("[data-close]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm("Закрыть должность?")) return;
      setPosStatus(b.getAttribute("data-close"), "closed").then(() => toast("Закрыта", "ok"));
    })
  );
  $$("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => fillPos(b.getAttribute("data-edit")))
  );
  $$("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Удалить? При наличии заявок — только закрытие.")) return;
      const r = await deletePos(b.getAttribute("data-del"));
      toast(r.soft ? "Закрыта" : "Удалена", r.soft ? "warn" : "ok");
      resetPos();
    })
  );
}

function fillPos(id) {
  const p = state.positions[id];
  if (!p) return;
  state.editingPosId = id;
  $("#posFormTitle").innerHTML = `<i class="fas fa-pen"></i> Редактирование`;
  $("#posId").value = id;
  $("#posTitle").value = p.title || "";
  $("#posDept").value = p.department || "";
  $("#posStatus").value = p.status || "open";
  $("#posSlots").value = p.slots || 1;
  $("#posSummary").value = p.summary || "";
  $("#posReq").value = (p.requirements || []).join("\n");
  $("#posDuties").value = (p.duties || []).join("\n");
  $("#posCancel").style.display = "";
}
function resetPos() {
  state.editingPosId = null;
  $("#posFormTitle").innerHTML = `<i class="fas fa-plus"></i> Новая должность`;
  $("#posForm").reset();
  $("#posId").value = "";
  $("#posCancel").style.display = "none";
}

function renderUsers() {
  if (!isAdmin()) {
    $("#usersTable tbody").innerHTML = `<tr><td colspan="4">Нет доступа</td></tr>`;
    return;
  }
  $("#usersTable tbody").innerHTML = state.users.length
    ? state.users
        .map((u, i) => {
          const self = u.fullName === state.user?.fullName;
          return `<tr>
          <td><div class="fw-700">${esc(u.fullName)}${self ? ' <span class="text-sm muted">(вы)</span>' : ""}</div></td>
          <td><span class="role-badge ${esc(u.role)}">${esc(roleLabel(u.role))}</span></td>
          <td class="text-sm muted mono">${esc(u.password ? "••••" : "—")}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn--primary" style="padding:6px 10px;font-size:0.78rem" data-uedit="${i}">Изменить</button>
              <button type="button" class="btn btn--danger" style="padding:6px 10px;font-size:0.78rem" data-udel="${i}" ${self ? "disabled" : ""}>✕</button>
            </div>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="4"><div class="empty-state"><h4>Нет пользователей</h4></div></td></tr>`;

  $$("[data-uedit]").forEach((b) =>
    b.addEventListener("click", () => fillUser(Number(b.getAttribute("data-uedit"))))
  );
  $$("[data-udel]").forEach((b) =>
    b.addEventListener("click", async () => {
      const i = Number(b.getAttribute("data-udel"));
      const u = state.users[i];
      if (!u || !confirm("Удалить «" + u.fullName + "»?")) return;
      try {
        await deleteUser(i);
        toast("Удалено", "ok");
        resetUserForm();
        renderUsers();
      } catch (e) {
        toast(e.message || "Ошибка", "err");
      }
    })
  );
}
function fillUser(index) {
  const u = state.users[index];
  if (!u) return;
  state.editingUserIndex = index;
  $("#userFormTitle").innerHTML = `<i class="fas fa-pen"></i> Редактирование`;
  $("#userIndex").value = String(index);
  $("#userName").value = u.fullName || "";
  $("#userPass").value = "";
  $("#userPass").placeholder = "Пусто = не менять";
  $("#userRole").value = u.role || "user";
  $("#userCancel").style.display = "";
}
function resetUserForm() {
  state.editingUserIndex = null;
  $("#userFormTitle").innerHTML = `<i class="fas fa-user-plus"></i> Новый пользователь`;
  $("#userForm").reset();
  $("#userIndex").value = "";
  $("#userPass").placeholder = "";
  $("#userCancel").style.display = "none";
}

/* ===== Auth ===== */
function enter(user) {
  state.user = user;
  sessionStorage.setItem("asuls_apps_user", JSON.stringify(user));
  $("#loginScreen").style.display = "none";
  $("#appContent").style.display = "block";
  $("#userDisplay").textContent = `${user.fullName} · ${roleLabel(user.role)}`;
  $("#btnReview").style.display = isReviewer() ? "" : "none";
  $("#btnAdmin").style.display = isAdmin() ? "" : "none";
  $("#btnUsers").style.display = isAdmin() ? "" : "none";
  writeLog("sys", `Вход: ${user.fullName}`);
  show("home");
}
function logout() {
  if (state.user) writeLog("sys", `Выход: ${state.user.fullName}`);
  state.user = null;
  sessionStorage.removeItem("asuls_apps_user");
  $("#appContent").style.display = "none";
  $("#loginScreen").style.display = "flex";
}

/* ===== FX ===== */
function initMatrix() {
  const c = $("#loginMatrixCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  let w, h, cols, drops;
  const resize = () => {
    w = c.width = innerWidth;
    h = c.height = innerHeight;
    cols = Math.floor(w / 18);
    drops = Array(cols).fill(1);
  };
  resize();
  addEventListener("resize", resize);
  const chars = "01АСУЛСЗАЯВКИ█▓▒░";
  (function draw() {
    if ($("#loginScreen")?.style.display !== "none") {
      ctx.fillStyle = "rgba(5,7,12,0.14)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(207,161,52,0.32)";
      ctx.font = "12px monospace";
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(chars[(Math.random() * chars.length) | 0], i * 18, drops[i] * 16);
        if (drops[i] * 16 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    requestAnimationFrame(draw);
  })();
}

function runBoot(done) {
  const screen = $("#decryptingScreen");
  const log = $("#terminalLog");
  const fill = $("#cyberProgressFill");
  const pct = $("#cyberPercent");
  if (!screen) return done();
  screen.style.display = "flex";
  const lines = [
    "> INIT CADRE MODULE…",
    "> LINK RTDB CHANNEL…",
    "> LOAD ACCESS MATRIX…",
    "> UI THEME: SLATE/GOLD…",
    "> CHANNEL SECURE",
  ];
  let i = 0;
  let p = 0;
  const t = setInterval(() => {
    if (i < lines.length && log) {
      log.innerHTML += `<div>${lines[i++]}</div>`;
      log.scrollTop = log.scrollHeight;
    }
    p = Math.min(100, p + 10 + Math.random() * 8);
    if (fill) fill.style.width = p + "%";
    if (pct) pct.textContent = Math.floor(p) + "%";
    if (p >= 100) {
      clearInterval(t);
      setTimeout(() => {
        screen.style.display = "none";
        done();
      }, 220);
    }
  }, 90);
}

function startClock() {
  const tick = () => {
    const el = $("#sysClock");
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };
  tick();
  setInterval(tick, 1000);
}

function bindUi() {
  function needsMaster(role) {
    return role === "admin" || role === "reviewer";
  }
  function updateMasterFieldVisibility() {
    const name = ($("#loginName")?.value || "").trim().toLowerCase();
    const pass = $("#loginPass")?.value || "";
    const group = $("#loginMasterGroup");
    const input = $("#loginMaster");
    if (!group) return;
    const match = state.users.find(
      (u) => u.fullName.toLowerCase() === name && u.password === pass
    );
    const show = !!(match && needsMaster(match.role));
    group.style.display = show ? "" : "none";
    if (!show && input) input.value = "";
  }
  $("#loginName")?.addEventListener("input", updateMasterFieldVisibility);
  $("#loginPass")?.addEventListener("input", updateMasterFieldVisibility);

  $("#loginForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#loginName").value.trim();
    const pass = $("#loginPass").value;
    const user = state.users.find(
      (u) => u.fullName.toLowerCase() === name.toLowerCase() && u.password === pass
    );
    if (!user) {
      $("#loginError").style.display = "block";
      $("#loginError").textContent = "Неверные данные";
      updateMasterFieldVisibility();
      return;
    }
    if (needsMaster(user.role)) {
      updateMasterFieldVisibility();
      if ($("#loginMaster").value !== getMaster()) {
        $("#loginError").style.display = "block";
        $("#loginError").textContent = "Неверный мастер-пароль";
        return;
      }
    }
    $("#loginError").style.display = "none";
    enter(user);
  };

  $("#openReg").onclick = () => ($("#regModal").style.display = "flex");
  $("#regClose").onclick = () => ($("#regModal").style.display = "none");
  $("#regForm").onsubmit = async (e) => {
    e.preventDefault();
    const fullName = $("#regName").value.trim();
    const password = $("#regPass").value;
    if (state.users.some((u) => u.fullName.toLowerCase() === fullName.toLowerCase())) {
      $("#regError").style.display = "block";
      $("#regError").textContent = "Уже существует";
      return;
    }
    state.users.push({ fullName, password, role: "user" });
    await R.users.set(state.users);
    $("#regError").style.display = "none";
    $("#regModal").style.display = "none";
    toast("Аккаунт создан", "ok");
    $("#loginName").value = fullName;
    updateMasterFieldVisibility();
  };

  $("#btnLogout").onclick = logout;
  $("#goHome").onclick = () => show("home");
  $$("[data-back-home]").forEach((b) => (b.onclick = () => show("home")));
  $("#btnMy").onclick = () => show("my");
  $("#btnReview").onclick = () => show("review");
  $("#btnAdmin").onclick = () => show("admin");
  $("#btnUsers").onclick = () => show("users");

  $("#posSearch")?.addEventListener("input", (e) => {
    state.posSearch = e.target.value;
    clearTimeout(state._ps);
    state._ps = setTimeout(() => renderHome(), 120);
  });
  $("#revSearch")?.addEventListener("input", (e) => {
    state.revSearch = e.target.value;
    clearTimeout(state._rs);
    state._rs = setTimeout(() => renderReview(), 120);
  });
  $("#revFilter")?.addEventListener("change", (e) => {
    state.revFilter = e.target.value;
    renderReview();
  });

  const closeApply = () => closeApplyModal();
  $("#applyCancel").onclick = closeApply;
  $("#applyClose").onclick = closeApply;
  $("#applyModal")?.addEventListener("click", (e) => {
    // клик по затемнению (не по карточке) — закрыть
    if (e.target === $("#applyModal")) closeApplyModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#applyModal")?.style.display === "flex") {
      closeApplyModal();
    }
  });

  $("#applyForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await submitApp({
        positionId: $("#applyPosId").value,
        name: $("#aName").value,
        staticId: $("#aStatic").value,
        discord: $("#aDiscord").value,
        age: $("#aAge").value,
        online: $("#aOnline").value,
        currentRole: $("#aCurrent").value,
        experience: $("#aExp").value,
        motivation: $("#aWhy").value,
        extra: $("#aExtra").value,
      });
      toast("Заявка подана", "ok");
      closeApplyModal();
      show("my");
    } catch (err) {
      toast(err.message || "Ошибка", "err");
    } finally {
      btn.disabled = false;
    }
  };

  $("#posForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return;
    try {
      await savePos(
        {
          title: $("#posTitle").value,
          department: $("#posDept").value,
          status: $("#posStatus").value,
          slots: $("#posSlots").value,
          summary: $("#posSummary").value,
          requirements: $("#posReq").value,
          duties: $("#posDuties").value,
        },
        $("#posId").value || null
      );
      toast("Сохранено", "ok");
      resetPos();
    } catch (err) {
      toast(err.message || "Ошибка", "err");
    }
  };
  $("#posCancel").onclick = resetPos;
  $("#btnClearPos").onclick = async () => {
    if (!isAdmin()) return;
    if (!confirm("Удалить ВСЕ должности?")) return;
    try {
      await R.positions.set({});
      state.positions = {};
      state.selectedPosId = null;
      resetPos();
      await writeLog("sys", "Все должности очищены");
      toast("Очищено", "ok");
      render();
    } catch (e) {
      toast(e.message || "Ошибка", "err");
    }
  };

  $("#userForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return;
    const idxRaw = $("#userIndex").value;
    const index = idxRaw === "" ? null : Number(idxRaw);
    try {
      await saveUser(
        {
          fullName: $("#userName").value,
          password: $("#userPass").value,
          role: $("#userRole").value,
        },
        index
      );
      toast("Сохранено", "ok");
      resetUserForm();
      renderUsers();
    } catch (err) {
      toast(err.message || "Ошибка", "err");
    }
  };
  $("#userCancel").onclick = resetUserForm;
}

async function start() {
  startClock();
  initMatrix();
  bindUi();
  runBoot(async () => {
    try {
      await ensureSeed();
      bind();
    } catch (e) {
      console.error(e);
      toast("Нет связи с базой", "err");
    }
    try {
      const raw = sessionStorage.getItem("asuls_apps_user");
      if (raw) {
        setTimeout(() => {
          const u = JSON.parse(raw);
          const found = state.users.find(
            (x) => x.fullName === u.fullName && x.password === u.password
          );
          if (found) enter(found);
        }, 500);
      }
    } catch (_) {}
  });
}

start();
