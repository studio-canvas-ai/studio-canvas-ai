import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db/store";
import { markOrderPaid } from "@/lib/payments";
import { isPrepaidPass } from "@/lib/data";
import {
  cancelStripeSubscriptionImmediately,
  verifyStripeWebhook,
} from "@/lib/payments/stripe";
import {
  isWebhookEventProcessed,
  recordWebhookEvent,
} from "@/lib/payments/webhookIdempotency";
import {
  expireSubscription,
  handleRenewalFailure,
} from "@/lib/subscriptionLifecycle";
import { withDbLock } from "@/lib/db/store";

export const runtime = "nodejs";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return null;

  if (await isWebhookEventProcessed("stripe", session.id)) {
    return getDb().orders[orderId] ?? null;
  }

  const order = getDb().orders[orderId];
  if (!order) return null;

  // Switching from a recurring monthly plan to a prepaid pass must
  // terminate the old Stripe subscription so no monthly renewal can survive.
  if (
    order.kind === "subscription" &&
    order.billingInterval &&
    isPrepaidPass(order.billingInterval)
  ) {
    const user = getDb().users[order.userId];
    if (user?.stripeSubscriptionId) {
      await cancelStripeSubscriptionImmediately(user.stripeSubscriptionId);
    }
  }

  const receiptUrl =
    typeof session.invoice === "object" && session.invoice && "hosted_invoice_url" in session.invoice
      ? (session.invoice.hosted_invoice_url as string | null)
      : undefined;

  const paidOrder = await markOrderPaid({
    orderId,
    externalPaymentKey: session.payment_intent?.toString() ?? session.id,
    receiptUrl: receiptUrl ?? undefined,
    stripeCustomerId: session.customer?.toString(),
    stripeSubscriptionId: session.subscription?.toString(),
  });

  await recordWebhookEvent({
    source: "stripe",
    eventId: session.id,
    orderId,
  });
  return paidOrder;
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(payload, signature);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid signature" },
      { status: 400 }
    );
  }

  if (await isWebhookEventProcessed("stripe", event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const order = await handleCheckoutCompleted(session);
        return NextResponse.json({ ok: true, orderId: order?.id });
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription?.toString();
        if (!subscriptionId) break;

        await withDbLock((db) => {
          const user = Object.values(db.users).find(
            (u) => u.stripeSubscriptionId === subscriptionId
          );
          if (!user) return;
          user.subscriptionLifecycle = "ACTIVE";
          user.subscriptionStatus = "active";
          user.updatedAt = Date.now();
        });

        await recordWebhookEvent({ source: "stripe", eventId: event.id });
        return NextResponse.json({ ok: true });
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription?.toString();
        if (subscriptionId) {
          const user = Object.values(getDb().users).find(
            (u) => u.stripeSubscriptionId === subscriptionId
          );
          if (user) await handleRenewalFailure(user.id);
        }
        await recordWebhookEvent({ source: "stripe", eventId: event.id });
        return NextResponse.json({ ok: true });
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await withDbLock((db) => {
          const user = Object.values(db.users).find(
            (u) => u.stripeSubscriptionId === sub.id
          );
          if (!user) return;
          if (sub.cancel_at_period_end) {
            user.subscriptionLifecycle = "CANCELED_PENDING";
            user.cancelAtPeriodEnd = true;
            user.scheduledCancelAt = sub.current_period_end * 1000;
          } else {
            user.subscriptionLifecycle = "ACTIVE";
            user.cancelAtPeriodEnd = false;
            delete user.scheduledCancelAt;
          }
          user.currentPeriodEnd = sub.current_period_end * 1000;
          user.updatedAt = Date.now();
        });
        await recordWebhookEvent({ source: "stripe", eventId: event.id });
        return NextResponse.json({ ok: true });
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const user = Object.values(getDb().users).find(
          (u) => u.stripeSubscriptionId === sub.id
        );
        if (user) await expireSubscription(user.id);
        await recordWebhookEvent({ source: "stripe", eventId: event.id });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: true, ignored: event.type });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "webhook failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
