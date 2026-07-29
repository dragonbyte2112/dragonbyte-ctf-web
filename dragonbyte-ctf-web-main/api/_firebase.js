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
    // Used for challenge/room file attachments (Firebase Storage).
    // Falls back to this project's default bucket if FIREBASE_STORAGE_BUCKET isn't set.
    // Firebase projects created since ~Oct 2024 default to <project-id>.firebasestorage.app
    // (older projects use <project-id>.appspot.com — set FIREBASE_STORAGE_BUCKET explicitly if so).
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
  });
}
