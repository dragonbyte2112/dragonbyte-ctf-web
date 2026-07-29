// api/leaderboard.js — GET /api/leaderboard (global Arena) or ?roomId=... (Competition Room)
// Merged into one file/function (Vercel Hobby plan caps at 12 functions).
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ detail: "Method not allowed" });

  try {
    initAdmin();
    const db = getFirestore();
    const { roomId } = req.query;

    // ── Room leaderboard ───────────────────────────────────────
    if (roomId) {
      const snap = await db
        .collection("rooms")
        .doc(String(roomId))
        .collection("scores")
        .orderBy("score", "desc")
        .limit(100)
        .get();

      return res.status(200).json(
        snap.docs.map((d, i) => {
          const { username = "Player", score = 0, solvedCount = 0 } = d.data();
          return { rank: i + 1, username, score, solved_count: solvedCount };
        })
      );
    }

    // ── Global Arena leaderboard ───────────────────────────────
    const snap = await db
      .collection("users")
      .orderBy("score", "desc")
      .limit(100)
      .get();

    const rows = snap.docs.map((d, i) => {
      const { username = "Anonymous", score = 0, solvedCount = 0 } = d.data();
      return { rank: i + 1, userId: d.id, username, score, solved_count: solvedCount };
    });

    return res.status(200).json(rows);

  } catch (err) {
    console.error("leaderboard error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
