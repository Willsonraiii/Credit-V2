# Yalambar Store — Daily Credit Tracker (v3)

A mobile-first PWA for managing customers, credit/payment transactions and
balances, built with React + Vite + Tailwind. Data storage has been migrated
from **Firebase Firestore** to **Supabase (Postgres)** — the app keeps the same
data, features and offline behavior.

The app now runs **entirely on Supabase**. The Firebase SDK, the legacy
`firebase.ts` layer and the one-time migration code have been removed.

---

## History: how the Firebase → Supabase switch happened (no data lost)

The migration was done in three steps, then Firebase was removed from the app:

1. `supabase/schema.sql` created the `customers`, `transactions`,
   `cloud_backups`, `cloud_backup_items` and `pos_users` tables.
2. A one-time in-app migration copied every Firestore document (including cloud
   backup subcollections) into Supabase — 16 customers, 55 transactions,
   4 POS users and 2 cloud backups, all verified field-by-field.
3. `src/db.ts` was flipped so **Supabase is the default for every device**, and
   the Firebase SDK + migration code were deleted.

Your Firebase project was left untouched and can be kept as a read-only backup.

### Project setup (already completed)

- **Tables:** run [`supabase/schema.sql`](supabase/schema.sql) once in the
  Supabase SQL Editor — already done for project `zpeihhsewpamzxuivawa`.
- **Balance/transaction fix functions:** run [`supabase/functions.sql`](supabase/functions.sql)
  once too. It makes every balance change atomic (fixes the "PAID/UNPAID keeps
  adding" drift and the delete-payment cleanup). The app falls back to a
  client-side recompute until you run it, but running it is recommended.
- **Keys:** the Project URL + anon/public key are set in `src/supabase.ts`
  (with `.env` as an override). The anon key is public by design; security
  comes from Row Level Security in `schema.sql`, not from hiding the key.

### Balance rules (how totals are calculated)

- A **credit** adds to the customer's balance until it is marked PAID.
- Marking a credit **PAID** removes it from the balance; UNPAID adds it back.
- A **payment** reduces the balance. If the payment exactly covers some
  unpaid credits, those credits are marked PAID and the payment isn't counted
  twice.
- The balance is always **recomputed from the transactions**, so it can't
  drift — the `customers.balance` column is a derived cache, and the "Repair"
  button re-derives it for every customer.

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
  db.ts          data-layer re-export (Supabase)
  supabase.ts    Supabase data layer (listeners, writes, backups, balances)
  types.ts       shared types (Timestamp, Customer, Transaction, CloudBackup)
  users.ts       local POS users/PINs
supabase/
  schema.sql     tables, RLS, realtime, balance RPC
  functions.sql  atomic balance/toggle/delete fixes (run once after schema.sql)
```
