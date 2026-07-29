import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPaymentOrder, getPaymentProvider } from "@/lib/payments";
import { CREDIT_PACKS, pricingPlanIds } from "@/lib/data";
import { getUserById } from "@/lib/db/credits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    kind: "subscription" | "credit_pack";
    planId?: (typeof pricingPlanIds)[number];
    packId?: (typeof CREDIT_PACKS)[number]["id"];
  };

  try {
    const order = await createPaymentOrder({
      userId,
      kind: body.kind,
      planId: body.planId,
      packId: body.packId,
      isSubscriber: user.planId !== "free",
    });

    return NextResponse.json({
      order,
      provider: getPaymentProvider(),
      tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null,
      successUrl: `${process.env.NEXTAUTH_URL || ""}/pricing?payment=success&orderId=${order.id}`,
      failUrl: `${process.env.NEXTAUTH_URL || ""}/pricing?payment=fail&orderId=${order.id}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "order failed" },
      { status: 400 }
    );
  }
}
