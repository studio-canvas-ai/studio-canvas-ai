import { getDb, withDbLock } from "@/lib/db/store";
import type { UserRecord } from "@/lib/db/types";
import { getPlanUsageLimits, type PlanUsageSnapshot } from "@/lib/planQuotas";
import {
  readQuotaCookie,
  writeQuotaCookie,
} from "@/lib/quotaCookie";

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
  const rolled =
    user.quotaPeriodStart == null || user.quotaPeriodStart !== periodStart;
  if (rolled || user.fhdRemaining == null || user.uhd4kRemaining == null) {
    user.quotaPeriodStart = periodStart;
    user.fhdRemaining = limits.fhd;
    user.uhd4kRemaining = limits.uhd4k;
  } else {
    user.fhdRemaining = Math.min(limits.fhd, Math.max(0, user.fhdRemaining));
    user.uhd4kRemaining = Math.min(
      limits.uhd4k,
      Math.max(0, user.uhd4kRemaining)
    );
  }
}

export function applyQuotaCookieToUser(
  user: UserRecord,
  cookie: {
    userId: string;
    fhdRemaining: number;
    uhd4kRemaining: number;
    quotaPeriodStart: number;
  } | null
): void {
  if (!cookie || cookie.userId !== user.id) return;
  const periodStart = user.currentPeriodStart ?? 0;
  if (cookie.quotaPeriodStart !== periodStart) return;
  const limits = limitsFor(user);
  user.quotaPeriodStart = periodStart;
  user.fhdRemaining = Math.min(limits.fhd, Math.max(0, cookie.fhdRemaining));
  user.uhd4kRemaining = Math.min(
    limits.uhd4k,
    Math.max(0, cookie.uhd4kRemaining)
  );
}

export async function hydrateUserPlanUsage(
  user: UserRecord
): Promise<UserRecord> {
  const cookie = await readQuotaCookie(user.id);
  const updated = await withDbLock((db) => {
    const row = db.users[user.id];
    if (!row) return user;
    ensurePlanUsage(row);
    applyQuotaCookieToUser(row, cookie);
    return row;
  });
  await persistUserPlanUsage(updated);
  return updated;
}

export async function persistUserPlanUsage(user: UserRecord): Promise<void> {
  ensurePlanUsage(user);
  await writeQuotaCookie({
    userId: user.id,
    fhdRemaining: user.fhdRemaining ?? 0,
    uhd4kRemaining: user.uhd4kRemaining ?? 0,
    quotaPeriodStart: user.quotaPeriodStart ?? user.currentPeriodStart ?? 0,
    updatedAt: Date.now(),
  });
}

export type ConsumeQuotaResult =
  | { ok: true; user: UserRecord; remaining: number }
  | { ok: false; reason: "not_found" | "insufficient"; remaining: number };

/** Decrement FHD or 4K remaining. Admins are not exempt. */
export async function consumeDownloadQuota(params: {
  userId: string;
  kind: DownloadQuotaKind;
}): Promise<ConsumeQuotaResult> {
  const cookie = await readQuotaCookie(params.userId);
  const result = await withDbLock((db) => {
    const user = db.users[params.userId];
    if (!user) {
      return { ok: false as const, reason: "not_found" as const, remaining: 0 };
    }
    ensurePlanUsage(user);
    applyQuotaCookieToUser(user, cookie);
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
