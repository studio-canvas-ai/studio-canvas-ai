/**
 * Plan-based cloud storage caps (pricing catalog scaCloud / worksGallery).
 */

import type { BillingInterval } from "@/lib/data";

const MONTHLY = {
  starter: { scaCloud: 10, worksGallery: 20 },
  standard: { scaCloud: 20, worksGallery: 40 },
  pro: { scaCloud: 40, worksGallery: 70 },
} as const;

const QUARTERLY = {
  starter: { scaCloud: 10, worksGallery: 20 },
  standard: { scaCloud: 20, worksGallery: 40 },
  pro: { scaCloud: 40, worksGallery: 70 },
} as const;

const ANNUAL = {
  starter: { scaCloud: 10, worksGallery: 20 },
  standard: { scaCloud: 20, worksGallery: 40 },
  pro: { scaCloud: 40, worksGallery: 70 },
} as const;

export type PlanStorageLimits = {
  /** 최근 파일 / 수정용 .sca 클라우드 */
  scaCloud: number;
  /** 내 갤러리(작업물) .sca 보관 */
  worksGallery: number;
};

function planKey(
  planId: string | null | undefined
): "starter" | "standard" | "pro" | null {
  const p = (planId || "").toLowerCase();
  if (p === "enterprise" || p === "pro") return "pro";
  if (p === "standard") return "standard";
  if (p === "starter") return "starter";
  return null;
}

/** Defaults when free / unknown — keep conservative starter floor. */
export const DEFAULT_STORAGE_LIMITS: PlanStorageLimits = {
  scaCloud: 10,
  worksGallery: 20,
};

export function getPlanStorageLimits(
  planId: string | null | undefined,
  interval: BillingInterval | null | undefined
): PlanStorageLimits {
  const key = planKey(planId);
  if (!key) return DEFAULT_STORAGE_LIMITS;
  if (interval === "quarterly") return { ...QUARTERLY[key] };
  if (interval === "annual") return { ...ANNUAL[key] };
  return { ...MONTHLY[key] };
}
