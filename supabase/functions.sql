-- ============================================================================
-- Yalambar Store — Supabase: balance & transaction fix functions
--
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- (Safe to re-run — everything is CREATE OR REPLACE.)
--
-- Why: the previous client-side code did read-modify-write on the balance,
-- which can drift when several devices write at the same time (e.g. toggling
-- a credit PAID/UNPAID quickly). These functions move every balance change
-- into the database so it is atomic and always correct.
-- ============================================================================

-- 1) Recompute a single customer's balance from their transactions.
--    Canonical formula (matches the app):
--      balance = SUM(unpaid credits) - SUM(unmatched payments)
--    where an "unmatched" payment is one that did NOT auto-apply to credits.
create or replace function public.set_customer_balance_from_transactions(p_customer_id text)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.customers
     set balance = coalesce((
       select sum(amount) from public.transactions
       where customer_id = p_customer_id and type = 'credit' and paid = false
     ), 0) - coalesce((
       select sum(amount) from public.transactions
       where customer_id = p_customer_id and type = 'payment'
         and (applied_to_credit_ids is null or cardinality(applied_to_credit_ids) = 0)
     ), 0)
   where id = p_customer_id;
$$;

-- 2) Recompute every customer's balance (used by the "Repair" button).
create or replace function public.recompute_all_balances()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.customers c
     set balance = coalesce((
       select sum(t.amount) from public.transactions t
       where t.customer_id = c.id and t.type = 'credit' and t.paid = false
     ), 0) - coalesce((
       select sum(t.amount) from public.transactions t
       where t.customer_id = c.id and t.type = 'payment'
         and (t.applied_to_credit_ids is null or cardinality(t.applied_to_credit_ids) = 0)
     ), 0);
$$;

-- 3) Atomically toggle a credit's PAID state and fix the balance in one step.
--    This replaces the racy client-side read-modify-write, so rapid or
--    multi-device toggles can never drift the balance.
create or replace function public.toggle_credit_paid(
  p_tx_id text,
  p_paid boolean,
  p_user text,
  p_user_name text,
  p_now timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_type text;
  v_paid boolean;
  v_customer_id text;
  v_paid_by_payment_id text;
begin
  select type, paid, customer_id, paid_by_payment_id
    into v_type, v_paid, v_customer_id, v_paid_by_payment_id
    from public.transactions
   where id = p_tx_id
   for update;

  if v_type is null or v_type <> 'credit' then return; end if;
  if v_paid is null then v_paid := false; end if;
  if v_paid = p_paid then return; end if;

  -- Never allow un-paying a credit that was settled by a payment record
  -- (delete the payment instead — see delete_transaction_fix).
  if v_paid and v_paid_by_payment_id is not null and p_paid = false then return; end if;

  update public.transactions
     set paid = p_paid,
         paid_at = case when p_paid then p_now else null end,
         paid_by = case when p_paid then p_user else null end,
         paid_by_name = case when p_paid then p_user_name else null end
   where id = p_tx_id;

  if v_customer_id is not null then
    perform public.set_customer_balance_from_transactions(v_customer_id);
  end if;
end;
$$;

-- 4) Delete a transaction and fix everything it affected:
--      - if it was a payment, un-mark the credits it had settled,
--      - then recompute the customer's balance.
create or replace function public.delete_transaction_fix(p_tx_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_type text;
  v_customer_id text;
begin
  select type, customer_id into v_type, v_customer_id
    from public.transactions
   where id = p_tx_id
   for update;

  if v_type = 'payment' and v_customer_id is not null then
    update public.transactions
       set paid = false,
           paid_at = null,
           paid_by = null,
           paid_by_name = null,
           paid_by_payment_id = null
     where customer_id = v_customer_id
       and paid_by_payment_id = p_tx_id;
  end if;

  delete from public.transactions where id = p_tx_id;

  if v_customer_id is not null then
    perform public.set_customer_balance_from_transactions(v_customer_id);
  end if;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
grant execute on function public.set_customer_balance_from_transactions(text)
  to anon, authenticated, service_role;
grant execute on function public.recompute_all_balances()
  to anon, authenticated, service_role;
grant execute on function public.toggle_credit_paid(text, boolean, text, text, timestamptz)
  to anon, authenticated, service_role;
grant execute on function public.delete_transaction_fix(text)
  to anon, authenticated, service_role;
