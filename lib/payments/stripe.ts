import Stripe from "stripe";
import type { BillingInterval } from "@/lib/data";
import type { PaymentOrder, UserRecord } from "@/lib/db/types";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return stripeClient;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function planLabel(planId: string, interval: BillingInterval): string {
  const name =
    planId === "enterprise" || planId === "pro"
      ? "Pro"
      : planId === "standard"
        ? "Standard"
        : "Starter";
  const cadence =
    interval === "annual" ? "Annual" : interval === "quarterly" ? "3-Month" : "Monthly";
  return `${name} (${cadence})`;
}

export async function createStripeCheckoutSession(input: {
  order: PaymentOrder;
  user: UserRecord;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY missing");

  const isPlanPurchase = input.order.kind === "subscription";
  const interval = input.order.billingInterval ?? "annual";
  // Annual passes are prepaid one-time purchases. Only monthly plans create
  // recurring Stripe subscriptions.
  const isRecurringSubscription = isPlanPurchase && interval === "monthly";
  const amountUsd = input.order.amountUsd ?? 0;
  const amountCents = Math.round(amountUsd * 100);

  const customerParams: Stripe.Checkout.SessionCreateParams.CustomerCreation = "always";
  let customer: string | undefined = input.user.stripeCustomerId;

  if (!customer && input.user.email) {
    const existing = await stripe.customers.list({
      email: input.user.email,
      limit: 1,
    });
    customer = existing.data[0]?.id;
  }

  const metadata = {
    orderId: input.order.id,
    userId: input.order.userId,
    kind: input.order.kind,
    planId: input.order.planId ?? "",
    billingInterval: input.order.billingInterval ?? "",
    packId: input.order.packId ?? "",
  };

  const baseParams: Stripe.Checkout.SessionCreateParams = {
    mode: isRecurringSubscription ? "subscription" : "payment",
    success_url: `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: input.cancelUrl,
    client_reference_id: input.order.id,
    metadata,
    automatic_tax: { enabled: false },
    ...(customer
      ? { customer }
      : input.user.email
        ? { customer_email: input.user.email, customer_creation: customerParams }
        : {}),
  };

  if (isRecurringSubscription && input.order.planId) {
    baseParams.line_items = [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: planLabel(input.order.planId, interval),
            description: `${input.order.credits} portrait credits / period`,
          },
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ];
    baseParams.subscription_data = { metadata };
  } else if (isPlanPurchase && input.order.planId) {
    baseParams.line_items = [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: planLabel(input.order.planId, interval),
            description:
              interval === "annual"
                ? `${input.order.credits} portrait credits · 12-month prepaid pass · no auto-renewal`
                : interval === "quarterly"
                  ? `${input.order.credits} portrait credits · 3-month prepaid pass · no auto-renewal`
                  : `${input.order.credits} portrait credits`,
          },
        },
        quantity: 1,
      },
    ];
    baseParams.payment_intent_data = { metadata };
  } else {
    baseParams.line_items = [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Credit pack (${input.order.credits} credits)`,
          },
        },
        quantity: 1,
      },
    ];
    baseParams.payment_intent_data = { metadata };
  }

  const session = await stripe.checkout.sessions.create(baseParams);
  if (!session.url) throw new Error("Stripe session URL missing");
  return { sessionId: session.id, url: session.url };
}

export async function createStripePortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY missing");
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return session.url;
}

export async function cancelStripeSubscriptionAtPeriodEnd(
  subscriptionId: string
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY missing");
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function cancelStripeSubscriptionImmediately(
  subscriptionId: string
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY missing");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.status !== "canceled") {
    await stripe.subscriptions.cancel(subscriptionId);
  }
}

export async function resumeStripeSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY missing");
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function createStripeRefund(input: {
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}): Promise<{ refundId: string; paymentIntentId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY missing");

  let paymentIntentId = input.paymentIntentId?.trim() || "";
  if (!paymentIntentId && input.checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(input.checkoutSessionId);
    const pi = session.payment_intent;
    paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? "";
  }
  if (!paymentIntentId) {
    throw new Error("Stripe payment intent missing for refund");
  }

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason: input.reason ?? "requested_by_customer",
  });
  return { refundId: refund.id, paymentIntentId };
}

export function verifyStripeWebhook(
  payload: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new Error("Stripe webhook not configured");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
