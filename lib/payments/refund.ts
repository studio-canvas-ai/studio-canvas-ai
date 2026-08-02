import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { PaymentOrder, UserRecord } from "@/lib/db/types";
import { cancelTossPayment } from "@/lib/payments";
import {
  isWithinRefundWindow,
  orderCreditsFullyUnused,
} from "@/lib/payments/orderCredits";
import { createStripeRefund } from "@/lib/payments/stripe";

export type RefundDenialReason =
  | "not_found"
  | "forbidden"
  | "already_refunded"
  | "not_paid"
  | "window_expired"
  | "credits_used"
  | "provider_unsupported";

export type RefundEligibility = {
  eligible: boolean;
  order: PaymentOrder | null;
  denialReason?: RefundDenialReason;
  withinWindow: boolean;
  creditsUnused: boolean;
  autoRefundable: boolean;
};

export type RefundMode = "auto" | "system_error" | "admin_exception";

/**
 * Article 6 eligibility:
 * - Auto approve: within 7 days AND no credits from that payment used
 * - Deny: used credits OR past 7 days (unless exception override)
 */
export function evaluateRefundEligibility(
  order: PaymentOrder | null | undefined,
  opts?: { userId?: string; allowException?: boolean }
): RefundEligibility {
  if (!order) {
    return {
      eligible: false,
      order: null,
      denialReason: "not_found",
      withinWindow: false,
      creditsUnused: false,
      autoRefundable: false,
    };
  }
  if (opts?.userId && order.userId !== opts.userId) {
    return {
      eligible: false,
      order,
      denialReason: "forbidden",
      withinWindow: false,
      creditsUnused: false,
      autoRefundable: false,
    };
  }
  if (order.status === "refunded") {
    return {
      eligible: false,
      order,
      denialReason: "already_refunded",
      withinWindow: false,
      creditsUnused: false,
      autoRefundable: false,
    };
  }
  if (order.status !== "paid") {
    return {
      eligible: false,
      order,
      denialReason: "not_paid",
      withinWindow: false,
      creditsUnused: false,
      autoRefundable: false,
    };
  }

  const withinWindow = isWithinRefundWindow(order);
  const creditsUnused = orderCreditsFullyUnused(order);
  const autoRefundable = withinWindow && creditsUnused;

  if (autoRefundable) {
    return {
      eligible: true,
      order,
      withinWindow,
      creditsUnused,
      autoRefundable: true,
    };
  }

  if (opts?.allowException) {
    return {
      eligible: true,
      order,
      withinWindow,
      creditsUnused,
      autoRefundable: false,
    };
  }

  return {
    eligible: false,
    order,
    denialReason: !withinWindow ? "window_expired" : "credits_used",
    withinWindow,
    creditsUnused,
    autoRefundable: false,
  };
}

async function executeProviderRefund(
  order: PaymentOrder,
  cancelReason: string
): Promise<{ refundId: string }> {
  if (order.provider === "demo") {
    return { refundId: `demo_refund_${Date.now()}` };
  }

  if (order.provider === "toss") {
    const paymentKey = order.externalPaymentKey;
    if (!paymentKey) throw new Error("Domestic payment key missing");
    // Toss Payments cancel covers domestic card/KCP rails used via Toss (NHN KCP).
    const result = await cancelTossPayment({
      paymentKey,
      cancelReason,
      cancelAmount: order.currency === "KRW" ? order.amountKrw : undefined,
    });
    return {
      refundId:
        (result as { lastTransactionKey?: string }).lastTransactionKey ||
        `toss_cancel_${paymentKey}`,
    };
  }

  if (order.provider === "portone") {
    // PortOne-specific cancel is not wired; require admin after manual PG cancel,
    // or use demo/local clawback only when explicitly forced via exception path later.
    throw new Error("provider_unsupported");
  }

  if (order.provider === "stripe") {
    const result = await createStripeRefund({
      paymentIntentId: order.stripePaymentIntentId || order.externalPaymentKey,
      checkoutSessionId: order.stripeCheckoutSessionId,
      reason: "requested_by_customer",
    });
    return { refundId: result.refundId };
  }

  throw new Error("provider_unsupported");
}

function clawBackEntitlements(
  user: UserRecord,
  order: PaymentOrder,
  now: number
): number {
  const claw = Math.min(user.credits, order.credits);
  user.credits = Math.round((user.credits - claw) * 10) / 10;
  user.updatedAt = now;

  if (order.kind === "subscription" && order.planId && user.planId === order.planId) {
    user.planId = "free";
    user.maxCredits = Math.max(user.credits, 2);
    delete user.billingInterval;
    delete user.currentPeriodStart;
    delete user.currentPeriodEnd;
    delete user.stripeSubscriptionId;
    user.cancelAtPeriodEnd = false;
    delete user.scheduledCancelAt;
    user.subscriptionLifecycle = "EXPIRED";
  }

  return claw;
}

/**
 * Run PG refund + DB sync in one flow.
 * `mode: auto` requires Article 6 auto conditions.
 * `system_error` / `admin_exception` allow override (admin only at API layer).
 */
export async function processPaymentRefund(input: {
  orderId: string;
  userId?: string;
  mode: RefundMode;
  reason?: string;
}): Promise<
  | { ok: true; order: PaymentOrder; clawedCredits: number; refundId: string }
  | { ok: false; denialReason: RefundDenialReason; message: string }
> {
  const allowException = input.mode === "system_error" || input.mode === "admin_exception";
  const existing = getDb().orders[input.orderId];
  const eligibility = evaluateRefundEligibility(existing, {
    userId: input.userId,
    allowException,
  });

  if (!eligibility.eligible || !eligibility.order) {
    const reason = eligibility.denialReason ?? "not_found";
    return {
      ok: false,
      denialReason: reason,
      message: denialMessage(reason),
    };
  }

  const orderSnapshot = eligibility.order;
  const cancelReason =
    input.reason?.trim() ||
    (input.mode === "system_error"
      ? "System error exception refund (Article 6)"
      : input.mode === "admin_exception"
        ? "Admin exception refund (Article 6)"
        : "Customer withdrawal within 7 days — unused credits (Article 6)");

  let providerRefundId: string;
  try {
    const providerResult = await executeProviderRefund(orderSnapshot, cancelReason);
    providerRefundId = providerResult.refundId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "provider refund failed";
    if (msg.includes("provider_unsupported")) {
      return {
        ok: false,
        denialReason: "provider_unsupported",
        message: denialMessage("provider_unsupported"),
      };
    }
    throw err;
  }

  const applied = await withDbLock((db) => {
    const order = db.orders[input.orderId];
    if (!order || order.status !== "paid") {
      return null;
    }
    const user = db.users[order.userId];
    if (!user) return null;

    const now = Date.now();
    const clawed = clawBackEntitlements(user, order, now);
    order.status = "refunded";
    order.refundedAt = now;
    order.refundId = providerRefundId;
    order.refundReason = cancelReason;
    order.refundKind = input.mode;
    order.creditsRemaining = 0;

    db.ledger.push({
      id: newId("ldg"),
      userId: user.id,
      delta: -clawed,
      balanceAfter: user.credits,
      reason: input.mode === "system_error" ? "system_error_restore" : "payment_refund",
      meta: {
        orderId: order.id,
        refundId: providerRefundId,
        mode: input.mode,
        clawedCredits: clawed,
      },
      createdAt: now,
    });

    return { order, clawedCredits: clawed };
  });

  if (!applied) {
    return {
      ok: false,
      denialReason: "already_refunded",
      message: denialMessage("already_refunded"),
    };
  }

  return {
    ok: true,
    order: applied.order,
    clawedCredits: applied.clawedCredits,
    refundId: providerRefundId,
  };
}

function denialMessage(reason: RefundDenialReason): string {
  switch (reason) {
    case "not_found":
      return "Order not found.";
    case "forbidden":
      return "You cannot refund this order.";
    case "already_refunded":
      return "This payment was already refunded.";
    case "not_paid":
      return "Only paid orders can be refunded.";
    case "window_expired":
      return "The 7-day withdrawal window has expired.";
    case "credits_used":
      return "Credits from this payment were already used, so an automatic refund is not available.";
    case "provider_unsupported":
      return "Automatic refund is not supported for this payment provider.";
    default:
      return "Refund denied.";
  }
}

/** Admin/system-error path: restore credits without PG refund when generation failed. */
export async function restoreCreditsForSystemError(input: {
  userId: string;
  amount: number;
  orderId?: string;
  note?: string;
}): Promise<UserRecord | null> {
  return withDbLock((db) => {
    const user = db.users[input.userId];
    if (!user) return null;
    const amount = Math.round(input.amount * 10) / 10;
    if (amount <= 0) return user;
    user.credits = Math.round((user.credits + amount) * 10) / 10;
    user.maxCredits = Math.max(user.maxCredits, user.credits);
    user.updatedAt = Date.now();
    if (input.orderId) {
      const order = db.orders[input.orderId];
      if (order && order.status === "paid") {
        const next = Math.min(
          order.credits,
          Math.round(((order.creditsRemaining ?? 0) + amount) * 10) / 10
        );
        order.creditsRemaining = next;
      }
    }
    db.ledger.push({
      id: newId("ldg"),
      userId: user.id,
      delta: amount,
      balanceAfter: user.credits,
      reason: "system_error_restore",
      meta: {
        orderId: input.orderId ?? null,
        note: input.note ?? "system_error",
      },
      createdAt: Date.now(),
    });
    return user;
  });
}
