import { requireAuth } from "./_auth.js";
import { isAdminEmail } from "./_admin.js";
import { initAdmin } from "./_firebase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ detail: "Method not allowed" });

  initAdmin();
  const user = await requireAuth(req, res);
  if (!user) return;

  return res.status(200).json({
    username: user.username,
    email: user.email || null,
    isAdmin: isAdminEmail(user.email),
  });
}
