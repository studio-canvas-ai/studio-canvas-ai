import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db/credits";
import { resumeSubscription } from "@/lib/subscriptionLifecycle";
import { resumeStripeSubscription } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const user = await getUserById(userId);
  if (!user || user.subscriptionLifecycle !== "CANCELED_PENDING") {
    return NextResponse.json({ error: "not_pending_cancel" }, { status: 400 });
  }

  if (user.stripeSubscriptionId) {
    try {
      await resumeStripeSubscription(user.stripeSubscriptionId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "stripe resume failed" },
        { status: 400 }
      );
    }
  }

  const updated = await resumeSubscription(userId);
  return NextResponse.json({
    ok: true,
    user: updated
      ? {
          planId: updated.planId,
          subscriptionLifecycle: updated.subscriptionLifecycle,
          currentPeriodEnd: updated.currentPeriodEnd,
        }
      : null,
  });
}
