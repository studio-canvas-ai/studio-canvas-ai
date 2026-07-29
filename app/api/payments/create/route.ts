import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createCheckoutForOrder,
  createPaymentOrder,
  getPaymentProvider,
  isDemoCheckoutAllowed,
} from "@/lib/payments";
import {
  type BillingInterval,
  CREDIT_PACKS,
  pricingPlanIds,
} from "@/lib/data";
import { getUserById } from "@/lib/db/credits";
import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";

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
    billingInterval?: BillingInterval;
    packId?: (typeof CREDIT_PACKS)[number]["id"];
    locale?: string;
  };

  const locale = (
    body.locale && LOCALES.includes(body.locale as Locale) ? body.locale : "en"
  ) as Locale;

  try {
    const order = await createPaymentOrder({
      userId,
      kind: body.kind,
      planId: body.planId,
      billingInterval: body.billingInterval,
      packId: body.packId,
      isSubscriber: user.planId !== "free",
      locale,
    });

    const baseUrl = process.env.NEXTAUTH_URL || "";
    const successPath =
      body.kind === "credit_pack"
        ? `/generate?payment=success&orderId=${order.id}`
        : `/pricing?payment=success&orderId=${order.id}`;
    const failPath =
      body.kind === "credit_pack"
        ? `/generate?payment=fail&orderId=${order.id}`
        : `/pricing?payment=fail&orderId=${order.id}`;

    const checkout = await createCheckoutForOrder({
      order,
      user,
      successUrl: `${baseUrl}${successPath}`,
      cancelUrl: `${baseUrl}${failPath}`,
    });

    return NextResponse.json({
      order,
      provider: getPaymentProvider(locale),
      checkoutUrl: checkout.checkoutUrl ?? null,
      stripeSessionId: checkout.sessionId ?? null,
      tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null,
      portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID || null,
      demoAllowed: isDemoCheckoutAllowed(),
      successUrl: `${baseUrl}${successPath}`,
      failUrl: `${baseUrl}${failPath}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "order failed" },
      { status: 400 }
    );
  }
}
