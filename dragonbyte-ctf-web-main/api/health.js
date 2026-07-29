import { initAdmin } from "./_firebase.js";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Visit /api/health locally or in prod to check that env vars are loaded
// and Firebase Admin can actually reach Firestore + Auth. Never exposes
// secret values — only whether each is present and whether the connection works.
export default async function handler(req, res) {
  const report = {
    env_present: {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      SEED_SECRET: !!process.env.SEED_SECRET,
      ADMIN_EMAILS: !!process.env.ADMIN_EMAILS,
    },
    firebase_init: null,
    firestore_read: null,
    auth_reachable: null,
  };

  try {
    initAdmin();
    report.firebase_init = "ok";
  } catch (err) {
    report.firebase_init = `FAILED: ${err.message}`;
    return res.status(500).json(report);
  }

  try {
    await getFirestore().collection("challenges").limit(1).get();
    report.firestore_read = "ok";
  } catch (err) {
    report.firestore_read = `FAILED: ${err.code || ""} ${err.message}`;
  }

  try {
    // listUsers is a cheap way to confirm the Auth Admin API is reachable
    // with these credentials without needing a real token.
    await getAuth().listUsers(1);
    report.auth_reachable = "ok";
  } catch (err) {
    report.auth_reachable = `FAILED: ${err.code || ""} ${err.message}`;
  }

  const allOk = report.firebase_init === "ok" && report.firestore_read === "ok" && report.auth_reachable === "ok";
  return res.status(allOk ? 200 : 500).json(report);
}
