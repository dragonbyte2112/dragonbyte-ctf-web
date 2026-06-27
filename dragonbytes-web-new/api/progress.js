import { getFirestore } from "firebase-admin/firestore";
import { initAdmin }    from "./_firebase.js";
import { requireAuth }  from "./_clerk.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = await requireAuth(req, res); if (!user) return;

  try {
    initAdmin();
    const db = getFirestore();

    if (req.method === "POST") {
      const sv = await db.collection("solves").where("userId", "==", user.userId).get();
      const hv = await db.collection("hintUsage").where("userId", "==", user.userId).get();
      const batch = db.batch();
      sv.docs.forEach(d => batch.delete(d.ref));
      hv.docs.forEach(d => batch.delete(d.ref));
      batch.set(db.collection("users").doc(user.userId), { score: 0, solvedCount: 0 }, { merge: true });
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    const chalSnap = await db.collection("challenges").get();
    const totalsByCat = {};
    chalSnap.docs.forEach(d => { const k = d.data().category_key; totalsByCat[k] = (totalsByCat[k]||0)+1; });

    const sv = await db.collection("solves").where("userId", "==", user.userId).get();
    let score = 0; const solvedByCat = {};
    sv.docs.forEach(d => {
      const { points, challengeId } = d.data(); score += points||0;
      const c = chalSnap.docs.find(x => x.id === challengeId);
      if (c) { const k = c.data().category_key; solvedByCat[k] = (solvedByCat[k]||0)+1; }
    });

    const category_progress = {};
    for (const [k,total] of Object.entries(totalsByCat)) category_progress[k] = { solved: solvedByCat[k]||0, total };
    return res.status(200).json({ score, solved_count: sv.size, total_challenges: chalSnap.size, category_progress });
  } catch (err) { console.error(err); return res.status(500).json({ detail: "Internal server error" }); }
}
