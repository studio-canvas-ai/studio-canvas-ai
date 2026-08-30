import { getDb, withDbLock } from "@/lib/db/store";
import type { UserRecord } from "@/lib/db/types";
import { getPlanUsageLimits, type PlanUsageSnapshot } from "@/lib/planQuotas";
import {
  applyDurableQuotaToUser,
  loadDurableQuota,
  saveDurableQuota,
  type DurableQuotaSnapshot,
} from "@/lib/db/durableQuota";
import { loadSupabaseQuota, saveSupabaseQuota } from "@/lib/db/supabaseQuota";
import {
  readQuotaCookie,
  writeQuotaCookie,
  type QuotaCookiePayload,
} from "@/lib/quotaCookie";
import {
  alignUserPeriodFromSnapshot,
  billingPeriodExpired,
  pickPreferredQuotaSnapshot,
  quotaPeriodCompatible,
  type QuotaSnapshotLike,
} from "@/lib/quotaPeriod";
import { FEATURE_CREDIT_COST, creditPoolForPlan } from "@/lib/featureCreditCosts";

export type DownloadQuotaKind = "fhd" | "uhd4k";

export type { PlanUsageSnapshot };

function limitsFor(user: UserRecord) {
  return getPlanUsageLimits(user.planId, user.billingInterval ?? "monthly");
}

export function snapshotPlanUsage(user: UserRecord): PlanUsageSnapshot {
  const limits = limitsFor(user);
  return {
    fhdRemaining: user.fhdRemaining ?? limits.fhd,
    fhdLimit: limits.fhd,
    uhd4kRemaining: user.uhd4kRemaining ?? limits.uhd4k,
    uhd4kLimit: limits.uhd4k,
    galleryLimit: limits.gallery,
  };
}

/** Fill remaining from caps when the billing window is new or unused. */
export function ensurePlanUsage(user: UserRecord): void {
  const limits = limitsFor(user);
  const periodStart = user.currentPeriodStart ?? 0;
  const hasRemaining =
    user.fhdRemaining != null && user.uhd4kRemaining != null;
  const rolled =
    user.quotaPeriodStart == null || user.quotaPeriodStart !== periodStart;

  if (!hasRemaining) {
    user.quotaPeriodStart = periodStart;
    user.fhdRemaining = limits.fhd;
    user.uhd4kRemaining = limits.uhd4k;
    return;
  }

  if (rolled) {
    if (billingPeriodExpired(user)) {
      user.quotaPeriodStart = periodStart;
      user.fhdRemaining = limits.fhd;
      user.uhd4kRemaining = limits.uhd4k;
      return;
    }
    // Cold start moved currentPeriodStart — keep restored counts, align key only.
    user.quotaPeriodStart = periodStart;
  }

  user.fhdRemaining = Math.min(limits.fhd, Math.max(0, user.fhdRemaining!));
  user.uhd4kRemaining = Math.min(
    limits.uhd4k,
    Math.max(0, user.uhd4kRemaining!)
  );
}

export function applyQuotaCookieToUser(
  user: UserRecord,
  cookie: QuotaCookiePayload | null
): void {
  if (!cookie || cookie.userId !== user.id) return;
  if (
    !quotaPeriodCompatible(
      user,
      cookie.quotaPeriodStart,
      cookie.quotaPeriodEnd
    )
  ) {
    return;
  }
  const limits = limitsFor(user);
  const pool = creditPoolForPlan(user.planId, user.billingInterval ?? "monthly");
  const snapVer = cookie.schemaVersion ?? 1;
  const applyFhd = !(pool != null && snapVer < 2);

  user.quotaPeriodStart = user.currentPeriodStart ?? cookie.quotaPeriodStart;
  if (applyFhd) {
    user.fhdRemaining = Math.min(
      limits.fhd,
      Math.max(0, cookie.fhdRemaining),
      user.fhdRemaining ?? cookie.fhdRemaining
    );
  }
  user.uhd4kRemaining = Math.min(
    limits.uhd4k,
    Math.max(0, cookie.uhd4kRemaining),
    user.uhd4kRemaining ?? cookie.uhd4kRemaining
  );
  if (snapVer >= 2) {
    user.quotaSchemaVersion = Math.max(user.quotaSchemaVersion ?? 1, snapVer);
  }
}

/** One-time cutover: legacy FHD counters → full plan credit pool. */
export function migrateToCreditPoolSchema(user: UserRecord): boolean {
  const interval = user.billingInterval ?? "monthly";
  const pool = creditPoolForPlan(user.planId, interval);
  if (pool == null) return false;
  if ((user.quotaSchemaVersion ?? 1) >= 2) return false;

  const limits = limitsFor(user);
  user.fhdRemaining = pool;
  user.uhd4kRemaining = limits.uhd4k;
  user.quotaPeriodStart = user.currentPeriodStart ?? user.quotaPeriodStart ?? Date.now();
  user.quotaSchemaVersion = 2;
  user.updatedAt = Date.now();
  return true;
}

function toSnapshotLike(
  source: QuotaCookiePayload | QuotaSnapshotLike | null
): QuotaSnapshotLike | null {
  if (!source) return null;
  return {
    userId: source.userId,
    fhdRemaining: source.fhdRemaining,
    uhd4kRemaining: source.uhd4kRemaining,
    quotaPeriodStart: source.quotaPeriodStart,
    quotaPeriodEnd:
      "quotaPeriodEnd" in source ? source.quotaPeriodEnd : undefined,
    updatedAt: "updatedAt" in source ? source.updatedAt : undefined,
    schemaVersion:
      "schemaVersion" in source && typeof source.schemaVersion === "number"
        ? source.schemaVersion
        : 1,
  };
}

/** Restore cookie/R2/Supabase first, then fill gaps — shared by hydrate and consume. */
export function mergePlanUsageFromSnapshots(
  user: UserRecord,
  cookie: QuotaCookiePayload | null,
  durable: DurableQuotaSnapshot | null,
  supabase: DurableQuotaSnapshot | null = null
): void {
  const cookieSnap = toSnapshotLike(cookie);
  const durableSnap = toSnapshotLike(durable);
  const supabaseSnap = toSnapshotLike(supabase);
  const preferred = pickPreferredQuotaSnapshot(
    pickPreferredQuotaSnapshot(cookieSnap, durableSnap),
    supabaseSnap
  );

  // Vercel cold start reprovisions memory rows with full plan caps before hydrate.
  // Clear volatile defaults so signed durable snapshots can realign the period.
  if (preferred) {
    user.fhdRemaining = undefined;
    user.uhd4kRemaining = undefined;
    user.quotaPeriodStart = undefined;
  }

  alignUserPeriodFromSnapshot(user, preferred);
  applyQuotaCookieToUser(user, cookie);
  applyDurableQuotaToUser(user, durable);
  applyDurableQuotaToUser(user, supabase);
  ensurePlanUsage(user);
}

function guardedPersistValues(
  user: UserRecord,
  existingCookie: QuotaCookiePayload | null,
  existingDurable: DurableQuotaSnapshot | null,
  existingSupabase: DurableQuotaSnapshot | null = null,
  opts?: { allowPoolIncrease?: boolean }
): { fhdRemaining: number; uhd4kRemaining: number; quotaPeriodStart: number } {
  const limits = limitsFor(user);
  const periodStart = user.quotaPeriodStart ?? user.currentPeriodStart ?? 0;
  let fhd = Math.max(0, user.fhdRemaining ?? 0);
  let uhd = Math.max(0, user.uhd4kRemaining ?? 0);
  const allowIncrease = opts?.allowPoolIncrease === true;

  const guard = (stored: QuotaSnapshotLike | QuotaCookiePayload | null) => {
    if (!stored || stored.userId !== user.id) return;
    if (
      !quotaPeriodCompatible(
        user,
        stored.quotaPeriodStart,
        "quotaPeriodEnd" in stored ? stored.quotaPeriodEnd : undefined
      )
    ) {
      return;
    }
    const storedVer =
      "schemaVersion" in stored && typeof stored.schemaVersion === "number"
        ? stored.schemaVersion
        : 1;
    // Do not let legacy FHD snapshots pull a credit-pool balance down.
    if (allowIncrease || storedVer < 2) return;
    fhd = Math.min(fhd, Math.max(0, stored.fhdRemaining));
    uhd = Math.min(uhd, Math.max(0, stored.uhd4kRemaining));
  };

  guard(existingCookie);
  guard(existingDurable);
  guard(existingSupabase);

  return {
    fhdRemaining: Math.min(limits.fhd, fhd),
    uhd4kRemaining: Math.min(limits.uhd4k, uhd),
    quotaPeriodStart: periodStart,
  };
}

export async function hydrateUserPlanUsage(
  user: UserRecord,
  opts?: { supabaseUserId?: string | null }
): Promise<UserRecord> {
  const aliases = [
    opts?.supabaseUserId,
    /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  const [cookie, durable, supabase] = await Promise.all([
    readQuotaCookie(user.id),
    loadDurableQuota(user.id),
    loadSupabaseQuota(user.id, aliases),
  ]);
  const updated = await withDbLock((db) => {
    const row = db.users[user.id];
    if (!row) return { user, migrated: false };
    mergePlanUsageFromSnapshots(row, cookie, durable, supabase);
    const migrated = migrateToCreditPoolSchema(row);
    ensurePlanUsage(row);
    return { user: row, migrated };
  });
  await persistUserPlanUsage(updated.user, {
    ...opts,
    allowPoolIncrease: updated.migrated,
  });
  return updated.user;
}

export async function persistUserPlanUsage(
  user: UserRecord,
  opts?: { supabaseUserId?: string | null; allowPoolIncrease?: boolean }
): Promise<void> {
  const aliases = [
    opts?.supabaseUserId,
    /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  const [existingCookie, existingDurable, existingSupabase] = await Promise.all([
    readQuotaCookie(user.id),
    loadDurableQuota(user.id),
    loadSupabaseQuota(user.id, aliases),
  ]);
  const guarded = guardedPersistValues(
    user,
    existingCookie,
    existingDurable,
    existingSupabase,
    { allowPoolIncrease: opts?.allowPoolIncrease }
  );
  user.fhdRemaining = guarded.fhdRemaining;
  user.uhd4kRemaining = guarded.uhd4kRemaining;
  user.quotaPeriodStart = guarded.quotaPeriodStart;
  if ((user.quotaSchemaVersion ?? 1) < 2 && creditPoolForPlan(user.planId, user.billingInterval)) {
    user.quotaSchemaVersion = 2;
  }

  await Promise.all([
    writeQuotaCookie({
      userId: user.id,
      fhdRemaining: guarded.fhdRemaining,
      uhd4kRemaining: guarded.uhd4kRemaining,
      quotaPeriodStart: guarded.quotaPeriodStart,
      quotaPeriodEnd: user.currentPeriodEnd ?? null,
      updatedAt: Date.now(),
      schemaVersion: user.quotaSchemaVersion ?? 1,
    }),
    saveDurableQuota(user),
    saveSupabaseQuota(user, opts),
  ]);
}

export type ConsumeQuotaResult =
  | { ok: true; user: UserRecord; remaining: number }
  | { ok: false; reason: "not_found" | "insufficient"; remaining: number };

/**
 * Decrement the unified credit pool (`fhdRemaining`) by `amount`, then persist
 * cookie + R2 + Supabase.
 */
export async function consumeCreditPool(params: {
  userId: string;
  amount: number;
  supabaseUserId?: string | null;
}): Promise<ConsumeQuotaResult> {
  const amount = Math.max(1, Math.floor(params.amount));
  const aliases = [
    params.supabaseUserId,
    /^[0-9a-f-]{36}$/i.test(params.userId) ? params.userId : null,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  const [cookie, durable, supabase] = await Promise.all([
    readQuotaCookie(params.userId),
    loadDurableQuota(params.userId),
    loadSupabaseQuota(params.userId, aliases),
  ]);
  const result = await withDbLock((db) => {
    const user = db.users[params.userId];
    if (!user) {
      return { ok: false as const, reason: "not_found" as const, remaining: 0 };
    }
    mergePlanUsageFromSnapshots(user, cookie, durable, supabase);
    migrateToCreditPoolSchema(user);
    ensurePlanUsage(user);
    const remaining = user.fhdRemaining ?? 0;
    if (remaining < amount) {
      return {
        ok: false as const,
        reason: "insufficient" as const,
        remaining,
      };
    }
    user.fhdRemaining = remaining - amount;
    user.quotaSchemaVersion = Math.max(user.quotaSchemaVersion ?? 1, 2);
    user.updatedAt = Date.now();
    return {
      ok: true as const,
      user,
      remaining: user.fhdRemaining ?? 0,
    };
  });

  if (result.ok) {
    await persistUserPlanUsage(result.user, {
      supabaseUserId: params.supabaseUserId,
      allowPoolIncrease: false,
    });
  }
  return result;
}

/** @deprecated Prefer consumeCreditPool — maps legacy FHD/4K kinds to pool costs. */
export async function consumeDownloadQuota(params: {
  userId: string;
  kind: DownloadQuotaKind;
  amount?: number;
  supabaseUserId?: string | null;
}): Promise<ConsumeQuotaResult> {
  const amount =
    typeof params.amount === "number" && Number.isFinite(params.amount)
      ? Math.max(1, Math.floor(params.amount))
      : params.kind === "uhd4k"
        ? FEATURE_CREDIT_COST.hdDownload
        : FEATURE_CREDIT_COST.webDownload;
  return consumeCreditPool({
    userId: params.userId,
    amount,
    supabaseUserId: params.supabaseUserId,
  });
}
