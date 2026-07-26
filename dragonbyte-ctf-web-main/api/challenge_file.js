// api/challenge_file.js — GET /api/challenge_file?id=<challengeId>
// Streams a redirect to a short-lived signed URL for the file attached to a
// challenge. Challenges (and their files) are public info, same as the
// challenge list itself — no sign-in required, matching /api/challenges.
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

  } catch (err) {
    console.error("challenge_file error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
