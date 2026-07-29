import {
  CREDIT_PACKS,
  type BillingInterval,
  creditPackAmount,
  creditPackPricesKrw,
  getPlanOffer,
  pricingPlanIds,
} from "@/lib/data";
import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { PaymentOrder } from "@/lib/db/types";

export type CheckoutKind = "subscription" | "credit_pack";

export function getPaymentProvider(): "toss" | "portone" | "demo" {
  const forced = process.env.PAYMENT_PROVIDER as "toss" | "portone" | "demo" | undefined;
  if (forced) return forced;
  if (process.env.TOSS_SECRET_KEY && process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) return "toss";
  if (process.env.PORTONE_API_SECRET && process.env.NEXT_PUBLIC_PORTONE_STORE_ID)
    return "portone";
  return "demo";
}

export async function createPaymentOrder(input: {
  userId: string;
  kind: CheckoutKind;
  planId?: (typeof pricingPlanIds)[number];
  billingInterval?: BillingInterval;
  packId?: (typeof CREDIT_PACKS)[number]["id"];
  isSubscriber: boolean;
}): Promise<PaymentOrder> {
  return withDbLock((db) => {
    let amountKrw = 0;
    let baseAmountKrw = 0;
    let prorationCreditKrw = 0;
    let credits = 0;
    if (input.kind === "subscription") {
      if (!input.planId) throw new Error("planId required");
      const interval = input.billingInterval ?? "annual";
      const offer = getPlanOffer(input.planId, interval);
      baseAmountKrw = offer.totalKrw;
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
        const periodLength = Math.max(
          1,
          user.currentPeriodEnd - user.currentPeriodStart
        );
        const remainingFraction = Math.min(
          1,
          Math.max(0, (user.currentPeriodEnd - now) / periodLength)
        );
        prorationCreditKrw = Math.round(
          user.lastPlanAmountKrw * remainingFraction
        );
        amountKrw = Math.max(0, baseAmountKrw - prorationCreditKrw);
      }
    } else {
      const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
      if (!pack) throw new Error("invalid pack");
      amountKrw = creditPackPricesKrw[pack.id];
      credits = creditPackAmount(pack, input.isSubscriber);
    }

    const order: PaymentOrder = {
      id: newId("ord"),
      userId: input.userId,
      provider: getPaymentProvider(),
      kind: input.kind,
      planId: input.planId,
      billingInterval: input.billingInterval,
      packId: input.packId,
      baseAmountKrw,
      prorationCreditKrw,
      amountKrw,
      credits,
      status: "pending",
      createdAt: Date.now(),
    };
    db.orders[order.id] = order;
    return order;
  });
}

export async function markOrderPaid(params: {
  orderId: string;
  externalPaymentKey?: string;
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
    o.externalPaymentKey = params.externalPaymentKey;

    user.credits = Math.round((user.credits + o.credits) * 10) / 10;
    user.maxCredits = Math.max(user.maxCredits, user.credits);
    user.updatedAt = now;

    if (o.kind === "subscription" && o.planId) {
      const interval = o.billingInterval ?? "annual";
      const isUpgrade =
        previousPlanId !== "free" &&
        (previousPlanId !== o.planId || previousInterval !== interval);
      user.planId = o.planId;
      user.billingInterval = interval;
      user.currentPeriodStart = now;
      user.currentPeriodEnd =
        now + (interval === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000;
      user.lastPlanAmountKrw = o.baseAmountKrw ?? o.amountKrw;
      db.ledger.push({
        id: newId("ldg"),
        userId: user.id,
        delta: o.credits,
        balanceAfter: user.credits,
        reason: isUpgrade ? "subscription_upgrade" : "subscription",
        meta: {
          orderId: o.id,
          planId: o.planId,
          billingInterval: interval,
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
        meta: { orderId: o.id, packId: o.packId ?? null },
        createdAt: now,
      });
    }
    return o;
  });
  return order ? getDb().orders[order.id] ?? order : null;
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
  return data;
}
