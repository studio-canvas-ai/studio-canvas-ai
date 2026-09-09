/**
 * Shared export / share / project-load access control.
 * Free tier is blocked; paid plans + privileged admins are allowed.
 */

import type { PlanId } from "@/lib/faceProfiles";

export type SubscriptionAccessInput = {
  planId: PlanId | string | null | undefined;
  isAdmin?: boolean;
  unlimitedCredits?: boolean;
};

/** True when the account may download / share / load proprietary projects. */
export function resolveIsSubscribed(input: SubscriptionAccessInput): boolean {
  if (input.isAdmin || input.unlimitedCredits) return true;
  const plan = (input.planId || "free").toString().toLowerCase();
  return plan !== "free" && plan.length > 0;
}

export const PREMIUM_FEATURE_MESSAGE =
  "프리미엄 구독 회원 전용 기능입니다";
