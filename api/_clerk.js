// api/_clerk.js — Firebase JWT verification
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
    console.error("Token verification failed:", err.code, err.message);
    res.status(401).json({ detail: "Invalid token" });
    return null;
  }
}

export async function optionalAuth(req) {
  const header = req.headers["authorization"] || "";
  const token = header.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return { userId: decoded.uid, username: decoded.name || decoded.email || decoded.uid };
  } catch (err) {
    return null;
  }
}