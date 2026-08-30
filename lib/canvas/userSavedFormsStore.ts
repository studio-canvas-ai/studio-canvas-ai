/**
 * Server store for account-scoped SCA recent files (`public.user_saved_forms`).
 * Keyed by NextAuth app user + optional Supabase auth.users id so Naver/Kakao/Google
 * (and any other bridged provider) share one drawer per login.
 */

import { parseStudioProject } from "@/lib/canvas/projectFile";
import { mergeRecentEntries } from "@/lib/studioStore/merge";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { RecentDrawerEntry } from "@/lib/studioStore/types";

export type SavedFormScreenId = "screen_007" | "screen_008" | "screen_010";

export const USER_SAVED_FORM_SCREENS = [
  "screen_007",
  "screen_008",
  "screen_010",
] as const;

const LEGACY_KIND: Partial<
  Record<SavedFormScreenId, "recent_shared" | "recent_photo">
> = {
  screen_007: "recent_shared",
  screen_010: "recent_photo",
};

function isScreenId(v: unknown): v is SavedFormScreenId {
  return (
    v === "screen_007" || v === "screen_008" || v === "screen_010"
  );
}

export function parseSavedFormPayload(raw: unknown): RecentDrawerEntry[] {
  const payload = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { payload?: unknown })?.payload)
      ? ((raw as { payload: unknown[] }).payload)
      : [];
  const out: RecentDrawerEntry[] = [];
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.meta || !r.project) continue;
    try {
      out.push({
        id: r.id,
        meta: r.meta as RecentDrawerEntry["meta"],
        project: parseStudioProject(r.project),
      });
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

function uuidFromAliases(aliases: string[]): string | null {
  return (
    aliases.find((a) => /^[0-9a-f-]{36}$/i.test(a)) ?? null
  );
}

export async function loadUserSavedForms(
  aliases: string[],
  screenId: SavedFormScreenId
): Promise<RecentDrawerEntry[]> {
  const admin = createSupabaseServiceClient();
  if (!admin || !aliases.length || !isScreenId(screenId)) return [];

  const uuids = aliases.filter((a) => /^[0-9a-f-]{36}$/i.test(a));
  const [byApp, byUid] = await Promise.all([
    admin
      .from("user_saved_forms")
      .select("payload, updated_at")
      .eq("screen_id", screenId)
      .in("app_user_id", aliases),
    uuids.length
      ? admin
          .from("user_saved_forms")
          .select("payload, updated_at")
          .eq("screen_id", screenId)
          .in("user_id", uuids)
      : Promise.resolve({ data: [] as { payload: unknown }[], error: null }),
  ]);

  if (byApp.error) {
    console.warn(
      "[user_saved_forms] load by app_user_id skipped:",
      byApp.error.message
    );
  }
  if (byUid && "error" in byUid && byUid.error) {
    console.warn(
      "[user_saved_forms] load by user_id skipped:",
      byUid.error.message
    );
  }

  const groups = [
    ...((byApp.data ?? []) as { payload?: unknown }[]),
    ...((byUid.data ?? []) as { payload?: unknown }[]),
  ].map((row) => parseSavedFormPayload(row.payload));

  let merged = mergeRecentEntries(...groups);

  // One-shot fallback: older studio_user_stores drawers (007/010 only).
  if (!merged.length) {
    const legacyKind = LEGACY_KIND[screenId];
    if (legacyKind) {
      const [legacyApp, legacyUid] = await Promise.all([
        admin
          .from("studio_user_stores")
          .select("payload")
          .eq("kind", legacyKind)
          .in("app_user_id", aliases),
        uuids.length
          ? admin
              .from("studio_user_stores")
              .select("payload")
              .eq("kind", legacyKind)
              .in("user_id", uuids)
          : Promise.resolve({ data: [] as { payload: unknown }[], error: null }),
      ]);
      merged = mergeRecentEntries(
        ...[
          ...((legacyApp.data ?? []) as { payload?: unknown }[]),
          ...((legacyUid.data ?? []) as { payload?: unknown }[]),
        ].map((row) => parseSavedFormPayload(row.payload))
      );
    }
  }

  return merged;
}

export async function saveUserSavedForms(opts: {
  canonicalUserId: string;
  supabaseUserId?: string | null;
  screenId: SavedFormScreenId;
  entries: RecentDrawerEntry[];
  /** Plan scaCloud FIFO cap (default 10). */
  max?: number;
}): Promise<RecentDrawerEntry[]> {
  const cap = Math.max(
    1,
    Math.min(
      200,
      typeof opts.max === "number" && Number.isFinite(opts.max)
        ? Math.floor(opts.max)
        : 10
    )
  );
  const admin = createSupabaseServiceClient();
  if (!admin || !isScreenId(opts.screenId)) {
    return opts.entries.slice(0, cap);
  }

  const userId = opts.canonicalUserId;
  const uuid =
    opts.supabaseUserId && /^[0-9a-f-]{36}$/i.test(opts.supabaseUserId)
      ? opts.supabaseUserId
      : /^[0-9a-f-]{36}$/i.test(userId)
        ? userId
        : uuidFromAliases([userId]);

  const existing = await loadUserSavedForms(
    [...new Set([userId, opts.supabaseUserId].filter(Boolean) as string[])],
    opts.screenId
  );
  const merged = mergeRecentEntries(opts.entries, existing).slice(0, cap);

  const row = {
    user_id: uuid,
    app_user_id: userId,
    screen_id: opts.screenId,
    payload: merged,
    updated_at: new Date().toISOString(),
  };

  try {
    const match = uuid
      ? await admin
          .from("user_saved_forms")
          .select("id")
          .eq("screen_id", opts.screenId)
          .or(`user_id.eq.${uuid},app_user_id.eq.${userId}`)
          .maybeSingle()
      : await admin
          .from("user_saved_forms")
          .select("id")
          .eq("screen_id", opts.screenId)
          .eq("app_user_id", userId)
          .maybeSingle();

    const existingId = (match.data as { id?: string } | null)?.id;
    if (existingId) {
      const { error } = await admin
        .from("user_saved_forms")
        .update({
          user_id: uuid,
          app_user_id: userId,
          payload: row.payload,
          updated_at: row.updated_at,
        })
        .eq("id", existingId);
      if (error) {
        console.warn("[user_saved_forms] update skipped:", error.message);
      }
    } else {
      const { error } = await admin.from("user_saved_forms").insert(row);
      if (error) {
        console.warn("[user_saved_forms] insert skipped:", error.message);
      }
    }
  } catch (err) {
    console.warn("[user_saved_forms] save skipped", err);
  }

  return merged;
}
