import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db/credits";
import { scheduleSubscriptionCancel } from "@/lib/subscriptionLifecycle";
import { cancelStripeSubscriptionAtPeriodEnd } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const user = await getUserById(userId);
  if (!user || user.planId === "free") {
    return NextResponse.json({ error: "no_active_subscription" }, { status: 400 });
  }

  if (user.stripeSubscriptionId) {
    try {
      await cancelStripeSubscriptionAtPeriodEnd(user.stripeSubscriptionId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "stripe cancel failed" },
        { status: 400 }
      );
    }
  }

  const updated = await scheduleSubscriptionCancel({
    userId,
    reason: body.reason,
  });

  return NextResponse.json({
    ok: true,
    user: updated
      ? {
          planId: updated.planId,
          subscriptionLifecycle: updated.subscriptionLifecycle,
          currentPeriodEnd: updated.currentPeriodEnd,
          scheduledCancelAt: updated.scheduledCancelAt,
        }
      : null,
  });
}
