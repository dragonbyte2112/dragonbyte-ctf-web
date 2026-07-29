// api/challenge_file.js — GET (public download), POST/DELETE (admin upload/remove)
// Merged into one file/function (Vercel Hobby plan caps at 12 serverless
// functions per deployment) — GET is the public download redirect, POST/DELETE
// are admin-only upload/remove, same behavior as before, just one file now.
import { getFirestore } from "firebase-admin/firestore";
import { getStorage }   from "firebase-admin/storage";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";
import { requireAdmin } from "./_admin.js";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // ~4MB raw (Vercel request body hard-caps around 4.5MB total)

export default async function handler(req, res) {
  cors(res);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    initAdmin();
    const db = getFirestore();

    // ── GET: public download redirect ─────────────────────────
    if (req.method === "GET") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ detail: "id is required." });

      const snap = await db.collection("challenges").doc(String(id)).get();
      if (!snap.exists) return res.status(404).json({ detail: "Challenge not found." });

      const ch = snap.data();
      if (!ch.file_path) return res.status(404).json({ detail: "This challenge has no attached file." });

      const bucket = getStorage().bucket();
      const file   = bucket.file(ch.file_path);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ detail: "File not found in storage." });

      const [url] = await file.getSignedUrl({
        action:  "read",
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
        responseDisposition: `attachment; filename="${ch.file_name || "download"}"`,
      });

      res.writeHead(302, { Location: url });
      return res.end();
    }

    // ── POST/DELETE: admin upload / remove ────────────────────
    if (req.method !== "POST" && req.method !== "DELETE")
      return res.status(405).json({ detail: "Method not allowed" });

    const admin = await requireAdmin(req, res);
    if (!admin) return; // requireAdmin already responded (401/403)

    const bucket = getStorage().bucket();
    const body   = req.body || {};
    const challengeId = (req.method === "DELETE" ? (req.query.challengeId || body.challengeId) : body.challengeId);

    if (!challengeId) return res.status(400).json({ detail: "challengeId is required." });

    const chRef  = db.collection("challenges").doc(String(challengeId));
    const chSnap = await chRef.get();
    if (!chSnap.exists) return res.status(404).json({ detail: "Challenge not found." });
    const ch = chSnap.data();

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
    console.error("challenge_file error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
