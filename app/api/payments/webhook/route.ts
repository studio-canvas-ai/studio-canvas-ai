import { NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/payments";
import { getDb } from "@/lib/db/store";

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
    paymentKey?: string;
    status?: string;
    data?: { orderId?: string; paymentId?: string };
  };

  const orderId = body.orderId || body.data?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const existing = getDb().orders[orderId];
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (body.status && !["DONE", "PAID", "paid", "done"].includes(body.status)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const paid = await markOrderPaid({
    orderId,
    externalPaymentKey: body.paymentKey || body.data?.paymentId,
  });

  return NextResponse.json({ ok: true, order: paid });
}
