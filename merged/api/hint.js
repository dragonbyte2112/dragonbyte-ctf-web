// api/hint.js — POST /api/hint?challengeId=XXX
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { cors, requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ detail: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { challengeId } = req.query;
  if (!challengeId)
    return res.status(400).json({ detail: "Missing challengeId" });

  try {
    initAdmin();
    const db      = getFirestore();
    const chalDoc = await db.collection("challenges").doc(String(challengeId)).get();

    if (!chalDoc.exists)
      return res.status(404).json({ detail: "Challenge not found." });

    const hints = chalDoc.data().hints || [];

    // Count hints already revealed for this user+challenge
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
      hint:        hints[revealed],   // 0-indexed: revealed gives us the NEXT hint
    });

  } catch (err) {
    console.error("hint error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
