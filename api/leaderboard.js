// api/leaderboard.js — GET /api/leaderboard
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ detail: "Method not allowed" });

  try {
    initAdmin();
    const snap = await getFirestore()
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
