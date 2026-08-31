// Timestamps are represented uniformly as "seconds since the Unix epoch"
// (matching the `.seconds` property the UI already relies on). Both the
// Firebase and Supabase data layers convert their native date types to this
// shape, so the rest of the app is backend-agnostic.
export interface Timestamp {
  seconds: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: Timestamp;
  userCode: string | null;
  balance: number;
}

export interface Transaction {
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
