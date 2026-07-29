import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db/credits";
import { createStripePortalSession } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const user = await getUserById(userId);
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { returnUrl?: string };
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const returnUrl = body.returnUrl || `${base}/profile`;

  try {
    const url = await createStripePortalSession({
      customerId: user.stripeCustomerId,
      returnUrl,
    });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "portal failed" },
      { status: 400 }
    );
  }
}
