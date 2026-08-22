import {
  PLAN_OFFERS,
  CREDIT_PACKS,
  isPrepaidPass,
  type PlanOffer,
  type BillingInterval,
} from "@/lib/data";
import { formatKrw, formatUsd } from "@/lib/currency";
import { getTranslations, type Locale, type Translations } from "@/lib/i18n";

export function planDisplayName(offer: PlanOffer): string {
  if (offer.planId === "enterprise") return "Enterprise";
  if (offer.planId === "standard") return "Standard";
  if (offer.planId === "pro") return "Pro";
  return "Starter";
}

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function periodWord(interval: BillingInterval, locale: Locale): string {
  if (locale === "kr") {
    if (interval === "annual") return "연";
    if (interval === "quarterly") return "3개월";
    return "월";
  }
  if (interval === "annual") return "Annual";
  if (interval === "quarterly") return "3-month";
  return "Monthly";
}

function creditNumberLocale(locale: Locale): string {
  return locale === "kr" ? "ko-KR" : "en-US";
}

/** Feature lines follow the active UI locale (not hard-coded Korean). */
export function planFeatureLines(
  offer: PlanOffer,
  copy: Translations["pricing"],
  locale: Locale = "en"
): string[] {
  const list = [
    fill(copy.generationBenefit, {
      period: periodWord(offer.interval, locale),
      credits: offer.credits.toLocaleString(creditNumberLocale(locale)),
    }),
    fill(copy.photoBenefit, { count: offer.profileSlots }),
    offer.resolution === "4K" ? copy.fourKBenefit : copy.fhdBenefit,
  ];
  if (offer.fastGeneration) list.push(copy.fastBenefit);
  if (offer.commercialUse) list.push(copy.commercialBenefit);
  if (offer.permanentStorage) list.push(copy.permanentBenefit);
  list.push(copy.watermarkBenefit);
  return list;
}

export type StaticPlanProduct = {
  id: string;
  planId: PlanOffer["planId"];
  interval: BillingInterval;
  name: string;
  billingLabel: string;
  /** USD display for global markets / overseas catalog. */
  priceUsd: string;
  totalUsd: string;
  /** Absolute KRW amount (monthly = fixed domestic list price). */
  totalKrw: number;
  /** Preformatted KRW for domestic UI / scanners. */
  priceKrw: string;
  perMonthLabel: string;
  annualPrepaid: string | null;
  vatNotice: string;
  features: string[];
  highlighted: boolean;
  ctaLabel: string;
};

export type StaticCreditPack = {
  id: string;
  name: string;
  priceUsd: string;
  freeCredits: number;
  subscriberCredits: number;
};

function billingLabelFor(offer: PlanOffer, copy: Translations["pricing"]): string {
  if (offer.interval === "quarterly") return copy.quarterlySubscription;
  if (offer.interval === "annual") return copy.annualSubscription;
  return copy.monthlySubscription;
}

function prepaidNoticeFor(offer: PlanOffer, copy: Translations["pricing"]): string | null {
  if (offer.interval === "quarterly") {
    // No USD/KRW amount in the subtitle — price is shown in the hero figure.
    return copy.quarterlyPrepaid;
  }
  if (offer.interval === "annual") {
    return fill(copy.annualPrepaid, { total: formatUsd(offer.totalUsd).replace("$", "") });
  }
  return null;
}

function packDisplayName(packId: string, locale: Locale): string {
  const size = packId.replace("pack-", "").toUpperCase();
  return locale === "kr" ? `크레딧 단품 ${size}` : `Credit pack ${size}`;
}

/**
 * Build plan/pack cards for a locale.
 * - `kr` → fixed KRW copy + quarterly/monthly domestic SKUs in UI
 * - other locales → USD copy + annual/monthly + credit packs
 * SSR scanners may still call with `"kr"` for the hidden domestic catalog.
 */
export function buildStaticPlanProducts(locale: Locale = "kr"): {
  annual: StaticPlanProduct[];
  quarterly: StaticPlanProduct[];
  monthly: StaticPlanProduct[];
  packs: StaticCreditPack[];
  copy: Translations["pricing"];
} {
  const t = getTranslations(locale);
  const copy = t.pricing;

  const toProduct = (offer: PlanOffer): StaticPlanProduct => {
    const isPrepaidTotal =
      offer.interval === "quarterly" || offer.interval === "annual";
    return {
      id: `${offer.interval}-${offer.planId}`,
      planId: offer.planId,
      interval: offer.interval,
      name: planDisplayName(offer),
      billingLabel: billingLabelFor(offer, copy),
      // Prepaid passes: hero shows the full upfront total (USD for global annual).
      priceUsd: formatUsd(isPrepaidTotal ? offer.totalUsd : offer.monthlyUsd),
      totalUsd: formatUsd(offer.totalUsd),
      totalKrw: offer.totalKrw,
      priceKrw: formatKrw(offer.totalKrw),
      perMonthLabel:
        offer.interval === "quarterly"
          ? copy.perQuarter
          : offer.interval === "annual"
            ? copy.perYear
            : copy.perMonth,
      annualPrepaid: prepaidNoticeFor(offer, copy),
      vatNotice: copy.vatNotice,
      features: planFeatureLines(offer, copy, locale),
      highlighted: offer.highlighted,
      ctaLabel: offer.highlighted ? copy.getStarted : copy.selectPlan,
    };
  };

  return {
    annual: PLAN_OFFERS.annual.map(toProduct),
    quarterly: PLAN_OFFERS.quarterly.map(toProduct),
    monthly: PLAN_OFFERS.monthly.map(toProduct),
    packs: CREDIT_PACKS.map((pack) => ({
      id: pack.id,
      name: packDisplayName(pack.id, locale),
      priceUsd: formatUsd(pack.price),
      freeCredits: pack.freeCredits,
      subscriberCredits: pack.subscriberCredits,
    })),
    copy,
  };
}

export { isPrepaidPass };
