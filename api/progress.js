// api/progress.js — GET /api/progress  |  POST /api/progress (reset)
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin }                from "./_firebase.js";
import { cors, requireAuth }        from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    initAdmin();
    const db = getFirestore();

    // ── POST: reset all progress for this user ─────────────────────────────
    if (req.method === "POST") {
      const [sv, hv] = await Promise.all([
        db.collection("solves").where("userId", "==", user.userId).get(),
        db.collection("hintUsage").where("userId", "==", user.userId).get(),
      ]);
      const batch = db.batch();
      sv.docs.forEach(d => batch.delete(d.ref));
      hv.docs.forEach(d => batch.delete(d.ref));
      batch.set(
        db.collection("users").doc(user.userId),
        { score: 0, solvedCount: 0 },
        { merge: true }
      );
      await batch.commit();
      return res.status(200).json({ ok: true, message: "Progress reset." });
    }

    // ── GET: return current progress ───────────────────────────────────────
    if (req.method !== "GET")
      return res.status(405).json({ detail: "Method not allowed" });

    const [chalSnap, sv] = await Promise.all([
      db.collection("challenges").get(),
      db.collection("solves").where("userId", "==", user.userId).get(),
    ]);

    // Build category totals
    const totalsByCat = {};
    chalSnap.docs.forEach(d => {
      const k = d.data().category_key;
      totalsByCat[k] = (totalsByCat[k] || 0) + 1;
    });

    // Tally user score + per-category solves
    let score = 0;
    const solvedByCat = {};
    sv.docs.forEach(d => {
      const { points = 0, challengeId } = d.data();
      score += points;
      const chalDoc = chalSnap.docs.find(x => x.id === challengeId);
      if (chalDoc) {
        const k = chalDoc.data().category_key;
        solvedByCat[k] = (solvedByCat[k] || 0) + 1;
      }
    });

    const category_progress = {};
    for (const [k, total] of Object.entries(totalsByCat)) {
      category_progress[k] = { solved: solvedByCat[k] || 0, total };
    }

    return res.status(200).json({
      username:          user.username,
      score,
      solved_count:      sv.size,
      total_challenges:  chalSnap.size,
      category_progress,
    });

  } catch (err) {
    console.error("progress error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
