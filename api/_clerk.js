// api/_clerk.js — shared Clerk JWT helper for all serverless functions
import { createClerkClient } from "@clerk/backend";

let _clerk = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

export async function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ detail: "Not authenticated" }); return null; }
  try {
    const clerk   = getClerk();
    const payload = await clerk.verifyToken(auth.slice(7));
    const user    = await clerk.users.getUser(payload.sub);
    const username = user.username || user.firstName || user.emailAddresses?.[0]?.emailAddress || "Player";
    return { userId: payload.sub, username };
  } catch { res.status(401).json({ detail: "Invalid or expired token" }); return null; }
}

export async function optionalAuth(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const clerk   = getClerk();
    const payload = await clerk.verifyToken(auth.slice(7));
    const user    = await clerk.users.getUser(payload.sub);
    const username = user.username || user.firstName || user.emailAddresses?.[0]?.emailAddress || "Player";
    return { userId: payload.sub, username };
  } catch { return null; }
}
