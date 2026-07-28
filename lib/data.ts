export interface StylePackMeta {
  id: string;
  category: string;
  categoryKey: "lifestyle" | "cinematic" | "business" | "culture" | "urban" | "studio";
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
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "cultural-elegance",
    category: "Culture",
    categoryKey: "culture",
    gradient: "from-emerald-600/30 via-teal-500/20 to-amber-600/25",
    imageUrl:
      "https://images.unsplash.com/photo-1506480932912-dbbe35e3e516?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "neon-urban",
    category: "Urban",
    categoryKey: "urban",
    gradient: "from-fuchsia-500/30 via-violet-600/25 to-cyan-400/30",
    imageUrl:
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=800&fit=crop&q=80",
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

export const pricingPlanIds = ["starter", "standard", "pro"] as const;

export const pricingPrices: Record<(typeof pricingPlanIds)[number], number> = {
  starter: 4.9,
  standard: 9.9,
  pro: 19.9,
};

export const FREE_CREDITS = 3;
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

/** #60: 1 free edit on focused draft, then 1 credit per edit/regenerate */
export const RETOUCH_FREE_PER_CYCLE = 1;
export const RETOUCH_EXTRA_COST = 1;
export const RETOUCH_NEXT_DAY_ENTRY_COST = 1;
export const RETOUCH_DAILY_MAX = 50;
export const GENERATE_DRAFT_COUNT = 2;

/** #54 face profile slots by plan */
export const PLAN_PROFILE_SLOTS: Record<(typeof pricingPlanIds)[number], number> = {
  starter: 1,
  standard: 5,
  pro: 10,
};

/** #61 credit add-on packs */
export const CREDIT_PACKS = [
  { id: "pack10", credits: 10, price: 1.9 },
  { id: "pack30", credits: 30, price: 4.9 },
  { id: "pack100", credits: 100, price: 12.9 },
] as const;

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
