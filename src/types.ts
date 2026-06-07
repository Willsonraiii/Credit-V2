import type { Timestamp } from "./firebase";

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
