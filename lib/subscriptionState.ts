import type { UserRecord } from "@/lib/db/types";

export type SubscriptionLifecycle =
  | "ACTIVE"
  | "CANCELED_PENDING"
  | "EXPIRED";

export function normalizeSubscriptionLifecycle(
  user: Pick<
    UserRecord,
    | "subscriptionLifecycle"
    | "subscriptionStatus"
    | "planId"
    | "currentPeriodEnd"
    | "cancelAtPeriodEnd"
  >
): SubscriptionLifecycle {
  if (user.subscriptionLifecycle) return user.subscriptionLifecycle;
  if (user.cancelAtPeriodEnd && user.planId !== "free") return "CANCELED_PENDING";
  if (user.subscriptionStatus === "cancelled" || user.subscriptionStatus === "past_due") {
    return "EXPIRED";
  }
  if (user.planId !== "free") return "ACTIVE";
  return "EXPIRED";
}

export function isPaidPlanActive(user: UserRecord, now = Date.now()): boolean {
  const lifecycle = normalizeSubscriptionLifecycle(user);
  if (lifecycle === "ACTIVE" || lifecycle === "CANCELED_PENDING") {
    if (user.currentPeriodEnd && user.currentPeriodEnd <= now) return false;
    return user.planId !== "free";
  }
  return false;
}
