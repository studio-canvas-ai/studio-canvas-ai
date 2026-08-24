/**
 * Point-in-time cloud backups for admin rollback.
 * Service-role only — never exposed to end-user APIs.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  studioBundleCounts,
  studioBundleIsEmpty,
  type StudioStoreCounts,
} from "@/lib/studioStore/persistKeys";
import type { StudioStoreBundle } from "@/lib/studioStore/types";

export const SNAPSHOT_KEEP = 12;

export type StudioStoreSnapshotReason =
  | "autosave"
  | "admin_restore"
  | "pre_restore";

export type StudioStoreSnapshotRow = {
  id: string;
  user_id: string | null;
  app_user_id: string;
  reason: string;
  counts: StudioStoreCounts;
  payload: StudioStoreBundle;
  created_at: string;
};

export type StudioStoreSnapshotMeta = {
  id: string;
  createdAt: string;
  reason: string;
  counts: StudioStoreCounts;
};

function parseCounts(raw: unknown): StudioStoreCounts {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
  return {
    recentShared: n(o.recentShared),
    recentPhoto: n(o.recentPhoto),
    uploadVault: n(o.uploadVault),
    trainedVault: n(o.trainedVault),
  };
}

function parsePayload(raw: unknown): StudioStoreBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const asArr = (v: unknown) => (Array.isArray(v) ? v : []);
  const bundle: StudioStoreBundle = {
    recentShared: asArr(o.recentShared) as StudioStoreBundle["recentShared"],
    recentPhoto: asArr(o.recentPhoto) as StudioStoreBundle["recentPhoto"],
    uploadVault: asArr(o.uploadVault) as StudioStoreBundle["uploadVault"],
    trainedVault: asArr(o.trainedVault) as StudioStoreBundle["trainedVault"],
    activeTrainedId:
      typeof o.activeTrainedId === "string" ? o.activeTrainedId : null,
  };
  return bundle;
}

export async function insertStudioStoreSnapshot(opts: {
  canonicalUserId: string;
  supabaseUserId?: string | null;
  bundle: StudioStoreBundle;
  reason: StudioStoreSnapshotReason;
}): Promise<string | null> {
  if (studioBundleIsEmpty(opts.bundle)) return null;
  const admin = createSupabaseServiceClient();
  if (!admin) return null;
  const uuid =
    opts.supabaseUserId && /^[0-9a-f-]{36}$/i.test(opts.supabaseUserId)
      ? opts.supabaseUserId
      : /^[0-9a-f-]{36}$/i.test(opts.canonicalUserId)
        ? opts.canonicalUserId
        : null;
  const { data, error } = await admin
    .from("studio_user_store_snapshots")
    .insert({
      user_id: uuid,
      app_user_id: opts.canonicalUserId,
      reason: opts.reason,
      counts: studioBundleCounts(opts.bundle),
      payload: opts.bundle,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("[studioStore] snapshot insert skipped:", error.message);
    return null;
  }
  await trimStudioStoreSnapshots(opts.canonicalUserId, uuid);
  return (data as { id?: string } | null)?.id ?? null;
}

async function trimStudioStoreSnapshots(
  appUserId: string,
  supabaseUserId: string | null
) {
  const admin = createSupabaseServiceClient();
  if (!admin) return;
  let q = admin
    .from("studio_user_store_snapshots")
    .select("id, created_at")
    .order("created_at", { ascending: false });
  if (supabaseUserId) {
    q = q.or(`app_user_id.eq.${appUserId},user_id.eq.${supabaseUserId}`);
  } else {
    q = q.eq("app_user_id", appUserId);
  }
  const { data, error } = await q;
  if (error || !data) return;
  const extra = (data as { id: string }[]).slice(SNAPSHOT_KEEP);
  if (!extra.length) return;
  const { error: delErr } = await admin
    .from("studio_user_store_snapshots")
    .delete()
    .in(
      "id",
      extra.map((r) => r.id)
    );
  if (delErr) {
    console.warn("[studioStore] snapshot trim skipped:", delErr.message);
  }
}

export async function listStudioStoreSnapshots(
  aliases: string[]
): Promise<StudioStoreSnapshotMeta[]> {
  const admin = createSupabaseServiceClient();
  if (!admin || !aliases.length) return [];
  const uuids = aliases.filter((a) => /^[0-9a-f-]{36}$/i.test(a));
  const [byApp, byUid] = await Promise.all([
    admin
      .from("studio_user_store_snapshots")
      .select("id, reason, counts, created_at, app_user_id")
      .in("app_user_id", aliases)
      .order("created_at", { ascending: false })
      .limit(40),
    uuids.length
      ? admin
          .from("studio_user_store_snapshots")
          .select("id, reason, counts, created_at, app_user_id")
          .in("user_id", uuids)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  if (byApp.error) {
    console.warn("[studioStore] snapshot list skipped:", byApp.error.message);
  }
  const seen = new Set<string>();
  const out: StudioStoreSnapshotMeta[] = [];
  for (const row of [...(byApp.data ?? []), ...(byUid.data ?? [])] as {
    id: string;
    reason: string;
    counts: unknown;
    created_at: string;
  }[]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push({
      id: row.id,
      createdAt: row.created_at,
      reason: row.reason || "autosave",
      counts: parseCounts(row.counts),
    });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 20);
}

export async function getStudioStoreSnapshot(
  id: string
): Promise<StudioStoreSnapshotRow | null> {
  const admin = createSupabaseServiceClient();
  if (!admin || !id.trim()) return null;
  const { data, error } = await admin
    .from("studio_user_store_snapshots")
    .select("id, user_id, app_user_id, reason, counts, payload, created_at")
    .eq("id", id.trim())
    .maybeSingle();
  if (error || !data) return null;
  const payload = parsePayload((data as { payload: unknown }).payload);
  if (!payload) return null;
  const row = data as {
    id: string;
    user_id: string | null;
    app_user_id: string;
    reason: string;
    counts: unknown;
    created_at: string;
  };
  return {
    id: row.id,
    user_id: row.user_id,
    app_user_id: row.app_user_id,
    reason: row.reason,
    counts: parseCounts(row.counts),
    payload,
    created_at: row.created_at,
  };
}

/**
 * For each app_user_id, the newest non-empty snapshot at or before `iso`.
 */
export async function listLatestSnapshotsAtOrBefore(
  iso: string
): Promise<StudioStoreSnapshotRow[]> {
  const admin = createSupabaseServiceClient();
  if (!admin) return [];
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return [];

  const pageSize = 1000;
  const best = new Map<string, StudioStoreSnapshotRow>();
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error } = await admin
      .from("studio_user_store_snapshots")
      .select("id, user_id, app_user_id, reason, counts, payload, created_at")
      .lte("created_at", target.toISOString())
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn("[studioStore] global snapshot list skipped:", error.message);
      break;
    }
    const rows = (data ?? []) as {
      id: string;
      user_id: string | null;
      app_user_id: string;
      reason: string;
      counts: unknown;
      payload: unknown;
      created_at: string;
    }[];
    if (!rows.length) break;
    for (const row of rows) {
      const key = (row.app_user_id || "").trim();
      if (!key || best.has(key)) continue;
      const payload = parsePayload(row.payload);
      if (!payload || studioBundleIsEmpty(payload)) continue;
      best.set(key, {
        id: row.id,
        user_id: row.user_id,
        app_user_id: key,
        reason: row.reason,
        counts: parseCounts(row.counts),
        payload,
        created_at: row.created_at,
      });
    }
    if (rows.length < pageSize) break;
  }
  return [...best.values()];
}
