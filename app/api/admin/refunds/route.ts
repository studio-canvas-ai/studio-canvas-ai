import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  processPaymentRefund,
  restoreCreditsForSystemError,
} from "@/lib/payments/refund";

export const runtime = "nodejs";

/**
 * Admin exception / system-error refund path (Article 6).
 * Body:
 *  - { orderId, mode: "system_error"|"admin_exception", reason? }
 *  - { action: "restore_credits", userId, amount, orderId?, note? }
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    orderId?: string;
    mode?: "system_error" | "admin_exception";
    reason?: string;
    userId?: string;
    amount?: number;
    note?: string;
  };

  if (body.action === "restore_credits") {
    if (!body.userId || body.amount == null) {
      return NextResponse.json(
        { error: "userId and amount required" },
        { status: 400 }
      );
    }
    const user = await restoreCreditsForSystemError({
      userId: body.userId,
      amount: body.amount,
      orderId: body.orderId,
      note: body.note,
    });
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      credits: user.credits,
      userId: user.id,
    });
  }

  if (!body.orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }
  const mode = body.mode === "admin_exception" ? "admin_exception" : "system_error";

  try {
    const result = await processPaymentRefund({
      orderId: body.orderId,
      mode,
      reason: body.reason,
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
      mode,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "refund failed" },
      { status: 502 }
    );
  }
}
