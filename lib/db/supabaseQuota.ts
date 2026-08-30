import type { UserRecord } from "@/lib/db/types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { DurableQuotaSnapshot } from "@/lib/db/durableQuota";

type QuotaRow = {
  app_user_id: string;
  user_id: string | null;
  fhd_remaining: number;
  uhd4k_remaining: number;
  quota_period_start: number | string;
  quota_period_end: number | string | null;
  general_photo_download_count: number | null;
  updated_at: string | null;
};

function parseQuotaRow(row: QuotaRow, canonicalUserId: string): DurableQuotaSnapshot | null {
  const fhdRemaining = Number(row.fhd_remaining);
  const uhd4kRemaining = Number(row.uhd4k_remaining);
  const quotaPeriodStart = Number(row.quota_period_start);
  const quotaPeriodEnd =
    row.quota_period_end != null ? Number(row.quota_period_end) : undefined;
  const generalPhotoDownloadCount = Number(row.general_photo_download_count ?? 0);
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : Date.now();

  if (
    !Number.isFinite(fhdRemaining) ||
    !Number.isFinite(uhd4kRemaining) ||
    !Number.isFinite(quotaPeriodStart)
  ) {
    return null;
  }

  return {
    userId: canonicalUserId,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    quotaPeriodStart,
    ...(Number.isFinite(quotaPeriodEnd) ? { quotaPeriodEnd } : {}),
    fhdRemaining: Math.max(0, Math.floor(fhdRemaining)),
    uhd4kRemaining: Math.max(0, Math.floor(uhd4kRemaining)),
    generalPhotoDownloadCount: Number.isFinite(generalPhotoDownloadCount)
      ? Math.max(0, Math.floor(generalPhotoDownloadCount))
      : 0,
  };
}

/** Load persisted quota for the canonical app user id (+ optional aliases). */
export async function loadSupabaseQuota(
  canonicalUserId: string,
  aliases: string[] = []
): Promise<DurableQuotaSnapshot | null> {
  const admin = createSupabaseServiceClient();
  if (!admin || !canonicalUserId) return null;

  const lookupIds = [
    ...new Set([canonicalUserId, ...aliases].filter(Boolean)),
  ];

  for (const id of lookupIds) {
    const query = admin
      .from("user_download_quota")
      .select(
        "app_user_id, user_id, fhd_remaining, uhd4k_remaining, quota_period_start, quota_period_end, general_photo_download_count, updated_at"
      )
      .eq("app_user_id", id)
      .maybeSingle();

    const { data, error } = await query;
    if (error) {
      if (!error.message.toLowerCase().includes("does not exist")) {
        console.warn("[supabaseQuota] load skipped:", error.message);
      }
      continue;
    }
    if (!data) continue;
    const parsed = parseQuotaRow(data as QuotaRow, canonicalUserId);
    if (parsed) return parsed;
  }

  return null;
}

/** Upsert quota row keyed by app user id (service role). */
export async function saveSupabaseQuota(
  user: UserRecord,
  opts?: { supabaseUserId?: string | null }
): Promise<void> {
  const admin = createSupabaseServiceClient();
  if (!admin || !user.id) return;

  const supabaseUserId =
    opts?.supabaseUserId && /^[0-9a-f-]{36}$/i.test(opts.supabaseUserId)
      ? opts.supabaseUserId
      : /^[0-9a-f-]{36}$/i.test(user.id)
        ? user.id
        : null;

  const row = {
    app_user_id: user.id,
    user_id: supabaseUserId,
    fhd_remaining: Math.max(0, user.fhdRemaining ?? 0),
    uhd4k_remaining: Math.max(0, user.uhd4kRemaining ?? 0),
    quota_period_start: user.quotaPeriodStart ?? user.currentPeriodStart ?? 0,
    quota_period_end: user.currentPeriodEnd ?? null,
    general_photo_download_count: Math.max(0, user.generalPhotoDownloadCount ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("user_download_quota")
    .upsert(row, { onConflict: "app_user_id" });

  if (error) {
    const msg = error.message.toLowerCase();
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      console.warn("[supabaseQuota] save skipped:", error.message);
    }
  }
}
