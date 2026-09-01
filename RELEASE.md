# 🚀 Release Checklist — Firebase → Supabase migration (final publish)

This project has been migrated from Firebase Firestore to Supabase.
The code is finished and committed locally on branch `arena/01a0569b-credit-v2`.
Use this checklist to publish it to the live site.

---

## ✅ Already done (no action needed)

- [x] Supabase project created: `zpeihhsewpamzxuivawa`
- [x] Tables created via `supabase/schema.sql` (customers, transactions,
      cloud_backups, cloud_backup_items, pos_users)
- [x] Data migrated from Firebase → Supabase (16 customers, 55 transactions,
      4 users, 2 backups — verified)
- [x] Firebase SDK + legacy `firebase.ts`/`migrate.ts` removed
- [x] Balance/paid calculation logic fixed (atomic recompute)
- [x] Premium UI polish applied
- [x] Code committed locally (`455347f` on `arena/01a0569b-credit-v2`)

---

## ⏳ Step 1 — Run the balance-fix SQL (one time, manual)

1. Open Supabase Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of `supabase/functions.sql`.
3. Click **Run** → expect green **"Success. No rows returned"**.

This installs the atomic functions (`toggle_credit_paid`,
`delete_transaction_fix`, `recompute_all_balances`,
`set_customer_balance_from_transactions`) that prevent the "PAID/UNPAID keeps
adding" balance drift. The app has a client-side fallback, so this is safe to
do before or after deploying.

## ⏳ Step 2 — Publish the code to GitHub (one push + merge)

Open a **new Arena session** on this repo and paste:

```
Push branch arena/01a0569b-credit-v2 to GitHub, open a PR to main, and merge it.
```

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to
`yalambarcredit.willsonrai.com.np` automatically on merge to `main`.

## ✅ Step 3 — Verify (after deploy)

- [ ] Live site loads: https://yalambarcredit.willsonrai.com.np
- [ ] Sign in as admin (Wilson / `1111` by default)
- [ ] Toggle a credit PAID → UNPAID → PAID and confirm the customer balance
      doesn't keep adding
- [ ] Add a payment that covers a credit → confirm the credit auto-marks PAID
- [ ] Confirm the new premium UI (glowing tab bar, gradient buttons, login glow)

---

## 🔐 Optional hardening (later)

- [ ] Enable Supabase Auth and tighten RLS (currently open `using (true)`)
- [ ] Lock the old Firebase project (`allow read, write: if false`)
- [ ] Enable offline caching if needed

## 📁 Key files

- `supabase/schema.sql` — tables, RLS, realtime
- `supabase/functions.sql` — atomic balance fixes (run manually once)
- `src/supabase.ts` — data layer
- `src/db.ts` — re-export (Supabase only)
- `src/App.tsx`, `src/Login.tsx`, `src/index.css` — UI
