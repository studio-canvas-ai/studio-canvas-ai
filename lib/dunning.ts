import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { PaymentNotice, PaymentOrder, UserRecord } from "@/lib/db/types";
import { markOrderPaid } from "@/lib/payments";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function saveBillingCredentials(input: {
  userId: string;
  billingKey: string;
  customerKey?: string;
}) {
  return withDbLock((db) => {
    const user = db.users[input.userId];
    if (!user) return null;
    user.billingKey = input.billingKey;
    user.providerCustomerKey = input.customerKey ?? user.providerCustomerKey;
    user.updatedAt = Date.now();
    return user;
  });
}

function addNotice(
  db: ReturnType<typeof getDb>,
  userId: string,
  orderId: string,
  type: PaymentNotice["type"],
  attempt: PaymentNotice["attempt"]
) {
  const notice: PaymentNotice = {
    id: newId("pnt"),
    userId,
    orderId,
    type,
    attempt,
    createdAt: Date.now(),
  };
  db.paymentNotices.push(notice);
  return notice;
}

async function deliverNotice(notice: PaymentNotice, user: UserRecord) {
  const url = process.env.PAYMENT_NOTICE_WEBHOOK_URL;
  if (!url) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.PAYMENT_NOTICE_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.PAYMENT_NOTICE_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        type: notice.type,
        attempt: notice.attempt,
        email: user.email,
        userId: user.id,
        orderId: notice.orderId,
      }),
    });
    if (response.ok) {
      await withDbLock((db) => {
        const saved = db.paymentNotices.find((item) => item.id === notice.id);
        if (saved) saved.deliveredAt = Date.now();
      });
    }
  } catch {
    // Delivery is best-effort; the persisted notice can be replayed later.
  }
}

export async function recordSubscriptionPaymentFailure(input: {
  orderId: string;
  reason?: string;
}) {
  const result = await withDbLock((db) => {
    const order = db.orders[input.orderId];
    if (!order || order.kind !== "subscription" || order.status === "paid") return null;
    const user = db.users[order.userId];
    if (!user) return null;

    const now = Date.now();
    order.status = "failed";
    order.failedAt = now;
    order.failureReason = input.reason;
    user.subscriptionStatus = "past_due";
    user.paymentRetryCount = 1;
    user.lastPaymentFailureAt = now;
    user.nextPaymentRetryAt = now + 2 * DAY_MS;
    user.paymentGraceEndsAt = now + 4 * DAY_MS;
    user.updatedAt = now;
    const notice = addNotice(db, user.id, order.id, "card_check", 1);
    return { notice, user: { ...user }, order: { ...order } };
  });
  if (result) await deliverNotice(result.notice, result.user);
  return result;
}

async function retryProviderCharge(order: PaymentOrder, user: UserRecord) {
  const endpoint = process.env.PAYMENT_RETRY_ENDPOINT;
  if (!endpoint || !user.billingKey) {
    return { ok: false, reason: "billing_retry_not_configured" };
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.PAYMENT_RETRY_SECRET
          ? { Authorization: `Bearer ${process.env.PAYMENT_RETRY_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        orderId: order.id,
        userId: user.id,
        customerKey: user.providerCustomerKey,
        billingKey: user.billingKey,
        amountKrw: order.amountKrw,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      paymentKey?: string;
      error?: string;
    };
    return response.ok
      ? { ok: true, paymentKey: data.paymentKey }
      : { ok: false, reason: data.error || `provider_${response.status}` };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "provider_request_failed",
    };
  }
}

export async function processDunningRetries(now = Date.now()) {
  const db = getDb();
  const dueUsers = Object.values(db.users).filter(
    (user) =>
      user.subscriptionStatus === "past_due" &&
      user.nextPaymentRetryAt != null &&
      user.nextPaymentRetryAt <= now
  );
  let recovered = 0;
  let rescheduled = 0;
  let cancelled = 0;

  for (const snapshot of dueUsers) {
    const order = Object.values(getDb().orders)
      .filter(
        (item) =>
          item.userId === snapshot.id &&
          item.kind === "subscription" &&
          item.status === "failed"
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!order) continue;

    const charge = await retryProviderCharge(order, snapshot);
    if (charge.ok) {
      await markOrderPaid({ orderId: order.id, externalPaymentKey: charge.paymentKey });
      const notice = await withDbLock((locked) =>
        addNotice(locked, snapshot.id, order.id, "payment_recovered", Math.min(
          3,
          (snapshot.paymentRetryCount ?? 1) + 1
        ) as 2 | 3)
      );
      await deliverNotice(notice, snapshot);
      recovered += 1;
      continue;
    }

    const result = await withDbLock((locked) => {
      const user = locked.users[snapshot.id];
      const savedOrder = locked.orders[order.id];
      if (!user || user.subscriptionStatus !== "past_due") return null;
      const nextAttempt = Math.min(3, (user.paymentRetryCount ?? 1) + 1) as 2 | 3;
      user.paymentRetryCount = nextAttempt;
      savedOrder.failureReason = charge.reason;
      savedOrder.failedAt = now;

      if (nextAttempt < 3) {
        user.nextPaymentRetryAt = now + 2 * DAY_MS;
        user.updatedAt = now;
        return {
          cancelled: false,
          notice: addNotice(locked, user.id, order.id, "retry_failed", 2),
          user: { ...user },
        };
      }

      user.lastPaidPlan = user.planId === "free" ? user.lastPaidPlan : user.planId;
      user.planId = "free";
      user.subscriptionStatus = "cancelled";
      user.cancelledAt = now;
      user.currentPeriodEnd = now;
      user.updatedAt = now;
      delete user.nextPaymentRetryAt;
      return {
        cancelled: true,
        notice: addNotice(locked, user.id, order.id, "subscription_cancelled", 3),
        user: { ...user },
      };
    });
    if (!result) continue;
    await deliverNotice(result.notice, result.user);
    if (result.cancelled) cancelled += 1;
    else rescheduled += 1;
  }

  return { scanned: dueUsers.length, recovered, rescheduled, cancelled };
}
