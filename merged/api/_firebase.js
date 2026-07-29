// api/_firebase.js — Firebase Admin SDK initializer (singleton)
import { initializeApp, getApps, cert } from "firebase-admin/app";

export function initAdmin() {
  if (getApps().length > 0) return; // already initialized — skip
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) throw new Error("FIREBASE_PRIVATE_KEY env var is missing.");
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores \n literally — convert back to real newlines
      privateKey:  privateKey.replace(/\\n/g, "\n"),
    }),
  });
}
