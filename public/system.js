// Клієнтська логіка панелі "Система" VARTA

const $ = (id) => document.getElementById(id);

const ROLE_LABELS = {
  guest: "Гість",
  admin: "Адмін",
  methodist: "Методист",
  zavuch: "Завуч",
  teacher: "Вчитель",
  student: "Учень",
  jury: "Журі",
  system: "Система",
};
const STATUS_LABELS = {
  draft: "Чернетка",
  submitted: "Подано",
  approved: "Схвалено",
  rejected: "Відхилено",
  pending: "Очікує",
};
const ARCHIVE_LABELS = { diploma: "Диплом", protocol: "Протокол", competition: "Конкурс" };
const PAGE_TITLES = {
  dashboard: "Dashboard",
  results: "Результати",
  rating: "Рейтинг",
  archive: "Архів",
  statistics: "Статистика",
  notifications: "Сповіщення",
};

// ---- HTTP-хелпери -----------------------------------------------------------
async function getJSON(url) {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/";
    throw new Error("unauthorized");
  }
  return res.json();
}
async function send(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function toast(type, text) {
  const t = $("toast");
  t.className = `toast show ${type}`;
  t.textContent = text;
  setTimeout(() => (t.className = "toast"), 2800);
}
function fmtDate(s) {
  return new Date(s).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---- Навігація --------------------------------------------------------------
const loaders = {
  dashboard: loadDashboard,
  results: loadResults,
  rating: loadRatingPage,
  archive: loadArchive,
  statistics: loadStatistics,
  notifications: loadNotifications,
};

function switchPage(page) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  document.querySelectorAll(".page").forEach((s) => s.classList.toggle("hidden", s.dataset.page !== page));
  $("pageTitle").textContent = PAGE_TITLES[page];
  loaders[page]?.();
}
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.onclick = () => switchPage(btn.dataset.page);
});
$("logoutBtn").onclick = async () => {
  await send("POST", "/api/logout", {});
  window.location.href = "/";
};

// Заповнює <select> конкурсами
function fillCompetitionSelect(el, competitions, { withEmpty = false } = {}) {
  const opts = competitions
    .map((c) => `<option value="${c.id}">${esc(c.title)}</option>`)
    .join("");
  el.innerHTML = (withEmpty ? `<option value="">Усі конкурси</option>` : "") + opts;
}

let competitionsCache = [];
async function ensureCompetitions() {
  if (competitionsCache.length === 0) {
    const { competitions } = await getJSON("/api/system/competitions");
    competitionsCache = competitions;
  }
  return competitionsCache;
}

// ---- Dashboard --------------------------------------------------------------
async function loadDashboard() {
  const { stats } = await getJSON("/api/system/stats");
  const cards = [
    ["Конкурсів", stats.competitions],
    ["Оцінок", stats.results],
    ["Дипломів", stats.diplomas],
    ["Протоколів", stats.protocols],
    ["В архіві", stats.archive],
    ["Сповіщень", stats.notifications],
  ];
  $("statCards").innerHTML = cards
    .map(([lbl, num]) => `<div class="card"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`)
    .join("");
}

// ---- Результати -------------------------------------------------------------
async function loadResults() {
  const competitions = await ensureCompetitions();
  fillCompetitionSelect($("resultsComp"), competitions, { withEmpty: true });
  await renderResults();
}
async function renderResults() {
  const compId = $("resultsComp").value;
  const url = compId ? `/api/system/results?competition_id=${compId}` : "/api/system/results";
  const { results } = await getJSON(url);
  $("resultsBody").innerHTML = results.length
    ? results
        .map(
          (r) => `<tr>
            <td>${esc(r.competition_title)}</td>
            <td>${esc(r.title)}</td>
            <td>${esc(r.student_name || "—")}</td>
            <td>${r.avg_score ?? "—"}</td>
            <td>${r.judges_count}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">Оцінених робіт немає</td></tr>`;
}
$("resultsComp").addEventListener("change", renderResults);

// ---- Рейтинг ----------------------------------------------------------------
async function loadRatingPage() {
  const competitions = await ensureCompetitions();
  fillCompetitionSelect($("ratingComp"), competitions);
  await renderRating();
}
async function renderRating() {
  const compId = $("ratingComp").value;
  if (!compId) {
    $("ratingBody").innerHTML = `<tr><td colspan="5" class="empty">Оберіть конкурс</td></tr>`;
    return;
  }
  const { rating } = await getJSON(`/api/system/rating?competition_id=${compId}`);
  $("ratingBody").innerHTML = rating.length
    ? rating
        .map(
          (r) => `<tr>
            <td><strong>${r.place}</strong></td>
            <td>${esc(r.student_name || "—")}</td>
            <td>${esc(r.title)}</td>
            <td>${r.avg_score ?? "—"}</td>
            <td>${r.judges_count}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">Немає оцінених робіт у цьому конкурсі</td></tr>`;
}
$("ratingComp").addEventListener("change", renderRating);

$("genDiplomasBtn").addEventListener("click", async () => {
  const compId = $("ratingComp").value;
  if (!compId) return toast("err", "Оберіть конкурс");
  const places = parseInt($("diplomaPlaces").value, 10) || 3;
  const { ok, data } = await send("POST", `/api/system/competitions/${compId}/diplomas`, { places });
  toast(ok ? "ok" : "err", ok ? data.message : data.error || "Помилка");
});

$("genProtocolBtn").addEventListener("click", async () => {
  const compId = $("ratingComp").value;
  if (!compId) return toast("err", "Оберіть конкурс");
  const { ok, data } = await send("POST", `/api/system/competitions/${compId}/protocol`, {});
  toast(ok ? "ok" : "err", ok ? data.message : data.error || "Помилка");
});

// ---- Архів ------------------------------------------------------------------
async function loadArchive() {
  await renderArchive();
}
async function renderArchive() {
  const type = $("archiveType").value;
  const url = type ? `/api/system/archive?type=${type}` : "/api/system/archive";
  const { items } = await getJSON(url);
  $("archiveBody").innerHTML = items.length
    ? items
        .map(
          (it) => `<tr>
            <td><span class="status">${ARCHIVE_LABELS[it.type] || esc(it.type)}</span></td>
            <td>${esc(it.title || "—")}</td>
            <td>${fmtDate(it.created_at)}</td>
            <td class="actions">${
              it.file_url
                ? `<a class="btn sm" href="${esc(it.file_url)}" target="_blank" rel="noopener">Відкрити</a>`
                : "—"
            }</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Архів порожній</td></tr>`;
}
$("archiveType").addEventListener("change", renderArchive);

// ---- Статистика -------------------------------------------------------------
function renderBars(el, rows, labelFn) {
  const max = Math.max(1, ...rows.map((r) => r.c));
  el.innerHTML = rows.length
    ? rows
        .map(
          (r) => `<div class="role-bar">
            <span>${labelFn(r)}</span>
            <span class="track"><span class="fill" style="width:${(r.c / max) * 100}%"></span></span>
            <span>${r.c}</span></div>`
        )
        .join("")
    : `<p class="empty">Даних немає</p>`;
}
async function loadStatistics() {
  const { live, byRole, byStatus, snapshots } = await getJSON("/api/system/statistics");
  const cards = [
    ["Користувачів", live.users],
    ["Конкурсів", live.competitions],
    ["Заявок", live.applications],
    ["Оцінок", live.results],
    ["Дипломів", live.diplomas],
    ["Середній бал", live.avg_score],
  ];
  $("liveStatCards").innerHTML = cards
    .map(([lbl, num]) => `<div class="card"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`)
    .join("");

  renderBars($("statRoleBreakdown"), byRole, (r) => ROLE_LABELS[r.role] || r.role);
  renderBars($("statStatusBreakdown"), byStatus, (r) => STATUS_LABELS[r.status] || r.status);

  $("snapshotsBody").innerHTML = snapshots.length
    ? snapshots
        .map((s) => {
          const d = s.data_json || {};
          return `<tr>
            <td>${fmtDate(s.created_at)}</td>
            <td>${d.users ?? "—"}</td>
            <td>${d.competitions ?? "—"}</td>
            <td>${d.applications ?? "—"}</td>
            <td>${d.results ?? "—"}</td>
            <td>${d.diplomas ?? "—"}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">Зрізів ще немає</td></tr>`;
}
$("snapshotBtn").addEventListener("click", async () => {
  const { ok, data } = await send("POST", "/api/system/statistics/snapshot", {});
  toast(ok ? "ok" : "err", ok ? data.message : data.error || "Помилка");
  if (ok) loadStatistics();
});

// ---- Сповіщення -------------------------------------------------------------
async function loadNotifications() {
  const { notifications } = await getJSON("/api/system/notifications");
  $("notificationsBody").innerHTML = notifications.length
    ? notifications
        .map(
          (n) => `<tr>
            <td>${esc(n.user_name || n.user_email || "—")}</td>
            <td>${esc(n.message)}</td>
            <td><span class="status ${n.is_read ? "approved" : "pending"}">${n.is_read ? "Прочитано" : "Нове"}</span></td>
            <td>${fmtDate(n.created_at)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Сповіщень ще немає</td></tr>`;
}
$("notifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { ok, data } = await send("POST", "/api/system/notifications", {
    message: $("notifyMessage").value.trim(),
    target: $("notifyTarget").value,
  });
  if (!ok) return toast("err", data.error || "Помилка");
  $("notifyMessage").value = "";
  toast("ok", data.message || "Надіслано");
  loadNotifications();
});

// ---- Старт ------------------------------------------------------------------
(async function init() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return (window.location.href = "/");
    const { user } = await res.json();
    if (user.role !== "system" && user.role !== "admin") return (window.location.href = "/");
    $("systemEmail").textContent = user.email;
    switchPage("dashboard");
  } catch {
    window.location.href = "/";
  }
})();
