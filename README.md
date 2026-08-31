# Yalambar Store — Daily Credit Tracker (v3)

A mobile-first PWA for managing customers, credit/payment transactions and
balances, built with React + Vite + Tailwind. Data storage has been migrated
from **Firebase Firestore** to **Supabase (Postgres)** — the app keeps the same
data, features and offline behavior.

---

## Switching from Firebase to Supabase (without losing data)

The app ships with **both** backends wired up:

- `src/firebase.ts` — the original Firestore layer (kept as the read source for
  the one-time migration and as an automatic fallback).
- `src/supabase.ts` — the new Supabase layer.
- `src/db.ts` — a dispatcher that routes every call to the active backend.

Out of the box the app still runs on Firebase exactly as before. You switch to
Supabase in three steps:

### Step 1 — Create a Supabase project and tables

1. Go to <https://supabase.com> → **New project** (free tier is fine).
2. Pick a name, set a strong database password, choose a region close to you
   (e.g. Singapore / Mumbai) and click **Create project**.
3. Open **SQL Editor** → **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.

   This creates the `customers`, `transactions`, `cloud_backups`,
   `cloud_backup_items` and `pos_users` tables, an atomic balance function,
   row-level security policies and the realtime publication.

### Step 2 — Add your project keys to the app

1. In Supabase Dashboard → **Project Settings → API**, copy the **Project URL**
   and the **anon (public) key**.
2. Create a `.env` file in the repo root (copy `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. Fill in the two values, then build/deploy the app as usual:

   ```bash
   npm install
   npm run build
   ```

   The `anon` key is meant to be public — security comes from the Row Level
   Security policies in `schema.sql`, not from hiding the key.

### Step 3 — Run the one-time migration (inside the app)

1. Open the app and sign in as an **admin**.
2. Go to **Settings → Data Backend**.
3. Click **Migrate to Supabase**.

The app reads every customer, transaction, POS user and cloud backup (including
backup subcollections) from Firebase and copies them into Supabase, then
reloads itself running on Supabase. Your Firebase data is **not modified**, so
you can re-run the migration or roll back any time.

> Safety tip: keep the Firebase project until you've confirmed everything looks
> right on Supabase. If you ever want to switch back, clear the
> `yalambar_backend_v1` key in the browser's localStorage (or run this in the
> console: `localStorage.removeItem("yalambar_backend_v1")`).

---

## Development

```bash
npm install      # install dependencies
npm run dev      # local dev server
npm run build    # production build (single-file bundle in dist/)
npm run preview  # preview the production build
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds the app and deploys the
`dist/` folder to GitHub Pages at `yalambarcredit.willsonrai.com.np` on every
push to `main`.

For Supabase, make sure the two `VITE_*` values are available at build time in
your CI (e.g. add them as repository **Secrets/variables** and reference them,
or commit a `.env` — the anon key is public by design).

## Security notes

The PIN login is a local (device-only) gate for the UI. The actual data
protection is the backend's Row Level Security. The shipped `schema.sql` uses
permissive "allow all" policies so the app works immediately — before using this
in production, consider tightening them (e.g. restrict writes to authenticated
users and enable Supabase Auth), and disable the open policies.

## Project structure

```
src/
  App.tsx        main UI (dashboard, customers, transactions, settings, admin)
  Login.tsx      PIN login screen
  db.ts          backend dispatcher (firebase ↔ supabase)
  firebase.ts    legacy Firestore data layer (kept for migration/fallback)
  supabase.ts    Supabase data layer
  migrate.ts     one-time Firestore → Supabase migration
  types.ts       shared types (Timestamp, Customer, Transaction, CloudBackup)
  users.ts       local POS users/PINs
supabase/
  schema.sql     tables, RLS, realtime, balance RPC
```
