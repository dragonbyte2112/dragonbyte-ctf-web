import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.js";
import { optionalAuth } from "./_auth.js";
import { requireAdmin } from "./_admin.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  initAdmin();
  const db = getFirestore();

  // ── List rooms (public — anyone can browse; logged-in users also get their own score) ──
  if (req.method === "GET") {
    try {
      const snap = await db.collection("rooms").orderBy("createdAt", "desc").get();
      const user = await optionalAuth(req);
      const rooms = [];
      for (const d of snap.docs) {
        const r = d.data();
        const qSnap = await db.collection("rooms").doc(d.id).collection("questions").get();
        let myScore = 0, mySolved = 0;
        if (user) {
          const scoreDoc = await db.collection("rooms").doc(d.id).collection("scores").doc(user.userId).get();
          if (scoreDoc.exists) {
            myScore = scoreDoc.data().score || 0;
            mySolved = scoreDoc.data().solvedCount || 0;
          }
        }
        rooms.push({
          id: d.id,
          name: r.name,
          description: r.description || "",
          status: r.status || "active",
          questionCount: qSnap.size,
          myScore,
          mySolved,
        });
      }
      return res.status(200).json(rooms);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  // ── Create room (admin only) ──
  if (req.method === "POST") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ detail: "Room name is required." });
    try {
      const ref = await db.collection("rooms").add({
        name: name.trim(),
        description: (description || "").trim(),
        status: "active",
        createdBy: admin.userId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ id: ref.id, name: name.trim(), description: (description || "").trim(), status: "active" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  // ── Delete room (admin only) — cascades and permanently removes questions/solves/hints/scores ──
  if (req.method === "DELETE") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ detail: "Missing roomId" });
    try {
      const ref = db.collection("rooms").doc(String(roomId));
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ detail: "Room not found." });
      await db.recursiveDelete(ref);
      return res.status(200).json({ ok: true, message: "Room and all of its data were deleted." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ detail: "Internal server error" });
    }
  }

  return res.status(405).json({ detail: "Method not allowed" });
}
