// api/challenges.js — GET /api/challenges
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { cors, optionalAuth } from "./_auth.js";

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ detail: "Method not allowed" });

  try {
    initAdmin();
    const db   = getFirestore();
    const user = await optionalAuth(req);
    const { category, difficulty, random } = req.query;

    // Build Firestore query
    let q = db.collection("challenges");
    if (category && category !== "all") q = q.where("category_key", "==", category);
    if (difficulty && difficulty !== "All") q = q.where("difficulty", "==", difficulty);

    const snap       = await q.get();
    let challenges   = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch this user's solved + hints (if signed in)
    let solvedIds = new Set(), hintsRevealed = {};
    if (user) {
      const [sv, hv] = await Promise.all([
        db.collection("solves").where("userId", "==", user.userId).get(),
        db.collection("hintUsage").where("userId", "==", user.userId).get(),
      ]);
      solvedIds = new Set(sv.docs.map(d => d.data().challengeId));
      for (const d of hv.docs) {
        const { challengeId, hintLevel } = d.data();
        hintsRevealed[challengeId] = Math.max(hintsRevealed[challengeId] || 0, hintLevel);
      }
    }

    // Strip flag_hash before sending to client
    const toPublic = ch => {
      const hints = ch.hints || [];
      const rc    = hintsRevealed[ch.id] || 0;
      return {
        id:             ch.id,
        title:          ch.title,
        category:       ch.category,
        category_key:   ch.category_key,
        description:    ch.description,
        code_snippet:   ch.code_snippet  || null,
        code_lang:      ch.code_lang     || null,
        difficulty:     ch.difficulty,
        points:         ch.points,
        solved:         solvedIds.has(ch.id),
        total_hints:    hints.length,
        hints_revealed: rc,
        revealed_hints: hints.slice(0, rc),
      };
    };

    // Random single challenge (for Generate button)
    if (random === "1") {
      if (!challenges.length)
        return res.status(404).json({ detail: "No challenges match that filter." });
      const ch = challenges[Math.floor(Math.random() * challenges.length)];
      return res.status(200).json(toPublic(ch));
    }

    // Full sorted list
    challenges.sort((a, b) =>
      a.category_key < b.category_key ? -1 :
      a.category_key > b.category_key ?  1 :
      a.points - b.points
    );
    return res.status(200).json(challenges.map(toPublic));

  } catch (err) {
    console.error("challenges error:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
}
