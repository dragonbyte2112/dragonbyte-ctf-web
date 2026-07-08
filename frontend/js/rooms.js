/* Dragon Byte — Competition Rooms */
const roomState = { rooms: [], currentRoom: null, questions: [], isAdmin: false, feedback: {} };

async function checkAdmin() {
  if (!state.user) { roomState.isAdmin = false; renderRoomAdminControls(); return; }
  try {
    const who = await api("/whoami", { auth: true });
    roomState.isAdmin = !!who.isAdmin;
  } catch {
    roomState.isAdmin = false;
  }
  renderRoomAdminControls();
}

function renderRoomAdminControls() {
  const createPanel = document.getElementById("room-admin-panel");
  if (createPanel) createPanel.style.display = roomState.isAdmin ? "" : "none";
  const addQPanel = document.getElementById("room-add-question-panel");
  if (addQPanel) addQPanel.style.display = roomState.isAdmin ? "" : "none";
  if (roomState.rooms.length) renderRoomsGrid();
  if (roomState.currentRoom) renderRoomQuestions();
}

async function loadRooms() {
  const grid = document.getElementById("rooms-grid");
  grid.innerHTML = `<div class="empty-state"><h3>Loading rooms&hellip;</h3></div>`;
  try {
    const rooms = await api("/rooms", { auth: !!state.user });
    roomState.rooms = rooms;
    renderRoomsGrid();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load rooms.</h3></div>`;
  }
}

function renderRoomsGrid() {
  const grid = document.getElementById("rooms-grid");
  if (!roomState.rooms.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><h3>No active rooms yet</h3><p>Check back soon for the next mini-competition.</p></div>`;
    return;
  }
  grid.innerHTML = roomState.rooms.map(r => `
    <div class="content-card room-card">
      <div class="ch-title">${esc(r.name)}</div>
      <p>${esc(r.description || "No description provided.")}</p>
      <div class="ch-meta">
        <span class="ch-badge ch-category">${r.questionCount} question${r.questionCount === 1 ? "" : "s"}</span>
        <span class="ch-badge ch-points">⚡ ${(r.myScore || 0).toLocaleString()} pts</span>
        <span class="ch-badge ${r.status === "active" ? "ch-solved" : "ch-difficulty"}">${esc(r.status)}</span>
      </div>
      <div class="action-row" style="margin-top:12px">
        <button class="btn btn-primary" onclick="enterRoom('${r.id}')">Enter Room</button>
        ${roomState.isAdmin ? `<button class="btn" style="background:#ff3b5c;color:#fff" onclick="deleteRoom('${r.id}', ${JSON.stringify(r.name)})">Delete Room</button>` : ""}
      </div>
    </div>`).join("");
}

async function createRoom() {
  const nameEl = document.getElementById("new-room-name");
  const descEl = document.getElementById("new-room-desc");
  const name = nameEl.value.trim();
  const description = descEl.value.trim();
  if (!name) { toast("Room name is required.", "error"); return; }
  try {
    await api("/rooms", { method: "POST", auth: true, body: { name, description } });
    toast("Room created!", "success");
    nameEl.value = ""; descEl.value = "";
    loadRooms();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteRoom(roomId, name) {
  if (!confirm(`Delete room "${name}"? This permanently removes all its questions, hints, solves, and leaderboard.`)) return;
  try {
    await api(`/rooms?roomId=${encodeURIComponent(roomId)}`, { method: "DELETE", auth: true });
    toast("Room deleted.", "success");
    loadRooms();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function enterRoom(roomId) {
  roomState.currentRoom = roomId;
  roomState.feedback = {};
  setPage("room-detail");
  await loadRoomDetail();
}

async function loadRoomDetail() {
  const roomId = roomState.currentRoom;
  const area = document.getElementById("room-questions-area");
  area.innerHTML = `<div class="empty-state"><h3>Loading&hellip;</h3></div>`;
  try {
    const data = await api(`/room_questions?roomId=${encodeURIComponent(roomId)}`, { auth: !!state.user });
    roomState.questions = data.questions;
    document.getElementById("room-detail-title").textContent = data.room.name;
    document.getElementById("room-detail-desc").textContent = data.room.description || "";
    renderRoomAdminControls();
    renderRoomQuestions();
    loadRoomLeaderboard();
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><h3>Could not load this room.</h3></div>`;
  }
}

function renderRoomQuestions() {
  const area = document.getElementById("room-questions-area");
  if (!area) return;
  if (!roomState.questions.length) {
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">🐉</div><h3>No questions yet</h3><p>Check back once the admin adds challenges to this room.</p></div>`;
    return;
  }
  area.innerHTML = roomState.questions.map(q => {
    const hintsHtml = (q.revealed_hints || []).length
      ? `<div class="hint-list">${q.revealed_hints.map((h, i) => `<div class="hint-item">💡 Hint ${i + 1}: ${esc(h)}</div>`).join("")}</div>`
      : "";
    const fb = roomState.feedback[q.id];
    const fbHtml = fb ? `<div class="feedback-banner feedback-${fb.type}">${esc(fb.message)}</div>` : "";
    return `<div class="challenge-header ${q.solved ? "challenge-solved" : ""}" style="margin-bottom:16px">
      <div class="ch-title">${esc(q.title)}</div>
      <div class="ch-meta">
        <span class="ch-badge ch-difficulty">${DIFF[q.difficulty] || "⬜"} ${esc(q.difficulty)}</span>
        <span class="ch-badge ch-points">⚡ ${q.points} pts</span>
        ${q.solved ? '<span class="ch-badge ch-solved">✅ Solved</span>' : ""}
        ${roomState.isAdmin ? `<button class="btn" style="background:#ff3b5c;color:#fff;padding:4px 12px;font-size:12px" onclick="deleteRoomQuestion('${q.id}')">Delete</button>` : ""}
      </div>
      <div class="challenge-body"><div class="challenge-description">${esc(q.description).replace(/\n/g, "<br>")}</div></div>
      ${q.code_snippet ? `<pre class="challenge-code">${esc(q.code_snippet)}</pre>` : ""}
      <div class="challenge-footer">
        <div class="flag-submit-row">
          <input type="text" id="room-flag-${q.id}" placeholder="DB{your_flag_here}" autocomplete="off">
          <button class="btn btn-primary" onclick="submitRoomFlag('${q.id}')">🚀 Submit</button>
        </div>
        ${fbHtml}
        <hr class="divider" style="margin:1.2rem 0">
        <div class="hint-row">
          <strong>💡 Hints — ${q.hints_revealed || 0}/${q.total_hints || 0} used</strong>
          <button class="btn" ${(q.hints_revealed || 0) >= (q.total_hints || 0) ? "disabled" : ""} onclick="revealRoomHint('${q.id}')">Reveal Hint</button>
        </div>
        ${hintsHtml}
      </div>
    </div>`;
  }).join("");

  roomState.questions.forEach(q => {
    const input = document.getElementById(`room-flag-${q.id}`);
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitRoomFlag(q.id); });
  });
}

async function submitRoomFlag(questionId) {
  const input = document.getElementById(`room-flag-${questionId}`);
  const flag = input.value.trim();
  if (!flag) return;
  if (!state.user) { toast("Sign in to submit flags.", "error"); return; }
  try {
    const result = await api(`/room_submit?roomId=${encodeURIComponent(roomState.currentRoom)}&questionId=${encodeURIComponent(questionId)}`, {
      method: "POST", auth: true, body: { flag },
    });
    const q = roomState.questions.find(x => x.id === questionId);
    if (result.correct && !result.already_solved) {
      roomState.feedback[questionId] = { type: "success", message: `🎉 ${result.message}` };
      if (q) q.solved = true;
      loadRoomLeaderboard();
    } else if (result.correct) {
      roomState.feedback[questionId] = { type: "warning", message: `⚠️ ${result.message}` };
    } else {
      roomState.feedback[questionId] = { type: "error", message: `❌ ${result.message}` };
    }
    renderRoomQuestions();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    toast(err.message, "error");
  }
}

async function revealRoomHint(questionId) {
  try {
    const result = await api(`/room_hint?roomId=${encodeURIComponent(roomState.currentRoom)}&questionId=${encodeURIComponent(questionId)}`, {
      method: "POST", auth: true,
    });
    const q = roomState.questions.find(x => x.id === questionId);
    if (q) {
      q.hints_revealed = result.hint_level;
      q.revealed_hints = [...(q.revealed_hints || []), result.hint];
    }
    renderRoomQuestions();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    toast(err.message, "error");
  }
}

async function addRoomQuestion() {
  const title = document.getElementById("rq-title").value.trim();
  const description = document.getElementById("rq-desc").value.trim();
  const flag = document.getElementById("rq-flag").value.trim();
  const points = document.getElementById("rq-points").value.trim() || 100;
  const difficulty = document.getElementById("rq-difficulty").value;
  const hints = document.getElementById("rq-hints").value.split("\n").map(s => s.trim()).filter(Boolean);

  if (!title || !description || !flag) { toast("Title, description and flag are required.", "error"); return; }

  try {
    await api(`/room_questions?roomId=${encodeURIComponent(roomState.currentRoom)}`, {
      method: "POST", auth: true, body: { title, description, flag, points, difficulty, hints },
    });
    toast("Question added!", "success");
    ["rq-title", "rq-desc", "rq-flag", "rq-hints"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("rq-points").value = "100";
    loadRoomDetail();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteRoomQuestion(questionId) {
  if (!confirm("Delete this question? This cannot be undone.")) return;
  try {
    await api(`/room_questions?roomId=${encodeURIComponent(roomState.currentRoom)}&questionId=${encodeURIComponent(questionId)}`, {
      method: "DELETE", auth: true,
    });
    toast("Question deleted.", "success");
    loadRoomDetail();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function loadRoomLeaderboard() {
  const el = document.getElementById("room-leaderboard-rows");
  if (!el) return;
  el.innerHTML = `<div class="lb-row"><span></span><span>Loading&hellip;</span><span></span><span></span></div>`;
  try {
    const leaders = await api(`/room_leaderboard?roomId=${encodeURIComponent(roomState.currentRoom)}`);
    if (!leaders.length) {
      el.innerHTML = `<div class="lb-row"><span></span><span>No solves yet — be the first!</span><span></span><span></span></div>`;
      return;
    }
    el.innerHTML = leaders.map(l => {
      const isYou = state.user && l.username === state.user.username;
      const r = l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : l.rank;
      return `<div class="lb-row ${isYou ? "lb-you" : ""}"><span class="lb-rank">${r}</span><span class="lb-user">${isYou ? "🐉 " : ""}${esc(l.username)}</span><span class="lb-score">${l.score.toLocaleString()}</span><span class="lb-solved">${l.solved_count}</span></div>`;
    }).join("");
  } catch {
    el.innerHTML = `<div class="lb-row"><span></span><span>Could not load.</span><span></span><span></span></div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("create-room-btn")?.addEventListener("click", createRoom);
  document.getElementById("add-room-question-btn")?.addEventListener("click", addRoomQuestion);
  document.getElementById("back-to-rooms-btn")?.addEventListener("click", () => setPage("rooms"));
});
