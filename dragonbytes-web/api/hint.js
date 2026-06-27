import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { requireAuth }  from "./_clerk.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

  const user = await requireAuth(req, res); if (!user) return;
  const { challengeId } = req.query;
  if (!challengeId) return res.status(400).json({ detail: "Missing challengeId" });

  try {
    initAdmin();
    const db      = getFirestore();
    const chalDoc = await db.collection("challenges").doc(String(challengeId)).get();
    if (!chalDoc.exists) return res.status(404).json({ detail: "Challenge not found." });
    const hints       = chalDoc.data().hints || [];
    const hintsSnap   = await db.collection("hintUsage").where("userId", "==", user.userId).where("challengeId", "==", String(challengeId)).get();
    const revealed    = hintsSnap.size;
    if (revealed >= hints.length) return res.status(400).json({ detail: "No more hints available." });
    const next = revealed + 1;
    await db.collection("hintUsage").doc(`${user.userId}_${challengeId}_${next}`).set({ userId: user.userId, challengeId: String(challengeId), hintLevel: next });
    return res.status(200).json({ hint_level: next, total_hints: hints.length, hint: hints[revealed] });
  } catch (err) { console.error(err); return res.status(500).json({ detail: "Internal server error" }); }
}
