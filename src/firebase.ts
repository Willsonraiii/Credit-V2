import { initializeApp } from "firebase/app";
import {
  getFirestore,
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
const db = getFirestore(app);

// Firestore collection references
export const customersCol = collection(db, "customers");
export const transactionsCol = collection(db, "transactions");
export const cloudBackupsCol = collection(db, "cloudBackups");

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
  });
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
  const snap = await getDoc(txRef);
  if (!snap.exists()) return;

  const raw = snap.data();
  const type = normalizeType(raw.type);
  if (type !== "credit") return;

  const currentPaid = Boolean(raw.paid);
  if (currentPaid === paid) return;

  const amount = Number(raw.amount ?? 0);
  const customerId = String(raw.customerId || "");
  const cleanUser = userCode?.trim() || null;
  const userName = displayNameFromCode(cleanUser || undefined);
  const now = new Date().toISOString();

  const batch = writeBatch(db);
  batch.update(txRef, {
    paid,
    paidAt: paid ? now : null,
    paidBy: paid ? cleanUser?.toLowerCase() || null : null,
    paidByName: paid ? userName : null,
  });

  if (customerId) {
    batch.update(doc(db, "customers", customerId), {
      balance: increment(paid ? -amount : amount),
    });
  }
  await batch.commit();
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

export { Timestamp };
