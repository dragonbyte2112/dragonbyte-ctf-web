import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ detail: "Missing roomId" });

  try {
    initAdmin();
    const db = getFirestore();
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
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
