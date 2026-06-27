import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function hashFlag(f) { return crypto.createHash("sha256").update(f.trim()).digest("hex"); }

export default async function handler(req, res) {
  if (!["GET","POST"].includes(req.method)) return res.status(405).json({ detail: "Method not allowed" });
  if (!process.env.SEED_SECRET || req.query.secret !== process.env.SEED_SECRET) return res.status(403).json({ detail: "Forbidden" });
  try {
    initAdmin();
    const db = getFirestore();
    const existing = await db.collection("challenges").limit(1).get();
    if (!existing.empty) return res.status(200).json({ message: "Already seeded.", count: 0 });
    const filePath = path.join(process.cwd(), "challenges_seed.json");
    const challenges = JSON.parse(fs.readFileSync(filePath, "utf8"));
    let count = 0;
    for (let i = 0; i < challenges.length; i += 400) {
      const batch = db.batch();
      for (const c of challenges.slice(i, i + 400)) {
        batch.set(db.collection("challenges").doc(String(c.id)), { title:c.title, category:c.category, category_key:c.category_key, description:c.description, code_snippet:c.code_snippet||null, code_lang:c.code_lang||null, difficulty:c.difficulty, points:c.points, flag_hash:hashFlag(c.flag), hints:c.hints||[] });
        count++;
      }
      await batch.commit();
    }
    return res.status(200).json({ message: `Seeded ${count} challenges.`, count });
  } catch (err) { console.error("SEED ERROR:", err); return res.status(500).json({ detail: err.message }); }
}
