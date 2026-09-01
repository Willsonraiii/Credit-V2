import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PosUser } from "./users";
import type { Customer, Transaction, CloudBackup, Timestamp } from "./types";

// ============================================================
// Supabase configuration
//
// Set these via a `.env` file (see `.env.example`) or edit the
// fallback values below. The Project URL + anon ("public") key are
// safe to ship in the browser bundle — row-level security in
// supabase/schema.sql is what actually protects the data.
// ============================================================
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://zpeihhsewpamzxuivawa.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_yMUlQh4PBBplnxF_JLhUVQ_21JBXXrD";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/** True only when a real project URL + key have been provided. */
export function isSupabaseConfigured(): boolean {
  return (
    !SUPABASE_URL.includes("YOUR-PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE")
  );
}

// ─── Shared helpers ────────────────────────────────────────────

function toSeconds(value: unknown): number {
  if (value == null) return 0;
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return Math.floor(value / 1000);
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
  }
  return 0;
}

const ts = (value: unknown): Timestamp => ({ seconds: toSeconds(value) });
const tsOrNull = (value: unknown): Timestamp | null => (value ? ts(value) : null);

function normalizeType(value: unknown): "credit" | "payment" {
  return String(value ?? "credit").toUpperCase() === "PAYMENT" ? "payment" : "credit";
}

function displayNameFromCode(code?: string) {
  const clean = (code || "").trim();
  if (!clean) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function findExactCreditMatch(credits: Array<{ id: string; amount: number }>, target: number) {
  // Finds one exact combination of unpaid credit entries matching a payment
  // amount, so unrelated credit items stay untouched.
  const limited = credits.filter((c) => c.amount > 0).slice(0, 80);
  const dp = new Map<number, string[]>();
  dp.set(0, []);

  for (const credit of limited) {
    const entries = Array.from(dp.entries());
    for (const [sum, ids] of entries) {
      const next = sum + credit.amount;
      if (next > target || dp.has(next)) continue;
      const nextIds = [...ids, credit.id];
      if (next === target) return nextIds;
      dp.set(next, nextIds);
    }
  }
  return [];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ─── Row mappers (Supabase snake_case → app types) ─────────────

type Row = Record<string, unknown>;

function mapCustomer(row: Row): Customer {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Unknown"),
    phone: row.phone != null ? String(row.phone) : null,
    address: row.address != null ? String(row.address) : null,
    createdAt: ts(row.created_at),
    userCode: (row.user_code ?? row.added_by_name ?? row.added_by) as string | null,
    balance: Number(row.balance ?? 0),
  };
}

function mapTransaction(row: Row): Transaction {
  return {
    id: String(row.id ?? ""),
    customerId: String(row.customer_id ?? ""),
    type: normalizeType(row.type),
    amount: Number(row.amount ?? 0),
    note: row.note != null ? String(row.note) : row.description != null ? String(row.description) : null,
    date: ts(row.date ?? row.created_at),
    userCode: (row.user_code ?? row.created_by_name ?? row.created_by) as string | null,
    paid: Boolean(row.paid),
    paidAt: tsOrNull(row.paid_at),
    paidBy: (row.paid_by_name ?? row.paid_by) as string | null,
    paidByPaymentId: row.paid_by_payment_id != null ? String(row.paid_by_payment_id) : null,
    appliedToCreditIds: Array.isArray(row.applied_to_credit_ids)
      ? row.applied_to_credit_ids.map(String)
      : [],
    secured: Boolean(row.secured),
    securedBy: (row.secured_by_name ?? row.secured_by) as string | null,
  };
}

// ─── Realtime + fallback polling ───────────────────────────────
// Subscribes to Postgres changes (supabase_realtime publication, see
// supabase/schema.sql) and refreshes on any change. A slow polling loop
// acts as a safety net in case realtime is ever misconfigured.

function startLiveListener(table: string, load: () => void): () => void {
  let cancelled = false;
  const safeLoad = () => {
    if (!cancelled) load();
  };
  const channel = supabase
    .channel(`yalambar-${table}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, safeLoad)
    .subscribe();
  const interval = window.setInterval(safeLoad, 60_000);
  return () => {
    cancelled = true;
    window.clearInterval(interval);
    supabase.removeChannel(channel);
  };
}

async function selectAll(table: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return (data ?? []) as Row[];
}

export function listenCustomers(
  callback: (data: Customer[]) => void,
  onError: (err: Error) => void,
) {
  const load = () => {
    selectAll("customers")
      .then((rows) => {
        const result = rows
          .map(mapCustomer)
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        callback(result);
      })
      .catch(onError);
  };
  load();
  const unregister = registerRefresh(load);
  const unsubscribe = startLiveListener("customers", load);
  return () => {
    unregister();
    unsubscribe();
  };
}

export function listenTransactions(
  callback: (data: Transaction[]) => void,
  onError: (err: Error) => void,
) {
  const load = () => {
    selectAll("transactions")
      .then((rows) => {
        const result = rows
          .map(mapTransaction)
          .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
        callback(result);
      })
      .catch(onError);
  };
  load();
  const unregister = registerRefresh(load);
  const unsubscribe = startLiveListener("transactions", load);
  return () => {
    unregister();
    unsubscribe();
  };
}

export function listenPosUsers(
  callback: (users: PosUser[]) => void,
  onError: (err: Error) => void,
) {
  const load = () => {
    selectAll("pos_users")
      .then((rows) => {
        const users: PosUser[] = rows
          .map((d) => ({
            id: String(d.id ?? ""),
            name: String(d.name ?? "User"),
            pin: String(d.pin ?? "0000").padStart(4, "0").slice(0, 4),
            isAdmin: Boolean(d.is_admin),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        callback(users);
      })
      .catch(onError);
  };
  load();
  const unregister = registerRefresh(load);
  const unsubscribe = startLiveListener("pos_users", load);
  return () => {
    unregister();
    unsubscribe();
  };
}

export async function savePosUsers(users: PosUser[]) {
  await supabase.from("pos_users").delete().neq("id", "");
  if (users.length) {
    const { error } = await supabase.from("pos_users").insert(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        pin: u.pin,
        is_admin: u.isAdmin,
        updated_at: new Date().toISOString(),
      })),
    );
    if (error) throw error;
  }
  refreshAll();
}

// ─── Live-refresh hook ─────────────────────────────────────────
// Write operations call refreshAll() afterwards so every listener reloads
// immediately — no waiting for realtime or the polling fallback.

const refreshHooks = new Set<() => void>();

function registerRefresh(hook: () => void): () => void {
  refreshHooks.add(hook);
  return () => {
    refreshHooks.delete(hook);
  };
}

export function refreshAll() {
  refreshHooks.forEach((hook) => {
    try {
      hook();
    } catch {
      /* ignore individual reload errors */
    }
  });
}

// ─── Balance helper (atomic, via supabase/functions.sql) ───────
// Balance is always recomputed from the transactions table, so it can never
// drift no matter how many devices write at once. Falls back to an equivalent
// client-side recompute if the SQL functions haven't been installed yet.

function isMissingFunction(err: unknown): boolean {
  return /could not find the function/i.test(String((err as { message?: string })?.message ?? ""));
}

async function recomputeBalance(customerId: string) {
  const { error } = await supabase.rpc("set_customer_balance_from_transactions", {
    p_customer_id: customerId,
  });
  if (!error) return;
  if (!isMissingFunction(error)) throw error;

  // Fallback: recompute client-side (same formula as the SQL function).
  const { data, error: readErr } = await supabase
    .from("transactions")
    .select("type, amount, paid, applied_to_credit_ids")
    .eq("customer_id", customerId);
  if (readErr) throw readErr;
  const balance = (data ?? []).reduce((sum, t) => {
    if (normalizeType(t.type) === "credit") {
      return sum + (t.paid ? 0 : Number(t.amount ?? 0));
    }
    const applied =
      Array.isArray(t.applied_to_credit_ids) && (t.applied_to_credit_ids as unknown[]).length > 0;
    return sum - (applied ? 0 : Number(t.amount ?? 0));
  }, 0);
  const { error: writeErr } = await supabase.from("customers").update({ balance }).eq("id", customerId);
  if (writeErr) throw writeErr;
}

// ─── Write operations ──────────────────────────────────────────

export async function addCustomer(data: {
  name: string;
  phone?: string;
  address?: string;
  userCode?: string;
}) {
  const now = new Date().toISOString();
  const id = `c${Date.now()}`;
  const userCode = data.userCode?.trim() || null;
  const userName = displayNameFromCode(userCode || undefined);

  const { error } = await supabase.from("customers").insert({
    id,
    name: data.name.trim(),
    name_np: data.name.trim(),
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    notes: "",
    status: "active",
    credit_limit: 1000,
    balance: 0,
    created_at: now,
    added_by: userCode?.toLowerCase() || null,
    added_by_name: userName,
    last_edited_by: null,
    last_edited_by_name: null,
    user_code: userCode,
  });
  if (error) throw error;
  refreshAll();
}

export async function addTransaction(data: {
  customerId: string;
  type: "credit" | "payment";
  amount: number;
  note?: string;
  userCode?: string;
}) {
  const now = new Date().toISOString();
  const id = `t${Date.now()}`;
  const amount = Math.max(0, Math.round(data.amount));
  const userCode = data.userCode?.trim() || null;
  const userName = displayNameFromCode(userCode || undefined);
  let appliedToCreditIds: string[] = [];

  if (data.type === "payment") {
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("id, amount, date, created_at, secured")
      .eq("customer_id", data.customerId)
      .eq("type", "credit")
      .eq("paid", false);
    if (error) throw error;

    const unpaidCredits: Array<{ id: string; amount: number; seconds: number; secured: boolean }> =
      (rows ?? []).map((r: Row) => ({
        id: String(r.id),
        amount: Number(r.amount ?? 0),
        seconds: toSeconds(r.date ?? r.created_at),
        secured: Boolean(r.secured),
      }));
    unpaidCredits.sort((a, b) => a.seconds - b.seconds);
    const normalCredits = unpaidCredits.filter((tx) => !tx.secured);
    appliedToCreditIds = findExactCreditMatch(normalCredits, amount);
    if (appliedToCreditIds.length === 0) {
      const exactSecured = unpaidCredits.find((tx) => tx.secured && tx.amount === amount);
      appliedToCreditIds = exactSecured ? [exactSecured.id] : [];
    }
  }

  const { error: insertErr } = await supabase.from("transactions").insert({
    id,
    customer_id: data.customerId,
    type: data.type === "payment" ? "payment" : "credit",
    amount,
    description: data.note?.trim() || "",
    note: data.note?.trim() || null,
    date: now,
    created_at: now,
    created_by: userCode?.toLowerCase() || null,
    created_by_name: userName,
    user_code: userCode,
    paid: false,
    paid_at: null,
    paid_by: null,
    paid_by_name: null,
    applied_to_credit_ids: appliedToCreditIds,
    auto_applied: appliedToCreditIds.length > 0,
    secured: false,
    secured_at: null,
    secured_by: null,
    secured_by_name: null,
  });
  if (insertErr) throw insertErr;

  if (appliedToCreditIds.length > 0) {
    const { error } = await supabase
      .from("transactions")
      .update({
        paid: true,
        paid_at: now,
        paid_by: userCode?.toLowerCase() || null,
        paid_by_name: userName,
        paid_by_payment_id: id,
      })
      .in("id", appliedToCreditIds);
    if (error) throw error;
  }

  // Recompute (not increment) so the balance is always exact.
  await recomputeBalance(data.customerId);
  refreshAll();
}

export async function updateCustomer(
  id: string,
  data: { name?: string; phone?: string | null; address?: string | null },
) {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) {
    payload.name = data.name.trim();
    payload.name_np = data.name.trim();
  }
  if (data.phone !== undefined) payload.phone = data.phone?.trim() || null;
  if (data.address !== undefined) payload.address = data.address?.trim() || null;

  const { error } = await supabase.from("customers").update(payload).eq("id", id);
  if (error) throw error;
}

export async function updateTransaction(
  id: string,
  data: { amount?: number; note?: string | null; type?: "credit" | "payment" },
) {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const old = rows as Row | null;
  if (!old) return;

  const payload: Record<string, unknown> = {};
  if (data.amount !== undefined) payload.amount = Math.max(0, Math.round(data.amount));
  if (data.note !== undefined) {
    payload.note = data.note?.trim() || null;
    payload.description = data.note?.trim() || "";
  }
  if (data.type !== undefined) payload.type = data.type === "payment" ? "payment" : "credit";

  const { error: updateErr } = await supabase.from("transactions").update(payload).eq("id", id);
  if (updateErr) throw updateErr;

  // Recompute the balance from scratch — this handles every case (type or
  // amount changes, paid state) without fragile delta arithmetic.
  const customerId = String(old.customer_id || "");
  if (customerId) await recomputeBalance(customerId);
  refreshAll();
}

export async function setCreditPaid(id: string, paid: boolean, userCode?: string) {
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);
  const now = new Date().toISOString();

  // Atomic toggle + balance fix (see supabase/functions.sql). This is what
  // prevents the "keeps adding" drift when toggling PAID/UNPAID repeatedly.
  const { error } = await supabase.rpc("toggle_credit_paid", {
    p_tx_id: id,
    p_paid: paid,
    p_user: cleanUser?.toLowerCase() || null,
    p_user_name: userName,
    p_now: now,
  });
  if (!error) {
    refreshAll();
    return;
  }
  if (!isMissingFunction(error)) throw error;

  // Fallback for when the SQL functions haven't been installed yet.
  const { data: rows, error: readErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const raw = rows as Row | null;
  if (!raw) return;
  if (normalizeType(raw.type) !== "credit") return;

  const currentPaid = Boolean(raw.paid);
  if (currentPaid === paid) return;
  if (currentPaid && raw.paid_by_payment_id && !paid) return;

  const customerId = String(raw.customer_id || "");

  const { error: updateErr } = await supabase
    .from("transactions")
    .update({
      paid,
      paid_at: paid ? now : null,
      paid_by: paid ? cleanUser?.toLowerCase() || null : null,
      paid_by_name: paid ? userName : null,
    })
    .eq("id", id);
  if (updateErr) throw updateErr;

  if (customerId) await recomputeBalance(customerId);
  refreshAll();
}

export async function setCreditSecured(id: string, secured: boolean, userCode?: string) {
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const raw = rows as Row | null;
  if (!raw) return;
  if (normalizeType(raw.type) !== "credit") return;
  if (Boolean(raw.paid)) return;
  if (Boolean(raw.secured) === secured) return;

  const { error: updateErr } = await supabase
    .from("transactions")
    .update({
      secured,
      secured_at: secured ? now : null,
      secured_by: secured ? cleanUser?.toLowerCase() || null : null,
      secured_by_name: secured ? userName : null,
    })
    .eq("id", id);
  if (updateErr) throw updateErr;
  refreshAll();
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  refreshAll();
}

export async function deleteTransaction(id: string) {
  // Atomic delete + un-apply of any credits the payment had settled
  // (see supabase/functions.sql).
  const { error } = await supabase.rpc("delete_transaction_fix", { p_tx_id: id });
  if (!error) {
    refreshAll();
    return;
  }
  if (!isMissingFunction(error)) throw error;

  // Fallback for when the SQL functions haven't been installed yet.
  const { data: rows, error: readErr } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const raw = rows as Row | null;
  if (!raw) return;

  const customerId = raw.customer_id != null ? String(raw.customer_id) : "";

  if (normalizeType(raw.type) === "payment" && customerId) {
    // Un-mark credits that this payment had settled.
    const { error: unapplyErr } = await supabase
      .from("transactions")
      .update({
        paid: false,
        paid_at: null,
        paid_by: null,
        paid_by_name: null,
        paid_by_payment_id: null,
      })
      .eq("customer_id", customerId)
      .eq("paid_by_payment_id", id);
    if (unapplyErr) throw unapplyErr;
  }

  const { error: delErr } = await supabase.from("transactions").delete().eq("id", id);
  if (delErr) throw delErr;

  if (customerId) await recomputeBalance(customerId);
  refreshAll();
}

// ─── Cloud backups ─────────────────────────────────────────────

export async function createCloudBackup(userCode?: string, label = "Manual backup") {
  const now = new Date().toISOString();
  const id = `b${Date.now()}`;
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);

  const customers = await selectAll("customers");
  const transactions = await selectAll("transactions");

  const { error } = await supabase.from("cloud_backups").insert({
    id,
    created_at: now,
    created_by: cleanUser?.toLowerCase() || null,
    created_by_name: userName,
    label,
    customer_count: customers.length,
    transaction_count: transactions.length,
    version: "daily-credit-v3",
  });
  if (error) throw error;

  const items = [
    ...customers.map((c) => ({ backup_id: id, kind: "customer", doc_id: String(c.id ?? ""), data: c })),
    ...transactions.map((t) => ({ backup_id: id, kind: "transaction", doc_id: String(t.id ?? ""), data: t })),
  ];
  for (const batch of chunk(items, 450)) {
    const { error: itemErr } = await supabase.from("cloud_backup_items").insert(batch);
    if (itemErr) throw itemErr;
  }
  return id;
}

export async function listCloudBackups(): Promise<CloudBackup[]> {
  const rows = await selectAll("cloud_backups");
  return rows
    .map((r) => ({
      id: String(r.id ?? ""),
      createdAt: String(r.created_at ?? ""),
      createdBy: (r.created_by ?? null) as string | null,
      createdByName: (r.created_by_name ?? null) as string | null,
      label: (r.label ?? null) as string | null,
      customerCount: Number(r.customer_count ?? 0),
      transactionCount: Number(r.transaction_count ?? 0),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function restoreCloudBackup(backupId: string, userCode?: string) {
  // Safety backup first, so a restore can be reversed manually if needed.
  await createCloudBackup(userCode, `Safety backup before restore ${backupId}`);

  const { data: items, error } = await supabase
    .from("cloud_backup_items")
    .select("kind, doc_id, data")
    .eq("backup_id", backupId);
  if (error) throw error;

  // Clear current data (transactions first — FK references customers).
  await supabase.from("transactions").delete().neq("id", "");
  await supabase.from("customers").delete().neq("id", "");

  const customers = (items ?? []).filter((i) => i.kind === "customer").map((i) => i.data as Row);
  const transactions = (items ?? []).filter((i) => i.kind === "transaction").map((i) => i.data as Row);

  for (const batch of chunk(customers, 450)) {
    const { error: cErr } = await supabase.from("customers").insert(batch);
    if (cErr) throw cErr;
  }
  for (const batch of chunk(transactions, 450)) {
    const { error: tErr } = await supabase.from("transactions").insert(batch);
    if (tErr) throw tErr;
  }
}

export async function recalculateCustomerBalances() {
  // Atomic full recompute (see supabase/functions.sql).
  const { error } = await supabase.rpc("recompute_all_balances");
  if (!error) {
    refreshAll();
    return;
  }
  if (!isMissingFunction(error)) throw error;

  // Fallback: recompute each customer client-side using the SAME formula as
  // the app (unpaid credits − unmatched payments). The old code subtracted
  // every payment, which double-counted auto-applied payments.
  const { data: customers, error: cErr } = await supabase.from("customers").select("id");
  if (cErr) throw cErr;
  const { data: transactions, error: tErr } = await supabase
    .from("transactions")
    .select("customer_id, type, amount, paid, applied_to_credit_ids");
  if (tErr) throw tErr;

  const balances = new Map<string, number>();
  (customers ?? []).forEach((c) => balances.set(String(c.id), 0));

  (transactions ?? []).forEach((t) => {
    const customerId = String(t.customer_id || "");
    if (!customerId) return;
    const type = normalizeType(t.type);
    const amount = Number(t.amount ?? 0);
    const current = balances.get(customerId) || 0;
    if (type === "credit") {
      balances.set(customerId, current + (t.paid ? 0 : amount));
    } else {
      const applied =
        Array.isArray(t.applied_to_credit_ids) && (t.applied_to_credit_ids as unknown[]).length > 0;
      balances.set(customerId, current - (applied ? 0 : amount));
    }
  });

  for (const [customerId, balance] of balances) {
    const { error: wErr } = await supabase.from("customers").update({ balance }).eq("id", customerId);
    if (wErr) throw wErr;
  }
  refreshAll();
}
