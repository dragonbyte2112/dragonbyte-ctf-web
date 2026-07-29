// api/_auth.js — Firebase ID token verification
// The frontend signs in with Firebase Auth (email/Google/GitHub) and sends
// the Firebase ID token in the Authorization header. We verify it here
// with the Firebase Admin SDK — no Clerk needed.
import { initAdmin } from "./_firebase.js";
import { getAuth }   from "firebase-admin/auth";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
}

export { cors };

export async function requireAuth(req, res) {
  const header = (req.headers["authorization"] || "").trim();
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ detail: "Not authenticated — please sign in." });
    return null;
  }
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return {
      userId:   decoded.uid,
      username: decoded.name || (decoded.email ? decoded.email.split("@")[0] : decoded.uid),
      email:    decoded.email || null,
    };
  } catch (err) {
    console.error("Token verification failed:", err.code, err.message);
    res.status(401).json({ detail: "Session expired — please sign in again." });
    return null;
  }
}

export async function optionalAuth(req) {
  const header = (req.headers["authorization"] || "").trim();
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return {
      userId:   decoded.uid,
      username: decoded.name || (decoded.email ? decoded.email.split("@")[0] : decoded.uid),
      email:    decoded.email || null,
    };
  } catch {
    return null;
  }
}
