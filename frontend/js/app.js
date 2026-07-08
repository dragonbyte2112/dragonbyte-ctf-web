/* ============================================================
   Dragon Byte CTF Arena — app.js
   Auth:    Firebase Auth (email + Google + GitHub)
   Backend: Vercel serverless API → Firebase Firestore
   ============================================================ */

const API  = "/api";
const DIFF = { Easy:"🟢", Medium:"🟡", Hard:"🔴", Insane:"🟣" };

const state = {
  user:     null,   // { username, userId, token }
  page:     "home",
  challenge: null,
  feedback:  null,
  catFilter: "web",
  diffFilter:"All",
  authMode:  "login",
};

// ── Firebase readiness ──────────────────────────────────────
function waitForFirebase() {
  return new Promise(resolve => {
    if (window.__fbAuth && window.__fbFns) { resolve(); return; }
    const iv = setInterval(() => {
      if (window.__fbAuth && window.__fbFns) { clearInterval(iv); resolve(); }
    }, 40);
  });
}

async function getToken() {
  try {
    const u = window.__fbAuth?.currentUser;
    return u ? await u.getIdToken(/* forceRefresh */ false) : null;
  } catch { return null; }
}

// ── API helper ──────────────────────────────────────────────
async function api(path, { method = "GET", body = null, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error((data && data.detail) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Toast ───────────────────────────────────────────────────
function toast(msg, type = "default") {
  const el = document.createElement("div");
  el.className = `toast${type === "success" ? " toast-success" : type === "error" ? " toast-error" : ""}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ── Routing ─────────────────────────────────────────────────
function setPage(page) {
  state.page = page;
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(`page-${page}`).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle("nav-active", b.dataset.page === page)
  );
  document.getElementById("sidebar").classList.remove("sidebar-open");

  if (page === "leaderboard") loadLeaderboard();
  if (page === "arena")       refreshArenaGate();
  if (page === "resources")   renderResourceTab("getting-started");
  if (page === "rooms")       loadRooms();
}

document.querySelectorAll("[data-page]").forEach(el =>
  el.addEventListener("click", () => setPage(el.dataset.page))
);
document.getElementById("mobile-nav-toggle").addEventListener("click", () =>
  document.getElementById("sidebar").classList.toggle("sidebar-open")
);

// ── Auth Modal ──────────────────────────────────────────────
const authModal = document.getElementById("auth-modal");
const authError = document.getElementById("auth-error");

function openAuthModal(mode = "login") {
  setAuthMode(mode);
  authModal.classList.remove("hidden");
}

function closeAuthModal() {
  authModal.classList.add("hidden");
  authError.classList.add("hidden");
  authError.textContent = "";
  ["auth-email","auth-password","auth-username"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.getElementById("tab-login").classList.toggle("modal-tab-active",    mode === "login");
  document.getElementById("tab-register").classList.toggle("modal-tab-active", mode === "register");
  document.getElementById("auth-submit").textContent = mode === "login" ? "Sign In" : "Create Account";
  document.getElementById("auth-username-row").style.display = mode === "register" ? "" : "none";
  authError.classList.add("hidden");
}

document.getElementById("tab-login").addEventListener("click",    () => setAuthMode("login"));
document.getElementById("tab-register").addEventListener("click", () => setAuthMode("register"));
document.getElementById("auth-modal-close").addEventListener("click", closeAuthModal);
authModal.addEventListener("click", e => { if (e.target === authModal) closeAuthModal(); });

// Email auth submit
document.getElementById("auth-submit").addEventListener("click", async () => {
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const username = document.getElementById("auth-username").value.trim();
  const btn      = document.getElementById("auth-submit");

  authError.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Please wait…";

  try {
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = window.__fbFns;
    const auth = window.__fbAuth;

    if (state.authMode === "register") {
      if (!username || username.length < 3)
        throw new Error("Username must be at least 3 characters.");
      if (!/^[a-zA-Z0-9_]+$/.test(username))
        throw new Error("Username: only letters, numbers, and underscores.");
      if (!email)    throw new Error("Email is required.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
      closeAuthModal();
      toast(`Welcome to Dragon Byte, ${username}! 🐉`, "success");
    } else {
      if (!email || !password) throw new Error("Email and password are required.");
      await signInWithEmailAndPassword(auth, email, password);
      closeAuthModal();
    }
  } catch (err) {
    let msg = err.message || "Authentication failed.";
    if (msg.includes("email-already-in-use"))          msg = "Email already registered. Try signing in instead.";
    else if (msg.includes("invalid-credential") || msg.includes("wrong-password")) msg = "Invalid email or password.";
    else if (msg.includes("user-not-found"))           msg = "No account found with that email.";
    else if (msg.includes("weak-password"))            msg = "Password must be at least 6 characters.";
    else if (msg.includes("invalid-email"))            msg = "Please enter a valid email address.";
    else if (msg.includes("too-many-requests"))        msg = "Too many attempts. Please wait a moment and try again.";
    authError.textContent = msg;
    authError.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = state.authMode === "login" ? "Sign In" : "Create Account";
  }
});

// Social login
async function socialLogin(providerName) {
  const btn = providerName === "google"
    ? document.getElementById("google-signin-btn")
    : document.getElementById("github-signin-btn");
  btn.disabled = true;
  try {
    const { GoogleAuthProvider, GithubAuthProvider, signInWithPopup } = window.__fbFns;
    const provider = providerName === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
    await signInWithPopup(window.__fbAuth, provider);
    closeAuthModal();
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      authError.textContent = err.message;
      authError.classList.remove("hidden");
    }
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("google-signin-btn").addEventListener("click", () => socialLogin("google"));
document.getElementById("github-signin-btn").addEventListener("click", () => socialLogin("github"));

// ── Sign out ────────────────────────────────────────────────
async function logout() {
  await window.__fbFns.signOut(window.__fbAuth);
  state.user = null;
  renderAuthBox();
  refreshSidebarStats();
  if (state.page === "arena") refreshArenaGate();
  checkAdmin();
  toast("Signed out.");
}

// ── Auth box (sidebar) ──────────────────────────────────────
function renderAuthBox() {
  const box = document.getElementById("auth-box");
  if (state.user) {
    box.innerHTML = `
      <div class="auth-greeting">
        Signed in as<br>
        <strong>${esc(state.user.username)}</strong>
      </div>
      <button class="btn btn-block" id="logout-btn" style="margin-top:8px">Sign Out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", logout);
  } else {
    box.innerHTML = `
      <button class="btn btn-primary btn-block" id="open-signin-btn">Sign In</button>
      <button class="btn btn-block" id="open-signup-btn" style="margin-top:6px">Register Free</button>
    `;
    document.getElementById("open-signin-btn").addEventListener("click", () => openAuthModal("login"));
    document.getElementById("open-signup-btn").addEventListener("click", () => openAuthModal("register"));
  }
}

// ── Sidebar stats ───────────────────────────────────────────
async function refreshSidebarStats() {
  if (!state.user) {
    document.getElementById("stat-score").textContent   = "0";
    document.getElementById("stat-solved").textContent  = "—";
    document.getElementById("stat-rank").textContent    = "Rookie";
    document.getElementById("sidebar-progress-fill").style.width = "0%";
    document.getElementById("sidebar-progress-caption").textContent = "Sign in to track progress";
    return;
  }
  try {
    const p = await api("/progress", { auth: true });
    document.getElementById("stat-score").textContent  = p.score.toLocaleString();
    document.getElementById("stat-solved").textContent = `${p.solved_count}/${p.total_challenges}`;
    document.getElementById("stat-rank").textContent   = p.score >= 2000 ? "🐉 Elite"
                                                       : p.score >= 500  ? "🔥 Hunter"
                                                       : "🔰 Rookie";
    const pct = p.total_challenges ? (p.solved_count / p.total_challenges) * 100 : 0;
    document.getElementById("sidebar-progress-fill").style.width      = `${pct}%`;
    document.getElementById("sidebar-progress-caption").textContent   = `${pct.toFixed(1)}% complete`;
  } catch (err) {
    if (err.status === 401) logout();
  }
}

// ── Arena gate ──────────────────────────────────────────────
function refreshArenaGate() {
  const gate    = document.getElementById("arena-login-gate");
  const content = document.getElementById("arena-content");
  if (state.user) {
    gate.classList.add("hidden");
    content.classList.remove("hidden");
    loadCategoryProgress();
  } else {
    gate.classList.remove("hidden");
    content.classList.add("hidden");
  }
}

document.getElementById("arena-gate-signin").addEventListener("click",  () => openAuthModal("login"));
document.getElementById("arena-gate-signup").addEventListener("click",  () => openAuthModal("register"));

// ── Generate challenge ──────────────────────────────────────
async function generateChallenge() {
  const btn = document.getElementById("generate-btn");
  btn.disabled = true;
  btn.textContent = "Loading…";
  try {
    const cat  = document.getElementById("category-select").value;
    const diff = document.getElementById("difficulty-select").value;
    const qs   = new URLSearchParams({ category: cat, random: "1" });
    if (diff !== "All") qs.set("difficulty", diff);

    const ch = await api(`/challenges?${qs}`, { auth: true });
    state.challenge = ch;
    state.feedback  = null;
    renderChallengeArea();
  } catch (err) {
    if (err.status === 404)      toast("No challenges match that filter — try another.", "error");
    else if (err.status === 401) logout();
    else                         toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Generate Challenge";
  }
}

document.getElementById("generate-btn").addEventListener("click", generateChallenge);
document.getElementById("clear-btn").addEventListener("click", () => {
  state.challenge = null;
  state.feedback  = null;
  renderChallengeArea();
});

// ── Render challenge card ───────────────────────────────────
function renderChallengeArea() {
  const area = document.getElementById("challenge-area");
  const ch   = state.challenge;

  if (!ch) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🐉</div>
        <h3>No challenge loaded</h3>
        <p>Select a category above and click <strong>Generate Challenge</strong>.</p>
      </div>`;
    return;
  }

  const diffIcon  = DIFF[ch.difficulty] || "⬜";
  const hintsHtml = (ch.revealed_hints || []).map((h, i) =>
    `<div class="hint-item">💡 Hint ${i + 1}: ${esc(h)}</div>`
  ).join("");

  area.innerHTML = `
    <div class="challenge-header ${ch.solved ? "challenge-solved" : ""}">
      <div class="ch-title">${esc(ch.title)}</div>
      <div class="ch-meta">
        <span class="ch-badge ch-category">${esc(ch.category)}</span>
        <span class="ch-badge ch-difficulty">${diffIcon} ${ch.difficulty}</span>
        <span class="ch-badge ch-points">⚡ ${ch.points} pts</span>
        ${ch.solved ? '<span class="ch-badge ch-solved">✅ Solved</span>' : ""}
      </div>
    </div>

    <div class="challenge-body">
      <div class="challenge-description">${esc(ch.description).replace(/\n/g, "<br>")}</div>
    </div>

    ${ch.code_snippet ? `<pre class="challenge-code">${esc(ch.code_snippet)}</pre>` : ""}

    <div class="challenge-footer">
      <div id="feedback-slot"></div>

      ${ch.solved
        ? `<div class="feedback-banner feedback-success">✅ Already solved — great work!</div>`
        : `<div class="flag-submit-row">
             <input type="text" id="flag-input" placeholder="DB{your_flag_here}" autocomplete="off">
             <button class="btn btn-primary" id="submit-flag-btn">🚀 Submit</button>
           </div>`
      }

      <hr class="divider" style="margin:1.2rem 0">

      <div class="hint-row">
        <strong>💡 Hints — ${ch.hints_revealed || 0}/${ch.total_hints || 0} used</strong>
        <button class="btn" id="hint-btn"
          ${(ch.hints_revealed || 0) >= (ch.total_hints || 0) ? "disabled" : ""}>
          Reveal Hint
        </button>
      </div>
      ${hintsHtml ? `<div class="hint-list">${hintsHtml}</div>` : ""}
    </div>`;

  renderFeedback();

  if (!ch.solved) {
    document.getElementById("submit-flag-btn").addEventListener("click", submitFlag);
    document.getElementById("flag-input").addEventListener("keydown", e => {
      if (e.key === "Enter") submitFlag();
    });
  }
  document.getElementById("hint-btn").addEventListener("click", revealHint);
}

function renderFeedback() {
  const slot = document.getElementById("feedback-slot");
  if (!slot || !state.feedback) { if (slot) slot.innerHTML = ""; return; }
  const { type, message } = state.feedback;
  slot.innerHTML = `<div class="feedback-banner feedback-${type}">${esc(message)}</div>`;
}

// ── Submit flag ─────────────────────────────────────────────
async function submitFlag() {
  const input = document.getElementById("flag-input");
  const flag  = input?.value?.trim();
  if (!flag)  return;

  const ch  = state.challenge;
  const btn = document.getElementById("submit-flag-btn");
  btn.disabled    = true;
  btn.textContent = "Checking…";

  try {
    const result = await api(`/submit?challengeId=${ch.id}`, {
      method: "POST",
      auth:   true,
      body:   { flag },
    });

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
    toast(err.message, "error");
    btn.disabled    = false;
    btn.textContent = "🚀 Submit";
  }
}

// ── Reveal hint ─────────────────────────────────────────────
async function revealHint() {
  const ch  = state.challenge;
  const btn = document.getElementById("hint-btn");
  btn.disabled    = true;
  btn.textContent = "Loading…";

  try {
    const result = await api(`/hint?challengeId=${ch.id}`, {
      method: "POST",
      auth:   true,
    });
    ch.hints_revealed = result.hint_level;
    ch.revealed_hints = [...(ch.revealed_hints || []), result.hint];
    state.feedback = {
      type:    "info",
      message: `💡 Hint ${result.hint_level}: ${result.hint}`,
    };
    renderChallengeArea();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    toast(err.message, "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Reveal Hint";
  }
}

// ── Category progress bars ──────────────────────────────────
const CAT_LABELS = {
  web:"🌐 Web", crypto:"🔐 Crypto", forensics:"🔍 Forensics",
  binary:"💻 Binary", stego:"🖼️ Stego", ai_ml:"🤖 AI/ML", osint:"🕵️ OSINT",
};

async function loadCategoryProgress() {
  if (!state.user) return;
  try {
    const p   = await api("/progress", { auth: true });
    const el  = document.getElementById("category-progress-list");
    const cp  = p.category_progress || {};
    el.innerHTML = Object.entries(cp).map(([k, v]) => {
      const pct  = v.total ? (v.solved / v.total) * 100 : 0;
      const label = CAT_LABELS[k] || k;
      return `
        <div class="category-progress-block">
          <div class="category-progress">
            <span class="cat-prog-name">${label}</span>
            <span class="cat-prog-stat">${v.solved}/${v.total}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    if (err.status === 401) logout();
  }
}

// ── Leaderboard ─────────────────────────────────────────────
async function loadLeaderboard() {
  const rows = document.getElementById("leaderboard-rows");
  rows.innerHTML = `<div class="lb-row"><span></span><span>Loading…</span><span></span><span></span></div>`;
  try {
    const leaders = await api("/leaderboard");
    if (!leaders.length) {
      rows.innerHTML = `<div class="lb-row"><span></span><span>No players yet — be the first!</span><span></span><span></span></div>`;
      return;
    }
    rows.innerHTML = leaders.map(l => {
      const isYou  = state.user && l.username === state.user.username;
      const medal  = l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : l.rank;
      return `
        <div class="lb-row ${isYou ? "lb-you" : ""}">
          <span class="lb-rank">${medal}</span>
          <span class="lb-user">${isYou ? "🐉 " : ""}${esc(l.username)}</span>
          <span class="lb-score">${l.score.toLocaleString()}</span>
          <span class="lb-solved">${l.solved_count}</span>
        </div>`;
    }).join("");
  } catch {
    rows.innerHTML = `<div class="lb-row"><span></span><span>Could not load leaderboard.</span><span></span><span></span></div>`;
  }
}

// ── Resources ───────────────────────────────────────────────
function renderResourceTab(key) {
  const tab = (SITE_DATA?.resourceTabs || {})[key];
  if (!tab) return;
  document.getElementById("resource-tab-content").innerHTML = `
    <div class="resource-section">
      <h3>${tab.title}</h3>
      ${tab.cards.map(([t, d]) => `
        <div class="resource-card">
          <strong>${t}</strong>
          <p>${d}</p>
        </div>`).join("")}
    </div>`;
}

document.querySelectorAll(".tab-btn").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
    renderResourceTab(btn.dataset.tab);
  })
);

// ── Home page dynamic content ───────────────────────────────
function renderHomeSections() {
  const sd = window.SITE_DATA;
  if (!sd) return;

  // Activities
  const actEl = document.getElementById("home-activities");
  if (actEl && sd.activities) {
    actEl.innerHTML = sd.activities.map(([icon, title, desc]) => `
      <div class="activity-card">
        <div class="activity-icon">${icon}</div>
        <h4>${title}</h4>
        <p>${desc}</p>
      </div>`).join("");
  }

  // Events
  const evEl = document.getElementById("home-events");
  if (evEl && sd.events) {
    evEl.innerHTML = sd.events.map(([date, title, desc, status]) => {
      const col = status==="Open" ? "#00ff88" : status==="Registering" ? "#ff9500" : "#9b59b6";
      return `
        <div class="event-card">
          <div class="event-date">${date}</div>
          <div class="event-info">
            <div class="event-title">${title}</div>
            <div class="event-desc">${desc}</div>
          </div>
          <div class="event-status" style="color:${col};border-color:${col}">${status}</div>
        </div>`;
    }).join("");
  }

  // Team
  const teamEl = document.getElementById("home-team");
  if (teamEl && sd.team) {
    teamEl.innerHTML = sd.team.map(([icon, name, role, badge]) => `
      <div class="team-card">
        <div class="team-avatar">${icon}</div>
        <div class="team-name">${name}</div>
        <div class="team-role">${role}</div>
        <div class="team-badge">${badge}</div>
      </div>`).join("");
  }
}

// ── Join form ───────────────────────────────────────────────
document.getElementById("join-submit-btn").addEventListener("click", () => {
  const name  = document.getElementById("join-name").value.trim();
  const email = document.getElementById("join-email").value.trim();
  const fb    = document.getElementById("join-feedback");
  if (!name || !email) {
    fb.innerHTML = `<div class="feedback-banner feedback-error">Please fill in your name and email.</div>`;
    return;
  }
  fb.innerHTML = `<div class="feedback-banner feedback-success">✅ Thanks ${esc(name)}! We'll reach out to ${esc(email)} within 48 hours. 🐉</div>`;
  document.getElementById("join-name").value    = "";
  document.getElementById("join-email").value   = "";
  document.getElementById("join-college").value = "";
});

// ── Boot ────────────────────────────────────────────────────
async function init() {
  renderResourceTab("getting-started");
  renderHomeSections();
  renderAuthBox();
  setPage("home");

  await waitForFirebase();

  window.__fbFns.onAuthStateChanged(window.__fbAuth, async user => {
    if (user) {
      // Force token refresh so we always have a valid one
      await user.getIdToken(true).catch(() => {});
      state.user = {
        userId:   user.uid,
        username: user.displayName || user.email?.split("@")[0] || user.uid,
      };
      toast(`Welcome back, ${state.user.username}! 🐉`, "success");
    } else {
      state.user = null;
    }
    renderAuthBox();
    refreshSidebarStats();
    if (state.page === "arena") refreshArenaGate();
    checkAdmin();
  });
}

init();
