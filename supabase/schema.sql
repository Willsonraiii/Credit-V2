-- ============================================================================
-- Yalambar Store — Credit Tracker: Supabase schema
--
-- Run this ONCE in your Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- It creates the tables that mirror the old Firestore collections, the
-- realtime publication (for live updates) and an atomic balance helper used
-- by the app. Data itself is copied over by the in-app "Migrate to Supabase"
-- button, NOT by this file.
-- ============================================================================

-- ── customers ────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id                 text primary key,
  name               text not null,
  name_np            text,
  phone              text,
  address            text,
  notes              text default '',
  status             text default 'active',
  credit_limit       numeric default 1000,
  balance            numeric default 0,
  created_at         timestamptz,
  added_by           text,
  added_by_name      text,
  last_edited_by     text,
  last_edited_by_name text,
  user_code          text
);

-- ── transactions ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id                    text primary key,
  customer_id           text references public.customers (id) on delete cascade,
  type                  text not null,          -- 'credit' | 'payment'
  amount                numeric not null default 0,
  description           text default '',
  note                  text,
  date                  timestamptz,
  created_at            timestamptz,
  created_by            text,
  created_by_name       text,
  user_code             text,
  paid                  boolean default false,
  paid_at               timestamptz,
  paid_by               text,
  paid_by_name          text,
  paid_by_payment_id    text,
  applied_to_credit_ids text[] default '{}',
  auto_applied          boolean default false,
  secured               boolean default false,
  secured_at            timestamptz,
  secured_by            text,
  secured_by_name       text
);

create index if not exists transactions_customer_id_idx on public.transactions (customer_id);
create index if not exists transactions_date_idx on public.transactions (date desc);

-- ── cloud backups (mirrors the old cloudBackups collection + subcollections) ──
create table if not exists public.cloud_backups (
  id                 text primary key,
  created_at         timestamptz,
  created_by         text,
  created_by_name    text,
  label              text,
  customer_count     integer default 0,
  transaction_count  integer default 0,
  version            text
);

create table if not exists public.cloud_backup_items (
  backup_id text references public.cloud_backups (id) on delete cascade,
  kind      text not null,        -- 'customer' | 'transaction'
  doc_id    text not null,
  data      jsonb not null,
  primary key (backup_id, kind, doc_id)
);

-- ── POS users ────────────────────────────────────────────────────────────────
create table if not exists public.pos_users (
  id         text primary key,
  name       text,
  pin        text,
  is_admin   boolean default false,
  updated_at timestamptz
);

-- ── Atomic balance helper ────────────────────────────────────────────────────
-- Used by the app instead of client-side read-modify-write, so concurrent
-- updates can't overwrite each other.
create or replace function public.increment_customer_balance(
  p_customer_id text,
  p_delta numeric
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.customers
     set balance = coalesce(balance, 0) + p_delta
   where id = p_customer_id;
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- NOTE: These permissive policies allow full access for the anon/authenticated
-- roles so the app works straight away (same trust level as the previous
-- open Firestore rules). Tighten them before production — see README.
alter table public.customers          enable row level security;
alter table public.transactions       enable row level security;
alter table public.cloud_backups      enable row level security;
alter table public.cloud_backup_items enable row level security;
alter table public.pos_users          enable row level security;

create policy "customers_all"          on public.customers          for all using (true) with check (true);
create policy "transactions_all"       on public.transactions       for all using (true) with check (true);
create policy "cloud_backups_all"      on public.cloud_backups      for all using (true) with check (true);
create policy "cloud_backup_items_all" on public.cloud_backup_items for all using (true) with check (true);
create policy "pos_users_all"          on public.pos_users          for all using (true) with check (true);

-- ── Grants ───────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on function public.increment_customer_balance(text, numeric)
  to anon, authenticated, service_role;

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable live updates for each table. REPLICA IDENTITY FULL makes UPDATE and
-- DELETE events carry the row data (the app refetches on any change).
alter table public.customers          replica identity full;
alter table public.transactions       replica identity full;
alter table public.cloud_backups      replica identity full;
alter table public.cloud_backup_items replica identity full;
alter table public.pos_users          replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['customers','transactions','cloud_backups','cloud_backup_items','pos_users'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
