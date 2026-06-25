"""
Dragon Bytes CTF Arena — Database layer (SQLite)
"""
import sqlite3
import json
import os
import threading

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "dragonbytes.db")
SEED_PATH = os.path.join(os.path.dirname(__file__), "data", "challenges_seed.json")

_lock = threading.Lock()


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create tables if they don't exist, and seed challenges from JSON."""
    with _lock:
        conn = get_conn()
        cur = conn.cursor()

        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS challenges (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                category_key TEXT NOT NULL,
                description TEXT NOT NULL,
                code_snippet TEXT,
                code_lang TEXT,
                difficulty TEXT NOT NULL,
                points INTEGER NOT NULL,
                flag_hash TEXT NOT NULL,
                hints_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS solves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
                solved_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, challenge_id)
            );

            CREATE TABLE IF NOT EXISTS hint_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
                hint_level INTEGER NOT NULL,
                UNIQUE(user_id, challenge_id, hint_level)
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL
            );
            """
        )
        conn.commit()

        # Seed challenges only if table is empty
        cur.execute("SELECT COUNT(*) AS c FROM challenges")
        count = cur.fetchone()["c"]
        if count == 0 and os.path.exists(SEED_PATH):
            from security import hash_flag

            with open(SEED_PATH) as f:
                seed = json.load(f)
            for c in seed:
                cur.execute(
                    """
                    INSERT INTO challenges
                        (id, title, category, category_key, description, code_snippet,
                         code_lang, difficulty, points, flag_hash, hints_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        c["id"],
                        c["title"],
                        c["category"],
                        c["category_key"],
                        c["description"],
                        c.get("code_snippet"),
                        c.get("code_lang"),
                        c["difficulty"],
                        c["points"],
                        hash_flag(c["flag"]),
                        json.dumps(c.get("hints", [])),
                    ),
                )
            conn.commit()
        conn.close()
