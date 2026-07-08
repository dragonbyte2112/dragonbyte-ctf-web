// api/seed.js — GET /api/seed?secret=YOUR_SEED_SECRET
// Run ONCE after deployment to populate Firestore with all challenges.
// Guarded by SEED_SECRET env var. Safe to call again — checks if already seeded.
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { cors }         from "./_auth.js";
import crypto           from "crypto";
import fs               from "fs";
import path             from "path";

function hashFlag(f) {
  return crypto.createHash("sha256").update(f.trim()).digest("hex");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // Secret guard — required
  const secret = process.env.SEED_SECRET;
  if (!secret || req.query.secret !== secret)
    return res.status(403).json({ detail: "Forbidden — wrong or missing secret." });

  try {
    initAdmin();
    const db = getFirestore();

    // Idempotency check — don't re-seed if challenges exist
    const existing = await db.collection("challenges").limit(1).get();
    if (!existing.empty)
      return res.status(200).json({ message: "Already seeded — no changes made.", count: 0 });

    // Load seed data from project root
    const filePath   = path.join(process.cwd(), "challenges_seed.json");
    const challenges = JSON.parse(fs.readFileSync(filePath, "utf8"));

    let count = 0;
    // Firestore batch limit = 500 writes; use 400 to stay safe
    for (let i = 0; i < challenges.length; i += 400) {
      const batch = db.batch();
      for (const c of challenges.slice(i, i + 400)) {
        const ref = db.collection("challenges").doc(String(c.id));
        batch.set(ref, {
          title:        c.title,
          category:     c.category,
          category_key: c.category_key,
          description:  c.description,
          code_snippet: c.code_snippet  || null,
          code_lang:    c.code_lang     || null,
          difficulty:   c.difficulty,
          points:       c.points,
          flag_hash:    hashFlag(c.flag),   // NEVER store raw flag
          hints:        c.hints || [],
        });
        count++;
      }
      await batch.commit();
    }

    // Create Firestore index hints (comment only — configure in console)
    return res.status(200).json({
      message: `Seeded ${count} challenges successfully.`,
      count,
      next_step: "Create Firestore composite indexes — see SETUP.md for details.",
    });

  } catch (err) {
    console.error("SEED ERROR:", err);
    return res.status(500).json({ detail: err.message });
  }
}
