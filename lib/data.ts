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
    gradient: "from-amber-500/30 via-orange-400/20 to-rose-500/30",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "cinematic-poster",
    category: "Cinematic",
    categoryKey: "cinematic",
    gradient: "from-red-600/30 via-purple-600/25 to-indigo-800/30",
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "business-executive",
    category: "Business",
    categoryKey: "business",
    gradient: "from-slate-400/25 via-blue-500/20 to-cyan-400/25",
    imageUrl:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "cultural-elegance",
    category: "Culture East",
    categoryKey: "cultureEast",
    gradient: "from-emerald-600/30 via-teal-500/20 to-amber-600/25",
    imageUrl:
      "https://images.unsplash.com/photo-1506480932912-dbbe35e3e516?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "classic-western",
    category: "Culture West",
    categoryKey: "cultureWest",
    gradient: "from-stone-400/25 via-amber-700/20 to-rose-900/25",
    imageUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "neon-urban",
    category: "Urban",
    categoryKey: "urban",
    gradient: "from-fuchsia-500/30 via-violet-600/25 to-cyan-400/30",
    imageUrl:
      "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "soft-studio",
    category: "Studio",
    categoryKey: "studio",
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
export type BillingInterval = "monthly" | "annual";

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

/** #108 final plan catalog. Annual is the default presentation. */
export const PLAN_OFFERS: Record<BillingInterval, readonly PlanOffer[]> = {
  annual: [
    {
      planId: "starter",
      interval: "annual",
      monthlyUsd: 4.08,
      totalUsd: 49,
      totalKrw: 49_000,
      credits: 200,
      profileSlots: 3,
      resolution: "FHD",
      fastGeneration: false,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: false,
    },
    {
      planId: "standard",
      interval: "annual",
      monthlyUsd: 8.25,
      totalUsd: 99,
      totalKrw: 99_000,
      credits: 500,
      profileSlots: 5,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: false,
      permanentStorage: false,
      dedicatedLane: false,
      highlighted: true,
    },
    {
      planId: "enterprise",
      interval: "annual",
      monthlyUsd: 16.58,
      totalUsd: 199,
      totalKrw: 199_000,
      credits: 1_200,
      profileSlots: 10,
      resolution: "4K",
      fastGeneration: true,
      commercialUse: true,
      permanentStorage: true,
      dedicatedLane: true,
      highlighted: false,
    },
  ],
  monthly: [
    {
      planId: "starter",
      interval: "monthly",
      monthlyUsd: 4.9,
      totalUsd: 4.9,
      totalKrw: 4_900,
      credits: 20,
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
      monthlyUsd: 9.9,
      totalUsd: 9.9,
      totalKrw: 9_900,
      credits: 50,
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
      monthlyUsd: 19.9,
      totalUsd: 19.9,
      totalKrw: 19_900,
      credits: 120,
      profileSlots: 10,
      resolution: "4K",
      fastGeneration: false,
      commercialUse: true,
      permanentStorage: true,
      dedicatedLane: false,
      highlighted: false,
    },
  ],
};

export function getPlanOffer(planId: PricingPlanId, interval: BillingInterval): PlanOffer {
  const offer = PLAN_OFFERS[interval].find((item) => item.planId === planId);
  if (!offer) throw new Error(`Plan ${planId} is not available for ${interval} billing`);
  return offer;
}

/** Legacy monthly maps retained for existing consumers. */
export const pricingPrices: Record<PricingPlanId, number> = {
  starter: 4.9,
  standard: 9.9,
  pro: 19.9,
  enterprise: 199,
};

export const FREE_CREDITS = 2;

/** Monthly plan credit allotment (server + client) */
export const PLAN_CREDITS: Record<PricingPlanId, number> = {
  starter: 20,
  standard: 50,
  pro: 120,
  enterprise: 1_200,
};

/** KRW amounts for Toss / PortOne checkout */
export const pricingPricesKrw: Record<PricingPlanId, number> = {
  starter: 4900,
  standard: 9900,
  pro: 19900,
  enterprise: 199000,
};
export const PROMPT_MAX_LENGTH = 100;
export const MIN_SELFIE_UPLOADS = 1;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const;
export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** #60 / #104: regenerate costs 0.5 credit; free retouch path removed from UI */
export const RETOUCH_FREE_PER_CYCLE = 0;
export const RETOUCH_EXTRA_COST = 0.5;
export const REGENERATE_CREDIT_COST = 0.5;
export const RETOUCH_NEXT_DAY_ENTRY_COST = 0.5;
export const RETOUCH_DAILY_MAX = 50;
export const GENERATE_DRAFT_COUNT = 2;

/** #54 face profile slots by plan */
export const PLAN_PROFILE_SLOTS: Record<PricingPlanId, number> = {
  starter: 1,
  standard: 5,
  pro: 10,
  enterprise: 30,
};

/** #79–#80 credit add-on packs (price shared; credits branch by subscription) */
export const CREDIT_PACKS = [
  { id: "pack-s", price: 4.9, freeCredits: 15, subscriberCredits: 20 },
  { id: "pack-m", price: 9.9, freeCredits: 35, subscriberCredits: 50 },
  { id: "pack-l", price: 19.9, freeCredits: 80, subscriberCredits: 120 },
] as const;

export const creditPackPricesKrw: Record<(typeof CREDIT_PACKS)[number]["id"], number> = {
  "pack-s": 4900,
  "pack-m": 9900,
  "pack-l": 19900,
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
  "cultural-elegance": "graceful traditional stance, serene expression, soft daylight",
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
