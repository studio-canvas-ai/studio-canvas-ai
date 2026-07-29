import { NextResponse } from "next/server";
import { markOrderPaid, saveBillingCredentials } from "@/lib/payments";
import { getDb } from "@/lib/db/store";
import { handleRenewalFailure } from "@/lib/subscriptionLifecycle";
import {
  isWebhookEventProcessed,
  recordWebhookEvent,
} from "@/lib/payments/webhookIdempotency";

export const runtime = "nodejs";

/**
 * Toss / PortOne webhook receiver.
 * Configure webhook URL to /api/payments/webhook
 */
export async function POST(req: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-webhook-secret") || req.headers.get("authorization");
    if (header !== secret && header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = (await req.json()) as {
    orderId?: string;
    eventId?: string;
    paymentKey?: string;
    status?: string;
    data?: {
      orderId?: string;
      paymentId?: string;
      billingKey?: string;
      customerKey?: string;
      receiptUrl?: string;
    };
    message?: string;
  };

  const orderId = body.orderId || body.data?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const eventId = body.eventId || body.paymentKey || body.data?.paymentId || `${orderId}:${body.status}`;
  if (await isWebhookEventProcessed("toss", eventId)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const existing = getDb().orders[orderId];
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const normalizedStatus = body.status?.toUpperCase();
  if (
    normalizedStatus &&
    ["FAILED", "FAIL", "DECLINED", "CANCELED", "CANCELLED"].includes(normalizedStatus)
  ) {
    if (existing.kind === "subscription") {
      await handleRenewalFailure(existing.userId);
    }
    await recordWebhookEvent({ source: "toss", eventId, orderId });
    return NextResponse.json({ ok: true, expired: true });
  }

  if (normalizedStatus && !["DONE", "PAID"].includes(normalizedStatus)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (body.data?.billingKey) {
    await saveBillingCredentials({
      userId: existing.userId,
      billingKey: body.data.billingKey,
      customerKey: body.data.customerKey,
    });
  }

  const paid = await markOrderPaid({
    orderId,
    externalPaymentKey: body.paymentKey || body.data?.paymentId,
    receiptUrl: body.data?.receiptUrl,
  });

  await recordWebhookEvent({ source: "toss", eventId, orderId });

  return NextResponse.json({ ok: true, order: paid });
}
