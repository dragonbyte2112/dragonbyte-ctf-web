# 🐉 Dragon Bytes — CTF Arena (Web Edition)

A full website + backend conversion of the original Streamlit app. Same
dragon fire-orange / arcane-purple theme, same 49 challenges across 7
categories — now running as a real client-server web app with a shared,
persistent SQLite-backed leaderboard.

## What changed vs. the Streamlit version

- **Real frontend**: plain HTML/CSS/JS (no framework needed), served as
  static files.
- **Real backend**: FastAPI (Python), with a REST API.
- **Real persistence**: SQLite database (`backend/data/dragonbytes.db`,
  created automatically on first run). Scores, solves, and the
  leaderboard are shared across every user who connects — not just
  stored in one browser's session.
- **Real accounts**: username + password, hashed with PBKDF2. Sessions
  use bearer tokens stored in `localStorage`.
- **Flags are never sent to the browser.** They're hashed (SHA-256 with
  a fixed salt) and stored only as hashes. Verification happens
  entirely server-side via a timing-safe comparison, so flags can't be
  read out of the browser's network tab or dev tools — a real security
  upgrade over the original, which kept flags in Streamlit's
  session state.

## Project structure

```
dragonbytes-web/
├── backend/
│   ├── main.py              # FastAPI app — all API routes
│   ├── database.py          # SQLite schema + seeding
│   ├── security.py          # password hashing, flag hashing, sessions
│   ├── requirements.txt
│   └── data/
│       └── challenges_seed.json   # the 49 challenges (from the original Python files)
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── data.js          # static community-page content (team, events, etc.)
        └── app.js           # routing, API calls, rendering
```

## Running it locally

```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000** in your browser. The backend serves
the frontend directly, so there's only one server to run.

The database is created automatically on first startup and seeded with
all 49 challenges. To wipe everything and start fresh, just delete
`backend/data/dragonbytes.db` and restart the server.

## API overview

| Method | Route                              | Purpose                          |
|--------|-------------------------------------|-----------------------------------|
| POST   | `/api/auth/register`               | Create an account                |
| POST   | `/api/auth/login`                  | Log in, get a session token      |
| POST   | `/api/auth/logout`                 | Invalidate the current session   |
| GET    | `/api/auth/me`                     | Current user info                |
| GET    | `/api/challenges`                  | List challenges (flags excluded) |
| GET    | `/api/challenges/random`           | Get one random challenge         |
| POST   | `/api/challenges/{id}/submit`      | Submit a flag attempt            |
| POST   | `/api/challenges/{id}/hint`        | Reveal the next hint             |
| GET    | `/api/progress`                    | Current user's score & progress  |
| POST   | `/api/progress/reset`              | Reset current user's progress    |
| GET    | `/api/leaderboard`                 | Global leaderboard (top 100)     |

All routes except auth/register/login/leaderboard require an
`Authorization: Bearer <token>` header.

## Deploying it for real

This will run anywhere that can run a Python process (a VPS, Render,
Railway, Fly.io, etc.). A few things worth doing before going fully
public:

- Put it behind HTTPS (e.g. via a reverse proxy like Caddy or Nginx,
  or your hosting platform's built-in TLS).
- Swap SQLite for Postgres if you expect heavy concurrent write load —
  SQLite is fine for a club-sized community but isn't built for high
  concurrency.
- Set a real session lifetime / add rate limiting on `/api/auth/login`
  and `/api/challenges/{id}/submit` to slow down brute-force guessing.
- Consider moving `CORSMiddleware`'s `allow_origins=["*"]` to your
  actual domain once deployed.
