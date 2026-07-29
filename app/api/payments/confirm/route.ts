import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  confirmTossPayment,
  getPaymentProvider,
  markOrderPaid,
} from "@/lib/payments";
import { getDb } from "@/lib/db/store";
import { getUserById } from "@/lib/db/credits";

export const runtime = "nodejs";

/**
 * Confirm payment after Toss widget / PortOne callback / demo checkout.
 * Body: { orderId, paymentKey?, demo?: true }
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await req.json()) as {
    orderId: string;
    paymentKey?: string;
    demo?: boolean;
  };

  const order = getDb().orders[body.orderId];
  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (order.status === "paid") {
    const user = await getUserById(userId);
    return NextResponse.json({ ok: true, order, user });
  }

  const provider = getPaymentProvider();

  try {
    if (provider === "toss" && body.paymentKey) {
      await confirmTossPayment({
        paymentKey: body.paymentKey,
        orderId: order.id,
        amount: order.amountKrw,
      });
      const paid = await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: body.paymentKey,
      });
      const user = await getUserById(userId);
      return NextResponse.json({ ok: true, order: paid, user });
    }

    if (provider === "demo" || body.demo) {
      const paid = await markOrderPaid({
        orderId: order.id,
        externalPaymentKey: `demo_${Date.now()}`,
      });
      const user = await getUserById(userId);
      return NextResponse.json({ ok: true, order: paid, user, demo: true });
    }

    // PortOne: client completes via webhook; allow mark if secret verifies later
    return NextResponse.json(
      { error: "awaiting_provider_confirmation", provider },
      { status: 202 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "confirm failed" },
      { status: 400 }
    );
  }
}
