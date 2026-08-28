import { getDb, withDbLock } from "@/lib/db/store";
import type { UserRecord } from "@/lib/db/types";
import { getPlanUsageLimits, type PlanUsageSnapshot } from "@/lib/planQuotas";
import {
  applyDurableQuotaToUser,
  loadDurableQuota,
  saveDurableQuota,
  type DurableQuotaSnapshot,
} from "@/lib/db/durableQuota";
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
  user.quotaPeriodStart = user.currentPeriodStart ?? cookie.quotaPeriodStart;
  user.fhdRemaining = Math.min(
    limits.fhd,
    Math.max(0, cookie.fhdRemaining),
    user.fhdRemaining ?? cookie.fhdRemaining
  );
  user.uhd4kRemaining = Math.min(
    limits.uhd4k,
    Math.max(0, cookie.uhd4kRemaining),
    user.uhd4kRemaining ?? cookie.uhd4kRemaining
  );
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
  };
}

/** Restore cookie/R2 first, then fill gaps — shared by hydrate and consume. */
export function mergePlanUsageFromSnapshots(
  user: UserRecord,
  cookie: QuotaCookiePayload | null,
  durable: DurableQuotaSnapshot | null
): void {
  const cookieSnap = toSnapshotLike(cookie);
  const durableSnap = toSnapshotLike(durable);
  const preferred = pickPreferredQuotaSnapshot(cookieSnap, durableSnap);
  alignUserPeriodFromSnapshot(user, preferred);
  applyQuotaCookieToUser(user, cookie);
  applyDurableQuotaToUser(user, durable);
  ensurePlanUsage(user);
}

function guardedPersistValues(
  user: UserRecord,
  existingCookie: QuotaCookiePayload | null,
  existingDurable: DurableQuotaSnapshot | null
): { fhdRemaining: number; uhd4kRemaining: number; quotaPeriodStart: number } {
  const limits = limitsFor(user);
  const periodStart = user.quotaPeriodStart ?? user.currentPeriodStart ?? 0;
  let fhd = Math.max(0, user.fhdRemaining ?? 0);
  let uhd = Math.max(0, user.uhd4kRemaining ?? 0);

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
    fhd = Math.min(fhd, Math.max(0, stored.fhdRemaining));
    uhd = Math.min(uhd, Math.max(0, stored.uhd4kRemaining));
  };

  guard(existingCookie);
  guard(existingDurable);

  return {
    fhdRemaining: Math.min(limits.fhd, fhd),
    uhd4kRemaining: Math.min(limits.uhd4k, uhd),
    quotaPeriodStart: periodStart,
  };
}

export async function hydrateUserPlanUsage(
  user: UserRecord
): Promise<UserRecord> {
  const [cookie, durable] = await Promise.all([
    readQuotaCookie(user.id),
    loadDurableQuota(user.id),
  ]);
  const updated = await withDbLock((db) => {
    const row = db.users[user.id];
    if (!row) return user;
    mergePlanUsageFromSnapshots(row, cookie, durable);
    return row;
  });
  await persistUserPlanUsage(updated);
  return updated;
}

export async function persistUserPlanUsage(user: UserRecord): Promise<void> {
  const [existingCookie, existingDurable] = await Promise.all([
    readQuotaCookie(user.id),
    loadDurableQuota(user.id),
  ]);
  const guarded = guardedPersistValues(user, existingCookie, existingDurable);
  user.fhdRemaining = guarded.fhdRemaining;
  user.uhd4kRemaining = guarded.uhd4kRemaining;
  user.quotaPeriodStart = guarded.quotaPeriodStart;

  await Promise.all([
    writeQuotaCookie({
      userId: user.id,
      fhdRemaining: guarded.fhdRemaining,
      uhd4kRemaining: guarded.uhd4kRemaining,
      quotaPeriodStart: guarded.quotaPeriodStart,
      quotaPeriodEnd: user.currentPeriodEnd ?? null,
      updatedAt: Date.now(),
    }),
    saveDurableQuota(user),
  ]);
}

export type ConsumeQuotaResult =
  | { ok: true; user: UserRecord; remaining: number }
  | { ok: false; reason: "not_found" | "insufficient"; remaining: number };

/** Decrement FHD or 4K remaining. Admins are not exempt. */
export async function consumeDownloadQuota(params: {
  userId: string;
  kind: DownloadQuotaKind;
}): Promise<ConsumeQuotaResult> {
  const [cookie, durable] = await Promise.all([
    readQuotaCookie(params.userId),
    loadDurableQuota(params.userId),
  ]);
  const result = await withDbLock((db) => {
    const user = db.users[params.userId];
    if (!user) {
      return { ok: false as const, reason: "not_found" as const, remaining: 0 };
    }
    mergePlanUsageFromSnapshots(user, cookie, durable);
    const key = params.kind === "uhd4k" ? "uhd4kRemaining" : "fhdRemaining";
    const remaining = user[key] ?? 0;
    if (remaining < 1) {
      return { ok: false as const, reason: "insufficient" as const, remaining };
    }
    user[key] = remaining - 1;
    user.updatedAt = Date.now();
    return { ok: true as const, user, remaining: user[key] ?? 0 };
  });

  if (result.ok) {
    await persistUserPlanUsage(result.user);
  }
  return result;
}
