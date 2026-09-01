// Data layer — Supabase (Postgres).
//
// This is now the single backend. The module re-exports the Supabase
// implementation under the same names the app has always used, so the rest of
// the codebase stays unchanged. (Firebase and the one-time migration were
// removed after the data was fully moved to Supabase.)
export * from "./supabase";
export type { CloudBackup } from "./types";
