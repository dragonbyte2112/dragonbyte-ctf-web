import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.js";
import { requireAuth } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { roomId, questionId } = req.query;
  if (!roomId || !questionId) return res.status(400).json({ detail: "Missing roomId or questionId" });

  try {
    initAdmin();
    const db = getFirestore();
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
  } catch (err) {
    console.error(err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
