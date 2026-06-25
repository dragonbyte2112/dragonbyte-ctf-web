"""
Dragon Bytes CTF Arena — FastAPI backend.

Routes:
  POST /api/auth/register      - create account
  POST /api/auth/login         - log in, get session token
  POST /api/auth/logout        - invalidate session
  GET  /api/auth/me            - current user info

  GET  /api/challenges                     - list challenges (no flags!)
  GET  /api/challenges/random?category=&difficulty=  - get one random challenge
  POST /api/challenges/{id}/submit         - submit a flag attempt
  POST /api/challenges/{id}/hint           - reveal next hint

  GET  /api/leaderboard        - global leaderboard
  GET  /api/progress           - current user's solved challenges + category progress
  POST /api/progress/reset     - wipe current user's progress (not other users)
"""
import json
import random
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import os

import database
import security

app = FastAPI(title="Dragon Bytes CTF Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_LIFETIME_DAYS = 30
DIFFICULTY_POINTS = {"Easy": 100, "Medium": 200, "Hard": 400, "Insane": 800}


# ─── Startup ──────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    database.init_db()


# ─── Schemas ──────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class SubmitFlagRequest(BaseModel):
    flag: str


# ─── Auth helpers ─────────────────────────────────────────────────────────
def get_current_user(authorization: str | None = Header(default=None)):
    """Resolve a Bearer token to a user row. Raises 401 if invalid/missing."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()

    conn = database.get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT users.id AS user_id, users.username AS username, sessions.expires_at AS expires_at
        FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
        """,
        (token,),
    )
    row = cur.fetchone()
    conn.close()

    if row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    return {"id": row["user_id"], "username": row["username"]}


def get_optional_user(authorization: str | None = Header(default=None)):
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


# ─── Auth routes ──────────────────────────────────────────────────────────
@app.post("/api/auth/register")
def register(body: RegisterRequest):
    username = body.username.strip()
    if not username.replace("_", "").isalnum():
        raise HTTPException(400, "Username can only contain letters, numbers, and underscores.")

    conn = database.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(400, "That username is already taken.")

    pw_hash = security.hash_password(body.password)
    cur.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, pw_hash),
    )
    user_id = cur.lastrowid
    conn.commit()

    token = _create_session(cur, user_id)
    conn.commit()
    conn.close()

    return {"token": token, "username": username}


@app.post("/api/auth/login")
def login(body: LoginRequest):
    conn = database.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (body.username.strip(),))
    user = cur.fetchone()

    if user is None or not security.verify_password(body.password, user["password_hash"]):
        conn.close()
        raise HTTPException(401, "Invalid username or password.")

    token = _create_session(cur, user["id"])
    conn.commit()
    conn.close()

    return {"token": token, "username": user["username"]}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        conn = database.get_conn()
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"ok": True}


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return user


def _create_session(cur, user_id: int) -> str:
    token = security.generate_session_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=SESSION_LIFETIME_DAYS)).isoformat()
    cur.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at),
    )
    return token


# ─── Challenge routes ─────────────────────────────────────────────────────
def _row_to_public_challenge(row, solved_ids, hints_revealed):
    hints = json.loads(row["hints_json"])
    revealed_count = hints_revealed.get(row["id"], 0)
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "category_key": row["category_key"],
        "description": row["description"],
        "code_snippet": row["code_snippet"],
        "code_lang": row["code_lang"],
        "difficulty": row["difficulty"],
        "points": row["points"],
        "solved": row["id"] in solved_ids,
        "total_hints": len(hints),
        "hints_revealed": revealed_count,
        "revealed_hints": hints[:revealed_count],
    }


@app.get("/api/challenges")
def list_challenges(
    category: str | None = None,
    difficulty: str | None = None,
    user=Depends(get_optional_user),
):
    conn = database.get_conn()
    cur = conn.cursor()

    query = "SELECT * FROM challenges WHERE 1=1"
    params = []
    if category:
        query += " AND category_key = ?"
        params.append(category)
    if difficulty:
        query += " AND difficulty = ?"
        params.append(difficulty)
    query += " ORDER BY category_key, points"

    cur.execute(query, params)
    rows = cur.fetchall()

    solved_ids, hints_revealed = _get_user_progress_maps(cur, user)
    conn.close()

    return [_row_to_public_challenge(r, solved_ids, hints_revealed) for r in rows]


@app.get("/api/challenges/random")
def random_challenge(
    category: str | None = None,
    difficulty: str | None = None,
    user=Depends(get_optional_user),
):
    conn = database.get_conn()
    cur = conn.cursor()

    query = "SELECT * FROM challenges WHERE 1=1"
    params = []
    if category:
        query += " AND category_key = ?"
        params.append(category)
    if difficulty and difficulty != "All":
        query += " AND difficulty = ?"
        params.append(difficulty)

    cur.execute(query, params)
    rows = cur.fetchall()

    if not rows:
        conn.close()
        raise HTTPException(404, "No challenges match that filter.")

    chosen = random.choice(rows)
    solved_ids, hints_revealed = _get_user_progress_maps(cur, user)
    conn.close()

    return _row_to_public_challenge(chosen, solved_ids, hints_revealed)


def _get_user_progress_maps(cur, user):
    """Returns (set_of_solved_ids, {challenge_id: hints_revealed_count})."""
    if not user:
        return set(), {}
    cur.execute("SELECT challenge_id FROM solves WHERE user_id = ?", (user["id"],))
    solved_ids = {r["challenge_id"] for r in cur.fetchall()}
    cur.execute(
        "SELECT challenge_id, COUNT(*) AS c FROM hint_usage WHERE user_id = ? GROUP BY challenge_id",
        (user["id"],),
    )
    hints_revealed = {r["challenge_id"]: r["c"] for r in cur.fetchall()}
    return solved_ids, hints_revealed


@app.post("/api/challenges/{challenge_id}/submit")
def submit_flag(challenge_id: int, body: SubmitFlagRequest, user=Depends(get_current_user)):
    conn = database.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM challenges WHERE id = ?", (challenge_id,))
    challenge = cur.fetchone()
    if challenge is None:
        conn.close()
        raise HTTPException(404, "Challenge not found.")

    cur.execute(
        "SELECT 1 FROM solves WHERE user_id = ? AND challenge_id = ?",
        (user["id"], challenge_id),
    )
    already_solved = cur.fetchone() is not None

    is_correct = security.verify_flag(body.flag, challenge["flag_hash"])

    if not is_correct:
        conn.close()
        return {"correct": False, "already_solved": already_solved, "message": "Incorrect flag. Re-read the challenge carefully."}

    if already_solved:
        conn.close()
        return {"correct": True, "already_solved": True, "points_awarded": 0, "message": "Already solved — no extra points awarded."}

    cur.execute(
        "INSERT INTO solves (user_id, challenge_id) VALUES (?, ?)",
        (user["id"], challenge_id),
    )
    conn.commit()
    conn.close()

    return {
        "correct": True,
        "already_solved": False,
        "points_awarded": challenge["points"],
        "message": f"Correct! +{challenge['points']} points earned. Dragon Bytes salutes you!",
    }


@app.post("/api/challenges/{challenge_id}/hint")
def reveal_hint(challenge_id: int, user=Depends(get_current_user)):
    conn = database.get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM challenges WHERE id = ?", (challenge_id,))
    challenge = cur.fetchone()
    if challenge is None:
        conn.close()
        raise HTTPException(404, "Challenge not found.")

    hints = json.loads(challenge["hints_json"])

    cur.execute(
        "SELECT COUNT(*) AS c FROM hint_usage WHERE user_id = ? AND challenge_id = ?",
        (user["id"], challenge_id),
    )
    revealed_count = cur.fetchone()["c"]

    if revealed_count >= len(hints):
        conn.close()
        raise HTTPException(400, "No more hints available.")

    next_level = revealed_count + 1
    cur.execute(
        "INSERT INTO hint_usage (user_id, challenge_id, hint_level) VALUES (?, ?, ?)",
        (user["id"], challenge_id, next_level),
    )
    conn.commit()
    hint_text = hints[revealed_count]
    conn.close()

    return {"hint_level": next_level, "total_hints": len(hints), "hint": hint_text}


# ─── Progress & leaderboard ───────────────────────────────────────────────
@app.get("/api/progress")
def progress(user=Depends(get_current_user)):
    conn = database.get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT challenges.category_key AS category_key, challenges.points AS points
        FROM solves JOIN challenges ON challenges.id = solves.challenge_id
        WHERE solves.user_id = ?
        """,
        (user["id"],),
    )
    solved_rows = cur.fetchall()

    cur.execute("SELECT category_key, COUNT(*) AS c FROM challenges GROUP BY category_key")
    totals_by_cat = {r["category_key"]: r["c"] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) AS c FROM challenges")
    total_challenges = cur.fetchone()["c"]

    conn.close()

    score = sum(r["points"] for r in solved_rows)
    solved_count = len(solved_rows)
    solved_by_cat = {}
    for r in solved_rows:
        solved_by_cat[r["category_key"]] = solved_by_cat.get(r["category_key"], 0) + 1

    category_progress = {
        cat: {"solved": solved_by_cat.get(cat, 0), "total": total}
        for cat, total in totals_by_cat.items()
    }

    return {
        "score": score,
        "solved_count": solved_count,
        "total_challenges": total_challenges,
        "category_progress": category_progress,
    }


@app.post("/api/progress/reset")
def reset_progress(user=Depends(get_current_user)):
    conn = database.get_conn()
    conn.execute("DELETE FROM solves WHERE user_id = ?", (user["id"],))
    conn.execute("DELETE FROM hint_usage WHERE user_id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/leaderboard")
def leaderboard():
    conn = database.get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT users.username AS username,
               COALESCE(SUM(challenges.points), 0) AS score,
               COUNT(solves.id) AS solved_count,
               MAX(solves.solved_at) AS last_solve
        FROM users
        LEFT JOIN solves ON solves.user_id = users.id
        LEFT JOIN challenges ON challenges.id = solves.challenge_id
        GROUP BY users.id
        ORDER BY score DESC, solved_count DESC, last_solve ASC
        LIMIT 100
        """
    )
    rows = cur.fetchall()
    conn.close()

    leaders = []
    for i, r in enumerate(rows, start=1):
        leaders.append(
            {
                "rank": i,
                "username": r["username"],
                "score": r["score"],
                "solved_count": r["solved_count"],
            }
        )
    return leaders


# ─── Static frontend ──────────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
