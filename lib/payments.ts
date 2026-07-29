import {
  CREDIT_PACKS,
  PLAN_CREDITS,
  creditPackAmount,
  creditPackPricesKrw,
  pricingPlanIds,
  pricingPricesKrw,
} from "@/lib/data";
import { creditUser } from "@/lib/db/credits";
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
  packId?: (typeof CREDIT_PACKS)[number]["id"];
  isSubscriber: boolean;
}): Promise<PaymentOrder> {
  return withDbLock((db) => {
    let amountKrw = 0;
    let credits = 0;
    if (input.kind === "subscription") {
      if (!input.planId) throw new Error("planId required");
      amountKrw = pricingPricesKrw[input.planId];
      credits = PLAN_CREDITS[input.planId];
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
      packId: input.packId,
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
    o.status = "paid";
    o.paidAt = Date.now();
    o.externalPaymentKey = params.externalPaymentKey;
    return o;
  });
  if (!order || order.status !== "paid") return order;

  await creditUser({
    userId: order.userId,
    amount: order.credits,
    reason: order.kind === "subscription" ? "subscription" : "credit_pack",
    meta: {
      orderId: order.id,
      planId: order.planId ?? null,
      packId: order.packId ?? null,
    },
    setPlanId: order.kind === "subscription" && order.planId ? order.planId : undefined,
    setMaxCredits:
      order.kind === "subscription" && order.planId
        ? PLAN_CREDITS[order.planId]
        : undefined,
  });
  return getDb().orders[order.id] ?? order;
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
