// One-time Firestore → Supabase migration.
//
// Reads every document from the existing Firebase project (customers,
// transactions, POS users and cloud backups incl. their subcollections) and
// writes them into Supabase. It is triggered from the Settings screen and is
// idempotent: re-running it simply re-copies the latest Firestore data over
// the Supabase tables.
import { collection, getDocs } from "firebase/firestore";
import {
  customersCol,
  transactionsCol,
  cloudBackupsCol,
  posUsersCol,
} from "./firebase";
import { supabase } from "./supabase";

export interface MigrationResult {
  customers: number;
  transactions: number;
  posUsers: number;
  backups: number;
  backupItems: number;
}

type FireDoc = Record<string, unknown>;

function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000).toISOString();
  return null;
}

function mapFireCustomer(snapId: string, raw: FireDoc) {
  return {
    id: snapId,
    name: raw.name != null ? String(raw.name) : "Unknown",
    name_np: raw.nameNp != null ? String(raw.nameNp) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    address: raw.address != null ? String(raw.address) : null,
    notes: raw.notes != null ? String(raw.notes) : "",
    status: raw.status != null ? String(raw.status) : "active",
    credit_limit: Number(raw.creditLimit ?? 1000),
    balance: Number(raw.balance ?? 0),
    created_at: toIso(raw.createdAt),
    added_by: raw.addedBy != null ? String(raw.addedBy) : null,
    added_by_name: raw.addedByName != null ? String(raw.addedByName) : null,
    last_edited_by: raw.lastEditedBy != null ? String(raw.lastEditedBy) : null,
    last_edited_by_name: raw.lastEditedByName != null ? String(raw.lastEditedByName) : null,
    user_code: raw.userCode != null ? String(raw.userCode) : null,
  };
}

function mapFireTransaction(snapId: string, raw: FireDoc) {
  const type = String(raw.type ?? "credit").toUpperCase() === "PAYMENT" ? "payment" : "credit";
  return {
    id: snapId,
    customer_id: raw.customerId != null ? String(raw.customerId) : "",
    type,
    amount: Number(raw.amount ?? 0),
    description: raw.description != null ? String(raw.description) : "",
    note: raw.note != null ? String(raw.note) : null,
    date: toIso(raw.date ?? raw.createdAt),
    created_at: toIso(raw.createdAt ?? raw.date),
    created_by: raw.createdBy != null ? String(raw.createdBy) : null,
    created_by_name: raw.createdByName != null ? String(raw.createdByName) : null,
    user_code: raw.userCode != null ? String(raw.userCode) : null,
    paid: Boolean(raw.paid),
    paid_at: toIso(raw.paidAt),
    paid_by: raw.paidBy != null ? String(raw.paidBy) : null,
    paid_by_name: raw.paidByName != null ? String(raw.paidByName) : null,
    paid_by_payment_id: raw.paidByPaymentId != null ? String(raw.paidByPaymentId) : null,
    applied_to_credit_ids: Array.isArray(raw.appliedToCreditIds) ? raw.appliedToCreditIds.map(String) : [],
    auto_applied: Boolean(raw.autoApplied),
    secured: Boolean(raw.secured),
    secured_at: toIso(raw.securedAt),
    secured_by: raw.securedBy != null ? String(raw.securedBy) : null,
    secured_by_name: raw.securedByName != null ? String(raw.securedByName) : null,
  };
}

function mapFirePosUser(snapId: string, raw: FireDoc) {
  return {
    id: snapId,
    name: raw.name != null ? String(raw.name) : "User",
    pin: String(raw.pin ?? "0000").padStart(4, "0").slice(0, 4),
    is_admin: Boolean(raw.isAdmin),
    updated_at: toIso(raw.updatedAt),
  };
}

function mapFireBackup(snapId: string, raw: FireDoc) {
  return {
    id: snapId,
    created_at: toIso(raw.createdAt),
    created_by: raw.createdBy != null ? String(raw.createdBy) : null,
    created_by_name: raw.createdByName != null ? String(raw.createdByName) : null,
    label: raw.label != null ? String(raw.label) : null,
    customer_count: Number(raw.customerCount ?? 0),
    transaction_count: Number(raw.transactionCount ?? 0),
    version: raw.version != null ? String(raw.version) : "daily-credit-v3",
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function migrateFirestoreToSupabase(
  onProgress?: (message: string) => void,
): Promise<MigrationResult> {
  const log = (m: string) => onProgress?.(m);

  try {
    log("Reading customers from Firestore…");
    const customerSnap = await getDocs(customersCol);
    const customers = customerSnap.docs.map((d) => mapFireCustomer(d.id, d.data()));

    log("Reading transactions from Firestore…");
    const txSnap = await getDocs(transactionsCol);
    const transactions = txSnap.docs.map((d) => mapFireTransaction(d.id, d.data()));

    log("Reading POS users from Firestore…");
    const posSnap = await getDocs(posUsersCol);
    const posUsers = posSnap.docs.map((d) => mapFirePosUser(d.id, d.data()));

    log("Reading cloud backups from Firestore…");
    const backupSnap = await getDocs(cloudBackupsCol);
    const backups = backupSnap.docs.map((d) => mapFireBackup(d.id, d.data()));

    const backupItems: Array<Record<string, unknown>> = [];
    for (const b of backupSnap.docs) {
      const bc = await getDocs(collection(cloudBackupsCol, b.id, "customers"));
      const bt = await getDocs(collection(cloudBackupsCol, b.id, "transactions"));
      bc.forEach((d) =>
        backupItems.push({ backup_id: b.id, kind: "customer", doc_id: d.id, data: mapFireCustomer(d.id, d.data()) }),
      );
      bt.forEach((d) =>
        backupItems.push({ backup_id: b.id, kind: "transaction", doc_id: d.id, data: mapFireTransaction(d.id, d.data()) }),
      );
    }

    log("Clearing existing Supabase data…");
    await supabase.from("cloud_backup_items").delete().neq("backup_id", "");
    await supabase.from("cloud_backups").delete().neq("id", "");
    await supabase.from("transactions").delete().neq("id", "");
    await supabase.from("customers").delete().neq("id", "");
    await supabase.from("pos_users").delete().neq("id", "");

    log(`Writing ${customers.length} customers…`);
    for (const batch of chunk(customers, 450)) {
      const { error } = await supabase.from("customers").upsert(batch, { onConflict: "id" });
      if (error) throw error;
    }

    log(`Writing ${transactions.length} transactions…`);
    for (const batch of chunk(transactions, 450)) {
      const { error } = await supabase.from("transactions").upsert(batch, { onConflict: "id" });
      if (error) throw error;
    }

    if (posUsers.length) {
      log(`Writing ${posUsers.length} POS users…`);
      const { error } = await supabase.from("pos_users").upsert(posUsers, { onConflict: "id" });
      if (error) throw error;
    }

    log(`Writing ${backups.length} cloud backups…`);
    for (const batch of chunk(backups, 450)) {
      const { error } = await supabase.from("cloud_backups").upsert(batch, { onConflict: "id" });
      if (error) throw error;
    }
    for (const batch of chunk(backupItems, 450)) {
      const { error } = await supabase.from("cloud_backup_items").insert(batch);
      if (error) throw error;
    }

    log("Migration complete ✓");
    return {
      customers: customers.length,
      transactions: transactions.length,
      posUsers: posUsers.length,
      backups: backups.length,
      backupItems: backupItems.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Migration failed — make sure supabase/schema.sql has been run in the Supabase SQL editor, and the project URL + anon key are set. (${msg})`,
    );
  }
}
