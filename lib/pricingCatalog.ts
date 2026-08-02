import {
  PLAN_OFFERS,
  CREDIT_PACKS,
  isPrepaidPass,
  type PlanOffer,
  type BillingInterval,
} from "@/lib/data";
import { formatUsd } from "@/lib/currency";
import { getTranslations, type Translations } from "@/lib/i18n";

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

/** Korean feature lines — PortOne / KCP product scanners expect KR copy in HTML. */
export function planFeatureLines(offer: PlanOffer, copy: Translations["pricing"]): string[] {
  const period =
    offer.interval === "annual" ? "연" : offer.interval === "quarterly" ? "3개월" : "월";
  const list = [
    fill(copy.generationBenefit, {
      period,
      credits: offer.credits.toLocaleString("ko-KR"),
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
  priceUsd: string;
  totalUsd: string;
  perMonthLabel: string;
  annualPrepaid: string | null;
  vatNotice: string;
  features: string[];
  highlighted: boolean;
  ctaLabel: string;
};

function billingLabelFor(offer: PlanOffer, copy: Translations["pricing"]): string {
  if (offer.interval === "quarterly") return copy.quarterlySubscription;
  if (offer.interval === "annual") return copy.annualSubscription;
  return copy.monthlySubscription;
}

function prepaidNoticeFor(offer: PlanOffer, copy: Translations["pricing"]): string | null {
  if (offer.interval === "quarterly") {
    return fill(copy.quarterlyPrepaid, { total: offer.totalUsd });
  }
  if (offer.interval === "annual") {
    return fill(copy.annualPrepaid, { total: offer.totalUsd });
  }
  return null;
}

export function buildStaticPlanProducts(): {
  annual: StaticPlanProduct[];
  quarterly: StaticPlanProduct[];
  monthly: StaticPlanProduct[];
  packs: {
    id: string;
    name: string;
    priceUsd: string;
    freeCredits: number;
    subscriberCredits: number;
  }[];
  copy: Translations["pricing"];
} {
  const t = getTranslations("kr");
  const copy = t.pricing;

  const toProduct = (offer: PlanOffer): StaticPlanProduct => ({
    id: `${offer.interval}-${offer.planId}`,
    planId: offer.planId,
    interval: offer.interval,
    name: planDisplayName(offer),
    billingLabel: billingLabelFor(offer, copy),
    // Quarterly: show the full 3-month prepaid total as the hero price.
    priceUsd: formatUsd(offer.interval === "quarterly" ? offer.totalUsd : offer.monthlyUsd),
    totalUsd: formatUsd(offer.totalUsd),
    perMonthLabel: offer.interval === "quarterly" ? copy.perQuarter : copy.perMonth,
    annualPrepaid: prepaidNoticeFor(offer, copy),
    vatNotice: copy.vatNotice,
    features: planFeatureLines(offer, copy),
    highlighted: offer.highlighted,
    ctaLabel: offer.highlighted ? copy.getStarted : copy.selectPlan,
  });

  return {
    annual: PLAN_OFFERS.annual.map(toProduct),
    quarterly: PLAN_OFFERS.quarterly.map(toProduct),
    monthly: PLAN_OFFERS.monthly.map(toProduct),
    packs: CREDIT_PACKS.map((pack) => ({
      id: pack.id,
      name: `크레딧 단품 ${pack.id.replace("pack-", "").toUpperCase()}`,
      priceUsd: formatUsd(pack.price),
      freeCredits: pack.freeCredits,
      subscriberCredits: pack.subscriberCredits,
    })),
    copy,
  };
}

export { isPrepaidPass };
