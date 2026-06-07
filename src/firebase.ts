import { initializeApp } from "firebase/app";
import type { PosUser } from "./users";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  onSnapshot,
  deleteDoc,
  getDoc,
  getDocs,
  increment,
  updateDoc,
  setDoc,
  doc,
  Timestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore";

// ============================================================
// IMPORTANT: Replace this config with YOUR Firebase config
// Go to Firebase Console → Project Settings → Web App → Config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyD6JLhrHYLKV0SHm3jfHXZSii7ErPt-0mQ",
  authDomain: "yalambar-store.firebaseapp.com",
  projectId: "yalambar-store",
  storageBucket: "yalambar-store.firebasestorage.app",
  messagingSenderId: "222615926321",
  appId: "1:222615926321:web:ebbd5e77fdea297250c710",
};

// ============================================================
// Edit firebaseConfig above — DO NOT touch below this line
// ============================================================

const app = initializeApp(firebaseConfig, "yalambar-v3");
const db = initializeFirestore(app, {
  // Persistent disk cache lets the app show customers/transactions offline
  // after they have loaded once on the device.
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Firestore collection references
export const customersCol = collection(db, "customers");
export const transactionsCol = collection(db, "transactions");
export const cloudBackupsCol = collection(db, "cloudBackups");
export const posUsersCol = collection(db, "posUsers");

function toTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  if (value && typeof value === "object" && "seconds" in value) return value as Timestamp;
  return Timestamp.now();
}

function normalizeType(value: unknown): "credit" | "payment" {
  return String(value ?? "CREDIT").toUpperCase() === "PAYMENT" ? "payment" : "credit";
}

function legacyType(type: "credit" | "payment") {
  return type === "payment" ? "PAYMENT" : "CREDIT";
}

function displayNameFromCode(code?: string) {
  const clean = (code || "").trim();
  if (!clean) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function findExactCreditMatch(credits: Array<{ id: string; amount: number }>, target: number) {
  // Finds one exact combination of unpaid credit entries matching a payment amount.
  // This keeps unrelated credit items untouched.
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

async function commitChunked(ops: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
}

// Types aligned with Firestore documents
export interface FireCustomer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: Timestamp;
  userCode: string | null;
  balance: number;
}

export interface FireTransaction {
  id: string;
  customerId: string;
  type: "credit" | "payment";
  amount: number;
  note: string | null;
  date: Timestamp;
  userCode: string | null;
  paid: boolean;
  paidAt: Timestamp | null;
  paidBy: string | null;
  paidByPaymentId?: string | null;
  appliedToCreditIds?: string[];
  secured?: boolean;
  securedBy?: string | null;
}

export interface CloudBackup {
  id: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  label: string | null;
  customerCount: number;
  transactionCount: number;
}

export function listenPosUsers(
  callback: (users: PosUser[]) => void,
  onError: (err: Error) => void,
) {
  return onSnapshot(
    posUsersCol,
    (snap) => {
      const users: PosUser[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        users.push({
          id: d.id,
          name: String(raw.name ?? "User"),
          pin: String(raw.pin ?? "0000").padStart(4, "0").slice(0, 4),
          isAdmin: Boolean(raw.isAdmin),
        });
      });
      users.sort((a, b) => a.name.localeCompare(b.name));
      callback(users);
    },
    onError,
  );
}

export async function savePosUsersFire(users: PosUser[]) {
  const existing = await getDocs(posUsersCol);
  const nextIds = new Set(users.map((u) => u.id));
  const batch = writeBatch(db);

  existing.forEach((snapshot) => {
    if (!nextIds.has(snapshot.id)) batch.delete(doc(db, "posUsers", snapshot.id));
  });

  users.forEach((user) => {
    batch.set(doc(db, "posUsers", user.id), {
      id: user.id,
      name: user.name,
      pin: user.pin,
      isAdmin: user.isAdmin,
      updatedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
}

// Real-time subscriptions
export function listenCustomers(
  callback: (data: FireCustomer[]) => void,
  onError: (err: Error) => void,
) {
  return onSnapshot(
    customersCol,
    (snap) => {
      const result: FireCustomer[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        result.push({
          id: d.id,
          name: raw.name ?? "Unknown",
          phone: raw.phone ?? null,
          address: raw.address ?? null,
          createdAt: toTimestamp(raw.createdAt),
          userCode: raw.userCode ?? raw.addedByName ?? raw.addedBy ?? raw.createdByName ?? raw.createdBy ?? null,
          balance: Number(raw.balance ?? 0),
        });
      });
      // newest first
      result.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      callback(result);
    },
    onError,
  );
}

export function listenTransactions(
  callback: (data: FireTransaction[]) => void,
  onError: (err: Error) => void,
) {
  return onSnapshot(
    transactionsCol,
    (snap) => {
      const result: FireTransaction[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        result.push({
          id: d.id,
          customerId: raw.customerId ?? "",
          type: normalizeType(raw.type),
          amount: Number(raw.amount ?? 0),
          note: raw.note ?? raw.description ?? null,
          date: toTimestamp(raw.date ?? raw.createdAt),
          userCode: raw.userCode ?? raw.createdByName ?? raw.createdBy ?? null,
          paid: Boolean(raw.paid),
          paidAt: raw.paidAt ? toTimestamp(raw.paidAt) : null,
          paidBy: raw.paidByName ?? raw.paidBy ?? null,
          paidByPaymentId: raw.paidByPaymentId ?? null,
          appliedToCreditIds: Array.isArray(raw.appliedToCreditIds) ? raw.appliedToCreditIds : [],
          secured: Boolean(raw.secured),
          securedBy: raw.securedByName ?? raw.securedBy ?? null,
        });
      });
      result.sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
      callback(result);
    },
    onError,
  );
}

// Write operations
export async function addCustomerFire(data: {
  name: string;
  phone?: string;
  address?: string;
  userCode?: string;
}) {
  const now = new Date().toISOString();
  const id = `c${Date.now()}`;
  const userCode = data.userCode?.trim() || null;
  const userName = displayNameFromCode(userCode || undefined);
  return setDoc(doc(db, "customers", id), {
    id,
    name: data.name.trim(),
    nameNp: data.name.trim(),
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    notes: "",
    status: "active",
    creditLimit: 1000,
    balance: 0,
    createdAt: now,
    addedBy: userCode?.toLowerCase() || null,
    addedByName: userName,
    lastEditedBy: null,
    lastEditedByName: null,
    userCode,
  });
}

export async function addTransactionFire(data: {
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
    const txSnap = await getDocs(transactionsCol);
    const unpaidCredits: Array<{ id: string; amount: number; seconds: number; secured: boolean }> = [];
    txSnap.forEach((snapshot) => {
      const raw = snapshot.data();
      if (String(raw.customerId || "") !== data.customerId) return;
      if (normalizeType(raw.type) !== "credit") return;
      if (Boolean(raw.paid)) return;
      unpaidCredits.push({
        id: snapshot.id,
        amount: Number(raw.amount ?? 0),
        seconds: toTimestamp(raw.date ?? raw.createdAt).seconds,
        secured: Boolean(raw.secured),
      });
    });
    unpaidCredits.sort((a, b) => a.seconds - b.seconds);
    const normalCredits = unpaidCredits.filter((tx) => !tx.secured);
    appliedToCreditIds = findExactCreditMatch(normalCredits, amount);
    if (appliedToCreditIds.length === 0) {
      const exactSecured = unpaidCredits.find((tx) => tx.secured && tx.amount === amount);
      appliedToCreditIds = exactSecured ? [exactSecured.id] : [];
    }
  }

  const batch = writeBatch(db);
  batch.set(doc(db, "transactions", id), {
    id,
    customerId: data.customerId,
    type: legacyType(data.type),
    amount,
    description: data.note?.trim() || "",
    note: data.note?.trim() || null,
    date: now,
    createdAt: now,
    createdBy: userCode?.toLowerCase() || null,
    createdByName: userName,
    userCode,
    paid: false,
    paidAt: null,
    paidBy: null,
    paidByName: null,
    appliedToCreditIds,
    autoApplied: appliedToCreditIds.length > 0,
    secured: false,
    securedAt: null,
    securedBy: null,
    securedByName: null,
  });

  if (appliedToCreditIds.length > 0) {
    for (const creditId of appliedToCreditIds) {
      batch.update(doc(db, "transactions", creditId), {
        paid: true,
        paidAt: now,
        paidBy: userCode?.toLowerCase() || null,
        paidByName: userName,
        paidByPaymentId: id,
      });
    }
  }

  batch.update(doc(db, "customers", data.customerId), {
    balance: increment(data.type === "credit" ? amount : -amount),
  });
  await batch.commit();
}

export async function updateCustomerFire(id: string, data: {
  name?: string;
  phone?: string | null;
  address?: string | null;
}) {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.name !== undefined) payload.nameNp = data.name.trim();
  if (data.phone !== undefined) payload.phone = data.phone?.trim() || null;
  if (data.address !== undefined) payload.address = data.address?.trim() || null;
  return updateDoc(doc(db, "customers", id), payload);
}

export async function updateTransactionFire(id: string, data: {
  amount?: number;
  note?: string | null;
  type?: "credit" | "payment";
}) {
  const txRef = doc(db, "transactions", id);
  const snap = await getDoc(txRef);
  const old = snap.exists() ? snap.data() : null;
  const oldType = normalizeType(old?.type);
  const oldAmount = Number(old?.amount ?? 0);
  const oldPaid = Boolean(old?.paid);
  const payload: Record<string, unknown> = {};
  const nextType = data.type ?? oldType;
  const nextAmount = data.amount !== undefined ? Math.max(0, Math.round(data.amount)) : oldAmount;
  if (data.amount !== undefined) payload.amount = nextAmount;
  if (data.note !== undefined) {
    payload.note = data.note?.trim() || null;
    payload.description = data.note?.trim() || "";
  }
  if (data.type !== undefined) payload.type = legacyType(data.type);
  const customerId = String(old?.customerId || "");
  if (customerId) {
    const oldSigned = oldType === "credit" ? (oldPaid ? 0 : oldAmount) : -oldAmount;
    const nextSigned = nextType === "credit" ? (oldPaid ? 0 : nextAmount) : -nextAmount;
    const batch = writeBatch(db);
    batch.update(txRef, payload);
    batch.update(doc(db, "customers", customerId), {
      balance: increment(nextSigned - oldSigned),
    });
    await batch.commit();
  } else {
    await updateDoc(txRef, payload);
  }
}

export async function setCreditPaidFire(id: string, paid: boolean, userCode?: string) {
  const txRef = doc(db, "transactions", id);
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);
  const now = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(txRef);
    if (!snap.exists()) return;

    const raw = snap.data();
    const type = normalizeType(raw.type);
    if (type !== "credit") return;

    const currentPaid = Boolean(raw.paid);
    if (currentPaid === paid) return;
  if (currentPaid && raw.paidByPaymentId && !paid) return;

    const amount = Number(raw.amount ?? 0);
    const customerId = String(raw.customerId || "");

    transaction.update(txRef, {
      paid,
      paidAt: paid ? now : null,
      paidBy: paid ? cleanUser?.toLowerCase() || null : null,
      paidByName: paid ? userName : null,
    });

    if (customerId) {
      transaction.update(doc(db, "customers", customerId), {
        balance: increment(paid ? -amount : amount),
      });
    }
  });
}

export async function setCreditSecuredFire(id: string, secured: boolean, userCode?: string) {
  const txRef = doc(db, "transactions", id);
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);
  const now = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(txRef);
    if (!snap.exists()) return;
    const raw = snap.data();
    if (normalizeType(raw.type) !== "credit") return;
    if (Boolean(raw.paid)) return;
    if (Boolean(raw.secured) === secured) return;

    transaction.update(txRef, {
      secured,
      securedAt: secured ? now : null,
      securedBy: secured ? cleanUser?.toLowerCase() || null : null,
      securedByName: secured ? userName : null,
    });
  });
}

export async function deleteCustomerFire(id: string) {
  return deleteDoc(doc(db, "customers", id));
}

export async function deleteTransactionFire(id: string) {
  const txRef = doc(db, "transactions", id);
  const snap = await getDoc(txRef);
  const raw = snap.exists() ? snap.data() : null;
  const batch = writeBatch(db);
  batch.delete(txRef);
  if (raw?.customerId) {
    const type = normalizeType(raw.type);
    const amount = Number(raw.amount ?? 0);
    const paid = Boolean(raw.paid);
    batch.update(doc(db, "customers", String(raw.customerId)), {
      balance: increment(type === "credit" ? (paid ? 0 : -amount) : amount),
    });
  }
  await batch.commit();
}

export async function createCloudBackupFire(userCode?: string, label = "Manual backup") {
  const now = new Date().toISOString();
  const id = `b${Date.now()}`;
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);
  const customerSnap = await getDocs(customersCol);
  const txSnap = await getDocs(transactionsCol);

  await setDoc(doc(db, "cloudBackups", id), {
    id,
    createdAt: now,
    createdBy: cleanUser?.toLowerCase() || null,
    createdByName: userName,
    label,
    customerCount: customerSnap.size,
    transactionCount: txSnap.size,
    version: "daily-credit-v3",
  });

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  customerSnap.forEach((snapshot) => {
    ops.push((batch) => batch.set(doc(db, "cloudBackups", id, "customers", snapshot.id), snapshot.data()));
  });
  txSnap.forEach((snapshot) => {
    ops.push((batch) => batch.set(doc(db, "cloudBackups", id, "transactions", snapshot.id), snapshot.data()));
  });
  await commitChunked(ops);
  return id;
}

export async function listCloudBackupsFire(): Promise<CloudBackup[]> {
  const snap = await getDocs(cloudBackupsCol);
  const backups: CloudBackup[] = [];
  snap.forEach((snapshot) => {
    const raw = snapshot.data();
    backups.push({
      id: snapshot.id,
      createdAt: String(raw.createdAt || ""),
      createdBy: raw.createdBy ?? null,
      createdByName: raw.createdByName ?? null,
      label: raw.label ?? null,
      customerCount: Number(raw.customerCount ?? 0),
      transactionCount: Number(raw.transactionCount ?? 0),
    });
  });
  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function restoreCloudBackupFire(backupId: string, userCode?: string) {
  // Safety backup first, so a restore can be reversed manually if needed.
  await createCloudBackupFire(userCode, `Safety backup before restore ${backupId}`);

  const backupCustomers = await getDocs(collection(db, "cloudBackups", backupId, "customers"));
  const backupTransactions = await getDocs(collection(db, "cloudBackups", backupId, "transactions"));
  const currentCustomers = await getDocs(customersCol);
  const currentTransactions = await getDocs(transactionsCol);

  const deleteOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  currentTransactions.forEach((snapshot) => {
    deleteOps.push((batch) => batch.delete(doc(db, "transactions", snapshot.id)));
  });
  currentCustomers.forEach((snapshot) => {
    deleteOps.push((batch) => batch.delete(doc(db, "customers", snapshot.id)));
  });
  await commitChunked(deleteOps);

  const restoreOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  backupCustomers.forEach((snapshot) => {
    restoreOps.push((batch) => batch.set(doc(db, "customers", snapshot.id), snapshot.data()));
  });
  backupTransactions.forEach((snapshot) => {
    restoreOps.push((batch) => batch.set(doc(db, "transactions", snapshot.id), snapshot.data()));
  });
  await commitChunked(restoreOps);
}

export async function recalculateCustomerBalancesFire() {
  const customerSnap = await getDocs(customersCol);
  const txSnap = await getDocs(transactionsCol);
  const balances = new Map<string, number>();

  customerSnap.forEach((snapshot) => {
    balances.set(snapshot.id, 0);
  });

  txSnap.forEach((snapshot) => {
    const raw = snapshot.data();
    const customerId = String(raw.customerId || "");
    if (!customerId) return;

    const type = normalizeType(raw.type);
    const amount = Number(raw.amount ?? 0);
    const paid = Boolean(raw.paid);
    const current = balances.get(customerId) || 0;

    if (type === "credit") {
      balances.set(customerId, current + (paid ? 0 : amount));
    } else {
      balances.set(customerId, current - amount);
    }
  });

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  balances.forEach((balance, customerId) => {
    ops.push((batch) => batch.update(doc(db, "customers", customerId), { balance }));
  });
  await commitChunked(ops);
}

export { Timestamp };
