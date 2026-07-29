// api/submit.js — POST /api/submit?challengeId=XXX  body: { flag }
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin }                from "./_firebase.js";
import { cors, requireAuth }        from "./_auth.js";
import crypto                       from "crypto";

function hashFlag(f) {
  return crypto.createHash("sha256").update(f.trim()).digest("hex");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ detail: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { challengeId } = req.query;
  const { flag }        = req.body || {};

  if (!challengeId || !flag)
    return res.status(400).json({ detail: "Missing challengeId or flag." });

  try {
    initAdmin();
    const db      = getFirestore();
    const chalRef = db.collection("challenges").doc(String(challengeId));
    const chalDoc = await chalRef.get();

    if (!chalDoc.exists)
      return res.status(404).json({ detail: "Challenge not found." });

    const ch          = chalDoc.data();
    const isCorrect   = hashFlag(flag) === ch.flag_hash;
    const solveId     = `${user.userId}_${challengeId}`;
    const solveRef    = db.collection("solves").doc(solveId);
    const alreadySolved = (await solveRef.get()).exists;

    if (!isCorrect) {
      return res.status(200).json({
        correct:       false,
        already_solved: alreadySolved,
        message:       "Incorrect flag. Re-read the challenge carefully.",
      });
    }

    if (alreadySolved) {
      return res.status(200).json({
        correct:        true,
        already_solved: true,
        points_awarded: 0,
        message:        "Already solved — no extra points awarded.",
      });
    }

    // First correct solve — record it atomically
    const batch = db.batch();
    batch.set(solveRef, {
      userId:      user.userId,
      challengeId: String(challengeId),
      solvedAt:    FieldValue.serverTimestamp(),
      points:      ch.points,
    });
    batch.set(
      db.collection("users").doc(user.userId),
      {
        username:    user.username,
        score:       FieldValue.increment(ch.points),
        solvedCount: FieldValue.increment(1),
        lastActive:  FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    return res.status(200).json({
      correct:        true,
      already_solved: false,
      points_awarded: ch.points,
      message:        `Correct! +${ch.points} points earned. Dragon Bytes salutes you! 🐉`,
    });

  } catch (err) {
    console.error("submit error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
