import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, Users, Receipt, MapPin,
  Phone, Search, Plus, TrendingUp, TrendingDown,
  Trash2, X, ArrowLeft, HandCoins,
  Eye, Download, RotateCcw, Loader2, WifiOff,
  Clock3, KeyRound, Languages, Settings,
  ShieldCheck, LogOut, Pencil, UserPlus,
} from "lucide-react";
import NepaliDate from "nepali-date-converter";
import type { Customer, Transaction } from "./types";
import {
  listenCustomers, listenTransactions,
  addCustomerFire, addTransactionFire,
  deleteCustomerFire, deleteTransactionFire,
  updateCustomerFire, updateTransactionFire,
  setCreditPaidFire,
  createCloudBackupFire, listCloudBackupsFire, restoreCloudBackupFire,
  type CloudBackup,
} from "./firebase";
import Login from "./Login";
import {
  loadUsers, saveUsers, getActiveUserId, setActiveUserId, makeUserId,
  type PosUser,
} from "./users";
import { formatNPR, balanceFor, totals } from "./lib/utils";
import { cn } from "./utils/cn";

type LanguageMode = "en" | "ne";

const LOGO_SRC = "https://raw.githubusercontent.com/Willsonraiii/Credit-V2/main/icon-512.png";

const nepaliDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
const np = (value: string | number) => String(value).replace(/\d/g, (d) => nepaliDigits[Number(d)]);
const bsMonths = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कार्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत"];
const npDays = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार"];

const text = {
  en: {
    app: "Yalambar Store",
    subtitle: "Daily Credit Tracker - V3",
    dashboard: "Dashboard",
    customers: "Customers",
    transactions: "Transactions",
    live: "LIVE",
    user: "User",
    code: "Code",
    setCode: "Set user code",
    changeCode: "Change code",
    location: "Pipalbot, Talchhikhel-14, Lalitpur",
    totalCredit: "Total Credit",
    collected: "Collected",
    topOutstanding: "Top Outstanding",
    highestCredit: "Highest credit balances",
    recent: "Recent",
    latest: "Latest 6 transactions",
    all: "All",
    credit: "Credit",
    payment: "Payment",
    add: "Add",
    search: "Search...",
    cleared: "Cleared",
    since: "Since",
    history: "History",
    balance: "Balance",
    totalGiven: "Total Given",
    totalPaid: "Total Paid",
    recordBy: "By",
    oldRecord: "Old record",
    dataTools: "Data Tools",
    exportJson: "Export JSON",
    refreshData: "Refresh Data",
    newCustomer: "New Customer",
    fullName: "Full Name *",
    phone: "Phone",
    address: "Address",
    cancel: "Cancel",
    save: "Save",
    addCredit: "Add Credit",
    recordPayment: "Record Payment",
    amount: "Amount (NPR)",
    note: "Note (optional)",
    saveCredit: "Save Credit",
    stored: "Data stored securely in Firestore",
    recentlyCleared: "Cleared This Week",
    reviewWeek: "Available for 1 week review",
    calculation: "Calculation",
    paidSign: "PAID",
    dateFilter: "Date Filter",
    allDates: "All dates",
    today: "Today",
    yesterday: "Yesterday",
    customDate: "Custom date",
    englishDate: "English date",
    nepaliDate: "Nepali date",
    year: "Year",
    month: "Month",
    day: "Day",
  },
  ne: {
    app: "यलम्बर स्टोर",
    subtitle: "Daily Credit Tracker - V3",
    dashboard: "ड्यासबोर्ड",
    customers: "ग्राहकहरू",
    transactions: "कारोबारहरू",
    live: "लाइभ",
    user: "प्रयोगकर्ता",
    code: "कोड",
    setCode: "प्रयोगकर्ता कोड राख्नुहोस्",
    changeCode: "कोड परिवर्तन",
    location: "पिपलबोट, ताल्छिखेल-१४, ललितपुर",
    totalCredit: "जम्मा उधारो",
    collected: "उठेको रकम",
    topOutstanding: "धेरै बाँकी",
    highestCredit: "सबैभन्दा धेरै उधारो रकम",
    recent: "हालसालै",
    latest: "अन्तिम ६ कारोबार",
    all: "सबै",
    credit: "उधारो",
    payment: "भुक्तानी",
    add: "थप्नुहोस्",
    search: "खोज्नुहोस्...",
    cleared: "सफा",
    since: "देखि",
    history: "इतिहास",
    balance: "बाँकी",
    totalGiven: "जम्मा दिएको",
    totalPaid: "जम्मा तिरेको",
    recordBy: "द्वारा",
    oldRecord: "पुरानो रेकर्ड",
    dataTools: "डाटा उपकरण",
    exportJson: "JSON निर्यात",
    refreshData: "डाटा रिफ्रेस",
    newCustomer: "नयाँ ग्राहक",
    fullName: "पूरा नाम *",
    phone: "फोन",
    address: "ठेगाना",
    cancel: "रद्द",
    save: "सेभ",
    addCredit: "उधारो थप्नुहोस्",
    recordPayment: "भुक्तानी राख्नुहोस्",
    amount: "रकम (NPR)",
    note: "नोट (वैकल्पिक)",
    saveCredit: "उधारो सेभ",
    stored: "डाटा फायरस्टोरमा सुरक्षित छ",
    recentlyCleared: "यो हप्ता सफा भएका",
    reviewWeek: "१ हप्ता समीक्षा गर्न उपलब्ध",
    calculation: "हिसाब",
    paidSign: "तिरेको",
    dateFilter: "मिति फिल्टर",
    allDates: "सबै मिति",
    today: "आज",
    yesterday: "हिजो",
    customDate: "मिति छान्नुहोस्",
    englishDate: "अंग्रेजी मिति",
    nepaliDate: "नेपाली मिति",
    year: "वर्ष",
    month: "महिना",
    day: "दिन",
  },
};

type CopyText = typeof text.en;

function formatClock(date: Date, lang: LanguageMode) {
  return new Intl.DateTimeFormat(lang === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatLiveDate(date: Date, lang: LanguageMode) {
  if (lang === "ne") {
    const bs = new NepaliDate(date).getBS();
    return `${npDays[date.getDay()]}, ${np(bs.date)} ${bsMonths[bs.month]} ${np(bs.year)}`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRecordDate(ts: { seconds?: number } | null | undefined, lang: LanguageMode, short = false) {
  if (!ts?.seconds) return "—";
  const date = new Date(ts.seconds * 1000);
  if (lang === "ne") {
    const bs = new NepaliDate(date).getBS();
    return short
      ? `${np(bs.date)} ${bsMonths[bs.month]}`
      : `${np(bs.date)} ${bsMonths[bs.month]} ${np(bs.year)}`;
  }
  return new Intl.DateTimeFormat("en-GB", short
    ? { day: "2-digit", month: "short" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function currentBsParts() {
  const bs = new NepaliDate(new Date()).getBS();
  return {
    year: String(bs.year),
    month: String(bs.month + 1),
    day: String(bs.date),
  };
}

// ─── Reusable UI ───────────────────────────────────────────────
const inputClass =
  "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1155ff] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-600/45 transition-all hover:scale-[1.02] active:scale-[0.98]";

const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all";

// ─── Modal ─────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, icon }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; icon?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#0f172a] border border-white/10 p-5 sm:p-6 animate-slide-up sm:animate-scale-in">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1155ff]/25 to-blue-400/10 ring-1 ring-white/10 text-blue-200">
                {icon}
              </div>
            )}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const hues = [
    "from-rose-400 to-pink-500", "from-amber-400 to-orange-500",
    "from-blue-500 to-[#1155ff]", "from-indigo-400 to-blue-600",
    "from-sky-400 to-blue-500", "from-fuchsia-400 to-purple-500",
  ];
  const idx = Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % hues.length;
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${hues[idx]} text-slate-900 font-bold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────

type Tab = "dashboard" | "customers" | "transactions";
type View = { tab: Tab; customerId: string | null };

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [view, setView] = useState<View>({ tab: "dashboard", customerId: null });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [showRestoreBackup, setShowRestoreBackup] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [language, setLanguage] = useState<LanguageMode>(() =>
    (localStorage.getItem("yalambar_language") as LanguageMode | null) ?? "en",
  );

  // ─── POS users / login ───────────────────────────────────────
  const [users, setUsers] = useState<PosUser[]>(() => loadUsers());
  const [activeUser, setActiveUser] = useState<PosUser | null>(() => {
    const id = getActiveUserId();
    return id ? loadUsers().find((u) => u.id === id) ?? null : null;
  });
  const staffCode = activeUser ? activeUser.name.toUpperCase() : "";
  const isAdmin = !!activeUser?.isAdmin;

  const [now, setNow] = useState(() => new Date());
  const copy = text[language];

  // Toast helper
  const notify = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("yalambar_language", language);
  }, [language]);

  // ─── Login / logout helpers ──────────────────────────────────
  const handleLogin = (user: PosUser) => {
    setActiveUser(user);
    setActiveUserId(user.id);
  };
  const handleLogout = () => {
    setActiveUser(null);
    setActiveUserId(null);
    setShowSettings(false);
    setView({ tab: "dashboard", customerId: null });
  };

  // Firestore listeners
  useEffect(() => {
    setLoading(true);
    const unsubC = listenCustomers(
      (data) => { setCustomers(data); setLoading(false); setError(null); },
      (err) => { console.error(err); setError("Failed to load customers. Check your Firebase config."); setLoading(false); },
    );
    const unsubT = listenTransactions(
      (data) => { setTransactions(data); },
      (err) => console.error(err),
    );
    return () => { unsubC(); unsubT(); };
  }, []);

  const selectedCustomer = view.customerId ? customers.find((c) => c.id === view.customerId) ?? null : null;
  const customerTxs = selectedCustomer
    ? transactions.filter((t) => t.customerId === selectedCustomer.id).sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))
    : [];
  const customerBalance = selectedCustomer ? selectedCustomer.balance : 0;
  const t = totals(customers, transactions);

  // Filter helpers
  const [searchQ, setSearchQ] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "payment">("all");
  const [txDateFilter, setTxDateFilter] = useState<"all" | "today" | "yesterday" | "custom">("all");
  const [customTxDateMode, setCustomTxDateMode] = useState<"ad" | "bs">("ad");
  const [customTxDate, setCustomTxDate] = useState(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  });
  const [customBsDate, setCustomBsDate] = useState(currentBsParts);

  const sameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const txMatchesDateFilter = (tx: Transaction) => {
    if (txDateFilter === "all") return true;
    const txDate = new Date((tx.date?.seconds ?? 0) * 1000);
    const target = new Date();
    if (txDateFilter === "yesterday") target.setDate(target.getDate() - 1);
    if (txDateFilter === "custom") {
      if (customTxDateMode === "bs") {
        const year = Number(customBsDate.year);
        const month = Number(customBsDate.month);
        const day = Number(customBsDate.day);
        if (!year || !month || !day) return true;
        const converted = new NepaliDate(year, month - 1, day).toJsDate();
        target.setFullYear(converted.getFullYear(), converted.getMonth(), converted.getDate());
      } else {
        const [year, month, day] = customTxDate.split("-").map(Number);
        if (!year || !month || !day) return true;
        target.setFullYear(year, month - 1, day);
      }
    }
    return sameLocalDay(txDate, target);
  };

  const customerRows = customers.map((c) => {
    const txs = transactions.filter((tx) => tx.customerId === c.id);
    const creditTxs = txs.filter((tx) => tx.type === "credit");
    const paymentTxs = txs.filter((tx) => tx.type === "payment");
    const grossCredit = creditTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const paidCreditTxs = creditTxs.filter((tx) => tx.paid);
    const totalPaidAmount = paymentTxs.reduce((sum, tx) => sum + tx.amount, 0) + paidCreditTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const latestTx = [...txs].sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))[0];
    const latestPayment = [...paymentTxs, ...paidCreditTxs].sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))[0];
    return {
      ...c,
      txs,
      creditTxs,
      paidCreditTxs,
      paymentTxs,
      grossCredit,
      totalPaidAmount,
      latestTx,
      latestPayment,
      balance: Number.isFinite(c.balance) ? c.balance : balanceFor(c.id, transactions),
    };
  });

  const filteredCustomers = customerRows
    .filter((c) => {
      if (!searchQ) return true;
      const s = searchQ.toLowerCase();
      return c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s) || (c.address ?? "").toLowerCase().includes(s);
    })
    .sort((a, b) => b.balance - a.balance);

  const topDebtors = filteredCustomers.filter((c) => c.balance > 0).slice(0, 5);
  const maxDebt = Math.max(1, ...topDebtors.map((c) => c.balance));
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentlyCleared = customerRows
    .filter((c) => c.txs.length > 0 && c.balance <= 0 && (c.latestPayment?.date?.seconds ?? 0) * 1000 >= sevenDaysAgo)
    .sort((a, b) => (b.latestPayment?.date?.seconds ?? 0) - (a.latestPayment?.date?.seconds ?? 0));
  const recentlyClearedIds = new Set(recentlyCleared.map((c) => c.id));

  const calculationText = (row: typeof customerRows[number]) => {
    const creditParts = row.creditTxs.slice(0, 4).map((tx) => formatNPR(tx.amount).replace("Rs. ", ""));
    const more = row.creditTxs.length > 4 ? " + ..." : "";
    const plus = creditParts.length ? creditParts.join(" + ") + more : "0";
    const paid = row.totalPaidAmount > 0 ? ` - ${copy.paidSign} ${formatNPR(row.totalPaidAmount).replace("Rs. ", "")}` : "";
    return `${plus}${paid} = ${formatNPR(Math.max(0, row.balance))}`;
  };

  const filteredTxs = transactions
    .filter((tx) => txFilter === "all" || tx.type === txFilter)
    .filter(txMatchesDateFilter)
    .filter((tx) => {
      if (!searchQ) return true;
      const s = searchQ.toLowerCase();
      const c = customers.find((x) => x.id === tx.customerId);
      return (c?.name ?? "").toLowerCase().includes(s) || (tx.note ?? "").toLowerCase().includes(s);
    });

  const recentTx = transactions.slice(0, 6);

  const navGo = (tab: Tab, cid?: string) => { setView({ tab, customerId: cid ?? null }); setSearchQ(""); };

  // ─── Actions ─────────────────────────────────────────────────
  const handleAddCustomer = async (data: { name: string; phone?: string; address?: string }) => {
    try {
      await addCustomerFire({ ...data, userCode: staffCode });
      notify("Customer added ✓");
    } catch (e) { console.error(e); notify("Failed to add customer"); }
  };

  const handleEditCustomer = async (id: string, data: { name: string; phone?: string; address?: string }) => {
    try {
      await updateCustomerFire(id, data);
      notify("Customer updated ✓");
    } catch (e) { console.error(e); notify("Failed to update"); }
  };

  const handleEditTx = async (id: string, data: { amount: number; note?: string }) => {
    try {
      await updateTransactionFire(id, data);
      notify("Transaction updated ✓");
    } catch (e) { console.error(e); notify("Failed to update"); }
  };

  const handleToggleCreditPaid = async (tx: Transaction) => {
    if (tx.type !== "credit") return;
    try {
      await setCreditPaidFire(tx.id, !tx.paid, staffCode);
      notify(!tx.paid ? "Credit item marked PAID ✓" : "Credit item kept as credit ✓");
    } catch (e) { console.error(e); notify("Failed to update paid status"); }
  };

  const handleDeleteCustomer = async (c: Customer) => {
    if (!confirm(`Delete ${c.name} and all their transactions?`)) return;
    try {
      // Delete all transactions for this customer
      const txs = transactions.filter((t) => t.customerId === c.id);
      await Promise.all(txs.map((t) => deleteTransactionFire(t.id)));
      await deleteCustomerFire(c.id);
      if (view.customerId === c.id) setView({ tab: "dashboard", customerId: null });
      notify("Customer deleted ✓");
    } catch (e) { console.error(e); notify("Failed to delete"); }
  };

  const handleDeleteTx = async (tx: Transaction) => {
    if (!confirm("Delete this transaction?")) return;
    try { await deleteTransactionFire(tx.id); notify("Transaction deleted ✓"); }
    catch (e) { console.error(e); notify("Failed to delete"); }
  };

  const handleAddTx = async (type: "credit" | "payment", amount: number, note?: string) => {
    if (!selectedCustomer) return;
    try {
      await addTransactionFire({ customerId: selectedCustomer.id, type, amount, note, userCode: staffCode });
      notify(type === "credit" ? "Credit recorded ✓" : "Payment recorded ✓");
    } catch (e) { console.error(e); notify("Failed to record"); }
  };

  // ─── Data toolbar ────────────────────────────────────────────
  const storeInfo = {
    name: "Yalambar Store",
    location: copy.location,
  };

  const exportJson = () => {
    const data = JSON.stringify({ store: storeInfo, customers, transactions }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yalambar-credit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Exported ✓");
  };

  const handleCreateCloudBackup = async () => {
    setBackupBusy(true);
    try {
      await createCloudBackupFire(staffCode, "Manual backup");
      notify(language === "ne" ? "क्लाउड ब्याकअप भयो ✓" : "Cloud backup created ✓");
    } catch (e) {
      console.error(e);
      notify(language === "ne" ? "ब्याकअप असफल भयो" : "Cloud backup failed");
    } finally {
      setBackupBusy(false);
    }
  };

  const openRestoreBackups = async () => {
    setBackupBusy(true);
    try {
      const backups = await listCloudBackupsFire();
      setCloudBackups(backups);
      setShowRestoreBackup(true);
    } catch (e) {
      console.error(e);
      notify(language === "ne" ? "ब्याकअप सूची लोड भएन" : "Could not load backups");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreCloudBackup = async (backupId: string) => {
    const ok = confirm(
      language === "ne"
        ? "यो restore गर्दा अहिलेको डाटा बदलिन्छ। Restore अघि safety backup बनाइन्छ। जारी राख्ने?"
        : "This will replace current cloud data. A safety backup will be created first. Continue?",
    );
    if (!ok) return;
    setBackupBusy(true);
    try {
      await restoreCloudBackupFire(backupId, staffCode);
      notify(language === "ne" ? "Restore भयो ✓" : "Backup restored ✓");
      setShowRestoreBackup(false);
    } catch (e) {
      console.error(e);
      notify(language === "ne" ? "Restore असफल भयो" : "Restore failed");
    } finally {
      setBackupBusy(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  // POS login gate — must pick a user + enter PIN before using the app
  if (!activeUser) {
    return <Login users={users} onLogin={handleLogin} nepali={language === "ne"} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-[#1155ff] animate-spin mx-auto" />
          <p className="text-white/60 text-sm">Loading from Firebase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-6">
        <div className="text-center space-y-4 glass rounded-2xl p-8 max-w-md">
          <WifiOff className="h-10 w-10 text-rose-400 mx-auto" />
          <p className="text-white text-lg font-semibold">Connection Error</p>
          <p className="text-white/60 text-sm">{error}</p>
          <p className="text-white/40 text-xs mt-2">
            Edit <code className="bg-white/10 px-1.5 py-0.5 rounded">src/firebase.ts</code> with your Firebase config
          </p>
          <button onClick={() => window.location.reload()} className={btnPrimary}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] toast glass rounded-xl px-4 py-3 text-sm text-white font-medium shadow-xl">
          {toast}
        </div>
      )}

      {/* Top Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/5">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src={LOGO_SRC} alt="Yalambar Store" className="h-10 w-10 rounded-xl object-contain bg-black/40 ring-1 ring-white/10" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Yalambar Store</p>
              <p className="hidden sm:block text-[10px] text-white/40 uppercase tracking-wider">{copy.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
              <Clock3 className="h-4 w-4 text-[#1155ff]" />
              <div className="leading-tight text-right">
                <p className="text-xs font-semibold text-white tabular">{formatClock(now, language)}</p>
                <p className="text-[10px] text-white/45">{formatLiveDate(now, language)}</p>
              </div>
            </div>
            <button
              onClick={() => setLanguage(language === "en" ? "ne" : "en")}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1155ff]/15 border border-[#1155ff]/30 px-3 text-xs font-semibold text-blue-200 hover:bg-[#1155ff]/25 transition-all"
              aria-label="Change language"
            >
              <Languages className="h-4 w-4" /> {language === "en" ? "ने" : "EN"}
            </button>
             <button
               onClick={() => setShowSettings(true)}
               className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 text-xs font-medium text-white/80 hover:bg-white/10 transition-all"
               title={activeUser.name}
             >
               <KeyRound className="h-4 w-4 text-[#1155ff]" />
               <span className="max-w-[90px] truncate">{activeUser.name}</span>
               {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />}
             </button>
             <button
               onClick={() => setShowSettings(true)}
               className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
               aria-label="Settings"
               title="Settings"
             >
               <Settings className="h-4 w-4" />
             </button>
           </div>
        </div>

        <div className="md:hidden mx-3 mb-2 flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-blue-200"><span className="h-2 w-2 rounded-full bg-[#1155ff] animate-pulse" />{copy.live}</span>
          <span className="text-xs font-semibold text-white tabular">{formatClock(now, language)}</span>
          <span className="text-[10px] text-white/45 truncate max-w-[45%] text-right">{formatLiveDate(now, language)}</span>
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-6xl px-1 sm:px-6">
          <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {([
              ["dashboard", LayoutDashboard, copy.dashboard],
              ["customers", Users, copy.customers],
              ["transactions", Receipt, copy.transactions],
            ] as const).map(([id, Icon, label]) => {
              const active = view.tab === id;
              return (
                <button
                  key={id}
                  onClick={() => navGo(id)}
                  className={`relative inline-flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active ? "text-white" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {active && (
                    <span className="absolute left-2 sm:left-3 right-2 sm:right-3 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-[#1155ff] via-blue-400 to-white/70 animated-gradient" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        {/* Store header - always visible */}
        <div className="glass rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gradient-to-br from-[#1155ff]/25 to-blue-400/5 blur-2xl" />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <img src={LOGO_SRC} alt="Yalambar Store logo" className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-black/35 ring-1 ring-white/10 shadow-lg shadow-blue-700/20 animate-float" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                {storeInfo.name}
              </h1>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs sm:text-sm text-white/60">
                <MapPin className="h-3.5 w-3.5 text-[#1155ff] shrink-0" />
                <span className="truncate">{storeInfo.location}</span>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#1155ff]/15 border border-[#1155ff]/30 px-3 py-1 text-xs text-blue-200 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1155ff] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1155ff]" />
              </span>
              {copy.live}
            </span>
          </div>
        </div>

        {/* Content by view */}
        {view.customerId && selectedCustomer ? (
          /* ─── Customer Detail ───────────────────────────────── */
          <div className="space-y-4 animate-fade-up">
            <button onClick={() => navGo("customers")} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> {language === "ne" ? "फिर्ता" : "Back"}
            </button>

            <div className="glass rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[#1155ff]/18 to-blue-400/8 blur-2xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedCustomer.name} size={48} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedCustomer.name}</h2>
                      <button
                        onClick={() => setEditCustomer(selectedCustomer)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        title={language === "ne" ? "नाम सम्पादन" : "Edit name"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                      {selectedCustomer.phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer.phone}</span>
                      )}
                      {selectedCustomer.address && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedCustomer.address}</span>
                      )}
                      <span>{copy.since} {formatRecordDate(selectedCustomer.createdAt, language)}</span>
                      <span>{copy.recordBy}: {selectedCustomer.userCode || copy.oldRecord}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPayment(true)} className={btnGhost + " text-xs sm:text-sm"}>
                    <HandCoins className="h-4 w-4" /> {copy.payment}
                  </button>
                  <button onClick={() => setShowCredit(true)} className={btnPrimary + " text-xs sm:text-sm"}>
                    <Plus className="h-4 w-4" /> {copy.credit}
                  </button>
                </div>
              </div>

              <div className="relative mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  [copy.balance, formatNPR(customerBalance), customerBalance > 0 ? "text-rose-300" : "text-blue-300"],
                  [copy.totalGiven, formatNPR(customerTxs.filter((x) => x.type === "credit").reduce((s, x) => s + x.amount, 0)), "text-blue-300"],
                  [copy.totalPaid, formatNPR(customerTxs.filter((x) => x.type === "payment").reduce((s, x) => s + x.amount, 0)), "text-blue-300"],
                ].map(([lbl, val, cls], i) => (
                  <div key={i} className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">{lbl}</p>
                    <p className={`mt-1 text-sm sm:text-base font-semibold tabular ${cls}`}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="relative mt-3 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">{copy.calculation}</p>
                <p className="mt-1 text-xs text-white/70 tabular">
                  {(() => {
                    const credits = customerTxs.filter((tx) => tx.type === "credit");
                    const paid = customerTxs
                      .filter((tx) => tx.type === "payment" || (tx.type === "credit" && tx.paid))
                      .reduce((sum, tx) => sum + tx.amount, 0);
                    const creditLine = credits.length
                      ? credits.slice(0, 5).map((tx) => formatNPR(tx.amount).replace("Rs. ", "")).join(" + ") + (credits.length > 5 ? " + ..." : "")
                      : "0";
                    return `${creditLine}${paid ? ` - ${copy.paidSign} ${formatNPR(paid).replace("Rs. ", "")}` : ""} = ${formatNPR(Math.max(0, customerBalance))}`;
                  })()}
                </p>
              </div>
              {customerBalance <= 0 && recentlyClearedIds.has(selectedCustomer.id) && (() => {
                const latestPay = customerTxs.filter((x) => x.type === "payment").sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))[0];
                const daysLeft = latestPay ? Math.max(0, 7 - Math.floor((Date.now() - (latestPay.date?.seconds ?? 0) * 1000) / 86400000)) : 0;
                return (
                  <div className="relative mt-3 rounded-xl bg-[#1155ff]/10 border border-[#1155ff]/25 px-4 py-3 flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-[#1155ff] animate-pulse shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-200">{copy.paidSign} ✓ {copy.cleared}</p>
                      <p className="text-[11px] text-blue-200/70">
                        {language === "ne"
                          ? `${np(daysLeft)} दिन समीक्षा बाँकी · ${copy.reviewWeek}`
                          : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left for review · ${copy.reviewWeek}`}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-300" /> {copy.history}
                </h3>
                <span className="text-xs text-white/50">{customerTxs.length} entries</span>
              </div>
              {customerTxs.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-2xl">📒</div>
                  <p className="text-sm text-white/80">No transactions yet</p>
                </div>
              ) : (
                <ul className="space-y-1.5 stagger">
                  {customerTxs.map((tx) => {
                    const isCredit = tx.type === "credit";
                    const creditPaid = isCredit && tx.paid;
                    return (
                      <li key={tx.id} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors ${creditPaid ? "bg-[#1155ff]/5" : ""}`}>
                        <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ring-1 ${creditPaid ? "bg-[#1155ff]/15 text-blue-200 ring-blue-500/30" : isCredit ? "bg-rose-400/10 text-rose-300 ring-rose-400/20" : "bg-[#1155ff]/15 text-blue-200 ring-blue-500/30"}`}>
                          {isCredit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white capitalize">
                            {isCredit ? copy.credit : copy.payment}
                            {(creditPaid || !isCredit) && <span className="ml-2 rounded-full bg-[#1155ff]/15 px-2 py-0.5 text-[10px] font-semibold text-blue-200 ring-1 ring-blue-500/30">{copy.paidSign}</span>}
                          </p>
                          <p className="text-xs text-white/50 truncate">{tx.note || "—"} · {formatRecordDate(tx.date, language, true)}</p>
                          <p className="text-[10px] text-white/35 truncate">{copy.recordBy}: {tx.userCode || copy.oldRecord}</p>
                        </div>
                        <p className={`text-sm font-semibold tabular ${creditPaid ? "text-blue-300 line-through decoration-blue-300/60" : isCredit ? "text-rose-300" : "text-blue-300"}`}>
                          {isCredit ? "+" : "−"}{formatNPR(tx.amount).replace("Rs. ", "")}
                        </p>
                        {isCredit && (
                          <button
                            onClick={() => handleToggleCreditPaid(tx)}
                            className={`opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${creditPaid ? "bg-amber-500/10 text-amber-200 hover:bg-amber-500/20" : "bg-[#1155ff]/15 text-blue-200 hover:bg-[#1155ff]/25"}`}
                            title={creditPaid ? (language === "ne" ? "फेरि उधारो राख्नुहोस्" : "Keep as credit") : (language === "ne" ? "तिरेको चिन्ह लगाउनुहोस्" : "Mark paid")}
                          >
                            {creditPaid ? (language === "ne" ? "उधारो" : "UNPAID") : copy.paidSign}
                          </button>
                        )}
                        <button
                          onClick={() => setEditTx(tx)}
                          className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-300 hover:bg-[#1155ff]/15"
                          title={language === "ne" ? "सम्पादन" : "Edit"}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTx(tx)}
                          className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/10"
                          title={language === "ne" ? "मेटाउनुहोस्" : "Delete"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : view.tab === "dashboard" ? (
          /* ─── Dashboard ──────────────────────────────────────── */
          <div className="space-y-5 animate-fade-up">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
              {([
                [copy.customers, t.customers, <Users className="h-5 w-5" key="ic1" />, "indigo"] as const,
                [copy.transactions, t.transactions, <Receipt className="h-5 w-5" key="ic2" />, "amber"] as const,
                [copy.totalCredit, formatNPR(t.totalCredit), <TrendingUp className="h-5 w-5" key="ic3" />, "rose"] as const,
                [copy.collected, formatNPR(t.totalPaid), <TrendingDown className="h-5 w-5" key="ic4" />, "emerald"] as const,
              ]).map(([label, value, icon, tone], i) => {
                const tones: Record<string, string> = {
                  emerald: "from-[#1155ff]/25 to-blue-500/5 text-blue-200 ring-blue-500/30",
                  amber: "from-amber-400/20 to-amber-500/5 text-amber-300 ring-amber-400/20",
                  indigo: "from-[#1155ff]/25 to-blue-500/5 text-blue-200 ring-blue-500/30",
                  rose: "from-rose-400/20 to-rose-500/5 text-rose-300 ring-rose-400/20",
                };
                const toneStr: string = tone;
                return (
                  <div key={i} className="glass rounded-2xl p-4 relative overflow-hidden">
                    <div className={`absolute inset-x-0 -top-20 h-32 bg-gradient-to-b blur-2xl opacity-60 ${tones[toneStr]}`} />
                    <div className="relative">
                      <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-white/50">{label}</p>
                      <p className="mt-2 text-xl sm:text-2xl font-semibold tabular text-white">{value}</p>
                    </div>
                    <div className={`absolute bottom-3 right-3 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${tones[toneStr]}`}>
                      {icon}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 glass rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{copy.topOutstanding}</h3>
                    <p className="text-xs text-white/50">{copy.highestCredit}</p>
                  </div>
                  <button onClick={() => navGo("customers")} className="text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1">
                    {language === "ne" ? "सबै" : "View all"} <ArrowLeft className="h-3 w-3 rotate-180" />
                  </button>
                </div>
                {topDebtors.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-white/60">{language === "ne" ? "सबै सफा!" : "All clear!"} 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-3 stagger">
                    {topDebtors.map((c) => (
                      <button key={c.id} onClick={() => navGo("customers", c.id)} className="w-full text-left group">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} size={34} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">{c.name}</p>
                              <p className="text-sm font-semibold tabular text-rose-300">{formatNPR(c.balance)}</p>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-[#1155ff] to-blue-300 transition-all duration-700" style={{ width: `${Math.round((c.balance / maxDebt) * 100)}%` }} />
                            </div>
                              <p className="mt-1 text-[10px] text-white/40 truncate">
                                {copy.calculation}: {calculationText(c)}
                              </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {recentlyCleared.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{copy.recentlyCleared}</h4>
                        <p className="text-[11px] text-white/45">{copy.reviewWeek}</p>
                      </div>
                      <span className="rounded-full border border-blue-500/30 bg-[#1155ff]/15 px-2.5 py-1 text-[10px] font-semibold text-blue-200">
                        {copy.paidSign}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {recentlyCleared.map((c) => (
                        <button key={c.id} onClick={() => navGo("customers", c.id)} className="w-full rounded-xl bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06] transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{c.name}</p>
                              <p className="truncate text-[10px] text-white/45">{copy.calculation}: {calculationText(c)}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-blue-500/30 bg-[#1155ff]/15 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                              {copy.paidSign}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 glass rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{copy.recent}</h3>
                    <p className="text-xs text-white/50">{copy.latest}</p>
                  </div>
                  <button onClick={() => navGo("transactions")} className="text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1">
                    All <ArrowLeft className="h-3 w-3 rotate-180" />
                  </button>
                </div>
                {recentTx.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-white/60">No transactions yet</p>
                  </div>
                ) : (
                  <ul className="space-y-2 stagger">
                    {recentTx.map((tx) => {
                      const c = customers.find((x) => x.id === tx.customerId);
                      if (!c) return null;
                      const isCredit = tx.type === "credit";
                      const creditPaid = isCredit && tx.paid;
                      return (
                        <li key={tx.id} className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${creditPaid ? "bg-[#1155ff]/15 text-blue-200 ring-1 ring-blue-500/30" : isCredit ? "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20" : "bg-[#1155ff]/15 text-blue-200 ring-1 ring-blue-500/30"}`}>
                            {isCredit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{c.name}</p>
                            <p className="text-xs text-white/50">
                              {tx.note || (isCredit ? copy.credit : copy.payment)} · {formatRecordDate(tx.date, language, true)}
                              {(creditPaid || !isCredit) && <span className="ml-1 rounded-full bg-[#1155ff]/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200 ring-1 ring-blue-500/30">{copy.paidSign}</span>}
                            </p>
                            <p className="text-[10px] text-white/35">{copy.recordBy}: {tx.userCode || copy.oldRecord}</p>
                          </div>
                          <p className={`text-sm font-semibold tabular ${creditPaid ? "text-blue-300 line-through decoration-blue-300/60" : isCredit ? "text-rose-300" : "text-blue-300"}`}>{isCredit ? "+" : "−"}{formatNPR(tx.amount).replace("Rs. ", "")}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : view.tab === "customers" ? (
          /* ─── Customers ───────────────────────────────────────── */
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{copy.customers}</h2>
                <p className="text-xs text-white/50">{customers.length} {language === "ne" ? "खाताहरू" : "accounts"}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input type="text" placeholder={copy.search} value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                    className={inputClass + " pl-9"} />
                </div>
                <button onClick={() => setShowAddCustomer(true)} className={btnPrimary}>
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{copy.add}</span>
                </button>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-2xl">👤</div>
                <p className="text-sm text-white/80">{language === "ne" ? "ग्राहक भेटिएन" : "No customers found"}</p>
                <p className="text-xs text-white/40 mt-1">{searchQ ? (language === "ne" ? "अर्को खोज प्रयास गर्नुहोस्" : "Try a different search") : (language === "ne" ? "नयाँ ग्राहक थप्नुहोस्" : "Tap Add to create one")}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
                {filteredCustomers.map((c) => {
                  const isRecentlyCleared = recentlyClearedIds.has(c.id);
                  const daysLeft = isRecentlyCleared && c.latestPayment
                    ? Math.max(0, 7 - Math.floor((Date.now() - (c.latestPayment.date?.seconds ?? 0) * 1000) / 86400000))
                    : 0;
                  return (
                  <div key={c.id} className={`glass rounded-2xl p-4 hover:border-blue-500/30 hover:-translate-y-0.5 transition-all duration-300 ${isRecentlyCleared ? "border-[#1155ff]/25" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Avatar name={c.name} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                        <p className={`text-sm font-bold tabular mt-0.5 ${c.balance > 0 ? "text-rose-300" : "text-blue-300"}`}>
                          {c.balance > 0 ? formatNPR(c.balance) : <>{copy.cleared} <span className="ml-1 rounded-full bg-[#1155ff]/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200 ring-1 ring-blue-500/30">{copy.paidSign}</span></>}
                        </p>
                      </div>
                    </div>
                    {isRecentlyCleared && (
                      <div className="mt-2 rounded-lg bg-[#1155ff]/10 border border-[#1155ff]/25 px-3 py-1.5 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#1155ff] animate-pulse shrink-0" />
                        <p className="text-[11px] text-blue-200">
                          {language === "ne"
                            ? `✓ सफा भयो · ${np(daysLeft)} दिन समीक्षा बाँकी`
                            : `✓ Cleared · ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left for review`}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 space-y-1 text-xs text-white/50">
                      {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</div>}
                      {c.address && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {c.address}</div>}
                      <div>{copy.since} {formatRecordDate(c.createdAt, language)}</div>
                      <div>{copy.calculation}: {calculationText(c)}</div>
                      <div>{copy.recordBy}: {c.userCode || copy.oldRecord}</div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => navGo("customers", c.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => handleDeleteCustomer(c)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-400/20 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ─── Transactions ────────────────────────────────────── */
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{copy.transactions}</h2>
                <p className="text-xs text-white/50">{transactions.length} {language === "ne" ? "रेकर्ड" : "entries"}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input type="text" placeholder={copy.search} value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                    className={inputClass + " pl-9"} />
                </div>
                <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
                  {(["all", "credit", "payment"] as const).map((k) => (
                    <button key={k} onClick={() => { setTxFilter(k); setSearchQ(""); }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all capitalize ${txFilter === k ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
                      {k === "all" ? copy.all : k === "credit" ? copy.credit : copy.payment}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">{copy.dateFilter}</p>
                <p className="text-[11px] text-white/40">
                  {filteredTxs.length} {language === "ne" ? "रेकर्ड" : "records"}
                </p>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {([
                  ["all", copy.allDates],
                  ["today", copy.today],
                  ["yesterday", copy.yesterday],
                  ["custom", copy.customDate],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTxDateFilter(key)}
                    className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      txDateFilter === key
                        ? "bg-[#1155ff] text-white shadow-lg shadow-blue-700/20"
                        : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {txDateFilter === "custom" && (
                <div className="mt-3 space-y-2">
                  <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
                    {(["ad", "bs"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setCustomTxDateMode(mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          customTxDateMode === mode ? "bg-[#1155ff] text-white" : "text-white/55 hover:text-white"
                        }`}
                      >
                        {mode === "ad" ? copy.englishDate : copy.nepaliDate}
                      </button>
                    ))}
                  </div>

                  {customTxDateMode === "ad" ? (
                    <input
                      type="date"
                      value={customTxDate}
                      onChange={(e) => setCustomTxDate(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={customBsDate.year}
                        onChange={(e) => setCustomBsDate((d) => ({ ...d, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                        inputMode="numeric"
                        placeholder={copy.year}
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <select
                        value={customBsDate.month}
                        onChange={(e) => setCustomBsDate((d) => ({ ...d, month: e.target.value }))}
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      >
                        {bsMonths.map((month, index) => (
                          <option key={month} value={index + 1} className="bg-slate-900 text-white">
                            {language === "ne" ? month : `${index + 1}`}
                          </option>
                        ))}
                      </select>
                      <input
                        value={customBsDate.day}
                        onChange={(e) => setCustomBsDate((d) => ({ ...d, day: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                        inputMode="numeric"
                        placeholder={copy.day}
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              {filteredTxs.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-2xl">📜</div>
                  <p className="text-sm text-white/80">{language === "ne" ? "कारोबार छैन" : "No transactions"}</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {filteredTxs.map((tx) => {
                    const c = customers.find((x) => x.id === tx.customerId);
                    if (!c) return null;
                    const isCredit = tx.type === "credit";
                    const creditPaid = isCredit && tx.paid;
                    return (
                      <li key={tx.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                        <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ring-1 ${creditPaid ? "bg-[#1155ff]/15 text-blue-200 ring-blue-500/30" : isCredit ? "bg-rose-400/10 text-rose-300 ring-rose-400/20" : "bg-[#1155ff]/15 text-blue-200 ring-blue-500/30"}`}>
                          {isCredit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <Avatar name={c.name} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <p className="text-xs text-white/50 truncate">
                            {tx.note || (isCredit ? copy.credit : copy.payment)} · {formatRecordDate(tx.date, language, true)}
                            {(creditPaid || !isCredit) && <span className="ml-1 rounded-full bg-[#1155ff]/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200 ring-1 ring-blue-500/30">{copy.paidSign}</span>}
                          </p>
                          <p className="text-[10px] text-white/35 truncate">{copy.recordBy}: {tx.userCode || copy.oldRecord}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold tabular ${creditPaid ? "text-blue-300 line-through decoration-blue-300/60" : isCredit ? "text-rose-300" : "text-blue-300"}`}>
                            {isCredit ? "+" : "−"}{formatNPR(tx.amount).replace("Rs. ", "")}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-white/40">{creditPaid ? copy.paidSign : isCredit ? copy.credit : copy.paidSign}</p>
                        </div>
                        {isCredit && (
                          <button onClick={() => handleToggleCreditPaid(tx)} className={`opacity-0 group-hover:opacity-100 transition-opacity inline-flex rounded-lg px-2 py-1 text-[10px] font-semibold ${creditPaid ? "text-amber-200 hover:bg-amber-500/10" : "text-blue-200 hover:bg-[#1155ff]/15"}`}>
                            {creditPaid ? (language === "ne" ? "उधारो" : "UNPAID") : copy.paidSign}
                          </button>
                        )}
                        <button onClick={() => handleDeleteTx(tx)} className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-3 sm:px-6 pb-20 sm:pb-16 pt-4 text-center text-xs text-white/40">
        <p>Yalambar Store · Daily Credit Tracker - V3</p>
        <p className="mt-1">{copy.stored}</p>
      </footer>

      {/* Modals */}
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} onSubmit={handleAddCustomer} copy={copy} />
      <TxModal open={showCredit} onClose={() => setShowCredit(false)} kind="credit" copy={copy} onSubmit={(a, n) => { handleAddTx("credit", a, n); setShowCredit(false); }} />
      <TxModal open={showPayment} onClose={() => setShowPayment(false)} kind="payment" copy={copy} onSubmit={(a, n) => { handleAddTx("payment", a, n); setShowPayment(false); }} />

      {/* Edit Customer Modal */}
      <EditCustomerModal
        open={!!editCustomer}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        copy={copy}
        onSubmit={(id, d) => { handleEditCustomer(id, d); setEditCustomer(null); }}
      />

      {/* Edit Transaction Modal */}
      <EditTxModal
        open={!!editTx}
        tx={editTx}
        onClose={() => setEditTx(null)}
        copy={copy}
        language={language}
        onSubmit={(id, d) => { handleEditTx(id, d); setEditTx(null); }}
      />

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title={language === "ne" ? "सेटिङहरू" : "Settings"}
        icon={<Settings className="h-5 w-5" />}
      >
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-2">{language === "ne" ? "लग - इन प्रयोगकर्ता" : "Logged in as"}</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-blue-200">{activeUser.name}</p>
              {isAdmin && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-200 bg-[#1155ff]/10 border border-[#1155ff]/30 rounded-full px-2.5 py-0.5">
                  <ShieldCheck className="h-3 w-3" /> {language === "ne" ? "एडमिन" : "ADMIN"}
                </span>
              )}
            </div>
            <button onClick={handleLogout} className={btnGhost}>
              <LogOut className="h-4 w-4" /> {language === "ne" ? "लग आउट" : "Log out"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setLanguage(language === "en" ? "ne" : "en")}
            className={btnGhost}
          >
            <Languages className="h-4 w-4" /> {language === "en" ? "नेपालीमा स्विच" : "Switch to English"}
          </button>
          <button onClick={exportJson} className={btnGhost}>
            <Download className="h-4 w-4" /> {copy.exportJson}
          </button>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
            {language === "ne" ? "क्लाउड ब्याकअप (फायरबेस)" : "Cloud Backup (Firebase)"}
          </p>
          <p className="text-xs text-white/50">
            {language === "ne"
              ? "तपाईंले सेट गरेको फायरबेस प्रोजेक्टमा सबै ग्राहक र कारोबार स्वचालित रूपमा बचत गरिन्छ।"
              : "All customers and transactions are saved automatically to your configured Firebase project."}
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={handleCreateCloudBackup} disabled={backupBusy} className={cn(btnGhost, "disabled:opacity-40 disabled:cursor-not-allowed")}>
              <Download className="h-4 w-4" /> {language === "ne" ? "Manual Cloud Backup" : "Manual Cloud Backup"}
            </button>
            <button onClick={openRestoreBackups} disabled={backupBusy || !isAdmin} className={cn(btnPrimary, "disabled:opacity-40 disabled:cursor-not-allowed")}>
              <RotateCcw className="h-4 w-4" /> {language === "ne" ? "Restore Backup" : "Restore Backup"}
            </button>
          </div>
          {!isAdmin && (
            <p className="mt-2 text-[11px] text-white/35 text-center">
              {language === "ne" ? "Restore गर्न एडमिन चाहिन्छ।" : "Restore is admin-only."}
            </p>
          )}
          <p className="text-[11px] text-white/40 mt-2 text-center">
            <code className="bg-white/10 px-1.5 py-0.5 rounded">src/firebase.ts</code>
          </p>
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => { setShowSettings(false); setShowManageUsers(true); }}
              className={btnGhost}
            >
              <UserPlus className="h-4 w-4" /> {language === "ne" ? "प्रयोगकर्ता व्यवस्थापन" : "Manage Users"}
            </button>
            <button
              onClick={() => { setShowSettings(false); setShowAdminPanel(true); }}
              className={btnPrimary}
            >
              <KeyRound className="h-4 w-4" /> {language === "ne" ? "व्यवस्थापक प्यानल" : "Admin Panel"}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-white/40 text-center">
            {language === "ne" ? "प्रयोगकर्ता व्यवस्थापन एडमिनको लागि मात्र।" : "User management is admin-only."}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={() => setShowSettings(false)} className={btnGhost}>{copy.cancel}</button>
        </div>
      </Modal>

      {/* Manage Users Modal (admin only) */}
      <ManageUsersModal
        open={showManageUsers}
        onClose={() => setShowManageUsers(false)}
        language={language}
        copy={copy}
        users={users}
        activeUserId={activeUser.id}
        onSave={(next) => { setUsers(next); saveUsers(next); notify(language === "ne" ? "सुरक्षित ✓" : "Saved ✓"); }}
      />

      {/* Restore Cloud Backup Modal (admin only) */}
      <RestoreBackupModal
        open={showRestoreBackup}
        onClose={() => setShowRestoreBackup(false)}
        backups={cloudBackups}
        busy={backupBusy}
        language={language}
        copy={copy}
        onRestore={handleRestoreCloudBackup}
      />

       {/* Admin Panel Modal (records by user, admin only) */}
      <AdminPanelModal
        open={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        copy={copy}
        customers={customers}
        transactions={transactions}
        staffCode={staffCode}
        language={language}
      />
    </div>
  );
}

// ─── Add Customer Modal ────────────────────────────────────────
function AddCustomerModal({ open, onClose, onSubmit, copy }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (d: { name: string; phone?: string; address?: string }) => void;
  copy: CopyText;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), phone: phone.trim() || undefined, address: address.trim() || undefined });
    setName(""); setPhone(""); setAddress("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={copy.newCustomer} icon={<Users className="h-5 w-5" />}>
      <Label text={copy.fullName}>
        <input autoFocus type="text" placeholder="e.g. Ramesh Tamang" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Label text={copy.phone}>
          <input type="tel" placeholder="98XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Label>
        <Label text={copy.address}>
          <input type="text" placeholder="Tole / area" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </Label>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
        <button onClick={submit} disabled={!name.trim()} className={cn(btnPrimary, "disabled:opacity-40 disabled:cursor-not-allowed")}>{copy.save}</button>
      </div>
    </Modal>
  );
}

// ─── Transaction Modal ─────────────────────────────────────────
function TxModal({ open, onClose, kind, onSubmit, copy }: {
  open: boolean;
  onClose: () => void;
  kind: "credit" | "payment";
  onSubmit: (amount: number, note?: string) => void;
  copy: CopyText;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const isCredit = kind === "credit";

  const submit = () => {
    const n = Math.round(Number(amount));
    if (!n || n <= 0) return;
    onSubmit(n, note.trim() || undefined);
    setAmount(""); setNote("");
  };

  return (
    <Modal open={open} onClose={onClose} title={isCredit ? copy.addCredit : copy.recordPayment}
      icon={isCredit ? <TrendingUp className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
    >
      <Label text={copy.amount}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rs.</span>
          <input autoFocus type="number" inputMode="numeric" min={1} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
            className={inputClass + " pl-10"} />
        </div>
      </Label>
      <Label text={copy.note}>
        <input type="text" placeholder={isCredit ? "e.g. Groceries, rice…" : "e.g. Cash, eSewa…"} value={note} onChange={(e) => setNote(e.target.value)}
          className={inputClass} />
      </Label>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
        <button onClick={submit} disabled={!Number(amount) || Number(amount) <= 0} className={cn(btnPrimary, "disabled:opacity-40 disabled:cursor-not-allowed")}>
          {isCredit ? copy.saveCredit : copy.recordPayment}
        </button>
      </div>
    </Modal>
  );
}

// ─── Edit Customer Modal ───────────────────────────────────────
function EditCustomerModal({ open, onClose, onSubmit, customer, copy }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (id: string, d: { name: string; phone?: string; address?: string }) => void;
  customer: Customer | null;
  copy: CopyText;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setAddress(customer.address ?? "");
    }
  }, [customer, open]);

  const submit = () => {
    if (!name.trim() || !customer) return;
    onSubmit(customer.id, { name: name.trim(), phone: phone.trim(), address: address.trim() });
  };

  return (
    <Modal open={open} onClose={onClose} title={copy.newCustomer.replace("New", "Edit").replace("नयाँ", "सम्पादन")} icon={<Pencil className="h-5 w-5" />}>
      <Label text={copy.fullName}>
        <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Label text={copy.phone}>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Label>
        <Label text={copy.address}>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </Label>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
        <button onClick={submit} disabled={!name.trim()} className={cn(btnPrimary, "disabled:opacity-40 disabled:cursor-not-allowed")}>{copy.save}</button>
      </div>
    </Modal>
  );
}

// ─── Edit Transaction Modal ────────────────────────────────────
function EditTxModal({ open, onClose, onSubmit, tx, copy, language }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (id: string, d: { amount: number; note?: string }) => void;
  tx: Transaction | null;
  copy: CopyText;
  language: LanguageMode;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (tx) {
      setAmount(String(tx.amount));
      setNote(tx.note ?? "");
    }
  }, [tx, open]);

  const submit = () => {
    const n = Math.round(Number(amount));
    if (!n || n <= 0 || !tx) return;
    onSubmit(tx.id, { amount: n, note: note.trim() || undefined });
  };

  const isCredit = tx?.type === "credit";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={language === "ne" ? "रेकर्ड सम्पादन" : "Edit Record"}
      icon={<Pencil className="h-5 w-5" />}
    >
      {tx && (
        <p className="text-xs text-white/50">
          {isCredit ? copy.credit : copy.payment} · {copy.recordBy}: {tx.userCode || copy.oldRecord}
        </p>
      )}
      <Label text={copy.amount}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rs.</span>
          <input autoFocus type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass + " pl-10"} />
        </div>
      </Label>
      <Label text={language === "ne" ? "वस्तु / नोट" : "Item / Note"}>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={language === "ne" ? "जस्तै: चामल, तेल" : "e.g. Rice, Oil"} />
      </Label>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
        <button onClick={submit} disabled={!Number(amount) || Number(amount) <= 0} className={cn(btnPrimary, "disabled:opacity-40 disabled:cursor-not-allowed")}>{copy.save}</button>
      </div>
    </Modal>
  );
}

// ─── Manage Users Modal (admin only) ───────────────────────────
function ManageUsersModal({ open, onClose, users, onSave, activeUserId, language, copy }: {
  open: boolean;
  onClose: () => void;
  users: PosUser[];
  onSave: (next: PosUser[]) => void;
  activeUserId: string;
  language: LanguageMode;
  copy: CopyText;
}) {
  const [list, setList] = useState<PosUser[]>(users);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [admin, setAdmin] = useState(false);

  useEffect(() => { setList(users); }, [users, open]);

  const tt = {
    title: language === "ne" ? "प्रयोगकर्ता व्यवस्थापन" : "Manage Users",
    add: language === "ne" ? "नयाँ प्रयोगकर्ता" : "New user",
    name: language === "ne" ? "नाम" : "Name",
    pin: language === "ne" ? "PIN (४ अंक)" : "PIN (4 digits)",
    admin: language === "ne" ? "एडमिन" : "Admin",
    addBtn: language === "ne" ? "थप्नुहोस्" : "Add",
    you: language === "ne" ? "तपाईं" : "You",
  };

  const addUser = () => {
    const cleanName = name.trim();
    const cleanPin = pin.trim();
    if (!cleanName || !/^\d{4}$/.test(cleanPin)) return;
    const next = [...list, { id: makeUserId(), name: cleanName, pin: cleanPin, isAdmin: admin }];
    setList(next);
    onSave(next);
    setName(""); setPin(""); setAdmin(false);
  };

  const removeUser = (id: string) => {
    if (id === activeUserId) return;
    const next = list.filter((u) => u.id !== id);
    if (next.length === 0) return;
    setList(next);
    onSave(next);
  };

  const updatePin = (id: string, newPin: string) => {
    if (!/^\d{4}$/.test(newPin)) return;
    const next = list.map((u) => (u.id === id ? { ...u, pin: newPin } : u));
    setList(next);
    onSave(next);
  };

  const toggleAdmin = (id: string) => {
    const next = list.map((u) => (u.id === id ? { ...u, isAdmin: !u.isAdmin } : u));
    setList(next);
    onSave(next);
  };

  return (
    <Modal open={open} onClose={onClose} title={tt.title} icon={<UserPlus className="h-5 w-5" />}>
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
        {list.map((u) => (
          <div key={u.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {u.name}{u.id === activeUserId && <span className="ml-1 text-[10px] text-blue-300">({tt.you})</span>}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  defaultValue={u.pin}
                  maxLength={4}
                  inputMode="numeric"
                  onBlur={(e) => updatePin(u.id, e.target.value)}
                  className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-center text-sm text-white tracking-widest"
                />
                <button
                  onClick={() => toggleAdmin(u.id)}
                  className={`text-[10px] rounded-full px-2 py-0.5 border ${u.isAdmin ? "bg-[#1155ff]/15 text-blue-200 border-[#1155ff]/30" : "bg-white/5 text-white/40 border-white/10"}`}
                >
                  {tt.admin}
                </button>
              </div>
            </div>
            {u.id !== activeUserId && (
              <button onClick={() => removeUser(u.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
        <p className="text-xs uppercase tracking-widest text-white/40">{tt.add}</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt.name} className={inputClass} />
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={tt.pin} inputMode="numeric" className={inputClass + " tracking-widest"} />
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="accent-[#1155ff]" />
          {tt.admin}
        </label>
        <button onClick={addUser} disabled={!name.trim() || !/^\d{4}$/.test(pin)} className={cn(btnPrimary, "w-full disabled:opacity-40 disabled:cursor-not-allowed")}>
          <UserPlus className="h-4 w-4" /> {tt.addBtn}
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
      </div>
    </Modal>
  );
}

// ─── Restore Backup Modal ──────────────────────────────────────
function RestoreBackupModal({ open, onClose, backups, onRestore, busy, language, copy }: {
  open: boolean;
  onClose: () => void;
  backups: CloudBackup[];
  onRestore: (id: string) => void;
  busy: boolean;
  language: LanguageMode;
  copy: CopyText;
}) {
  return (
    <Modal open={open} onClose={onClose} title={language === "ne" ? "ब्याकअप Restore" : "Restore Cloud Backup"} icon={<RotateCcw className="h-5 w-5" />}>
      <p className="text-sm text-white/60">
        {language === "ne"
          ? "Restore गर्नु अघि अहिलेको डाटाको safety backup आफैं बनाइन्छ।"
          : "A safety backup of current data is created automatically before restore."}
      </p>
      {backups.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center text-sm text-white/50">
          {language === "ne" ? "Cloud backup भेटिएन।" : "No cloud backups found."}
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {backups.map((backup) => (
            <div key={backup.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{backup.label || "Manual backup"}</p>
                  <p className="mt-1 text-xs text-white/50">
                    {new Date(backup.createdAt).toLocaleString(language === "ne" ? "ne-NP" : "en-GB")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {backup.customerCount} {copy.customers} · {backup.transactionCount} {copy.transactions}
                    {backup.createdByName ? ` · ${copy.recordBy}: ${backup.createdByName}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onRestore(backup.id)}
                  disabled={busy}
                  className={cn(btnPrimary, "shrink-0 disabled:opacity-40 disabled:cursor-not-allowed")}
                >
                  <RotateCcw className="h-4 w-4" /> {language === "ne" ? "Restore" : "Restore"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
      </div>
    </Modal>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-white/50">{text}</span>
      {children}
    </label>
  );
}

// ─── Admin Panel Modal ──────────────────────────────────────────
// Shows who is using which staff code in the currently loaded data.
// Admin-only. Also lets admins manually re-tag any document's user code
// (useful when migrating older records that don't have userCode yet).
function AdminPanelModal({
  open, onClose, copy, customers, transactions, staffCode, language,
}: {
  open: boolean;
  onClose: () => void;
  copy: CopyText;
  customers: Customer[];
  transactions: Transaction[];
  staffCode: string;
  language: LanguageMode;
}) {
  const isNepali = language === "ne";
  const [selectedTab, setSelectedTab] = useState<"codes" | "customers" | "transactions">("codes");

  // Unique staff codes currently present (not counting missing ones as "Unknown").
  const codes = Array.from(new Set([
    ...customers.map((c) => (c.userCode || "").toUpperCase()).filter(Boolean),
    ...transactions.map((t) => (t.userCode || "").toUpperCase()).filter(Boolean),
  ])).sort();

  const countByCode = (code: string) => ({
    customers: customers.filter((c) => (c.userCode || "").toUpperCase() === code).length,
    transactions: transactions.filter((t) => (t.userCode || "").toUpperCase() === code).length,
  });

  const unknown = {
    customers: customers.filter((c) => !c.userCode).length,
    transactions: transactions.filter((t) => !t.userCode).length,
  };

   return (
     <Modal
       open={open}
       onClose={onClose}
       title={isNepali ? "व्यवस्थापक प्यानल" : "Admin Panel"}
       icon={<KeyRound className="h-5 w-5" />}
     >
       <p className="text-sm text-white/60">
         {isNepali
           ? "तपाईं व्यवस्थापक हुनुहुन्छ। स्टाफ कोडहरू, ग्राहकहरू र कारोबारहरूको सारांश हेर्नुहोस्।"
           : `Signed in as ${staffCode || "—"} (admin).`}
       </p>

       <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
         {([
           ["codes", isNepali ? "कोडहरू" : "Codes"],
           ["customers", isNepali ? "ग्राहकहरू" : "Customers"],
           ["transactions", isNepali ? "कारोबारहरू" : "Transactions"],
         ] as const).map(([k, label]) => (
           <button
             key={k}
             onClick={() => setSelectedTab(k)}
             className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
               selectedTab === k ? "bg-[#1155ff] text-white shadow" : "text-white/60 hover:text-white"
             }`}
           >
             {label}
           </button>
         ))}
       </div>

       {selectedTab === "codes" && (
         <div className="space-y-2">
           <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
             <div>
               <p className="text-sm font-semibold text-white">{isNepali ? "अज्ञात (पुरानो रेकर्ड)" : "Unknown (old records)"}</p>
               <p className="text-xs text-white/50">
                 {isNepali
                   ? `${unknown.customers} ग्राहक, ${unknown.transactions} कारोबार`
                   : `${unknown.customers} customers, ${unknown.transactions} transactions`}
               </p>
             </div>
             <span className="text-xs text-white/40">{unknown.customers + unknown.transactions}</span>
           </div>

           {codes.length === 0 && (
             <div className="py-8 text-center text-sm text-white/50">
               {isNepali ? "कुनै कोडहरू फेला परेनन्।" : "No staff codes found yet."}
             </div>
           )}

           <div className="space-y-1.5">
             {codes.map((code) => {
               const c = countByCode(code);
               return (
                 <div key={code} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                   <div>
                     <p className="text-sm font-semibold text-white tabular">{code}</p>
                     <p className="text-xs text-white/50">
                       {isNepali
                         ? `${c.customers} ग्राहक, ${c.transactions} कारोबार`
                         : `${c.customers} customers, ${c.transactions} transactions`}
                     </p>
                   </div>
                   <span className="text-xs text-[#1155ff] font-semibold tabular">
                     {c.customers + c.transactions}
                   </span>
                 </div>
               );
             })}
           </div>
         </div>
       )}

       {selectedTab === "customers" && (
         <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
           {customers.length === 0 ? (
             <p className="py-8 text-center text-sm text-white/50">
               {isNepali ? "कुनै ग्राहकहरू छैनन्।" : "No customers yet."}
             </p>
           ) : (
             customers.map((c) => (
               <div key={c.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                 <div className="min-w-0">
                   <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                   <p className="text-[11px] text-white/50 truncate">
                     {isNepali ? `द्वारा: ${c.userCode || "—"}` : `By: ${c.userCode || "—"}`}
                   </p>
                 </div>
                 <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.userCode ? "bg-[#1155ff]/15 text-blue-200 border border-[#1155ff]/30" : "bg-white/5 text-white/50 border border-white/10"}`}>
                   {c.userCode || (isNepali ? "अज्ञात" : "Unknown")}
                 </span>
               </div>
             ))
           )}
         </div>
       )}

       {selectedTab === "transactions" && (
         <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
           {transactions.length === 0 ? (
             <p className="py-8 text-center text-sm text-white/50">
               {isNepali ? "कुनै कारोबारहरू छैनन्।" : "No transactions yet."}
             </p>
           ) : (
             transactions.slice(0, 200).map((t) => (
               <div key={t.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
                 <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${t.type === "credit" ? "bg-rose-500/15 text-rose-300 border border-rose-400/30" : "bg-[#1155ff]/15 text-blue-200 border border-[#1155ff]/30"}`}>
                   {t.type === "credit" ? (isNepali ? "उधारो" : "Credit") : (isNepali ? "भुक्तानी" : "Payment")}
                 </span>
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-semibold text-white tabular">
                     {t.type === "credit" ? "+" : "−"}Rs. {t.amount.toLocaleString("en-IN")}
                   </p>
                   <p className="text-[11px] text-white/50 truncate">
                     {isNepali ? `द्वारा: ${t.userCode || "—"}` : `By: ${t.userCode || "—"}`}
                   </p>
                 </div>
               </div>
             ))
           )}
         </div>
       )}

       <div className="flex items-center justify-end gap-2 pt-2">
         <button onClick={onClose} className={btnGhost}>{copy.cancel}</button>
       </div>
     </Modal>
   );
 }