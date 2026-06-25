/* Dragon Bytes CTF Arena — Frontend application logic */

const API_BASE = "/api";

const state = {
  token: localStorage.getItem("db_token") || null,
  username: localStorage.getItem("db_username") || null,
  page: "home",
  currentChallenge: null,
  feedback: null,
  difficultyFilter: "All",
  categoryFilter: SITE_DATA.categoryOptions[0][0],
  authMode: "login", // "login" | "register"
};

/* ─── API helper ──────────────────────────────────────────── */
async function api(path, { method = "GET", body = null, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.token) headers["Authorization"] = `Bearer ${state.token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    const message = (data && data.detail) || "Something went wrong.";
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ─── Toasts ──────────────────────────────────────────────── */
function showToast(message, type = "default") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : ""}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ─── Routing ─────────────────────────────────────────────── */
function setPage(page) {
  state.page = page;
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(`page-${page}`).classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("nav-active", btn.dataset.page === page);
  });

  document.getElementById("sidebar").classList.remove("sidebar-open");

  if (page === "leaderboard") loadLeaderboard();
  if (page === "arena") refreshArenaGate();
  if (page === "home") window.scrollTo(0, 0);
}

document.querySelectorAll("[data-page]").forEach(el => {
  el.addEventListener("click", () => setPage(el.dataset.page));
});

document.getElementById("mobile-nav-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("sidebar-open");
});

/* ─── Auth: modal control ─────────────────────────────────── */
const authModal = document.getElementById("auth-modal");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSubmit = document.getElementById("auth-submit");

function openAuthModal(mode = "login") {
  setAuthMode(mode);
  authModal.classList.remove("hidden");
  document.getElementById("auth-username").focus();
}
function closeAuthModal() {
  authModal.classList.add("hidden");
  authError.classList.add("hidden");
  authForm.reset();
}
function setAuthMode(mode) {
  state.authMode = mode;
  document.getElementById("tab-login").classList.toggle("modal-tab-active", mode === "login");
  document.getElementById("tab-register").classList.toggle("modal-tab-active", mode === "register");
  authSubmit.textContent = mode === "login" ? "Sign In" : "Create Account";
  authError.classList.add("hidden");
}

document.getElementById("tab-login").addEventListener("click", () => setAuthMode("login"));
document.getElementById("tab-register").addEventListener("click", () => setAuthMode("register"));
document.getElementById("auth-modal-close").addEventListener("click", closeAuthModal);
authModal.addEventListener("click", (e) => { if (e.target === authModal) closeAuthModal(); });

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  authError.classList.add("hidden");
  authSubmit.disabled = true;

  try {
    const path = state.authMode === "login" ? "/auth/login" : "/auth/register";
    const data = await api(path, { method: "POST", body: { username, password } });
    state.token = data.token;
    state.username = data.username;
    localStorage.setItem("db_token", data.token);
    localStorage.setItem("db_username", data.username);
    closeAuthModal();
    renderAuthBox();
    showToast(`Welcome, ${data.username}! 🐉`, "success");
    refreshSidebarStats();
    if (state.page === "arena") refreshArenaGate();
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  } finally {
    authSubmit.disabled = false;
  }
});

async function logout() {
  try { await api("/auth/logout", { method: "POST", auth: true }); } catch (_) {}
  state.token = null;
  state.username = null;
  localStorage.removeItem("db_token");
  localStorage.removeItem("db_username");
  renderAuthBox();
  refreshSidebarStats();
  if (state.page === "arena") refreshArenaGate();
  showToast("Signed out.");
}

function renderAuthBox() {
  const box = document.getElementById("auth-box");
  if (state.token && state.username) {
    box.innerHTML = `
      <div class="auth-greeting">Signed in as <strong>${escapeHtml(state.username)}</strong></div>
      <button class="btn btn-block" id="logout-btn">Sign Out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", logout);
  } else {
    box.innerHTML = `<button class="btn btn-primary btn-block" id="open-auth-btn">🔑 Sign In / Register</button>`;
    document.getElementById("open-auth-btn").addEventListener("click", () => openAuthModal("login"));
  }
}

/* ─── Sidebar stats ───────────────────────────────────────── */
async function refreshSidebarStats() {
  if (!state.token) {
    document.getElementById("stat-score").textContent = "0";
    document.getElementById("stat-solved").textContent = "0/49";
    document.getElementById("stat-rank").textContent = "🔰 Rookie";
    document.getElementById("sidebar-progress-fill").style.width = "0%";
    document.getElementById("sidebar-progress-caption").textContent = "0.0% complete";
    return;
  }
  try {
    const p = await api("/progress", { auth: true });
    document.getElementById("stat-score").textContent = p.score.toLocaleString();
    document.getElementById("stat-solved").textContent = `${p.solved_count}/${p.total_challenges}`;
    document.getElementById("stat-rank").textContent = p.score >= 1000 ? "🐉 Elite" : "🔰 Rookie";
    const pct = p.total_challenges ? (p.solved_count / p.total_challenges) * 100 : 0;
    document.getElementById("sidebar-progress-fill").style.width = `${pct}%`;
    document.getElementById("sidebar-progress-caption").textContent = `${pct.toFixed(1)}% complete`;
    return p;
  } catch (err) {
    if (err.status === 401) logout();
  }
}

/* ─── Home page render ────────────────────────────────────── */
function renderHome() {
  document.getElementById("activities-grid").innerHTML = SITE_DATA.activities.map(([icon, title, desc]) => `
    <div class="activity-card"><div class="activity-icon">${icon}</div><h4>${title}</h4><p>${desc}</p></div>
  `).join("");

  document.getElementById("home-categories-grid").innerHTML = SITE_DATA.categories.map(([icon, name, desc]) => `
    <div class="category-card"><div class="category-icon">${icon}</div><div class="category-name">${name}</div><div class="category-desc">${desc}</div></div>
  `).join("");

  document.getElementById("team-grid").innerHTML = SITE_DATA.team.map(([icon, name, role, badge]) => `
    <div class="team-card"><div class="team-avatar">${icon}</div><div class="team-name">${name}</div><div class="team-role">${role}</div><div class="team-badge">${badge}</div></div>
  `).join("");

  document.getElementById("achievements-grid").innerHTML = SITE_DATA.achievements.map(([icon, title, detail]) => `
    <div class="achievement-card"><span class="achievement-icon">${icon}</span><div class="achievement-text"><div class="achievement-title">${title}</div><div class="achievement-detail">${detail}</div></div></div>
  `).join("");

  const statusColors = { Open: "#00ff88", Registering: "#ff9500", Soon: "#9b59b6", Coming: "#9b59b6" };
  document.getElementById("events-list").innerHTML = SITE_DATA.events.map(([date, title, desc, status]) => `
    <div class="event-card">
      <div class="event-date">${date}</div>
      <div class="event-info"><div class="event-title">${title}</div><div class="event-desc">${desc}</div></div>
      <div class="event-status" style="color:${statusColors[status] || '#888'}; border-color:${statusColors[status] || '#888'};">${status}</div>
    </div>
  `).join("");

  document.getElementById("projects-grid").innerHTML = SITE_DATA.projects.map(([icon, name, tech, desc]) => `
    <div class="project-card"><div class="project-icon">${icon}</div><div class="project-name">${name}</div><div class="project-tech">${tech}</div><div class="project-desc">${desc}</div></div>
  `).join("");

  document.getElementById("join-interests").innerHTML = SITE_DATA.joinInterests.map(i => `
    <div class="join-interest-chip" data-interest="${i}">${i}</div>
  `).join("");
  document.querySelectorAll(".join-interest-chip").forEach(chip => {
    chip.addEventListener("click", () => chip.classList.toggle("selected"));
  });
}

document.getElementById("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("join-name").value.trim();
  const email = document.getElementById("join-email").value.trim();
  if (name && email) {
    showToast(`✅ Welcome aboard, ${name}! We'll reach out to ${email} within 48 hours.`, "success");
    e.target.reset();
    document.querySelectorAll(".join-interest-chip.selected").forEach(c => c.classList.remove("selected"));
  } else {
    showToast("Please fill in your name and email.", "error");
  }
});

/* ─── Resources page render ───────────────────────────────── */
function renderResourceTab(tabKey) {
  const tab = SITE_DATA.resourceTabs[tabKey];
  document.getElementById("resource-tab-content").innerHTML = `
    <div class="resource-section">
      <h3>${tab.title}</h3>
      ${tab.cards.map(([title, desc]) => `
        <div class="resource-card"><strong>${title}</strong><p>${desc}</p></div>
      `).join("")}
    </div>
  `;
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
    renderResourceTab(btn.dataset.tab);
  });
});

/* ─── Arena page ──────────────────────────────────────────── */
const DIFFICULTY_COLORS = { Easy: "🟢", Medium: "🟡", Hard: "🔴", Insane: "🟣" };

function initArenaFilters() {
  const catSelect = document.getElementById("category-select");
  catSelect.innerHTML = SITE_DATA.categoryOptions.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  catSelect.addEventListener("change", () => { state.categoryFilter = catSelect.value; });

  document.getElementById("difficulty-select").addEventListener("change", (e) => {
    state.difficultyFilter = e.target.value;
  });

  document.getElementById("generate-btn").addEventListener("click", generateChallenge);
  document.getElementById("clear-btn").addEventListener("click", () => {
    state.currentChallenge = null;
    state.feedback = null;
    renderChallengeArea();
  });

  document.getElementById("arena-gate-signin").addEventListener("click", () => openAuthModal("login"));
}

function refreshArenaGate() {
  const gate = document.getElementById("arena-login-gate");
  const content = document.getElementById("arena-content");
  if (state.token) {
    gate.classList.add("hidden");
    content.classList.remove("hidden");
    loadCategoryProgress();
  } else {
    gate.classList.remove("hidden");
    content.classList.add("hidden");
  }
}

async function generateChallenge() {
  try {
    const params = new URLSearchParams();
    params.set("category", state.categoryFilter);
    if (state.difficultyFilter !== "All") params.set("difficulty", state.difficultyFilter);
    const ch = await api(`/challenges/random?${params.toString()}`, { auth: true });
    state.currentChallenge = ch;
    state.feedback = null;
    renderChallengeArea();
  } catch (err) {
    if (err.status === 404) {
      showToast("No challenges found for this filter. Try a different difficulty.", "error");
    } else if (err.status === 401) {
      logout();
    } else {
      showToast(err.message, "error");
    }
  }
}

function renderChallengeArea() {
  const area = document.getElementById("challenge-area");
  const ch = state.currentChallenge;

  if (!ch) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🐉</div>
        <h3>No challenge loaded</h3>
        <p>Select a category above and click <strong>Generate Challenge</strong> to begin.</p>
      </div>`;
    return;
  }

  const diffIcon = DIFFICULTY_COLORS[ch.difficulty] || "⬜";
  const hintsHtml = ch.revealed_hints.length
    ? `<div class="hint-list">${ch.revealed_hints.map((h, i) => `<div class="hint-item">💡 Hint ${i + 1}: ${escapeHtml(h)}</div>`).join("")}</div>`
    : "";

  area.innerHTML = `
    <div class="challenge-header ${ch.solved ? "challenge-solved" : ""}">
      <div class="ch-title">${escapeHtml(ch.title)}</div>
      <div class="ch-meta">
        <span class="ch-badge ch-category">${escapeHtml(ch.category)}</span>
        <span class="ch-badge ch-difficulty">${diffIcon} ${ch.difficulty}</span>
        <span class="ch-badge ch-points">⚡ ${ch.points} pts</span>
        ${ch.solved ? '<span class="ch-badge ch-solved">✅ Solved</span>' : ""}
      </div>
    </div>
    <div class="challenge-body">
      <div class="challenge-description">${renderDescription(ch.description)}</div>
    </div>
    ${ch.code_snippet ? `<div class="challenge-code">${escapeHtml(ch.code_snippet)}</div>` : ""}
    <div class="challenge-footer">
      <div class="flag-submit-row">
        <input type="text" id="flag-input" placeholder="DB{your_flag_here}" autocomplete="off">
        <button class="btn btn-primary" id="submit-flag-btn">🚀 Submit</button>
      </div>
      <div id="feedback-slot"></div>
      <hr class="divider" style="margin: 1.2rem 0;">
      <div class="hint-row">
        <strong>💡 Hints — ${ch.hints_revealed}/${ch.total_hints} used</strong>
        <button class="btn" id="hint-btn" ${ch.hints_revealed >= ch.total_hints ? "disabled" : ""}>Reveal Hint</button>
      </div>
      ${hintsHtml}
    </div>
  `;

  renderFeedback();

  document.getElementById("submit-flag-btn").addEventListener("click", submitFlag);
  document.getElementById("flag-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitFlag(); });
  document.getElementById("hint-btn").addEventListener("click", revealHint);
}

// Minimal markdown-ish rendering for challenge descriptions (bold + inline code)
function renderDescription(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderFeedback() {
  const slot = document.getElementById("feedback-slot");
  if (!slot) return;
  if (!state.feedback) { slot.innerHTML = ""; return; }
  const { type, message } = state.feedback;
  slot.innerHTML = `<div class="feedback-banner feedback-${type}">${escapeHtml(message)}</div>`;
}

async function submitFlag() {
  const input = document.getElementById("flag-input");
  const flag = input.value.trim();
  if (!flag) return;
  const ch = state.currentChallenge;

  try {
    const result = await api(`/challenges/${ch.id}/submit`, { method: "POST", auth: true, body: { flag } });
    if (result.correct && !result.already_solved) {
      state.feedback = { type: "success", message: `🎉 ${result.message}` };
      ch.solved = true;
      refreshSidebarStats();
      loadCategoryProgress();
    } else if (result.correct && result.already_solved) {
      state.feedback = { type: "warning", message: `⚠️ ${result.message}` };
    } else {
      state.feedback = { type: "error", message: `❌ ${result.message}` };
    }
    renderChallengeArea();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    showToast(err.message, "error");
  }
}

async function revealHint() {
  const ch = state.currentChallenge;
  try {
    const result = await api(`/challenges/${ch.id}/hint`, { method: "POST", auth: true });
    ch.hints_revealed = result.hint_level;
    ch.revealed_hints = [...ch.revealed_hints, result.hint];
    renderChallengeArea();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    showToast(err.message, "error");
  }
}

async function loadCategoryProgress() {
  if (!state.token) return;
  try {
    const p = await api("/progress", { auth: true });
    const list = document.getElementById("category-progress-list");
    list.innerHTML = SITE_DATA.categoryOptions.map(([key, label]) => {
      const cp = p.category_progress[key] || { solved: 0, total: 0 };
      const pct = cp.total ? (cp.solved / cp.total) * 100 : 0;
      return `
        <div class="category-progress-block">
          <div class="category-progress">
            <span class="cat-prog-name">${label}</span>
            <span class="cat-prog-stat">${cp.solved}/${cp.total}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join("");
  } catch (err) {
    if (err.status === 401) logout();
  }
}

/* ─── Leaderboard page ────────────────────────────────────── */
async function loadLeaderboard() {
  const rowsEl = document.getElementById("leaderboard-rows");
  rowsEl.innerHTML = `<div class="lb-row"><span></span><span>Loading…</span><span></span><span></span></div>`;
  try {
    const leaders = await api("/leaderboard");
    if (!leaders.length) {
      rowsEl.innerHTML = `<div class="lb-row"><span></span><span>No players yet — be the first!</span><span></span><span></span></div>`;
      return;
    }
    rowsEl.innerHTML = leaders.map(l => {
      const isYou = state.username && l.username === state.username;
      const rankDisplay = l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : l.rank;
      return `
        <div class="lb-row ${isYou ? "lb-you" : ""}">
          <span class="lb-rank">${rankDisplay}</span>
          <span class="lb-user">${isYou ? "🐉 " : ""}${escapeHtml(l.username)}</span>
          <span class="lb-score">${l.score.toLocaleString()}</span>
          <span class="lb-solved">${l.solved_count}</span>
        </div>`;
    }).join("");
  } catch (err) {
    rowsEl.innerHTML = `<div class="lb-row"><span></span><span>Couldn't load leaderboard.</span><span></span><span></span></div>`;
  }
}

/* ─── Init ────────────────────────────────────────────────── */
function init() {
  renderHome();
  renderResourceTab("getting-started");
  initArenaFilters();
  renderAuthBox();
  refreshSidebarStats();
  setPage("home");
}

init();
