// api/hint.js — POST /api/hint?challengeId=XXX (Arena) or ?roomId=X&questionId=Y (Room)
// Merged into one file/function (Vercel Hobby plan caps at 12 functions).
import { getFirestore }      from "firebase-admin/firestore";
import { initAdmin }         from "./_firebase.js";
import { cors, requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ detail: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { challengeId, roomId, questionId } = req.query;

  try {
    initAdmin();
    const db = getFirestore();

    // ── Room hint ────────────────────────────────────────────
    if (roomId || questionId) {
      if (!roomId || !questionId) return res.status(400).json({ detail: "Missing roomId or questionId" });

      const roomRef = db.collection("rooms").doc(String(roomId));
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return res.status(404).json({ detail: "Room not found." });

      const qDoc = await roomRef.collection("questions").doc(String(questionId)).get();
      if (!qDoc.exists) return res.status(404).json({ detail: "Question not found." });

      const hints = qDoc.data().hints || [];
      const hintsSnap = await roomRef
        .collection("hints")
        .where("userId", "==", user.userId)
        .where("questionId", "==", String(questionId))
        .get();
      const revealed = hintsSnap.size;
      if (revealed >= hints.length) return res.status(400).json({ detail: "No more hints available." });

      const next = revealed + 1;
      await roomRef
        .collection("hints")
        .doc(`${user.userId}_${questionId}_${next}`)
        .set({ userId: user.userId, questionId: String(questionId), hintLevel: next });

      return res.status(200).json({ hint_level: next, total_hints: hints.length, hint: hints[revealed] });
    }

    // ── Arena hint ───────────────────────────────────────────
    if (!challengeId)
      return res.status(400).json({ detail: "Missing challengeId" });

    const chalDoc = await db.collection("challenges").doc(String(challengeId)).get();
    if (!chalDoc.exists)
      return res.status(404).json({ detail: "Challenge not found." });

    const hints = chalDoc.data().hints || [];

    const hintsSnap = await db
      .collection("hintUsage")
      .where("userId",      "==", user.userId)
      .where("challengeId", "==", String(challengeId))
      .get();

    const revealed = hintsSnap.size;

    if (revealed >= hints.length)
      return res.status(400).json({ detail: "No more hints available." });

    const next = revealed + 1;
    await db
      .collection("hintUsage")
      .doc(`${user.userId}_${challengeId}_${next}`)
      .set({
        userId:      user.userId,
        challengeId: String(challengeId),
        hintLevel:   next,
        revealedAt:  new Date().toISOString(),
      });

    return res.status(200).json({
      hint_level:  next,
      total_hints: hints.length,
      hint:        hints[revealed],
    });

  } catch (err) {
    console.error("hint error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
