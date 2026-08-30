/**
 * Plan credit-pool costs (pricing catalog). Enforced via fhdRemaining as the
 * durable pool (cookie + R2 + Supabase user_download_quota).
 */

export const FEATURE_CREDIT_COST = {
  /** Web / SNS / standard print download */
  webDownload: 1,
  /** High-res poster / print download */
  hdDownload: 2,
  /** Ultra-HD / vector download */
  ultraDownload: 5,
  /** AI promo image / background generation */
  aiBackground: 25,
  /** Shorts hook auto-extract */
  shortsHook: 2,
  /** AI auto captions */
  shortsCaption: 3,
  /** Shorts final render & download */
  shortsRender: 20,
} as const;

export type FeatureCreditAction = keyof typeof FEATURE_CREDIT_COST;

/** Period credit pools aligned with pricing display (monthly / 3-month). */
export const PLAN_CREDIT_POOL = {
  monthly: {
    starter: 1_400,
    standard: 3_200,
    pro: 6_750,
  },
  quarterly: {
    starter: 4_200,
    standard: 9_600,
    pro: 20_250,
  },
} as const;

export function creditPoolForPlan(
  planId: string | null | undefined,
  interval: string | null | undefined
): number | null {
  const plan = (planId || "").toLowerCase();
  const key =
    plan === "enterprise" || plan === "pro"
      ? "pro"
      : plan === "standard"
        ? "standard"
        : plan === "starter"
          ? "starter"
          : null;
  if (!key) return null;
  if (interval === "quarterly") return PLAN_CREDIT_POOL.quarterly[key];
  if (interval === "monthly") return PLAN_CREDIT_POOL.monthly[key];
  return null;
}

export function featureCreditAmount(
  action: string | null | undefined
): number | null {
  if (!action) return null;
  if (action in FEATURE_CREDIT_COST) {
    return FEATURE_CREDIT_COST[action as FeatureCreditAction];
  }
  return null;
}
