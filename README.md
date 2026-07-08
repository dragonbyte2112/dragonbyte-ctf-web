# Dragon Byte CTF

Student-driven cybersecurity CTF platform — Firebase Auth + Firestore backend, deployed on Vercel.

**Full setup instructions: see [SETUP.md](./SETUP.md).**

## Competition Rooms (added on top of v2.0.0)

This build adds a **Competition Rooms** system alongside the original global CTF Arena:

- Admins (emails listed in the `ADMIN_EMAILS` env var) can create isolated mini-competitions ("rooms"), each with its own questions, progressive hints, scoring, and leaderboard.
- Players browse rooms from the **Competition Rooms** sidebar link, enter one, solve questions, reveal hints, and climb that room's own leaderboard — independent from the global Arena score.
- Deleting a room (admin-only) cascades and permanently removes everything under it (questions, hints, solves, scores) in a single action.

New endpoints: `/api/whoami`, `/api/rooms`, `/api/room_questions`, `/api/room_submit`, `/api/room_hint`, `/api/room_leaderboard`, plus a `/api/health` diagnostic endpoint for verifying your Firebase env vars are wired correctly.

Set `ADMIN_EMAILS=you@example.com` in your Vercel project's Environment Variables (same place as the `FIREBASE_*` and `SEED_SECRET` vars) and redeploy to enable the admin panel.
