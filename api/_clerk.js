// api/_clerk.js — Firebase JWT verification (replaces Clerk)
import { initAdmin } from "./_firebase.js";
import { getAuth } from "firebase-admin/auth";

export async function requireAuth(req, res) {
  const header = req.headers["authorization"] || "";
  const token = header.replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ detail: "Not authenticated" }); return null; }
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return { userId: decoded.uid, username: decoded.name || decoded.email || decoded.uid };
  } catch (err) {
    res.status(401).json({ detail: "Invalid token" });
    return null;
  }
}