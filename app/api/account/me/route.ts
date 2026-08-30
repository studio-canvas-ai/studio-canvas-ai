import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth, listSocialProviders, authConfigured } from "@/lib/auth";
import { isSupabaseConfigured, getSupabaseConfigError } from "@/lib/supabase/config";
import { findOrCreateOAuthUser, getUserById, ensureUserRecord, reconcileUserWithWalletCookie, syncTestAccountSubscription } from "@/lib/db/credits";
import type { AuthProviderId } from "@/lib/db/types";
import { FREE_CREDITS } from "@/lib/data";
import { getPaymentProvider } from "@/lib/payments";
import { getPortoneStoreId } from "@/lib/payments/portone";
import { resolveInferenceProvider } from "@/lib/ai/inference";
import { getBusinessInfo, isBusinessInfoComplete } from "@/lib/business";
import { normalizeSubscriptionLifecycle } from "@/lib/subscriptionState";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import { hasUnlimitedCredits, isUnlimitedAccountEmail } from "@/lib/unlimitedAccount";
import { isAdminEmail } from "@/lib/adminAuth";
import { remainingSubscriptionDays, formatSubscriptionEndDate } from "@/lib/subscriptionPeriod";
import { hydrateUserPlanUsage, snapshotPlanUsage } from "@/lib/db/planUsage";
import { readWalletCookie } from "@/lib/walletCookie";

export const runtime = "nodejs";

/** Current account snapshot for client CreditsProvider sync. */
export async function GET(request: NextRequest) {
  const session = await auth();
  let userId = (session?.user as { id?: string } | undefined)?.id;
  let user = userId ? await getUserById(userId) : null;
  if (user) {
    user = await reconcileUserWithWalletCookie(user);
  }

  // Vercel memory DB can be empty after a cold start even with a valid JWT.
  // Rehydrate the local user from JWT claims when possible.
  if (!user) {
    try {
      const secret = requireAuthSecret();
      const token = await getToken({
        req: request,
        secret,
        secureCookie: useSecureAuthCookies(),
        cookieName: authSessionCookieName(),
      });

      if (token?.termsAgreed === false) {
        // Provisional pre-consent session — not a registered app member yet.
        return NextResponse.json({
          authenticated: false,
          pendingTermsConsent: true,
          user: null,
          providers: listSocialProviders(),
          supabaseConfigured: isSupabaseConfigured(),
          supabaseConfigError: getSupabaseConfigError(),
          authConfigured: authConfigured(),
          paymentProvider: getPaymentProvider(),
          aiProvider: resolveInferenceProvider(),
          business: getBusinessInfo(),
          businessComplete: isBusinessInfoComplete(),
          tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null,
          portoneStoreId: getPortoneStoreId(),
          stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
        });
      }

      const provider = token?.authProvider as AuthProviderId | undefined;
      const providerAccountId =
        typeof token?.providerAccountId === "string"
          ? token.providerAccountId
          : typeof token?.supabaseUserId === "string"
            ? token.supabaseUserId
            : null;

      const provisionalId = String(
        userId || token?.uid || ""
      );
      const wallet = await readWalletCookie(provisionalId || null);
      const jwtCredits =
        typeof token?.credits === "number" ? token.credits : null;
      const creditsHint = wallet?.credits ?? jwtCredits ?? null;

      if (provider && providerAccountId && token) {
        const created = await findOrCreateOAuthUser({
          provider,
          providerAccountId,
          email: typeof token.email === "string" ? token.email : null,
          name: typeof token.name === "string" ? token.name : null,
          image: typeof token.picture === "string" ? token.picture : null,
          creditsHint,
        });
        user = created.user;
        userId = user.id;
      } else if (token?.uid || session?.user) {
        // Session exists — auto-provision wallet so generate/credits stay in sync.
        const id = String(token?.uid || userId || "");
        if (id) {
          user = await ensureUserRecord({
            userId: id,
            email:
              session?.user?.email ??
              (typeof token?.email === "string" ? token.email : null),
            name:
              session?.user?.name ??
              (typeof token?.name === "string" ? token.name : null),
            image:
              session?.user?.image ??
              (typeof token?.picture === "string" ? token.picture : null),
            provider,
            providerAccountId,
            credits: creditsHint ?? FREE_CREDITS,
          });
          userId = user.id;
        }
      }
    } catch {
      /* fall through with whatever we have */
    }
  }

  if (user) {
    let supabaseUserId: string | null = null;
    try {
      const secret = requireAuthSecret();
      const token = await getToken({
        req: request,
        secret,
        secureCookie: useSecureAuthCookies(),
        cookieName: authSessionCookieName(),
      });
      if (typeof token?.supabaseUserId === "string") {
        supabaseUserId = token.supabaseUserId;
      }
    } catch {
      /* optional JWT read for Supabase quota alias */
    }
    user = await hydrateUserPlanUsage(user, { supabaseUserId });
    user = await syncTestAccountSubscription(user);
  }

  const expiryDate = user
    ? formatSubscriptionEndDate(user.currentPeriodEnd ?? null)
    : null;
  const remainingDays =
    user && expiryDate && user.planId !== "free"
      ? Math.max(0, remainingSubscriptionDays(expiryDate))
      : null;
  const autoRenew = Boolean(
    user &&
      user.planId !== "free" &&
      !user.cancelAtPeriodEnd &&
      (user.autoRenew === true || user.billingInterval === "monthly")
  );
  const usage = user ? snapshotPlanUsage(user) : null;

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          credits: 0,
          maxCredits: 0,
          unlimitedCredits: hasUnlimitedCredits(user.email),
          isAdmin: Boolean(
            user.email &&
              (isAdminEmail(user.email) || isUnlimitedAccountEmail(user.email))
          ),
          planId: user.planId,
          billingInterval: user.billingInterval ?? null,
          currentPeriodStart: user.currentPeriodStart ?? null,
          currentPeriodEnd: user.currentPeriodEnd ?? null,
          expiryDate,
          remainingDays,
          autoRenew,
          usage,
          subscriptionLifecycle: normalizeSubscriptionLifecycle(user),
          cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
          defaultPaymentMethodLabel: user.defaultPaymentMethodLabel ?? null,
          stripeCustomerId: user.stripeCustomerId ?? null,
          provider: user.provider,
        }
      : null,
    providers: listSocialProviders(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseConfigError: getSupabaseConfigError(),
    authConfigured: authConfigured(),
    paymentProvider: getPaymentProvider(),
    aiProvider: resolveInferenceProvider(),
    business: getBusinessInfo(),
    businessComplete: isBusinessInfoComplete(),
    tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null,
    portoneStoreId: getPortoneStoreId(),
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
  });
}
