import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  evaluateRefundEligibility,
  processPaymentRefund,
} from "@/lib/payments/refund";
import { getDb } from "@/lib/db/store";

export const runtime = "nodejs";

/** POST — customer auto-refund under Article 6 (7-day + unused credits). */
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    orderId?: string;
  };
  if (!body.orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const order = getDb().orders[body.orderId];
  const eligibility = evaluateRefundEligibility(order, { userId });
  if (!eligibility.eligible) {
    return NextResponse.json(
      {
        error: eligibility.denialReason ?? "ineligible",
        message:
          eligibility.denialReason === "credits_used" ||
          eligibility.denialReason === "window_expired"
            ? "Automatic refund denied under Terms Article 6. Contact support for system-error exceptions."
            : "Refund not available.",
        withinWindow: eligibility.withinWindow,
        creditsUnused: eligibility.creditsUnused,
      },
      { status: 403 }
    );
  }

  try {
    const result = await processPaymentRefund({
      orderId: body.orderId,
      userId,
      mode: "auto",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.denialReason, message: result.message },
        { status: 403 }
      );
    }
    return NextResponse.json({
      ok: true,
      orderId: result.order.id,
      refundId: result.refundId,
      clawedCredits: result.clawedCredits,
      status: result.order.status,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "refund failed" },
      { status: 502 }
    );
  }
}

/** GET — preview eligibility for an order (?orderId=). */
export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }
  const eligibility = evaluateRefundEligibility(getDb().orders[orderId], {
    userId,
  });
  return NextResponse.json({
    orderId,
    eligible: eligibility.eligible,
    autoRefundable: eligibility.autoRefundable,
    withinWindow: eligibility.withinWindow,
    creditsUnused: eligibility.creditsUnused,
    denialReason: eligibility.denialReason ?? null,
  });
}
