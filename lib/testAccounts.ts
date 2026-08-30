import type { BillingInterval } from "@/lib/data";
import type { PlanId, UserRecord } from "@/lib/db/types";
import { subscriptionPeriodEndMs } from "@/lib/subscriptionPeriod";
import { billingPeriodExpired } from "@/lib/quotaPeriod";

export type TestAccountSetup = {
  email: string;
  planId: Extract<PlanId, "starter" | "standard" | "pro">;
  interval: BillingInterval;
  autoRenew: true;
};

/** QA accounts: forced plan + auto-renew + admin (see PRIVILEGED_ADMIN_EMAILS). */
export const TEST_ACCOUNT_SETUPS: readonly TestAccountSetup[] = [
  {
    email: "studiocanvas.cs@gmail.com",
    planId: "pro",
    interval: "quarterly",
    autoRenew: true,
  },
  {
    email: "agapet1004@gmail.com",
    planId: "starter",
    interval: "monthly",
    autoRenew: true,
  },
  {
    email: "scd77777@naver.com",
    planId: "standard",
    interval: "monthly",
    autoRenew: true,
  },
  {
    email: "hercd@hanmail.net",
    planId: "pro",
    interval: "monthly",
    autoRenew: true,
  },
] as const;

const SETUP_BY_EMAIL = new Map(
  TEST_ACCOUNT_SETUPS.map((row) => [row.email.toLowerCase(), row] as const)
);

export function getTestAccountSetup(
  email: string | null | undefined
): TestAccountSetup | null {
  if (!email) return null;
  return SETUP_BY_EMAIL.get(email.trim().toLowerCase()) ?? null;
}

export function isTestAccountEmail(email: string | null | undefined): boolean {
  return getTestAccountSetup(email) != null;
}

function periodMatchesSetup(
  user: UserRecord,
  setup: TestAccountSetup,
  now: number
): boolean {
  return (
    user.planId === setup.planId &&
    user.billingInterval === setup.interval &&
    (user.subscriptionLifecycle ?? "ACTIVE") === "ACTIVE" &&
    user.cancelAtPeriodEnd !== true &&
    user.autoRenew === true &&
    typeof user.currentPeriodEnd === "number" &&
    user.currentPeriodEnd > now
  );
}

/**
 * Force the designated QA plan on every provision/login (Vercel memory DB is ephemeral).
 * Active in-window periods are kept; expired windows roll from `now`.
 */
export function applyTestAccountSubscription(
  user: UserRecord,
  now = Date.now()
): boolean {
  const setup = getTestAccountSetup(user.email);
  if (!setup) return false;

  user.credits = 0;
  user.maxCredits = 0;
  user.legacyCreditsWiped = true;

  if (!periodMatchesSetup(user, setup, now)) {
    const periodExpired = billingPeriodExpired(user, now);
    const planChanged =
      user.planId !== setup.planId || user.billingInterval !== setup.interval;

    user.planId = setup.planId;
    user.billingInterval = setup.interval;
    user.autoRenew = true;
    user.subscriptionLifecycle = "ACTIVE";
    user.subscriptionStatus = "active";
    user.cancelAtPeriodEnd = false;
    delete user.cancelReason;
    delete user.scheduledCancelAt;
    delete user.cancelledAt;

    if (periodExpired || planChanged) {
      // New plan or expired window — seed full credit pool via ensurePlanUsage.
      user.currentPeriodStart = now;
      user.currentPeriodEnd = subscriptionPeriodEndMs(now, setup.interval);
      user.quotaPeriodStart = undefined;
      user.fhdRemaining = undefined;
      user.uhd4kRemaining = undefined;
    } else if (typeof user.currentPeriodEnd !== "number") {
      // Cold start reprovision — set subscription window; quota restored via cookie/R2/Supabase.
      user.currentPeriodStart = user.currentPeriodStart ?? now;
      user.currentPeriodEnd = subscriptionPeriodEndMs(
        user.currentPeriodStart,
        setup.interval
      );
    }
  }

  user.updatedAt = now;
  return true;
}
