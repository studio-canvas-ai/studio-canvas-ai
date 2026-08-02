import type { BillingInterval } from "@/lib/data";
import { pricingPlanIds } from "@/lib/data";

const STORAGE_KEY = "sca_pending_checkout";

export type PendingCheckout = {
  planId: (typeof pricingPlanIds)[number];
  interval: BillingInterval;
};

function isPlanId(value: unknown): value is (typeof pricingPlanIds)[number] {
  return typeof value === "string" && (pricingPlanIds as readonly string[]).includes(value);
}

function isInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "quarterly" || value === "annual";
}

export function savePendingCheckout(checkout: PendingCheckout): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkout));
  } catch {
    /* private mode / SSR */
  }
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { planId?: unknown; interval?: unknown };
    if (!isPlanId(parsed.planId) || !isInterval(parsed.interval)) return null;
    return { planId: parsed.planId, interval: parsed.interval };
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
