import type { PlanId } from "@/lib/faceProfiles";
import type { AccountMeta } from "@/lib/faceProfiles";
import { pricingPlanIds } from "@/lib/data";

export const RETENTION_FREE_DAYS = 14;
export const RETENTION_GRACE_STARTER_DAYS = 60;
export const RETENTION_GRACE_STANDARD_DAYS = 180;
export const RETENTION_EXPIRY_WARNING_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PaidPlanId = (typeof pricingPlanIds)[number];

export type RetentionContext = {
  planId: PlanId;
  cancelledAt?: number;
  lastPaidPlan?: PaidPlanId;
};

export function isActivePaidPlan(planId: PlanId): planId is PaidPlanId {
  return planId !== "free";
}

export function computeExpiresAt(
  createdAt: number,
  ctx: RetentionContext
): number | null {
  if (isActivePaidPlan(ctx.planId)) return null;

  if (ctx.lastPaidPlan === "pro") return null;

  if (ctx.cancelledAt && ctx.lastPaidPlan) {
    const graceDays =
      ctx.lastPaidPlan === "starter"
        ? RETENTION_GRACE_STARTER_DAYS
        : ctx.lastPaidPlan === "standard"
          ? RETENTION_GRACE_STANDARD_DAYS
          : null;
    if (graceDays != null) return ctx.cancelledAt + graceDays * MS_PER_DAY;
  }

  return createdAt + RETENTION_FREE_DAYS * MS_PER_DAY;
}

export function retentionContextFromAccount(
  planId: PlanId,
  meta: AccountMeta
): RetentionContext {
  return {
    planId,
    cancelledAt: meta.cancelledAt,
    lastPaidPlan: meta.lastPaidPlan,
  };
}

export function daysUntilExpiry(expiresAt: number | null | undefined, now = Date.now()): number | null {
  if (expiresAt == null) return null;
  const diff = expiresAt - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

export function isExpiringSoon(
  expiresAt: number | null | undefined,
  warningDays = RETENTION_EXPIRY_WARNING_DAYS,
  now = Date.now()
): boolean {
  const days = daysUntilExpiry(expiresAt, now);
  return days != null && days > 0 && days <= warningDays;
}

export function shouldShowActiveRetentionBanner(planId: PlanId): boolean {
  return isActivePaidPlan(planId);
}

export function shouldShowExpiryBadge(
  ctx: RetentionContext,
  expiresAt: number | null | undefined,
  now = Date.now()
): boolean {
  if (expiresAt == null) return false;
  if (isActivePaidPlan(ctx.planId)) return false;
  return isExpiringSoon(expiresAt, RETENTION_EXPIRY_WARNING_DAYS, now);
}

export function isGalleryItemExpired(
  expiresAt: number | null | undefined,
  now = Date.now()
): boolean {
  return expiresAt != null && expiresAt <= now;
}
