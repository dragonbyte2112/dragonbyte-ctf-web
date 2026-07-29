import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.js";
import { requireAdmin } from "./_admin.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  initAdmin();
  const db = getFirestore();
  const { roomId, questionId } = req.query;
  if (!roomId || !questionId) {
    return res.status(400).json({ detail: "Missing roomId or questionId" });
  }
  const qRef = db.collection("rooms").doc(String(roomId))
    .collection("questions").doc(String(questionId));

  // ── Attach or replace the file on an existing question (admin only) ──
  if (req.method === "POST") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { fileData, fileName, fileType } = req.body || {};
    if (!fileData) return res.status(400).json({ detail: "No file data provided." });

    // Firestore caps documents at 1MB total; base64 is ~33% larger than the raw
    // file, so cap the base64 string well below that to leave room for the
    // rest of the question's fields (description, hints, etc).
    if (fileData.length > 900000) {
      return res.status(400).json({ detail: "Attached file is too large (max ~650KB)." });
    }

    try {
      const qDoc = await qRef.get();
      if (!qDoc.exists) return res.status(404).json({ detail: "Question not found." });

      await qRef.update({
        file_data: String(fileData),
        file_name: String(fileName || "challenge-file").slice(0, 200),
        file_type: String(fileType || "application/octet-stream").slice(0, 100),
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("room_question_file error:", err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  // ── Remove the attached file from a question (admin only) ──
  if (req.method === "DELETE") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    try {
      const qDoc = await qRef.get();
      if (!qDoc.exists) return res.status(404).json({ detail: "Question not found." });
      const { FieldValue } = await import("firebase-admin/firestore");
      await qRef.update({
        file_data: FieldValue.delete(),
        file_name: FieldValue.delete(),
        file_type: FieldValue.delete(),
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("room_question_file delete error:", err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  return res.status(405).json({ detail: "Method not allowed" });
}