import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { UserRecord } from "@/lib/db/types";
import type { SubscriptionLifecycle } from "@/lib/subscriptionState";

/** Schedule cancellation at period end — keeps plan active until currentPeriodEnd. */
export async function scheduleSubscriptionCancel(input: {
  userId: string;
  reason?: string;
}): Promise<UserRecord | null> {
  return withDbLock((db) => {
    const user = db.users[input.userId];
    if (!user || user.planId === "free") return null;
    const now = Date.now();
    user.subscriptionLifecycle = "CANCELED_PENDING";
    user.cancelAtPeriodEnd = true;
    user.cancelReason = input.reason;
    user.scheduledCancelAt = user.currentPeriodEnd ?? now;
    user.subscriptionStatus = "active";
    user.updatedAt = now;
    return user;
  });
}

/** Resume a pending-cancel subscription back to ACTIVE. */
export async function resumeSubscription(userId: string): Promise<UserRecord | null> {
  return withDbLock((db) => {
    const user = db.users[userId];
    if (!user || user.planId === "free") return null;
    const now = Date.now();
    user.subscriptionLifecycle = "ACTIVE";
    user.cancelAtPeriodEnd = false;
    delete user.cancelReason;
    delete user.scheduledCancelAt;
    user.subscriptionStatus = "active";
    user.updatedAt = now;
    return user;
  });
}

/**
 * Expire subscription → Free plan. Credits and account are preserved (#113).
 */
export async function expireSubscription(userId: string): Promise<UserRecord | null> {
  return withDbLock((db) => {
    const user = db.users[userId];
    if (!user) return null;
    const now = Date.now();
    if (user.planId !== "free") {
      user.lastPaidPlan = user.planId;
    }
    user.planId = "free";
    user.subscriptionLifecycle = "EXPIRED";
    user.subscriptionStatus = "cancelled";
    user.cancelAtPeriodEnd = false;
    user.cancelledAt = now;
    user.currentPeriodEnd = now;
    delete user.cancelReason;
    delete user.scheduledCancelAt;
    delete user.stripeSubscriptionId;
    user.updatedAt = now;
    return user;
  });
}

/** Payment failure / PG subscription end → immediate EXPIRED, credits preserved. */
export async function handleRenewalFailure(userId: string): Promise<UserRecord | null> {
  return expireSubscription(userId);
}

/** Cron: expire CANCELED_PENDING users past period end, and stale ACTIVE past end. */
export async function processSubscriptionExpiries(now = Date.now()) {
  const db = getDb();
  let expired = 0;
  for (const user of Object.values(db.users)) {
    if (user.planId === "free") continue;
    const lifecycle = user.subscriptionLifecycle ?? "ACTIVE";
    const periodEnded = user.currentPeriodEnd != null && user.currentPeriodEnd <= now;
    if (!periodEnded) continue;
    if (lifecycle === "CANCELED_PENDING" || lifecycle === "ACTIVE") {
      await expireSubscription(user.id);
      expired += 1;
    }
  }
  return { scanned: Object.keys(db.users).length, expired };
}

export function activateSubscription(user: UserRecord): void {
  user.subscriptionLifecycle = "ACTIVE";
  user.cancelAtPeriodEnd = false;
  user.subscriptionStatus = "active";
  delete user.cancelReason;
  delete user.scheduledCancelAt;
  delete user.cancelledAt;
}

export function setLifecycle(
  user: UserRecord,
  lifecycle: SubscriptionLifecycle
): void {
  user.subscriptionLifecycle = lifecycle;
}
