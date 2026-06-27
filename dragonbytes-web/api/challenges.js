import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { optionalAuth } from "./_clerk.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  try {
    initAdmin();
    const db   = getFirestore();
    const user = await optionalAuth(req);
    const { category, difficulty, random } = req.query;

    let query = db.collection("challenges");
    if (category && category !== "all") query = query.where("category_key", "==", category);
    if (difficulty && difficulty !== "All") query = query.where("difficulty", "==", difficulty);

    const snapshot   = await query.get();
    let challenges   = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    let solvedIds = new Set(), hintsRevealed = {};
    if (user) {
      const sv = await db.collection("solves").where("userId", "==", user.userId).get();
      solvedIds = new Set(sv.docs.map(d => d.data().challengeId));
      const hv  = await db.collection("hintUsage").where("userId", "==", user.userId).get();
      for (const d of hv.docs) {
        const { challengeId, hintLevel } = d.data();
        hintsRevealed[challengeId] = Math.max(hintsRevealed[challengeId] || 0, hintLevel);
      }
    }

    const toPublic = ch => {
      const hints = ch.hints || [], rc = hintsRevealed[ch.id] || 0;
      return { id: ch.id, title: ch.title, category: ch.category, category_key: ch.category_key,
        description: ch.description, code_snippet: ch.code_snippet || null, code_lang: ch.code_lang || null,
        difficulty: ch.difficulty, points: ch.points, solved: solvedIds.has(ch.id),
        total_hints: hints.length, hints_revealed: rc, revealed_hints: hints.slice(0, rc) };
    };

    if (random === "1") {
      if (!challenges.length) return res.status(404).json({ detail: "No challenges match that filter." });
      return res.status(200).json(toPublic(challenges[Math.floor(Math.random() * challenges.length)]));
    }

    challenges.sort((a, b) => a.category_key < b.category_key ? -1 : a.category_key > b.category_key ? 1 : a.points - b.points);
    return res.status(200).json(challenges.map(toPublic));
  } catch (err) { console.error(err); return res.status(500).json({ detail: "Internal server error" }); }
}
