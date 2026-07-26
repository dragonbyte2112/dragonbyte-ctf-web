// api/room_question_file.js — GET /api/room_question_file?roomId=...&questionId=...
// Streams a redirect to a short-lived signed URL for the file attached to a
// Competition Room question. Mirrors challenge_file.js for the Arena — room
// questions are public info (same as /api/room_questions), no sign-in required.
import { getFirestore } from "firebase-admin/firestore";
import { getStorage }   from "firebase-admin/storage";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    initAdmin();
    const db = getFirestore();
    const { roomId, questionId } = req.query;
    if (!roomId || !questionId)
      return res.status(400).json({ detail: "roomId and questionId are required." });

    const snap = await db.collection("rooms").doc(String(roomId))
      .collection("questions").doc(String(questionId)).get();
    if (!snap.exists) return res.status(404).json({ detail: "Question not found." });

    const q = snap.data();
    if (!q.file_path) return res.status(404).json({ detail: "This question has no attached file." });

    const bucket = getStorage().bucket();
    const file   = bucket.file(q.file_path);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ detail: "File not found in storage." });

    const [url] = await file.getSignedUrl({
      action:  "read",
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      responseDisposition: `attachment; filename="${q.file_name || "download"}"`,
    });

    res.writeHead(302, { Location: url });
    return res.end();

  } catch (err) {
    console.error("room_question_file error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
