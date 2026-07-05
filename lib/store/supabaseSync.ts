import type { Db, Settings } from "@/lib/qmr-engine";
import { normalizeDb } from "@/lib/qmr-engine";

/* =========================================================
   Supabase sync (whole-project blob).

   Mirrors the local single-blob model: the entire Db is stored as one
   jsonb row in qmr_project (see the migration). Uses Supabase's REST
   (PostgREST) endpoint with the anon key, so no SDK dependency and it is
   easy to point at any Supabase project. The granular tables in the
   migration remain available for a future per-table adapter.
   ========================================================= */

export interface SupabaseConfig {
  url: string;
  key: string;
}

export function supabaseConfig(settings: Settings): SupabaseConfig {
  return { url: settings.supabaseUrl || "", key: settings.supabaseKey || "" };
}

export function supabaseConfigured(cfg: SupabaseConfig): boolean {
  return !!(cfg.url && cfg.key);
}

const base = (cfg: SupabaseConfig): string => cfg.url.replace(/\/+$/, "");
const headers = (cfg: SupabaseConfig): Record<string, string> => ({
  apikey: cfg.key,
  Authorization: "Bearer " + cfg.key,
  "Content-Type": "application/json",
});

const ROW_ID = "default";

/** Upsert the whole project into qmr_project. */
export async function pushProject(cfg: SupabaseConfig, db: Db, now: string): Promise<void> {
  const res = await fetch(base(cfg) + "/rest/v1/qmr_project", {
    method: "POST",
    headers: { ...headers(cfg), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: ROW_ID, data: db, updated_at: now }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("HTTP " + res.status + ": " + t.slice(0, 160));
  }
}

/** Load the whole project from qmr_project (null if none stored yet). */
export async function pullProject(cfg: SupabaseConfig): Promise<Db | null> {
  const res = await fetch(base(cfg) + "/rest/v1/qmr_project?id=eq." + ROW_ID + "&select=data", {
    headers: headers(cfg),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const rows = (await res.json()) as Array<{ data: unknown }>;
  if (!rows || !rows.length) return null;
  return normalizeDb(rows[0].data);
}
