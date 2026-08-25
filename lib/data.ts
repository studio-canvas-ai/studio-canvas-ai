import { usdToKrw } from "@/lib/currency";

/** #129 wizard STEP 1 concept gallery groups */
export const CONCEPT_GROUP_IDS = [
  "professional",
  "lifestyle",
  "editorial",
  "traditional",
  "vintage",
] as const;
export type ConceptGroupId = (typeof CONCEPT_GROUP_IDS)[number];

export const CONCEPT_GROUP_EMOJI: Record<ConceptGroupId, string> = {
  professional: "💼",
  lifestyle: "☕",
  editorial: "✨",
  traditional: "👘",
  vintage: "📸",
};

/** Framing tags shown on each concept card */
export const COMPOSITION_TAG_IDS = ["headshot", "upperBody", "fullBody"] as const;
export type CompositionTagId = (typeof COMPOSITION_TAG_IDS)[number];

export interface StylePackMeta {
  id: string;
  category: string;
  categoryKey:
    | "lifestyle"
    | "cinematic"
    | "business"
    | "cultureEast"
    | "cultureWest"
    | "urban"
    | "studio";
  conceptGroup: ConceptGroupId;
  composition: CompositionTagId;
  gradient: string;
  imageUrl: string;
}

export interface GalleryItemMeta {
  id: string;
  imageUrl: string;
  aspectRatio: "portrait" | "square" | "landscape";
}

export const stylePacksMeta: StylePackMeta[] = [
  {
    id: "luxury-lifestyle",
    category: "Lifestyle",
    categoryKey: "lifestyle",
    conceptGroup: "lifestyle",
    composition: "fullBody",
    gradient: "from-amber-500/30 via-orange-400/20 to-rose-500/30",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "cinematic-poster",
    category: "Cinematic",
    categoryKey: "cinematic",
    conceptGroup: "editorial",
    composition: "upperBody",
    gradient: "from-red-600/30 via-purple-600/25 to-indigo-800/30",
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "business-executive",
    category: "Business",
    categoryKey: "business",
    conceptGroup: "professional",
    composition: "headshot",
    gradient: "from-slate-400/25 via-blue-500/20 to-cyan-400/25",
    imageUrl:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "cultural-elegance-east",
    category: "Culture East",
    categoryKey: "cultureEast",
    conceptGroup: "traditional",
    composition: "fullBody",
    gradient: "from-emerald-600/30 via-teal-500/20 to-amber-600/25",
    imageUrl:
      "https://images.unsplash.com/photo-1506480932912-dbbe35e3e516?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "cultural-elegance-west",
    category: "Culture West",
    categoryKey: "cultureWest",
    conceptGroup: "traditional",
    composition: "fullBody",
    gradient: "from-amber-700/30 via-rose-900/20 to-stone-500/25",
    imageUrl: "/styles/traditional-west.png",
  },
  {
    id: "classic-western",
    category: "Culture West",
    categoryKey: "cultureWest",
    conceptGroup: "vintage",
    composition: "upperBody",
    gradient: "from-stone-400/25 via-amber-700/20 to-rose-900/25",
    imageUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "neon-urban",
    category: "Urban",
    categoryKey: "urban",
    conceptGroup: "editorial",
    composition: "fullBody",
    gradient: "from-fuchsia-500/30 via-violet-600/25 to-cyan-400/30",
    imageUrl:
      "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "soft-studio",
    category: "Studio",
    categoryKey: "studio",
    conceptGroup: "professional",
    composition: "headshot",
    gradient: "from-rose-300/25 via-pink-200/20 to-violet-300/25",
    imageUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=800&fit=crop&q=80",
  },
];

export const wizardStylePackIds = [
  { id: "editorial", emoji: "📸" },
  { id: "cinematic", emoji: "🎬" },
  { id: "corporate", emoji: "💼" },
  { id: "artistic", emoji: "🎨" },
  { id: "vintage", emoji: "📷" },
  { id: "fantasy", emoji: "✨" },
] as const;

export const subjectTypeOptions = [
  { id: "male", icon: "♂" },
  { id: "female", icon: "♀" },
  { id: "object", icon: "📦" },
] as const;

export const ageOptions = [
  { id: "10s", icon: "①" },
  { id: "20s", icon: "✦" },
  { id: "30s", icon: "✧" },
  { id: "40s", icon: "✪" },
  { id: "50s", icon: "⑤" },
  { id: "60s", icon: "⑥" },
  { id: "70s", icon: "⑦" },
  { id: "80s", icon: "⑧" },
] as const;

/** @deprecated use subjectTypeOptions + ageOptions */
export const personaSpecIds = {
  gender: [
    { id: "male", icon: "♂" },
    { id: "female", icon: "♀" },
  ],
  age: [...ageOptions],
  vibe: [
    { id: "elegant", icon: "◇" },
    { id: "bold", icon: "◆" },
    { id: "natural", icon: "○" },
    { id: "mysterious", icon: "◐" },
  ],
};

export const pricingPlanIds = ["starter", "standard", "pro", "enterprise"] as const;
export type PricingPlanId = (typeof pricingPlanIds)[number];
/** monthly = subscription; annual/quarterly = prepaid one-time passes (no auto-renew). */
export type BillingInterval = "monthly" | "annual" | "quarterly";

export type PlanOffer = {
  planId: PricingPlanId;
  interval: BillingInterval;
  monthlyUsd: number;
  totalUsd: number;
  totalKrw: number;
  credits: number;
  profileSlots: number;
  resolution: "FHD" | "4K";
  fastGeneration: boolean;
  commercialUse: boolean;
  permanentStorage: boolean;
  dedicatedLane: boolean;
  highlighted: boolean;
};

export function isPrepaidPass(interval: BillingInterval): boolean {
  return interval === "annual" || interval === "quarterly";
}

export function billingPeriodDays(interval: BillingInterval): number {
  if (interval === "annual") return 365;
  if (interval === "quarterly") return 90;
  return 30;
}

/** #108 final plan catalog. Annual is the default presentation for global; KR uses quarterly. */
export const PLAN_OFFERS: Record<BillingInterval, readonly PlanOffer[]> = {
  annual: [
    {
      planId: "starter",
      interval: "annual",
      monthlyUsd: 4.17,
      totalUsd: 49.99,
      totalKrw: 67_486,
      credits: 900,
      profileSlots: 3,
      resolution: "4K",
      fastGeneration: false,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: false,
    },
    {
      planId: "standard",
      interval: "annual",
      monthlyUsd: 8.33,
      totalUsd: 99.99,
      totalKrw: 134_986,
      credits: 2_400,
      profileSlots: 5,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: true,
    },
    {
      planId: "pro",
      interval: "annual",
      monthlyUsd: 16.67,
      totalUsd: 199.99,
      totalKrw: 269_986,
      credits: 7_000,
      profileSlots: 10,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: true,
      permanentStorage: true,
      dedicatedLane: true,
      highlighted: false,
    },
  ],
  /** Korea domestic PG (KCP) — 3-month prepaid one-time passes */
  quarterly: [
    {
      planId: "starter",
      interval: "quarterly",
      monthlyUsd: 4.33,
      totalUsd: 12.99,
      totalKrw: 19_900,
      credits: 90,
      profileSlots: 2,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: false,
    },
    {
      planId: "standard",
      interval: "quarterly",
      monthlyUsd: 9.0,
      totalUsd: 26.99,
      totalKrw: 39_900,
      credits: 240,
      profileSlots: 7,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: true,
    },
    {
      planId: "pro",
      interval: "quarterly",
      monthlyUsd: 18.66,
      totalUsd: 55.99,
      totalKrw: 79_900,
      credits: 700,
      profileSlots: 15,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: true,
      permanentStorage: true,
      dedicatedLane: false,
      highlighted: false,
    },
  ],
  monthly: [
    {
      planId: "starter",
      interval: "monthly",
      monthlyUsd: 7.99,
      totalUsd: 7.99,
      totalKrw: 7_900,
      credits: 30,
      profileSlots: 1,
      resolution: "FHD",
      fastGeneration: false,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: false,
    },
    {
      planId: "standard",
      interval: "monthly",
      monthlyUsd: 15.99,
      totalUsd: 15.99,
      totalKrw: 15_900,
      credits: 80,
      profileSlots: 5,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: true,
    },
    {
      planId: "pro",
      interval: "monthly",
      monthlyUsd: 29.99,
      totalUsd: 29.99,
      totalKrw: 29_900,
      credits: 230,
      profileSlots: 10,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: true,
      permanentStorage: true,
      dedicatedLane: false,
      highlighted: false,
    },
  ],
};

export function getPlanOffer(planId: PricingPlanId, interval: BillingInterval): PlanOffer {
  const offers = PLAN_OFFERS[interval];
  const direct = offers.find((item) => item.planId === planId);
  if (direct) return direct;

  // Legacy annual "enterprise" ↔ domestic/global "pro" top tier.
  if (planId === "enterprise") {
    const pro = offers.find((item) => item.planId === "pro");
    if (pro) return pro;
  }
  if (planId === "pro" && interval === "annual") {
    const legacy = offers.find((item) => item.planId === "enterprise");
    if (legacy) return legacy;
  }

  throw new Error(`Plan ${planId} is not available for ${interval} billing`);
}

/** Fixed VAT-inclusive KRW for domestic monthly subscriptions (Toss / PortOne). */
export const DOMESTIC_MONTHLY_PRICES_KRW = {
  starter: 7_900,
  standard: 15_900,
  pro: 29_900,
} as const;

/** Fixed VAT-inclusive KRW for domestic 3-month prepaid passes (Toss / PortOne). */
export const DOMESTIC_QUARTERLY_PRICES_KRW = {
  starter: 19_900,
  standard: 39_900,
  pro: 79_900,
} as const;

export type DomesticMonthlyPlanId = keyof typeof DOMESTIC_MONTHLY_PRICES_KRW;
export type DomesticQuarterlyPlanId = keyof typeof DOMESTIC_QUARTERLY_PRICES_KRW;

export function getDomesticMonthlyPriceKrw(
  planId: PricingPlanId
): number | null {
  if (planId === "starter" || planId === "standard" || planId === "pro") {
    return DOMESTIC_MONTHLY_PRICES_KRW[planId];
  }
  return null;
}

export function getDomesticQuarterlyPriceKrw(
  planId: PricingPlanId
): number | null {
  if (planId === "starter" || planId === "standard" || planId === "pro") {
    return DOMESTIC_QUARTERLY_PRICES_KRW[planId];
  }
  return null;
}

/** Legacy monthly maps retained for existing consumers. */
export const pricingPrices: Record<PricingPlanId, number> = {
  starter: 7.99,
  standard: 15.99,
  pro: 29.99,
  enterprise: 199.99,
};

/** Legacy credit wallet is retired (gift-card credits ship later). */
export const FREE_CREDITS = 0;

/** Monthly plan credit allotment (server + client) */
export const PLAN_CREDITS: Record<PricingPlanId, number> = {
  starter: 30,
  standard: 80,
  pro: 230,
  enterprise: 1_500,
};

/** KRW amounts for Toss / PortOne — monthly uses fixed domestic list prices. */
export const pricingPricesKrw: Record<PricingPlanId, number> = {
  starter: DOMESTIC_MONTHLY_PRICES_KRW.starter,
  standard: DOMESTIC_MONTHLY_PRICES_KRW.standard,
  pro: DOMESTIC_MONTHLY_PRICES_KRW.pro,
  enterprise: usdToKrw(pricingPrices.enterprise),
};
export const PROMPT_MAX_LENGTH = 100;
export const MIN_SELFIE_UPLOADS = 1;
export const MAX_SELFIE_UPLOADS = 10;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_IMAGE_EXT = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "avif",
  "svg",
] as const;
export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/svg+xml",
] as const;

/** Portrait generate / train / regenerate / download — no credit wallet debit. */
export const RETOUCH_FREE_PER_CYCLE = 0;
export const RETOUCH_EXTRA_COST = 0;
export const REGENERATE_CREDIT_COST = 0;
export const RETOUCH_NEXT_DAY_ENTRY_COST = 0;
export const RETOUCH_DAILY_MAX = 50;
export const GENERATE_DRAFT_COUNT = 2;

/** Baseline cost of one initial generation (wallet disabled). */
export const GENERATE_CREDIT_COST = 0;

/** Cost to export / download a finished portrait (HD, print, etc.). */
export const DOWNLOAD_CREDIT_COST = 0;

/** Face/object model training → A/B draft generation cost. */
export const TRAIN_CREDIT_COST = 0;

/**
 * Server-side price list per style pack. The client never decides what it pays —
 * `resolveGenerationCost` is the single source of truth for billing.
 * All portrait generate modes are currently free (plan quotas govern downloads).
 */
export const STYLE_CREDIT_COST: Record<string, number> = {
  "luxury-lifestyle": 0,
  "cinematic-poster": 0,
  "business-executive": 0,
  "cultural-elegance-east": 0,
  "cultural-elegance-west": 0,
  "classic-western": 0,
  "neon-urban": 0,
  "soft-studio": 0,
};

export function resolveGenerationCost(
  _mode: "initial" | "regenerate" | "train",
  _styleIds: string[] = []
): number {
  return 0;
}

/** #54 face profile slots by plan */
export const PLAN_PROFILE_SLOTS: Record<PricingPlanId, number> = {
  starter: 1,
  standard: 5,
  pro: 10,
  enterprise: 30,
};

/** #79–#80 credit add-on packs (price shared; credits branch by subscription) */
export const CREDIT_PACKS = [
  { id: "pack-s", price: 4.99, freeCredits: 15, subscriberCredits: 20 },
  { id: "pack-m", price: 9.99, freeCredits: 35, subscriberCredits: 50 },
  { id: "pack-l", price: 19.99, freeCredits: 80, subscriberCredits: 120 },
] as const;

export function planTotalKrw(totalUsd: number) {
  return usdToKrw(totalUsd);
}

/**
 * Refresh FX-derived KRW on annual offers.
 * Domestic monthly + quarterly Starter/Standard/Pro keep fixed list prices (VAT included).
 */
export function syncPlanOfferKrw() {
  for (const interval of Object.keys(PLAN_OFFERS) as BillingInterval[]) {
    for (const offer of PLAN_OFFERS[interval]) {
      if (interval === "monthly") {
        const fixed = getDomesticMonthlyPriceKrw(offer.planId);
        if (fixed != null) {
          (offer as { totalKrw: number }).totalKrw = fixed;
          continue;
        }
      }
      if (interval === "quarterly") {
        const fixed = getDomesticQuarterlyPriceKrw(offer.planId);
        if (fixed != null) {
          (offer as { totalKrw: number }).totalKrw = fixed;
          continue;
        }
      }
      (offer as { totalKrw: number }).totalKrw = planTotalKrw(offer.totalUsd);
    }
  }
}
syncPlanOfferKrw();

export const creditPackPricesKrw: Record<(typeof CREDIT_PACKS)[number]["id"], number> = {
  "pack-s": planTotalKrw(4.99),
  "pack-m": planTotalKrw(9.99),
  "pack-l": planTotalKrw(19.99),
};

export function creditPackAmount(
  pack: (typeof CREDIT_PACKS)[number],
  isSubscriber: boolean
) {
  return isSubscriber ? pack.subscriberCredits : pack.freeCredits;
}

export const BACKGROUND_MODE_IDS = ["auto", "tags", "custom"] as const;
export type BackgroundModeId = (typeof BACKGROUND_MODE_IDS)[number];

export const BACKGROUND_TAG_IDS = [
  "studio",
  "city",
  "nature",
  "luxury",
  "neon",
  "hanok",
] as const;

export const CONCEPT_POSE_HINTS: Record<string, string> = {
  editorial: "editorial three-quarter pose, soft smile, Rembrandt key light",
  cinematic: "dramatic film still pose, intense gaze, hard rim light",
  corporate: "confident standing pose, calm expression, soft office key light",
  artistic: "artistic gesture, thoughtful expression, painterly side light",
  vintage: "classic portrait pose, gentle smile, warm tungsten light",
  fantasy: "heroic open-arm pose, wonder expression, magical volumetric light",
  "luxury-lifestyle": "relaxed lifestyle pose, natural smile, golden-hour light",
  "cinematic-poster": "poster hero stance, determined look, high-contrast lighting",
  "business-executive": "executive seated pose, composed face, clean softbox light",
  "cultural-elegance-east": "graceful traditional stance, serene expression, soft daylight",
  "cultural-elegance-west":
    "poised period-costume stance, dignified expression, warm cathedral daylight",
  "classic-western": "classic western portrait pose, soft smile, Rembrandt key light",
  "neon-urban": "street fashion lean, cool expression, neon rim lights",
  "soft-studio": "minimal studio pose, soft smile, diffused beauty light",
};

export const galleryItemsMeta: GalleryItemMeta[] = [
  {
    id: "g1",
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop&q=80",
    aspectRatio: "portrait",
  },
  {
    id: "g2",
    imageUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=400&fit=crop&q=80",
    aspectRatio: "landscape",
  },
  {
    id: "g3",
    imageUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=80",
    aspectRatio: "square",
  },
  {
    id: "g4",
    imageUrl:
      "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=400&h=600&fit=crop&q=80",
    aspectRatio: "portrait",
  },
  {
    id: "g5",
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&q=80",
    aspectRatio: "portrait",
  },
  {
    id: "g6",
    imageUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=400&fit=crop&q=80",
    aspectRatio: "landscape",
  },
];

/** Matched pair — same model, single unified photographs (no compositing) */
export const HERO_BEFORE_IMAGE = "/hero/before.png";
export const HERO_AFTER_IMAGE = "/hero/after.png";
export const CANVAS_RESULT_IMAGE =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop&q=80";
