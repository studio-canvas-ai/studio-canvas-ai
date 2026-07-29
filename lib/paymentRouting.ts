import type { Locale } from "@/lib/i18n/types";

export type CheckoutRegion = "domestic" | "global";

/** Korean locale → domestic PG; all others → Stripe/global USD. */
export function resolveCheckoutRegion(locale: Locale): CheckoutRegion {
  return locale === "kr" ? "domestic" : "global";
}

export function shouldShowKrw(locale: Locale): boolean {
  return locale === "kr";
}
