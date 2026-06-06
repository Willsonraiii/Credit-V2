import type { Customer, Transaction } from "../types";

export const formatNPR = (n: number) =>
  `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

export const formatDate = (ts: { seconds?: number } | null | undefined) => {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

export const formatDateShort = (ts: { seconds?: number } | null | undefined) => {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short",
  });
};

export const balanceFor = (customerId: string, txs: Transaction[]) => {
  let bal = 0;
  for (const t of txs) {
    if (t.customerId !== customerId) continue;
    if (t.type === "credit") bal += t.paid ? 0 : t.amount;
    else bal -= t.amount;
  }
  return bal;
};

export const totals = (customers: Customer[], transactions: Transaction[]) => ({
  customers: customers.length,
  transactions: transactions.length,
  totalCredit: customers.reduce((s, c) => s + Math.max(0, Number.isFinite(c.balance) ? c.balance : balanceFor(c.id, transactions)), 0),
  totalPaid: transactions
    .filter((t) => t.type === "payment" || (t.type === "credit" && t.paid))
    .reduce((s, t) => s + t.amount, 0),
  totalGiven: transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0),
});
