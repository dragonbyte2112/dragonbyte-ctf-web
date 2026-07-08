// api/_admin.js — restricts room-management actions to configured admin emails
import { requireAuth } from "./_auth.js";

function adminList() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

// Call after requireAuth-style checks. Sends 403 and returns null if the
// signed-in user is not on the ADMIN_EMAILS allowlist.
export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null; // requireAuth already responded (401)

  const admins = adminList();
  const email = (user.email || "").toLowerCase();

  if (!admins.length || !email || !admins.includes(email)) {
    res.status(403).json({ detail: "Admin access required." });
    return null;
  }
  return user;
}

export function isAdminEmail(email) {
  const admins = adminList();
  return !!email && admins.includes(String(email).toLowerCase());
}
