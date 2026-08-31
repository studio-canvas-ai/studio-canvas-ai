import { NextResponse } from "next/server";
import {
  createCheckoutForOrder,
  createPaymentOrder,
  getPaymentProvider,
  isDemoCheckoutAllowed,
  requiresKcpRecurringBilling,
  shouldBypassRecurringForBcCard,
} from "@/lib/payments";
import {
  getPortoneBillingChannelKey,
  getPortoneChannelKey,
  getPortoneStoreId,
} from "@/lib/payments/portone";
import {
  type BillingInterval,
  CREDIT_PACKS,
  pricingPlanIds,
  syncPlanOfferKrw,
} from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";
import { getSiteUrl } from "@/lib/site";
import { appPathWithPaymentStatus } from "@/lib/appRoutes";
import { resolveCheckoutRegion } from "@/lib/paymentRouting";
import { ensureUsdKrwRate } from "@/lib/currency";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { isGuestCheckoutAllowed } from "@/lib/checkoutPolicy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const resolved = await resolveAppUser(req, {
    allowGuest: isGuestCheckoutAllowed(),
  });
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }
  const user = resolved.user;
  const userId = user.id;

  const body = (await req.json()) as {
    kind: "subscription" | "credit_pack";
    planId?: (typeof pricingPlanIds)[number];
    billingInterval?: BillingInterval;
    packId?: (typeof CREDIT_PACKS)[number]["id"];
    locale?: string;
    domesticCardBrand?: string;
  };

  const locale = (
    body.locale && LOCALES.includes(body.locale as Locale) ? body.locale : "en"
  ) as Locale;
  const isDomestic = resolveCheckoutRegion(locale) === "domestic";

  // Credit packs are global-only (not sold on the Korean / domestic market).
  if (body.kind === "credit_pack" && isDomestic) {
    return NextResponse.json(
      { error: "credit_packs_unavailable_in_domestic_market" },
      { status: 403 }
    );
  }

  try {
    // Refresh FX cache before KRW amounts are computed for the order.
    await ensureUsdKrwRate();
    syncPlanOfferKrw();

    const order = await createPaymentOrder({
      userId,
      kind: body.kind,
      planId: body.planId,
      billingInterval: body.billingInterval,
      packId: body.packId,
      isSubscriber: user.planId !== "free",
      locale,
    });

    const baseUrl = getSiteUrl();
    const successPath =
      body.kind === "credit_pack"
        ? appPathWithPaymentStatus("success", order.id)
        : `/pricing?payment=success&orderId=${order.id}`;
    const failPath =
      body.kind === "credit_pack"
        ? appPathWithPaymentStatus("fail", order.id)
        : `/pricing?payment=fail&orderId=${order.id}`;

    const checkout = await createCheckoutForOrder({
      order,
      user,
      successUrl: `${baseUrl}${successPath}`,
      cancelUrl: `${baseUrl}${failPath}`,
    });

    const bcMonthlyOneTime = isDomestic
      ? shouldBypassRecurringForBcCard({
          kind: body.kind,
          billingInterval: body.billingInterval,
          locale,
          domesticCardBrand: body.domesticCardBrand,
        })
      : false;
    const recurringBilling = !bcMonthlyOneTime && requiresKcpRecurringBilling({
      kind: body.kind,
      billingInterval: body.billingInterval,
      locale,
    });

    const portoneBillingChannelKey = getPortoneBillingChannelKey();
    if (recurringBilling && !portoneBillingChannelKey) {
      return NextResponse.json(
        { error: "portone_billing_channel_missing" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order,
      provider: getPaymentProvider(locale),
      checkoutMode: recurringBilling ? "recurring_billing_key" : "one_time",
      checkoutUrl: checkout.checkoutUrl ?? null,
      stripeSessionId: checkout.sessionId ?? null,
      tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null,
      portoneStoreId: getPortoneStoreId(),
      portoneChannelKey: getPortoneChannelKey(),
      portoneBillingChannelKey: portoneBillingChannelKey || null,
      bcMonthlyOneTime,
      customer: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
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
