/**
 * Concept Gallery — Before/After preview pairs (all 8 style packs).
 *
 * Each pair uses two Unsplash shots of the **same person** (same model /
 * photoshoot series) so the hover compare reads as a real transform mock:
 *   Before = plain / casual portrait
 *   After  = styled look for that concept
 *
 * Optional local drop-in later:
 *   /styles/previews/{stylePackId}-before.jpg
 *   /styles/previews/{stylePackId}-after.jpg
 */

import { HERO_AFTER_IMAGE, HERO_BEFORE_IMAGE, stylePacksMeta } from "@/lib/data";

export type StylePreviewPair = {
  before: string;
  after: string;
};

/** Portrait crop matching the home hero compare frame (4:5). */
function unsplashPortrait(photoPath: string): string {
  return `https://images.unsplash.com/${photoPath}?auto=format&fit=crop&w=900&h=1125&q=85`;
}

/** Target filenames for production assets (optional drop-in later). */
export const STYLE_PREVIEW_ASSET_PATHS: Record<string, StylePreviewPair> = {
  "luxury-lifestyle": {
    before: "/styles/previews/luxury-lifestyle-before.jpg",
    after: "/styles/previews/luxury-lifestyle-after.jpg",
  },
  "cinematic-poster": {
    before: "/styles/previews/cinematic-poster-before.jpg",
    after: "/styles/previews/cinematic-poster-after.jpg",
  },
  "business-executive": {
    before: "/styles/previews/business-executive-before.jpg",
    after: "/styles/previews/business-executive-after.jpg",
  },
  "cultural-elegance-east": {
    before: "/styles/previews/cultural-elegance-east-before.jpg",
    after: "/styles/previews/cultural-elegance-east-after.jpg",
  },
  "cultural-elegance-west": {
    before: "/styles/previews/cultural-elegance-west-before.jpg",
    after: "/styles/previews/cultural-elegance-west-after.jpg",
  },
  "classic-western": {
    before: "/styles/previews/classic-western-before.jpg",
    after: "/styles/previews/classic-western-after.jpg",
  },
  "neon-urban": {
    before: "/styles/previews/neon-urban-before.jpg",
    after: "/styles/previews/neon-urban-after.jpg",
  },
  "soft-studio": {
    before: "/styles/previews/soft-studio-before.jpg",
    after: "/styles/previews/soft-studio-after.jpg",
  },
};

/**
 * Live display pairs — same-person Before/After mocks (16 unique URLs).
 *
 * Sources (verified same model within each pair):
 * - Averie Woodard (@averieclaire)
 * - Aiony Haust model series (@aiony)
 * - Ola Szkołda (@olaszkolda)
 * - Good Faces agency series (@goodfacesagency)
 */
export const STYLE_PREVIEW_PAIRS: Record<string, StylePreviewPair> = {
  /* 여행 화보 — Averie: casual pink-wall → travel sands editorial */
  "luxury-lifestyle": {
    before: unsplashPortrait("photo-1500917293891-ef795e70e1f6"),
    after: unsplashPortrait("photo-1501200081947-78c39535e511"),
  },
  /* 시네마틱 — Aiony model: casual with camera → dramatic field dress */
  "cinematic-poster": {
    before: unsplashPortrait("photo-1571513721963-d855fd8df4c2"),
    after: unsplashPortrait("photo-1584646835188-0e0bac62df29"),
  },
  /* 비즈니스 — Good Faces: patterned shirt → full suit + sunglasses */
  "business-executive": {
    before: unsplashPortrait("photo-1769467304499-8f2e56c88ec7"),
    after: unsplashPortrait("photo-1769467304197-78154be931e6"),
  },
  /* 전통(동양) — Aiony model: plain sweatshirt → floral greenhouse elegance */
  "cultural-elegance-east": {
    before: unsplashPortrait("photo-1543654916-24cb93a9e817"),
    after: unsplashPortrait("photo-1553782376-b3c480f5fea7"),
  },
  /* 전통(서양) — Ola: casual braids → evening gown / red carpet */
  "cultural-elegance-west": {
    before: unsplashPortrait("photo-1779153456465-8d412a4c0997"),
    after: unsplashPortrait("photo-1779974796533-499a581679a5"),
  },
  /* 클래식 — Ola: casual jeans sit → classical columns fashion */
  "classic-western": {
    before: unsplashPortrait("photo-1779153456570-fee03ca25f37"),
    after: unsplashPortrait("photo-1782400243171-61ace80039c6"),
  },
  /* 네온시티 — Good Faces: blazer casual → bold gloves urban suit */
  "neon-urban": {
    before: unsplashPortrait("photo-1769467304166-2fbf42237387"),
    after: unsplashPortrait("photo-1769467304368-0dada8118bc3"),
  },
  /* 소프트 — Aiony model: simple black top → soft studio dress */
  "soft-studio": {
    before: unsplashPortrait("photo-1548361403-cb0c785eea54"),
    after: unsplashPortrait("photo-1553782376-b2e8256ab838"),
  },
};

export const STYLE_PREVIEW_ALIASES: Record<string, string> = {
  travel: "luxury-lifestyle",
  cinematic: "cinematic-poster",
  business: "business-executive",
  traditional: "cultural-elegance-east",
  "traditional-east": "cultural-elegance-east",
  "traditional-west": "cultural-elegance-west",
  classic: "classic-western",
  neon: "neon-urban",
  "neon-city": "neon-urban",
  soft: "soft-studio",
};

const packCoverById = Object.fromEntries(
  stylePacksMeta.map((p) => [p.id, p.imageUrl])
) as Record<string, string>;

/** Every gallery pack id must appear here. */
export const ALL_STYLE_PREVIEW_PACK_IDS = stylePacksMeta.map((p) => p.id);

export function resolveStylePackIdForPreview(styleId: string): string {
  const key = styleId.trim();
  if (STYLE_PREVIEW_PAIRS[key]) return key;
  const aliased = STYLE_PREVIEW_ALIASES[key.toLowerCase()];
  if (aliased && STYLE_PREVIEW_PAIRS[aliased]) return aliased;
  if (packCoverById[key]) return key;
  return key;
}

/**
 * Always returns usable https/public URLs for the hover compare popup.
 */
export function getStylePreviewPair(styleId: string): StylePreviewPair & {
  packId: string;
  fallbackBefore: string;
  fallbackAfter: string;
} {
  const packId = resolveStylePackIdForPreview(styleId);
  const pair = STYLE_PREVIEW_PAIRS[packId];
  const cover = packCoverById[packId] || HERO_AFTER_IMAGE;
  const before = pair?.before || HERO_BEFORE_IMAGE;
  const after = pair?.after || cover;
  return {
    packId,
    before,
    after,
    fallbackBefore: HERO_BEFORE_IMAGE,
    fallbackAfter: cover || HERO_AFTER_IMAGE,
  };
}

/** Warm browser cache so the first hover feels instant. */
export function preloadStylePreviewPair(styleId: string) {
  if (typeof window === "undefined") return;
  const { before, after } = getStylePreviewPair(styleId);
  for (const src of [before, after]) {
    if (!src) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}
