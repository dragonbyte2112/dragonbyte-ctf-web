# Dragon Byte CTF — Complete Setup Guide

## What's in this project

| File | Purpose |
|---|---|
| `frontend/index.html` | Full single-page app (HTML) |
| `frontend/js/app.js` | All frontend logic — auth, API calls, UI |
| `frontend/js/data.js` | Static community content (team, events, etc.) |
| `frontend/css/style.css` | Dragon Byte design system |
| `api/challenges.js` | GET /api/challenges |
| `api/submit.js` | POST /api/submit |
| `api/hint.js` | POST /api/hint |
| `api/leaderboard.js` | GET /api/leaderboard |
| `api/progress.js` | GET/POST /api/progress |
| `api/seed.js` | Populate Firestore with challenges (run once) |
| `api/_firebase.js` | Firebase Admin SDK init (shared) |
| `api/_auth.js` | Firebase ID token verification (shared) |
| `challenges_seed.json` | All 50 CTF challenge definitions |
| `vercel.json` | Routing config |

---

## STEP 1 — Firebase Console Setup (10 min)

### 1a. Create the Firebase project (if not already done)
1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `dragonbytes-ctf`
3. Enable Google Analytics if you like → Create project

### 1b. Enable Firebase Auth
1. In the sidebar: **Authentication** → **Get started**
2. Enable these sign-in providers:
   - **Email/Password** → Enable → Save
   - **Google** → Enable → set support email → Save
   - **GitHub** → Enable → paste Client ID + Secret from GitHub OAuth app → Save
     - To get GitHub credentials: github.com → Settings → Developer settings → OAuth Apps → New OAuth App
     - Homepage URL: `https://your-project.vercel.app`
     - Callback URL: `https://dragonbytes-ctf.firebaseapp.com/__/auth/handler`

### 1c. Enable Firestore
1. In sidebar: **Firestore Database** → **Create database**
2. Choose **Production mode** → Select a region (e.g. `asia-south1` for India)
3. Click **Enable**

### 1d. Set Firestore Security Rules
In Firestore → Rules tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Challenges: anyone can read (authenticated or not)
    match /challenges/{id} {
      allow read: if true;
      allow write: if false;  // only seeded via Admin SDK
    }

    // Solves: users can read their own, write via backend only
    match /solves/{id} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow write: if false;
    }

    // Hint usage: same
    match /hintUsage/{id} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow write: if false;
    }

    // Users (leaderboard): anyone can read, write via backend only
    match /users/{uid} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### 1e. Create Firestore Composite Indexes
In Firestore → Indexes → Composite → Add index:

**Index 1** (for category+difficulty filtering):
- Collection: `challenges`
- Fields: `category_key` ASC, `difficulty` ASC, `__name__` ASC

**Index 2** (for user solves):
- Collection: `solves`
- Fields: `userId` ASC, `solvedAt` DESC

**Index 3** (for hint usage):
- Collection: `hintUsage`
- Fields: `userId` ASC, `challengeId` ASC

### 1f. Get Service Account credentials
1. Firebase Console → Project Settings (gear icon) → **Service accounts** tab
2. Click **Generate new private key** → Download JSON
3. Open the JSON file — you need:
   - `project_id`
   - `client_email`
   - `private_key` (the long string with `-----BEGIN PRIVATE KEY-----`)

---

## STEP 2 — Deploy to Vercel (5 min)

### 2a. Push to GitHub
```bash
git init
git add .
git commit -m "Dragon Byte CTF v2"
git remote add origin https://github.com/YOUR_USERNAME/dragonbytes-ctf.git
git push -u origin main
```

### 2b. Import to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework Preset: **Other**
4. Root Directory: leave blank (project root)
5. Click **Deploy**

### 2c. Add Environment Variables in Vercel
Go to: Project → Settings → Environment Variables

Add these three:

| Name | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | `dragonbytes-ctf` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@dragonbytes-ctf.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | The full private key string including `-----BEGIN PRIVATE KEY-----` etc. |
| `SEED_SECRET` | Any secret string, e.g. `dragon-seed-2025` |

**Important for FIREBASE_PRIVATE_KEY:**
- Paste the entire value from the JSON including the header/footer
- Vercel stores `\n` as literal backslash-n — our code converts it back automatically

After adding variables → **Redeploy** (Deployments → Redeploy latest)

---

## STEP 3 — Seed Firestore with challenges (1 min)

Once deployed, visit this URL in your browser:

```
https://YOUR-PROJECT.vercel.app/api/seed?secret=dragon-seed-2025
```

You should see:
```json
{ "message": "Seeded 50 challenges successfully.", "count": 50 }
```

If it says "Already seeded", you're good — it won't re-seed.

---

## STEP 4 — Add authorized domains to Firebase Auth

1. Firebase Console → Authentication → Settings → **Authorized domains**
2. Add your Vercel domain: `your-project.vercel.app`
3. Also add any custom domain if you have one

---

## STEP 5 — Test everything

1. Open `https://your-project.vercel.app`
2. Click **Register Free** → create an account
3. Go to **CTF Arena** → Generate a challenge
4. Submit the correct flag from `challenges_seed.json`
5. Check **Leaderboard** — your score should appear
6. Click **Reveal Hint** — hint should show

---

## Local development

```bash
npm install
npm install -g vercel

# Create .env.local with your Firebase credentials:
cp .env.example .env.local
# Edit .env.local with real values

vercel dev
# Opens at http://localhost:3000
```

---

## Firestore data structure

```
challenges/
  {id}/
    title, category, category_key, description
    code_snippet, code_lang, difficulty, points
    flag_hash (SHA-256, never the raw flag)
    hints: [string, string, string]

solves/
  {userId}_{challengeId}/
    userId, challengeId, solvedAt, points

hintUsage/
  {userId}_{challengeId}_{level}/
    userId, challengeId, hintLevel, revealedAt

users/
  {userId}/
    username, score, solvedCount, lastActive
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Not authenticated" on submit | Firebase Auth token expired — sign out and sign in again |
| "Internal server error" on any API | Check Vercel Function Logs (Project → Functions tab) |
| Leaderboard empty | Firestore `users` collection needs at least one solve |
| Seed returns 500 | Check FIREBASE_* env vars are correct in Vercel |
| Google/GitHub login popup blocked | Browser blocked the popup — allow popups for the site |
| Category filter returns wrong challenges | Add the composite Firestore index (Step 1e) |

