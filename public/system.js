// Клієнтська логіка панелі системи VARTA (модуль "7. СИСТЕМА")

const $ = (id) => document.getElementById(id);

const PAGE_TITLES = {
  dashboard: "Dashboard",
  results: "Результати",
  rating: "Рейтинг",
  diplomas: "Дипломи",
  protocols: "Протоколи",
  archive: "Архів",
  statistics: "Статистика",
  notifications: "Сповіщення",
};

const STATUS_LABELS = {
  draft: "Чернетка",
  published: "Опубліковано",
  archived: "В архіві",
};

const ARCHIVE_TYPE_LABELS = {
  competition: "Конкурс",
  protocol: "Протокол",
  diploma: "Диплом",
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
  if (!s) return "—";
  return new Date(s).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function placeBadge(place) {
  const cls = place === 1 ? "gold" : place === 2 ? "silver" : place === 3 ? "bronze" : "";
  return `<span class="place ${cls}">${place ?? "—"}</span>`;
}

// ---- Навігація --------------------------------------------------------------
const loaders = {
  dashboard: loadDashboard,
  results: loadResults,
  rating: loadRating,
  diplomas: loadDiplomas,
  protocols: loadProtocols,
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

// ---- Dashboard --------------------------------------------------------------
async function loadDashboard() {
  const { stats } = await getJSON("/api/system/stats");
  const cards = [
    ["Конкурсів", stats.competitions],
    ["Результатів", stats.results],
    ["Дипломів", stats.diplomas],
    ["Протоколів", stats.protocols],
    ["В архіві", stats.archive],
    ["Непрочитаних", stats.unread],
  ];
  $("statCards").innerHTML = cards
    .map(([lbl, num]) => `<div class="card"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`)
    .join("");
  loadProcessList();
}

async function loadProcessList() {
  const { competitions } = await getJSON("/api/system/competitions");
  $("processBody").innerHTML = competitions.length
    ? competitions
        .map(
          (c) => `<tr>
            <td>${esc(c.title)}</td>
            <td><span class="status ${c.status}">${STATUS_LABELS[c.status] || c.status}</span></td>
            <td>${c.applications}</td>
            <td>${c.results}</td>
            <td>${c.diplomas}</td>
            <td>
              <button class="btn sm ${c.results ? "ok" : "ghost"}" data-process="${c.id}" ${c.results ? "" : "disabled"}>
                ${c.diplomas ? "Переобробити" : "Обробити"}
              </button>
            </td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">Немає конкурсів</td></tr>`;

  document.querySelectorAll("[data-process]").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      const { ok, data } = await send("POST", `/api/system/competitions/${btn.dataset.process}/process`);
      if (!ok) {
        toast("err", data.error || "Помилка обробки");
        btn.disabled = false;
        return;
      }
      toast("ok", `${data.message} (учасників: ${data.participants}, дипломів: ${data.diplomas})`);
      loadDashboard();
    };
  });
}

// ---- Результати -------------------------------------------------------------
async function loadResults() {
  const { results } = await getJSON("/api/system/results");
  $("resultsBody").innerHTML = results.length
    ? results
        .map(
          (r) => `<tr>
            <td>${esc(r.competition_title)}</td>
            <td>${esc(r.application_title || "—")}</td>
            <td>${esc(r.student_name || "—")}</td>
            <td>${esc(r.judge_name || "—")}</td>
            <td><span class="score">${r.score ?? "—"}</span></td>
            <td>${esc(r.comment || "—")}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">Немає результатів</td></tr>`;
}

// ---- Рейтинг ----------------------------------------------------------------
async function loadRating() {
  const { rating } = await getJSON("/api/system/rating");
  $("ratingBody").innerHTML = rating.length
    ? rating
        .map(
          (r) => `<tr>
            <td>${placeBadge(Number(r.place))}</td>
            <td>${esc(r.competition_title)}</td>
            <td>${esc(r.student_name || "—")}</td>
            <td>${esc(r.application_title || "—")}</td>
            <td>${r.judges}</td>
            <td><span class="score">${r.avg_score ?? "—"}</span></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">Рейтинг ще не сформовано</td></tr>`;
}

// ---- Дипломи ----------------------------------------------------------------
async function loadDiplomas() {
  const { diplomas } = await getJSON("/api/system/diplomas");
  $("diplomasBody").innerHTML = diplomas.length
    ? diplomas
        .map(
          (d) => `<tr>
            <td>${placeBadge(Number(d.place))}</td>
            <td>${esc(d.student_name || "—")}</td>
            <td>${esc(d.competition_title)}</td>
            <td><span class="score">${d.score ?? "—"}</span></td>
            <td>${fmtDate(d.issued_at)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">Дипломів ще немає</td></tr>`;
}

// ---- Протоколи --------------------------------------------------------------
async function loadProtocols() {
  const { protocols } = await getJSON("/api/system/protocols");
  $("protocolsList").innerHTML = protocols.length
    ? protocols
        .map(
          (p) => `<div class="doc-card">
            <div class="doc-title">
              <span>${esc(p.competition_title)}</span>
              <span class="meta">${fmtDate(p.created_at)}</span>
            </div>
            <pre>${esc(p.content || "—")}</pre>
          </div>`
        )
        .join("")
    : `<p class="empty-list">Протоколів ще немає</p>`;
}

// ---- Архів ------------------------------------------------------------------
async function loadArchive() {
  const { items } = await getJSON("/api/system/archive");
  $("archiveBody").innerHTML = items.length
    ? items
        .map(
          (i) => `<tr>
            <td><span class="type-tag">${ARCHIVE_TYPE_LABELS[i.type] || i.type}</span></td>
            <td>${esc(i.title || "—")}</td>
            <td>${fmtDate(i.created_at)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty">Архів порожній</td></tr>`;
}

// ---- Статистика -------------------------------------------------------------
async function loadStatistics() {
  const { statistics } = await getJSON("/api/system/statistics");
  $("statisticsBody").innerHTML = statistics.length
    ? statistics
        .map((s) => {
          const d = s.data_json || {};
          return `<tr>
            <td>${esc(d.competition_title || "—")}</td>
            <td>${d.participants ?? "—"}</td>
            <td>${d.diplomas ?? "—"}</td>
            <td><span class="score">${d.average_score ?? "—"}</span></td>
            <td>${d.top_score ?? "—"}</td>
            <td>${fmtDate(s.created_at)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">Статистики ще немає</td></tr>`;
}

// ---- Сповіщення -------------------------------------------------------------
async function loadNotifications() {
  const { notifications } = await getJSON("/api/system/notifications");
  $("notificationsList").innerHTML = notifications.length
    ? notifications
        .map(
          (n) => `<li class="${n.is_read ? "" : "unread"}">
            <div class="note-main">
              ${n.is_read ? "" : '<span class="dot"></span>'}
              <div class="note-text">
                ${esc(n.message)}
                <span class="meta">${esc(n.user_email || "—")} · ${fmtDate(n.created_at)}</span>
              </div>
            </div>
            ${n.is_read ? "" : `<button class="btn sm ghost" data-read="${n.id}">Прочитано</button>`}
          </li>`
        )
        .join("")
    : `<li class="empty-list">Сповіщень немає</li>`;

  document.querySelectorAll("[data-read]").forEach((btn) => {
    btn.onclick = async () => {
      await send("PATCH", `/api/system/notifications/${btn.dataset.read}/read`);
      loadNotifications();
    };
  });
}

$("readAllBtn").onclick = async () => {
  await send("POST", "/api/system/notifications/read-all");
  toast("ok", "Усі сповіщення прочитано");
  loadNotifications();
};

// ---- Ініціалізація ----------------------------------------------------------
(async function init() {
  try {
    const { user } = await getJSON("/api/me");
    if (user.role !== "system" && user.role !== "admin") {
      window.location.href = "/";
      return;
    }
    $("userEmail").textContent = user.email;
    switchPage("dashboard");
  } catch {
    /* getJSON вже перенаправив на / */
  }
})();
