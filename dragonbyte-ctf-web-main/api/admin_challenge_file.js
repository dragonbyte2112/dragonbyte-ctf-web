// api/admin_challenge_file.js — POST /api/admin_challenge_file (upload), DELETE (remove)
// Admin-only. Lets an admin attach a single downloadable file to a challenge
// (e.g. a pcap, zip, or binary the player needs) using Firebase Storage.
import { getFirestore } from "firebase-admin/firestore";
import { getStorage }   from "firebase-admin/storage";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";
import { requireAdmin } from "./_admin.js";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB raw (Vercel request body hard-caps around 4.5MB total)

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Methods", "POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "DELETE")
    return res.status(405).json({ detail: "Method not allowed" });

  try {
    initAdmin();
    const admin = await requireAdmin(req, res);
    if (!admin) return; // requireAdmin already responded (401/403)

    const db      = getFirestore();
    const bucket  = getStorage().bucket();
    const body    = req.body || {};
    const challengeId = (req.method === "DELETE" ? (req.query.challengeId || body.challengeId) : body.challengeId);

    if (!challengeId) return res.status(400).json({ detail: "challengeId is required." });

    const chRef  = db.collection("challenges").doc(String(challengeId));
    const chSnap = await chRef.get();
    if (!chSnap.exists) return res.status(404).json({ detail: "Challenge not found." });
    const ch = chSnap.data();

    // ── Remove existing file ──────────────────────────────────
    if (req.method === "DELETE") {
      if (ch.file_path) {
        await bucket.file(ch.file_path).delete({ ignoreNotFound: true });
      }
      await chRef.update({
        file_name: null, file_path: null, file_size: null,
        file_content_type: null, file_uploaded_at: null,
      });
      return res.status(200).json({ ok: true });
    }

    // ── Upload / replace file ─────────────────────────────────
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

    // Delete previous file for this challenge, if any, before saving the new one
    if (ch.file_path) {
      await bucket.file(ch.file_path).delete({ ignoreNotFound: true });
    }

    const safeName = String(filename).replace(/[^\w.\-]/g, "_").slice(0, 200);
    const path = `challenge-files/${challengeId}/${Date.now()}_${safeName}`;
    const file = bucket.file(path);
    await file.save(buffer, {
      contentType: contentType || "application/octet-stream",
      resumable:   false,
    });

    await chRef.update({
      file_name:         safeName,
      file_path:         path,
      file_size:         buffer.length,
      file_content_type: contentType || "application/octet-stream",
      file_uploaded_at:  new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, file_name: safeName, file_size: buffer.length });

  } catch (err) {
    console.error("admin_challenge_file error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
