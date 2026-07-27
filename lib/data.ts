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
      "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&h=800&fit=crop&q=80",
  },
  {
    id: "neon-urban",
    category: "Urban",
    categoryKey: "urban",
    gradient: "from-fuchsia-500/30 via-violet-600/25 to-cyan-400/30",
    imageUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&q=80",
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

export const personaSpecIds = {
  gender: [
    { id: "female", icon: "♀" },
    { id: "male", icon: "♂" },
    { id: "neutral", icon: "◈" },
  ],
  age: [
    { id: "20s", icon: "✦" },
    { id: "30s", icon: "✧" },
    { id: "40s", icon: "✪" },
  ],
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
