// ─── POS User accounts (stored locally on the device) ──────────
// Each user has a name and a 4-digit PIN. One or more can be admins.
// Admins can manage users, edit/delete records, and open the Admin Panel.

export interface PosUser {
  id: string;
  name: string;
  pin: string; // 4 digits
  isAdmin: boolean;
}

const USERS_KEY = "yalambar_users_v1";
const ACTIVE_KEY = "yalambar_active_user_v1";

const DEFAULT_USERS: PosUser[] = [
  { id: "u_wilson", name: "Wilson", pin: "1111", isAdmin: true },
  { id: "u_kush", name: "Kush", pin: "2222", isAdmin: false },
];

export function loadUsers(): PosUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PosUser[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Failed to load users", e);
  }
  // seed defaults on first run
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

export function saveUsers(users: PosUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getActiveUserId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveUserId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function makeUserId() {
  return "u_" + Math.random().toString(36).slice(2, 9);
}
