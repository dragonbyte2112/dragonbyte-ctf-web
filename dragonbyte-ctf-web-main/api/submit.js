// api/submit.js — POST /api/submit?challengeId=XXX (Arena) or ?roomId=X&questionId=Y (Room)  body: { flag }
// Merged into one file/function (Vercel Hobby plan caps at 12 functions).
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

  const { challengeId, roomId, questionId } = req.query;
  const { flag } = req.body || {};

  try {
    initAdmin();
    const db = getFirestore();

    // ── Room submit ──────────────────────────────────────────
    if (roomId || questionId) {
      if (!roomId || !questionId || !flag) {
        return res.status(400).json({ detail: "Missing roomId, questionId or flag" });
      }

      const roomRef = db.collection("rooms").doc(String(roomId));
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return res.status(404).json({ detail: "Room not found." });
      if ((roomDoc.data().status || "active") === "ended") {
        return res.status(400).json({ detail: "This room has ended and no longer accepts submissions." });
      }

      const qDoc = await roomRef.collection("questions").doc(String(questionId)).get();
      if (!qDoc.exists) return res.status(404).json({ detail: "Question not found." });
      const q = qDoc.data();

      const isCorrect = hashFlag(flag) === q.flag_hash;
      const solveId = `${user.userId}_${questionId}`;
      const alreadySolved = (await roomRef.collection("solves").doc(solveId).get()).exists;

      if (!isCorrect) {
        return res.status(200).json({ correct: false, already_solved: alreadySolved, message: "Incorrect flag. Re-read the question carefully." });
      }
      if (alreadySolved) {
        return res.status(200).json({ correct: true, already_solved: true, points_awarded: 0, message: "Already solved — no extra points awarded." });
      }

      const batch = db.batch();
      batch.set(roomRef.collection("solves").doc(solveId), {
        userId: user.userId,
        questionId: String(questionId),
        solvedAt: FieldValue.serverTimestamp(),
        points: q.points,
      });
      batch.set(
        roomRef.collection("scores").doc(user.userId),
        { username: user.username, score: FieldValue.increment(q.points), solvedCount: FieldValue.increment(1) },
        { merge: true }
      );
      await batch.commit();

      return res.status(200).json({ correct: true, already_solved: false, points_awarded: q.points, message: `Correct! +${q.points} points earned. Dragon Bytes salutes you!` });
    }

    // ── Arena submit ─────────────────────────────────────────
    if (!challengeId || !flag)
      return res.status(400).json({ detail: "Missing challengeId or flag." });

    const chalRef = db.collection("challenges").doc(String(challengeId));
    const chalDoc = await chalRef.get();

    if (!chalDoc.exists)
      return res.status(404).json({ detail: "Challenge not found." });

    const ch          = chalDoc.data();
    const isCorrect    = hashFlag(flag) === ch.flag_hash;
    const solveId      = `${user.userId}_${challengeId}`;
    const solveRef     = db.collection("solves").doc(solveId);
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
