// api/room_question_file.js — GET (public download), POST/DELETE (admin upload/remove)
// Merged into one file/function (Vercel Hobby plan caps at 12 serverless
// functions per deployment). Mirrors challenge_file.js but for Competition
// Room questions, which live at rooms/{roomId}/questions/{questionId}.
import { getFirestore } from "firebase-admin/firestore";
import { getStorage }   from "firebase-admin/storage";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";
import { requireAdmin } from "./_admin.js";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB raw

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    initAdmin();
    const db = getFirestore();

    // ── GET: public download redirect ─────────────────────────
    if (req.method === "GET") {
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
        expires: Date.now() + 5 * 60 * 1000,
        responseDisposition: `attachment; filename="${q.file_name || "download"}"`,
      });

      res.writeHead(302, { Location: url });
      return res.end();
    }

    // ── POST/DELETE: admin upload / remove ────────────────────
    if (req.method !== "POST" && req.method !== "DELETE")
      return res.status(405).json({ detail: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const bucket = getStorage().bucket();
    const body   = req.body || {};
    const roomId     = req.method === "DELETE" ? (req.query.roomId || body.roomId) : body.roomId;
    const questionId = req.method === "DELETE" ? (req.query.questionId || body.questionId) : body.questionId;

    if (!roomId || !questionId)
      return res.status(400).json({ detail: "roomId and questionId are required." });

    const qRef  = db.collection("rooms").doc(String(roomId)).collection("questions").doc(String(questionId));
    const qSnap = await qRef.get();
    if (!qSnap.exists) return res.status(404).json({ detail: "Question not found." });
    const q = qSnap.data();

    if (req.method === "DELETE") {
      if (q.file_path) {
        await bucket.file(q.file_path).delete({ ignoreNotFound: true });
      }
      await qRef.update({
        file_name: null, file_path: null, file_size: null,
        file_content_type: null, file_uploaded_at: null,
      });
      return res.status(200).json({ ok: true });
    }

    const { filename, contentType, fileBase64 } = body;
    if (!filename || !fileBase64)
      return res.status(400).json({ detail: "filename and fileBase64 are required." });

    let buffer;
    try {
      buffer = Buffer.from(fileBase64, "base64");
    } catch {
      return res.status(400).json({ detail: "fileBase64 is not valid base64." });
    }
    if (!buffer.length) return res.status(400).json({ detail: "File is empty." });
    if (buffer.length > MAX_FILE_BYTES)
      return res.status(413).json({ detail: "File too large — max 4MB." });

    if (q.file_path) {
      await bucket.file(q.file_path).delete({ ignoreNotFound: true });
    }

    const safeName = String(filename).replace(/[^\w.\-]/g, "_").slice(0, 200);
    const path = `room-files/${roomId}/${questionId}/${Date.now()}_${safeName}`;
    const file = bucket.file(path);
    await file.save(buffer, {
      contentType: contentType || "application/octet-stream",
      resumable:   false,
    });

    await qRef.update({
      file_name:         safeName,
      file_path:         path,
      file_size:         buffer.length,
      file_content_type: contentType || "application/octet-stream",
      file_uploaded_at:  new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, file_name: safeName, file_size: buffer.length });

  } catch (err) {
    console.error("room_question_file error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
