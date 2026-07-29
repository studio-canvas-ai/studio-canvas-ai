import { NextResponse } from "next/server";
import { auth, listSocialProviders, authConfigured } from "@/lib/auth";
import { getUserById } from "@/lib/db/credits";
import { getPaymentProvider } from "@/lib/payments";
import { resolveInferenceProvider } from "@/lib/ai/inference";
import { getBusinessInfo, isBusinessInfoComplete } from "@/lib/business";

export const runtime = "nodejs";

/** Current account snapshot for client CreditsProvider sync. */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const user = userId ? await getUserById(userId) : null;

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          credits: user.credits,
          maxCredits: user.maxCredits,
          planId: user.planId,
          billingInterval: user.billingInterval ?? null,
          currentPeriodStart: user.currentPeriodStart ?? null,
          currentPeriodEnd: user.currentPeriodEnd ?? null,
          provider: user.provider,
        }
      : null,
    providers: listSocialProviders(),
    authConfigured: authConfigured(),
    paymentProvider: getPaymentProvider(),
    aiProvider: resolveInferenceProvider(),
    business: getBusinessInfo(),
    businessComplete: isBusinessInfoComplete(),
    tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null,
    portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID || null,
  });
}
