/**
 * АСУЛС · Заявки на должности
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

const SEED_POS = {
  "nach-otd": {
    id: "nach-otd",
    title: "Начальник отдела",
    department: "Территориальное подразделение",
    status: "open",
    slots: 2,
    summary: "Организация работы отдела, контроль исполнения, взаимодействие со смежными подразделениями.",
    requirements: [
      "Опыт руководства от 3 лет",
      "Знание устава и субординации",
      "Готовность к ненормированному графику",
    ],
    duties: ["Руководство отделом", "Постановка задач", "Отчётность", "Работа с личным составом"],
    order: 10,
  },
  "zam-nach-otd": {
    id: "zam-nach-otd",
    title: "Заместитель начальника отдела",
    department: "Территориальное подразделение",
    status: "open",
    slots: 3,
    summary: "Замещение руководителя, координация направлений, контроль поручений.",
    requirements: ["Опыт от 2 лет", "Документооборот", "Стрессоустойчивость"],
    duties: ["Замещение начальника", "Координация", "Наставничество"],
    order: 20,
  },
  "nach-analit": {
    id: "nach-analit",
    title: "Начальник аналитического направления",
    department: "Аналитический блок",
    status: "open",
    slots: 1,
    summary: "Постановка задач аналитикам, контроль качества материалов.",
    requirements: ["Опыт аналитики", "Подготовка докладов", "Координация группы"],
    duties: ["Руководство группой", "Проверка материалов", "Методическая работа"],
    order: 30,
  },
  "zam-nach-upr": {
    id: "zam-nach-upr",
    title: "Заместитель начальника управления",
    department: "Управленческий аппарат",
    status: "open",
    slots: 1,
    summary: "Координация блоков, контроль поручений, участие в организационных решениях.",
    requirements: ["Существенный руководящий опыт", "Опыт замещения первого лица"],
    duties: ["Координация блоков", "Контроль поручений", "Совещания"],
    order: 40,
  },
};

const STATUS = {
  new: { label: "Подана", cls: "b-new" },
  review: { label: "Рассмотрение", cls: "b-calling" },
  interview: { label: "Собеседование", cls: "b-interview" },
  accepted: { label: "Принята", cls: "b-pass" },
  rejected: { label: "Отказ", cls: "b-fail" },
  withdrawn: { label: "Отозвана", cls: "b-noanswer" },
};

const state = {
  user: null,
  users: [],
  positions: {},
  applications: {},
  view: "home",
  selectedPosId: null,
  selectedAppId: null,
  revFilter: "active",
  connected: false,
  editingPosId: null,
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
function toast(msg, type = "") {
  const h = $("#toast-host");
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  h.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .2s";
    setTimeout(() => el.remove(), 200);
  }, 2800);
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
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}
function myApps() {
  const name = state.user?.fullName;
  return allApps().filter((a) => a.owner === name);
}
function appsForPos(id) {
  return allApps().filter((a) => a.positionId === id);
}

async function ensureSeed() {
  const [p, u] = await Promise.all([R.positions.once("value"), R.users.once("value")]);
  if (!p.exists()) {
    const o = {};
    Object.values(SEED_POS).forEach((x) => {
      o[x.id] = { ...x, updatedAt: nowIso() };
    });
    await R.positions.set(o);
  }
  if (!u.exists()) {
    await R.users.set([
      { fullName: "Администратор", password: "admin", role: "admin" },
      { fullName: "Кадровик", password: "kadry", role: "reviewer" },
    ]);
  }
}

function bind() {
  R.users.on(
    "value",
    (s) => {
      const v = s.val();
      state.users = v ? (Array.isArray(v) ? v : Object.values(v)) : [];
      state.connected = true;
      live();
      if (state.user) render();
    },
    onErr
  );
  R.positions.on(
    "value",
    (s) => {
      state.positions = s.val() || {};
      state.connected = true;
      live();
      if (state.user) render();
    },
    onErr
  );
  R.applications.on(
    "value",
    (s) => {
      state.applications = s.val() || {};
      state.connected = true;
      live();
      if (state.user) render();
    },
    onErr
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

async function submitApp(data) {
  const id = uid("app");
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
    reviewer: null,
  };
  await R.applications.child(id).set(rec);
  return rec;
}

async function setAppStatus(id, status, note) {
  const patch = {
    status,
    updatedAt: nowIso(),
    reviewer: state.user.fullName,
  };
  if (note != null) patch.note = note;
  await R.applications.child(id).update(patch);
}

async function withdrawApp(id) {
  const a = state.applications[id];
  if (!a || a.owner !== state.user.fullName) throw new Error("Нет доступа");
  if (!["new", "review"].includes(a.status)) throw new Error("Нельзя отозвать");
  await R.applications.child(id).update({
    status: "withdrawn",
    updatedAt: nowIso(),
  });
}

async function savePos(data, existingId) {
  const title = data.title.trim();
  if (!title) throw new Error("Укажите название");
  let id = existingId || title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").slice(0, 40) || uid("pos");
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
  return rec;
}

async function setPosStatus(id, status) {
  await R.positions.child(id).update({ status, updatedAt: nowIso(), updatedBy: state.user.fullName });
}
async function deletePos(id) {
  if (appsForPos(id).length) {
    await setPosStatus(id, "closed");
    return { soft: true };
  }
  await R.positions.child(id).remove();
  return { soft: false };
}

/* ===== Views ===== */
function show(view) {
  state.view = view;
  ["home", "my", "review", "admin"].forEach((v) => {
    const el = $("#view-" + v);
    if (el) el.classList.toggle("page-hidden", v !== view);
  });
  render();
  window.scrollTo(0, 0);
}

function render() {
  if (!state.user) return;
  $("#stOpen").textContent = openPositions().length;
  $("#stMine").textContent = myApps().length;
  $("#sideUser").innerHTML = `<div style="color:#fff;font-weight:700;margin-bottom:4px;">${esc(
    state.user.fullName
  )}</div><span class="role-badge ${esc(state.user.role)}">${esc(roleLabel(state.user.role))}</span>`;

  if (state.view === "home") renderHome();
  if (state.view === "my") renderMy();
  if (state.view === "review") renderReview();
  if (state.view === "admin") renderAdmin();
  renderSideRecent();
}

function renderSideRecent() {
  const list = (isReviewer() ? allApps() : myApps()).slice(0, 5);
  $("#sideRecent").innerHTML = list.length
    ? list
        .map(
          (a) => `<div class="side-user">
      <div class="av">${esc((a.name || "?").slice(0, 1).toUpperCase())}</div>
      <div style="min-width:0">
        <div style="color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(
          a.positionTitle || posTitle(a.positionId)
        )}</div>
        <div class="text-sm muted">${badge(a.status)} · ${esc(fmt(a.updatedAt || a.createdAt))}</div>
      </div>
    </div>`
        )
        .join("")
    : `<div class="text-sm muted">Нет заявок</div>`;
}

function renderHome() {
  const list = openPositions();
  const closed = Object.values(state.positions).filter((p) => p.status !== "open");
  if (!state.selectedPosId && list[0]) state.selectedPosId = list[0].id;

  $("#vacancyList").innerHTML = list.length
    ? list
        .map((p) => {
          const n = appsForPos(p.id).length;
          return `<article class="vacancy-item ${
            state.selectedPosId === p.id ? "active" : ""
          }" data-pos="${esc(p.id)}">
          <h3>${esc(p.title)}</h3>
          <div class="meta">${esc(p.department || "")} · мест: ${esc(p.slots || 1)} · заявок: ${n}</div>
          <div class="summary">${esc(p.summary || "")}</div>
        </article>`;
        })
        .join("")
    : `<div class="empty-state"><h4>Нет открытых должностей</h4></div>`;

  if (closed.length) {
    $("#vacancyList").innerHTML += closed
      .map(
        (p) => `<article class="vacancy-item" style="opacity:.55;cursor:default;">
        <h3>${esc(p.title)}</h3>
        <div class="meta">${esc(p.department || "")} · закрыта</div>
      </article>`
      )
      .join("");
  }

  $$("#vacancyList [data-pos]").forEach((el) =>
    el.addEventListener("click", () => {
      state.selectedPosId = el.getAttribute("data-pos");
      $("#applyCard").style.display = "none";
      renderHome();
    })
  );

  const p = state.positions[state.selectedPosId];
  const box = $("#posDetail");
  if (!p || p.status !== "open") {
    box.innerHTML = `<div class="empty-state"><p>Выберите должность</p></div>`;
    return;
  }
  box.innerHTML = `
    <div style="font-size:1.15rem;font-weight:800;color:#fff;margin-bottom:4px;">${esc(p.title)}</div>
    <div class="text-sm muted mb-12">${esc(p.department || "")} · мест: ${esc(p.slots || 1)}</div>
    <div class="detail-block"><label>Описание</label>${esc(p.summary || "—")}</div>
    <div class="detail-block"><label>Требования</label>${
      (p.requirements || []).map((x) => "• " + esc(x)).join("\n") || "—"
    }</div>
    <div class="detail-block"><label>Обязанности</label>${
      (p.duties || []).map((x) => "• " + esc(x)).join("\n") || "—"
    }</div>
    <button type="button" class="btn btn--gold" id="btnStartApply"><i class="fas fa-file-signature"></i> Подать заявку</button>
  `;
  $("#btnStartApply")?.addEventListener("click", () => {
    $("#applyPosId").value = p.id;
    $("#applyPosTitle").textContent = p.title;
    $("#applyCard").style.display = "";
    $("#applyCard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function statusSteps(st) {
  const order = ["new", "review", "interview", "accepted"];
  const fail = st === "rejected" || st === "withdrawn";
  return `<div class="status-steps">
    ${order
      .map((s) => {
        const on =
          !fail &&
          order.indexOf(s) <= Math.max(0, order.indexOf(st === "rejected" ? -1 : st));
        const active = s === st;
        return `<span class="status-step ${on || active ? "on" : ""}">${esc(STATUS[s].label)}</span>`;
      })
      .join("")}
    ${fail ? `<span class="status-step on">${esc(STATUS[st]?.label || st)}</span>` : ""}
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
      ${
        ["new", "review"].includes(a.status)
          ? `<button type="button" class="btn btn--secondary mt-12" data-withdraw="${esc(
              a.id
            )}">Отозвать</button>`
          : ""
      }
    </div>`
        )
        .join("")
    : `<div class="empty-state"><h4>Заявок нет</h4></div>`;

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

  const selected =
    (state.selectedAppId && state.applications[state.selectedAppId]) || list[0] || null;
  if (selected) state.selectedAppId = selected.id;

  $("#revList").innerHTML = list.length
    ? list
        .map(
          (a) => `<div class="review-item ${selected && a.id === a.id && selected.id === a.id ? "active" : ""} ${
            selected?.id === a.id ? "active" : ""
          }" data-app="${esc(a.id)}">
        <div class="fw-700" style="color:#fff;">${esc(a.name)}</div>
        <div class="text-sm muted">${esc(a.positionTitle || posTitle(a.positionId))}</div>
        <div class="mt-8">${badge(a.status)}</div>
      </div>`
        )
        .join("")
    : `<div class="empty-state"><h4>Пусто</h4></div>`;

  $$("#revList [data-app]").forEach((el) =>
    el.addEventListener("click", () => {
      state.selectedAppId = el.getAttribute("data-app");
      renderReview();
    })
  );

  const box = $("#revCard");
  if (!selected) {
    box.innerHTML = `<div class="empty-state"><h4>Выберите заявку</h4></div>`;
    return;
  }
  box.innerHTML = `
    <div class="inline-actions" style="justify-content:space-between;margin-bottom:12px;">
      <div>
        <div style="font-size:1.25rem;font-weight:800;color:#fff;">${esc(selected.name)}</div>
        <div class="text-sm muted mt-8">${esc(selected.positionTitle || posTitle(selected.positionId))}</div>
        <div class="mt-8">${badge(selected.status)}</div>
      </div>
      <button type="button" class="btn btn--gold" id="btnCopyDc"><i class="fas fa-copy"></i> ${esc(
        selected.discord
      )}</button>
    </div>
    <div class="detail-block"><label>Static ID</label>${esc(selected.staticId || "—")}</div>
    <div class="detail-block"><label>Discord</label>${esc(selected.discord || "—")}</div>
    <div class="detail-block"><label>Возраст / онлайн</label>${esc(selected.age || "—")} · ${esc(
      selected.online || "—"
    )}</div>
    <div class="detail-block"><label>Текущая должность</label>${esc(selected.currentRole || "—")}</div>
    <div class="detail-block"><label>Опыт</label>${esc(selected.experience || "—")}</div>
    <div class="detail-block"><label>Мотивация</label>${esc(selected.motivation || "—")}</div>
    ${
      selected.extra
        ? `<div class="detail-block"><label>Дополнительно</label>${esc(selected.extra)}</div>`
        : ""
    }
    <div class="form-group mt-12">
      <label>Комментарий</label>
      <textarea id="revNote" rows="3">${esc(selected.note || "")}</textarea>
    </div>
    <div class="inline-actions mt-12">
      <button type="button" class="btn btn--primary" data-st="review">В рассмотрение</button>
      <button type="button" class="btn btn--gold" data-st="interview">Собеседование</button>
      <button type="button" class="btn btn--gold" data-st="accepted" style="background:linear-gradient(135deg,#2f9e5f,#48bb78);">Принять</button>
      <button type="button" class="btn btn--danger" data-st="rejected">Отказ</button>
    </div>
    <div class="text-sm muted mt-12">Подана: ${esc(fmt(selected.createdAt))} · автор: ${esc(
      selected.owner || "—"
    )}</div>
  `;

  $("#btnCopyDc")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(selected.discord);
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
          <td><div class="fw-700">${esc(p.title)}</div><div class="text-sm muted">${esc(
            p.department || ""
          )}</div></td>
          <td><span class="badge ${p.status === "open" ? "b-open" : "b-closed"}">${
            p.status === "open" ? "Открыта" : "Закрыта"
          }</span></td>
          <td>${n}</td>
          <td>
            <div class="table-actions">
              ${
                p.status === "open"
                  ? `<button type="button" class="btn btn--secondary" style="padding:6px 10px;font-size:0.78rem" data-close="${esc(
                      p.id
                    )}">Закрыть</button>`
                  : `<button type="button" class="btn btn--gold" style="padding:6px 10px;font-size:0.78rem" data-open="${esc(
                      p.id
                    )}">Открыть</button>`
              }
              <button type="button" class="btn btn--primary" style="padding:6px 10px;font-size:0.78rem" data-edit="${esc(
                p.id
              )}">Изменить</button>
              <button type="button" class="btn btn--danger" style="padding:6px 10px;font-size:0.78rem" data-del="${esc(
                p.id
              )}">✕</button>
            </div>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="4"><div class="empty-state"><h4>Пусто</h4></div></td></tr>`;

  $$("[data-open]").forEach((b) =>
    b.addEventListener("click", () => setPosStatus(b.getAttribute("data-open"), "open").then(() => toast("Открыта", "ok")))
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
      toast(r.soft ? "Закрыта (есть заявки)" : "Удалена", r.soft ? "warn" : "ok");
      resetPos();
    })
  );
}

function fillPos(id) {
  const p = state.positions[id];
  if (!p) return;
  state.editingPosId = id;
  $("#posFormTitle").textContent = "Редактирование";
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
  $("#posFormTitle").textContent = "Новая должность";
  $("#posForm").reset();
  $("#posId").value = "";
  $("#posCancel").style.display = "none";
}

/* ===== Auth / UI ===== */
function enter(user) {
  state.user = user;
  sessionStorage.setItem("asuls_apps_user", JSON.stringify(user));
  $("#loginScreen").style.display = "none";
  $("#appContent").style.display = "block";
  $("#userDisplay").textContent = `${user.fullName} · ${roleLabel(user.role)}`;
  $("#btnReview").style.display = isReviewer() ? "" : "none";
  $("#btnAdmin").style.display = isAdmin() ? "" : "none";
  show("home");
}
function logout() {
  state.user = null;
  sessionStorage.removeItem("asuls_apps_user");
  $("#appContent").style.display = "none";
  $("#loginScreen").style.display = "flex";
}

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
  const chars = "01АСУЛСЗАЯВКИ█▓";
  (function draw() {
    if ($("#loginScreen")?.style.display !== "none") {
      ctx.fillStyle = "rgba(5,7,12,0.12)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(207,161,52,0.3)";
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

function bindUi() {
  $("#loginForm").onsubmit = (e) => {
    e.preventDefault();
    if ($("#loginMaster").value !== getMaster()) {
      $("#loginError").style.display = "block";
      $("#loginError").textContent = "Неверный мастер-пароль";
      return;
    }
    const name = $("#loginName").value.trim();
    const pass = $("#loginPass").value;
    const user = state.users.find(
      (u) => u.fullName.toLowerCase() === name.toLowerCase() && u.password === pass
    );
    if (!user) {
      $("#loginError").style.display = "block";
      $("#loginError").textContent = "Неверные данные";
      return;
    }
    $("#loginError").style.display = "none";
    enter(user);
  };

  $("#openReg").onclick = () => ($("#regModal").style.display = "flex");
  $("#regClose").onclick = () => ($("#regModal").style.display = "none");
  $("#regForm").onsubmit = async (e) => {
    e.preventDefault();
    if ($("#regMaster").value !== getMaster()) {
      $("#regError").style.display = "block";
      $("#regError").textContent = "Неверный мастер-пароль";
      return;
    }
    const fullName = $("#regName").value.trim();
    const password = $("#regPass").value;
    if (state.users.some((u) => u.fullName.toLowerCase() === fullName.toLowerCase())) {
      $("#regError").style.display = "block";
      $("#regError").textContent = "Уже существует";
      return;
    }
    state.users.push({ fullName, password, role: "user" });
    await R.users.set(state.users);
    $("#regModal").style.display = "none";
    toast("Аккаунт создан", "ok");
    $("#loginName").value = fullName;
  };

  $("#btnLogout").onclick = logout;
  $("#goHome").onclick = () => show("home");
  $$("[data-back-home]").forEach((b) => (b.onclick = () => show("home")));
  $("#btnMy").onclick = () => show("my");
  $("#btnReview").onclick = () => show("review");
  $("#btnAdmin").onclick = () => show("admin");

  $("#applyCancel").onclick = () => {
    $("#applyCard").style.display = "none";
    $("#applyForm").reset();
  };
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
      e.target.reset();
      $("#applyCard").style.display = "none";
      show("my");
    } catch (err) {
      toast(err.message || "Ошибка", "err");
    } finally {
      btn.disabled = false;
    }
  };

  $("#revFilter").onchange = (e) => {
    state.revFilter = e.target.value;
    renderReview();
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
}

async function start() {
  initMatrix();
  bindUi();
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
      }, 600);
    }
  } catch (_) {}
}

start();
