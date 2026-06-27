// api/_firebase.js — shared Firebase Admin init

import { initializeApp, getApps, cert } from "firebase-admin/app";

export function initAdmin() {

  if (getApps().length) {
    return;
  }


  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n");


  if (!projectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID");
  }

  if (!clientEmail) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL");
  }

  if (!privateKey) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY");
  }


  initializeApp({

    credential: cert({

      projectId,

      clientEmail,

      privateKey

    })

  });

}