import {
  PLAN_OFFERS,
  CREDIT_PACKS,
  isPrepaidPass,
  type PlanOffer,
  type BillingInterval,
  type PricingPlanId,
} from "@/lib/data";
import { formatKrw, formatUsd } from "@/lib/currency";
import { getTranslations, type Locale, type Translations } from "@/lib/i18n";
import {
  getPlanQuotaDisplay,
  type PlanLicense,
  type QuotaCap,
} from "@/lib/planQuotas";

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

function creditNumberLocale(locale: Locale): string {
  switch (locale) {
    case "kr":
      return "ko-KR";
    case "ja":
      return "ja-JP";
    case "zh":
      return "zh-CN";
    case "es":
      return "es-ES";
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "it":
      return "it-IT";
    case "vi":
      return "vi-VN";
    case "hi":
      return "hi-IN";
    default:
      return "en-US";
  }
}

function formatCap(cap: QuotaCap, locale: Locale): string {
  return cap.n.toLocaleString(creditNumberLocale(locale));
}

function formatN(n: number, locale: Locale): string {
  return n.toLocaleString(creditNumberLocale(locale));
}

function fillCap(
  maxTpl: string,
  plusTpl: string,
  cap: QuotaCap,
  locale: Locale
): string {
  return fill(cap.mode === "plus" ? plusTpl : maxTpl, {
    n: formatCap(cap, locale),
  });
}

function licenseLine(
  license: PlanLicense,
  copy: Translations["pricing"]
): string {
  if (license === "personal") return copy.quotaLicensePersonal;
  if (license === "commercialFull") return copy.quotaLicenseCommercialFull;
  return copy.quotaLicenseCommercial;
}

/** Pricing-card display catalog (UI copy only — not enforcement limits). */
type PlanCreditDisplay = {
  credits: number;
  webShare: number;
  hiResPrint: number;
  shortsHook: number;
  autoCaption: number;
  bannerOriginal: number;
  aiImageBg: number;
  scaCloud: number;
  worksGallery: number;
  license: PlanLicense;
};

const MONTHLY_CREDIT_DISPLAY: Record<
  "starter" | "standard" | "pro",
  PlanCreditDisplay
> = {
  starter: {
    credits: 1_400,
    webShare: 1_400,
    hiResPrint: 700,
    shortsHook: 700,
    autoCaption: 466,
    bannerOriginal: 280,
    aiImageBg: 56,
    scaCloud: 10,
    worksGallery: 20,
    license: "personal",
  },
  standard: {
    credits: 3_200,
    webShare: 3_200,
    hiResPrint: 1_600,
    shortsHook: 1_600,
    autoCaption: 1_066,
    bannerOriginal: 640,
    aiImageBg: 128,
    scaCloud: 20,
    worksGallery: 40,
    license: "commercial",
  },
  pro: {
    credits: 6_750,
    webShare: 6_750,
    hiResPrint: 3_375,
    shortsHook: 3_375,
    autoCaption: 2_250,
    bannerOriginal: 1_350,
    aiImageBg: 270,
    scaCloud: 40,
    worksGallery: 70,
    license: "commercialFull",
  },
};

const QUARTERLY_CREDIT_DISPLAY: Record<
  "starter" | "standard" | "pro",
  PlanCreditDisplay
> = {
  starter: {
    credits: 4_200,
    webShare: 4_200,
    hiResPrint: 2_100,
    shortsHook: 2_100,
    autoCaption: 1_400,
    bannerOriginal: 840,
    aiImageBg: 168,
    scaCloud: 10,
    worksGallery: 20,
    license: "personal",
  },
  standard: {
    credits: 9_600,
    webShare: 9_600,
    hiResPrint: 4_800,
    shortsHook: 4_800,
    autoCaption: 3_200,
    bannerOriginal: 1_920,
    aiImageBg: 384,
    scaCloud: 20,
    worksGallery: 40,
    license: "commercial",
  },
  pro: {
    credits: 20_250,
    webShare: 20_250,
    hiResPrint: 10_125,
    shortsHook: 10_125,
    autoCaption: 6_750,
    bannerOriginal: 4_050,
    aiImageBg: 810,
    scaCloud: 40,
    worksGallery: 70,
    license: "commercialFull",
  },
};

function planKey(planId: PricingPlanId): "starter" | "standard" | "pro" {
  if (planId === "standard") return "standard";
  if (planId === "pro" || planId === "enterprise") return "pro";
  return "starter";
}

function getPlanCreditDisplay(
  planId: PricingPlanId,
  interval: BillingInterval
): PlanCreditDisplay | null {
  if (interval !== "monthly" && interval !== "quarterly") return null;
  const key = planKey(planId);
  return interval === "quarterly"
    ? QUARTERLY_CREDIT_DISPLAY[key]
    : MONTHLY_CREDIT_DISPLAY[key];
}

function creditPlanFeatureLines(
  offer: PlanOffer,
  copy: Translations["pricing"],
  locale: Locale,
  d: PlanCreditDisplay
): string[] {
  const n = (value: number) => formatN(value, locale);
  const poolTpl =
    offer.interval === "quarterly"
      ? copy.creditPoolQuarterly
      : copy.creditPoolMonthly;
  return [
    fill(poolTpl, { n: n(d.credits) }),
    fill(copy.quotaWebShare, { n: n(d.webShare) }),
    fill(copy.quotaHiResPrint, { n: n(d.hiResPrint) }),
    fill(copy.quotaShortsHook, { n: n(d.shortsHook) }),
    fill(copy.quotaAutoCaption, { n: n(d.autoCaption) }),
    fill(copy.quotaBannerOriginal, { n: n(d.bannerOriginal) }),
    fill(copy.quotaAiImageBg, { n: n(d.aiImageBg) }),
    fill(copy.quotaScaCloud, { n: n(d.scaCloud) }),
    fill(copy.quotaWorksGallery, { n: n(d.worksGallery) }),
    copy.quotaScaAutoSave,
    licenseLine(d.license, copy),
  ];
}

/** Feature lines for pricing cards (monthly/3-month = credit catalog; annual keeps legacy caps). */
export function planFeatureLines(
  offer: PlanOffer,
  copy: Translations["pricing"],
  locale: Locale = "en"
): string[] {
  const creditDisplay = getPlanCreditDisplay(offer.planId, offer.interval);
  if (creditDisplay) {
    return creditPlanFeatureLines(offer, copy, locale, creditDisplay);
  }

  const q = getPlanQuotaDisplay(offer.planId, offer.interval);
  return [
    fillCap(copy.quotaFhd, copy.quotaFhdPlus, q.fhd, locale),
    fillCap(copy.quota4k, copy.quota4kPlus, q.uhd4k, locale),
    q.trainSlots.n === 1 && q.trainSlots.mode === "max"
      ? copy.quotaTrainOne
      : fillCap(copy.quotaTrain, copy.quotaTrainPlus, q.trainSlots, locale),
    fillCap(copy.quotaGallery, copy.quotaGalleryPlus, q.gallery, locale),
    fillCap(
      copy.quotaTrainPhoto,
      copy.quotaTrainPhotoPlus,
      q.trainPhotos,
      locale
    ),
    fillCap(
      copy.quotaGeneralPhoto,
      copy.quotaGeneralPhotoPlus,
      q.generalPhotos,
      locale
    ),
    copy.quotaSca,
    licenseLine(q.license, copy),
  ];
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
  quota: ReturnType<typeof getPlanQuotaDisplay>;
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
      quota: getPlanQuotaDisplay(offer.planId, offer.interval),
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
