# QR / Barcode Record Capture — Supabase + Vercel

Static single-page app. Login via Supabase Auth (email + password); each scan is
saved to your Supabase database and protected by row-level security so every
account only sees its own records.

```
qr-scanner-supabase-deploy/
├── index.html          # the app
├── supabase-setup.sql  # run once in Supabase SQL Editor
├── vercel.json         # static config + camera permission header
└── README.md
```

## Step 1 — Create the database table
Supabase Dashboard → SQL Editor → New query → paste `supabase-setup.sql` → Run.
(Optional, for an internal tool: Authentication → Providers → Email →
turn OFF "Confirm email" so users can sign in right after sign-up.)

## Step 2 — Add your project keys
Open `index.html`, find the CONFIG block near the top of the `<script>` and fill in:
```js
var SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
var SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
```
Both come from Dashboard → Project Settings → API Keys / Data API.
The anon key is public by design — security is enforced by row-level security.

## Step 3 — Deploy to Vercel
```bash
npm i -g vercel
cd qr-scanner-supabase-deploy
vercel            # preview
vercel --prod     # production
```
Framework preset = **Other**, leave Build Command and Output Directory empty.

## Step 4 — Allow your Vercel domain in Supabase
Dashboard → Authentication → URL Configuration → add your
`https://<app>.vercel.app` to Site URL / Redirect URLs.

## Notes
- Camera needs HTTPS at the top level — works on the Vercel URL, not inside embedded previews.
- Records load newest-first (up to 2000). "Ignore duplicate codes" checks against
  everything already saved for the account; turn it off to allow repeats.
- The green/amber/red dot next to each code = saved / saving / save failed.
