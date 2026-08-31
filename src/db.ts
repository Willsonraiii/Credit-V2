// Backend-agnostic data layer.
//
// The app talks to this module only. Internally it routes every call to
// either the legacy Firebase layer (`./firebase`) or the new Supabase layer
// (`./supabase`), based on a persisted setting. After the one-time migration
// is run from the Settings screen, the backend is flipped to Supabase and the
// app keeps working with the exact same data.
import * as fire from "./firebase";
import * as sup from "./supabase";
import type { Customer, Transaction } from "./types";

export type { CloudBackup } from "./types";
export type Backend = "firebase" | "supabase";
export { isSupabaseConfigured } from "./supabase";

const BACKEND_KEY = "yalambar_backend_v1";

/**
 * Supabase is the default for every device. A stored Firebase value remains
 * an explicit opt-out so a recovery path is available if it is ever needed.
 */
export function getBackend(): Backend {
  return localStorage.getItem(BACKEND_KEY) === "firebase" ? "firebase" : "supabase";
}

export function setBackend(backend: Backend) {
  localStorage.setItem(BACKEND_KEY, backend);
}

/**
 * The backend actually in use. Falls back to Firebase whenever Supabase is
 * not yet configured, so the app never breaks mid-migration.
 */
export function effectiveBackend(): Backend {
  return getBackend() === "supabase" && sup.isSupabaseConfigured() ? "supabase" : "firebase";
}

const useSupabase = () => effectiveBackend() === "supabase";

// ─── Realtime listeners ────────────────────────────────────────

export function listenCustomers(
  callback: (data: Customer[]) => void,
  onError: (err: Error) => void,
) {
  return useSupabase() ? sup.listenCustomers(callback, onError) : fire.listenCustomers(callback, onError);
}

export function listenTransactions(
  callback: (data: Transaction[]) => void,
  onError: (err: Error) => void,
) {
  return useSupabase() ? sup.listenTransactions(callback, onError) : fire.listenTransactions(callback, onError);
}

export function listenPosUsers(
  callback: (users: import("./users").PosUser[]) => void,
  onError: (err: Error) => void,
) {
  return useSupabase() ? sup.listenPosUsers(callback, onError) : fire.listenPosUsers(callback, onError);
}

// ─── Write operations ──────────────────────────────────────────

export function addCustomer(data: { name: string; phone?: string; address?: string; userCode?: string }) {
  return useSupabase() ? sup.addCustomer(data) : fire.addCustomerFire(data);
}

export function addTransaction(data: {
  customerId: string;
  type: "credit" | "payment";
  amount: number;
  note?: string;
  userCode?: string;
}) {
  return useSupabase() ? sup.addTransaction(data) : fire.addTransactionFire(data);
}

export function updateCustomer(id: string, data: { name?: string; phone?: string | null; address?: string | null }) {
  return useSupabase() ? sup.updateCustomer(id, data) : fire.updateCustomerFire(id, data);
}

export function updateTransaction(
  id: string,
  data: { amount?: number; note?: string | null; type?: "credit" | "payment" },
) {
  return useSupabase() ? sup.updateTransaction(id, data) : fire.updateTransactionFire(id, data);
}

export function setCreditPaid(id: string, paid: boolean, userCode?: string) {
  return useSupabase() ? sup.setCreditPaid(id, paid, userCode) : fire.setCreditPaidFire(id, paid, userCode);
}

export function setCreditSecured(id: string, secured: boolean, userCode?: string) {
  return useSupabase() ? sup.setCreditSecured(id, secured, userCode) : fire.setCreditSecuredFire(id, secured, userCode);
}

export function deleteCustomer(id: string) {
  return useSupabase() ? sup.deleteCustomer(id) : fire.deleteCustomerFire(id);
}

export function deleteTransaction(id: string) {
  return useSupabase() ? sup.deleteTransaction(id) : fire.deleteTransactionFire(id);
}

export function createCloudBackup(userCode?: string, label?: string) {
  return useSupabase() ? sup.createCloudBackup(userCode, label) : fire.createCloudBackupFire(userCode, label);
}

export function listCloudBackups() {
  return useSupabase() ? sup.listCloudBackups() : fire.listCloudBackupsFire();
}

export function restoreCloudBackup(backupId: string, userCode?: string) {
  return useSupabase() ? sup.restoreCloudBackup(backupId, userCode) : fire.restoreCloudBackupFire(backupId, userCode);
}

export function recalculateCustomerBalances() {
  return useSupabase() ? sup.recalculateCustomerBalances() : fire.recalculateCustomerBalancesFire();
}

export function savePosUsers(users: import("./users").PosUser[]) {
  return useSupabase() ? sup.savePosUsers(users) : fire.savePosUsersFire(users);
}
