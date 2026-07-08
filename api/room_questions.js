import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.js";
import { optionalAuth } from "./_auth.js";
import { requireAdmin } from "./_admin.js";
import crypto from "crypto";

function hashFlag(f) {
  return crypto.createHash("sha256").update(f.trim()).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  initAdmin();
  const db = getFirestore();
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ detail: "Missing roomId" });
  const roomRef = db.collection("rooms").doc(String(roomId));

  // ── List questions in the room, with per-user solved/hint state ──
  if (req.method === "GET") {
    try {
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return res.status(404).json({ detail: "Room not found." });

      const user = await optionalAuth(req);
      const qSnap = await roomRef.collection("questions").orderBy("points").get();

      let solvedIds = new Set(), hintsRevealed = {};
      if (user) {
        const sv = await roomRef.collection("solves").where("userId", "==", user.userId).get();
        solvedIds = new Set(sv.docs.map(d => d.data().questionId));
        const hv = await roomRef.collection("hints").where("userId", "==", user.userId).get();
        for (const d of hv.docs) {
          const { questionId, hintLevel } = d.data();
          hintsRevealed[questionId] = Math.max(hintsRevealed[questionId] || 0, hintLevel);
        }
      }

      const questions = qSnap.docs.map(d => {
        const q = d.data();
        const hints = q.hints || [];
        const rc = hintsRevealed[d.id] || 0;
        return {
          id: d.id,
          title: q.title,
          description: q.description,
          code_snippet: q.code_snippet || null,
          code_lang: q.code_lang || null,
          difficulty: q.difficulty || "Medium",
          points: q.points || 0,
          solved: solvedIds.has(d.id),
          total_hints: hints.length,
          hints_revealed: rc,
          revealed_hints: hints.slice(0, rc),
        };
      });

      return res.status(200).json({ room: { id: roomDoc.id, ...roomDoc.data() }, questions });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  // ── Add a question to the room (admin only) ──
  if (req.method === "POST") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { title, description, difficulty, points, flag, hints, code_snippet, code_lang } = req.body || {};
    if (!title || !description || !flag) {
      return res.status(400).json({ detail: "title, description and flag are required." });
    }
    try {
      const roomDoc = await roomRef.get();
      if (!roomDoc.exists) return res.status(404).json({ detail: "Room not found." });
      const ref = await roomRef.collection("questions").add({
        title: String(title).trim(),
        description: String(description).trim(),
        difficulty: difficulty || "Medium",
        points: Number(points) || 100,
        flag_hash: hashFlag(String(flag)),
        hints: Array.isArray(hints) ? hints.filter(Boolean) : [],
        code_snippet: code_snippet || null,
        code_lang: code_lang || null,
      });
      return res.status(200).json({ id: ref.id });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  // ── Delete a single question from the room (admin only) ──
  if (req.method === "DELETE") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { questionId } = req.query;
    if (!questionId) return res.status(400).json({ detail: "Missing questionId" });
    try {
      await roomRef.collection("questions").doc(String(questionId)).delete();
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  return res.status(405).json({ detail: "Method not allowed" });
}
