import {
  CREDIT_PACKS,
  type BillingInterval,
  creditPackAmount,
  getDomesticMonthlyPriceKrw,
  getDomesticQuarterlyPriceKrw,
  getPlanOffer,
  billingPeriodDays,
  isPrepaidPass,
  pricingPlanIds,
} from "@/lib/data";
import { usdToKrw } from "@/lib/currency";
import type { Locale } from "@/lib/i18n/types";
import { resolveCheckoutRegion } from "@/lib/paymentRouting";
import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { PaymentOrder, PaymentProviderId, UserRecord } from "@/lib/db/types";
import { activateSubscription } from "@/lib/subscriptionLifecycle";
import {
  createStripeCheckoutSession,
  stripeConfigured,
} from "@/lib/payments/stripe";
import { getSiteUrl } from "@/lib/site";
import { KCP_RECURRING_ENABLED } from "@/lib/checkoutPolicy";

export type CheckoutKind = "subscription" | "credit_pack";

export function requiresKcpRecurringBilling(input: {
  kind: CheckoutKind;
  billingInterval?: BillingInterval;
  locale?: Locale;
}): boolean {
  if (!KCP_RECURRING_ENABLED) return false;
  if (input.kind !== "subscription") return false;
  if (input.billingInterval !== "monthly") return false;
  return resolveCheckoutRegion(input.locale ?? "kr") === "domestic";
}

export function shouldBypassRecurringForBcCard(input: {
  kind: CheckoutKind;
  billingInterval?: BillingInterval;
  locale?: Locale;
  domesticCardBrand?: string | null;
}): boolean {
  if (input.kind !== "subscription") return false;
  if (input.billingInterval !== "monthly") return false;
  if (resolveCheckoutRegion(input.locale ?? "kr") !== "domestic") return false;
  return (input.domesticCardBrand ?? "").trim().toLowerCase() === "bc";
}

export function getDomesticProvider(): "toss" | "portone" | "demo" {
  const forced = process.env.PAYMENT_PROVIDER as PaymentProviderId | undefined;
  if (forced === "toss" || forced === "demo" || forced === "portone") return forced;
  // Default domestic rail: PortOne (storeId/channelKey have hardcoded test fallbacks).
  return "portone";
}

export function getPaymentProvider(locale?: Locale): PaymentProviderId {
  if (locale && resolveCheckoutRegion(locale) === "global") {
    return stripeConfigured() ? "stripe" : "demo";
  }
  return getDomesticProvider();
}

export function isDemoCheckoutAllowed(): boolean {
  const host = getSiteUrl();
  return host.includes("localhost") || host.includes("127.0.0.1");
}

export async function createPaymentOrder(input: {
  userId: string;
  kind: CheckoutKind;
  planId?: (typeof pricingPlanIds)[number];
  billingInterval?: BillingInterval;
  packId?: (typeof CREDIT_PACKS)[number]["id"];
  isSubscriber: boolean;
  locale?: Locale;
}): Promise<PaymentOrder> {
  return withDbLock((db) => {
    const locale = input.locale ?? "en";
    const region = resolveCheckoutRegion(locale);
    const provider = getPaymentProvider(locale);
    const currency: "KRW" | "USD" = region === "domestic" ? "KRW" : "USD";

    let amountUsd = 0;
    let amountKrw = 0;
    let baseAmountKrw = 0;
    let prorationCreditKrw = 0;
    let credits = 0;

    if (input.kind === "subscription") {
      if (!input.planId) throw new Error("planId required");
      const interval = input.billingInterval ?? "annual";
      const offer = getPlanOffer(input.planId, interval);
      amountUsd = offer.totalUsd;

      if (currency === "KRW" && interval === "monthly") {
        // Domestic monthly: fixed VAT-inclusive list prices for Toss / PortOne.
        const fixed = getDomesticMonthlyPriceKrw(input.planId);
        baseAmountKrw = fixed ?? offer.totalKrw;
      } else if (currency === "KRW" && interval === "quarterly") {
        // Domestic 3-month prepaid: fixed VAT-inclusive list prices.
        const fixed = getDomesticQuarterlyPriceKrw(input.planId);
        baseAmountKrw = fixed ?? offer.totalKrw;
      } else if (currency === "KRW") {
        baseAmountKrw = offer.totalKrw > 0 ? offer.totalKrw : usdToKrw(amountUsd);
      } else {
        // Global / Stripe: FX-derived KRW for bookkeeping only; charge is USD.
        baseAmountKrw = usdToKrw(amountUsd);
      }
      amountKrw = baseAmountKrw;
      credits = offer.credits;

      const user = db.users[input.userId];
      const isPlanChange =
        user?.planId !== "free" &&
        (user.planId !== input.planId || user.billingInterval !== interval);
      const now = Date.now();
      if (
        isPlanChange &&
        user.currentPeriodStart &&
        user.currentPeriodEnd &&
        user.currentPeriodEnd > now &&
        user.lastPlanAmountKrw
      ) {
        const periodLength = Math.max(1, user.currentPeriodEnd - user.currentPeriodStart);
        const remainingFraction = Math.min(
          1,
          Math.max(0, (user.currentPeriodEnd - now) / periodLength)
        );
        prorationCreditKrw = Math.round(user.lastPlanAmountKrw * remainingFraction);
        amountKrw = Math.max(0, baseAmountKrw - prorationCreditKrw);
        if (currency === "USD" && user.lastPlanAmountUsd) {
          const prorationUsd = user.lastPlanAmountUsd * remainingFraction;
          amountUsd = Math.max(0, Math.round((amountUsd - prorationUsd) * 100) / 100);
        }
      }
    } else {
      const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
      if (!pack) throw new Error("invalid pack");
      amountUsd = pack.price;
      amountKrw = usdToKrw(pack.price);
      credits = creditPackAmount(pack, input.isSubscriber);
    }

    const order: PaymentOrder = {
      id: newId("ord"),
      userId: input.userId,
      provider,
      kind: input.kind,
      planId: input.planId,
      billingInterval: input.billingInterval,
      packId: input.packId,
      locale,
      currency,
      amountUsd,
      baseAmountKrw,
      prorationCreditKrw,
      amountKrw,
      credits,
      status: "pending",
      vatIncluded: true,
      createdAt: Date.now(),
    };
    db.orders[order.id] = order;
    return order;
  });
}

export async function createCheckoutForOrder(input: {
  order: PaymentOrder;
  user: UserRecord;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ checkoutUrl?: string; sessionId?: string }> {
  if (input.order.provider === "stripe") {
    const session = await createStripeCheckoutSession({
      order: input.order,
      user: input.user,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
    await withDbLock((db) => {
      const order = db.orders[input.order.id];
      if (order) order.stripeCheckoutSessionId = session.sessionId;
    });
    return { checkoutUrl: session.url, sessionId: session.sessionId };
  }
  return {};
}

export async function markOrderPaid(params: {
  orderId: string;
  externalPaymentKey?: string;
  receiptUrl?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paymentMethodLabel?: string;
}): Promise<PaymentOrder | null> {
  const order = await withDbLock((db) => {
    const o = db.orders[params.orderId];
    if (!o || o.status === "paid") return o ?? null;
    const user = db.users[o.userId];
    if (!user) throw new Error("user not found");
    const now = Date.now();
    const previousPlanId = user.planId;
    const previousInterval = user.billingInterval;

    o.status = "paid";
    o.paidAt = now;
    o.creditsRemaining = o.credits;
    o.externalPaymentKey = params.externalPaymentKey;
    if (params.receiptUrl) o.receiptUrl = params.receiptUrl;
    if (params.externalPaymentKey?.startsWith("pi_")) {
      o.stripePaymentIntentId = params.externalPaymentKey;
    }

    user.credits = Math.round((user.credits + o.credits) * 10) / 10;
    user.maxCredits = Math.max(user.maxCredits, user.credits);
    user.updatedAt = now;
    activateSubscription(user);

    if (params.stripeCustomerId) user.stripeCustomerId = params.stripeCustomerId;
    if (params.stripeSubscriptionId) user.stripeSubscriptionId = params.stripeSubscriptionId;
    if (params.paymentMethodLabel) user.defaultPaymentMethodLabel = params.paymentMethodLabel;

    if (o.kind === "subscription" && o.planId) {
      const interval = o.billingInterval ?? "annual";
      const isUpgrade =
        previousPlanId !== "free" &&
        (previousPlanId !== o.planId || previousInterval !== interval);
      const isRenewal = previousPlanId === o.planId && previousInterval === interval;
      user.planId = o.planId;
      user.billingInterval = interval;
      if (isPrepaidPass(interval)) {
        // Prepaid passes are one-time checkouts, not provider subscriptions.
        delete user.stripeSubscriptionId;
        user.cancelAtPeriodEnd = false;
        delete user.scheduledCancelAt;
      }
      user.currentPeriodStart = now;
      user.currentPeriodEnd = now + billingPeriodDays(interval) * 24 * 60 * 60 * 1000;
      user.lastPlanAmountKrw = o.baseAmountKrw ?? o.amountKrw;
      user.lastPlanAmountUsd = o.amountUsd;
      db.ledger.push({
        id: newId("ldg"),
        userId: user.id,
        delta: o.credits,
        balanceAfter: user.credits,
        reason: isUpgrade
          ? "subscription_upgrade"
          : isRenewal
            ? "subscription_renewal"
            : "subscription",
        meta: {
          orderId: o.id,
          planId: o.planId,
          billingInterval: interval,
          amountUsd: o.amountUsd,
          baseAmountKrw: o.baseAmountKrw ?? o.amountKrw,
          prorationCreditKrw: o.prorationCreditKrw ?? 0,
          periodStart: user.currentPeriodStart,
          periodEnd: user.currentPeriodEnd,
        },
        createdAt: now,
      });
    } else {
      db.ledger.push({
        id: newId("ldg"),
        userId: user.id,
        delta: o.credits,
        balanceAfter: user.credits,
        reason: "credit_pack",
        meta: { orderId: o.id, packId: o.packId ?? null, amountUsd: o.amountUsd },
        createdAt: now,
      });
    }
    return o;
  });
  return order ? getDb().orders[order.id] ?? order : null;
}

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

export async function getUserPaymentHistory(userId: string) {
  const db = getDb();
  return Object.values(db.orders)
    .filter(
      (o) =>
        o.userId === userId && (o.status === "paid" || o.status === "refunded")
    )
    .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt));
}

/** Toss Payments confirm API */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("TOSS_SECRET_KEY missing");
  const auth = Buffer.from(`${secret}:`).toString("base64");
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Toss confirm failed");
  }
  return data as { receipt?: { url?: string } };
}

/** Toss Payments cancel/refund API (domestic PG — NHN KCP via Toss). */
export async function cancelTossPayment(params: {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
}) {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("TOSS_SECRET_KEY missing");
  const auth = Buffer.from(`${secret}:`).toString("base64");
  const res = await fetch(
    `https://api.tosspayments.com/v1/payments/${encodeURIComponent(params.paymentKey)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancelReason: params.cancelReason,
        ...(params.cancelAmount != null ? { cancelAmount: params.cancelAmount } : {}),
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Toss cancel failed");
  }
  return data as { paymentKey?: string; cancels?: unknown[] };
}

export function orderAmountForProvider(order: PaymentOrder): number {
  return order.currency === "USD" ? order.amountUsd : order.amountKrw;
}

export function formatOrderDisplayAmount(order: PaymentOrder, showKrw: boolean): string {
  if (order.currency === "USD") {
    const usd = `$${order.amountUsd % 1 === 0 ? order.amountUsd.toFixed(0) : order.amountUsd.toFixed(2)}`;
    if (showKrw) return `${usd} (₩${usdToKrw(order.amountUsd).toLocaleString("en-US")})`;
    return usd;
  }
  return `₩${order.amountKrw.toLocaleString("en-US")}`;
}
