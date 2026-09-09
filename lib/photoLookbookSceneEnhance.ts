/**
 * Lookbook scene prompt enhancement — expand Korean place names into
 * Flux-safe English visual descriptors before AI generation.
 */

import { isFluxSafeEnglishPrompt } from "@/lib/ai/commandParser";

type PlaceVisual = {
  /** Match against the raw user prompt (Korean or Latin). */
  match: RegExp;
  /** English visual descriptors for the location. */
  visual: string;
};

type PoseHint = {
  match: RegExp;
  pose: string;
};

/**
 * Most-specific patterns first (e.g. Jeju rapeseed before generic Jeju).
 * Descriptors emphasize recognizable landmarks / materials / light.
 */
const LOOKBOOK_PLACE_VISUALS: readonly PlaceVisual[] = [
  {
    match: /제주도?\s*유채|유채꽃/i,
    visual:
      "Jeju Island yellow rapeseed (canola) flower field in full bloom, dense bright yellow blossoms, black volcanic basalt stone walls (olle), rural Jeju countryside, clear spring daylight, blue sky",
  },
  {
    match: /경복궁|근정전|gyeongbok/i,
    visual:
      "Gyeongbokgung Palace in Seoul, Geunjeongjeon throne hall area, majestic traditional Korean royal palace architecture, ornate tiled roofs, wooden pillars, wide stone courtyard, Joseon dynasty heritage",
  },
  {
    match: /창덕궁|후원|changdeok/i,
    visual:
      "Changdeokgung Palace Secret Garden (Huwon) in Seoul, traditional Korean palace wooden daecheongmaru floor, carved wood eaves, quiet royal garden greenery",
  },
  {
    match: /북촌|한옥마을|bukchon/i,
    visual:
      "Bukchon Hanok Village Seoul, traditional Korean hanok houses, grey tiled roofs, stone alley walls (doldam), wooden gates, soft daylight",
  },
  {
    match: /한옥|돌담/i,
    visual:
      "traditional Korean hanok architecture, wooden lattice doors, grey tiled roof, stone wall alley, warm natural light",
  },
  {
    match: /전통\s*정자|정자\s*마루|누각/i,
    visual:
      "traditional Korean wooden pavilion (jeongja) with open wooden floor deck, carved pillars, forest greenery beyond latticed doors, soft daylight",
  },
  {
    match: /두물머리/i,
    visual:
      "Dumulmeori river confluence in Yangpyeong Korea, wide calm river meeting point, willow trees, misty waterside landscape, peaceful daylight",
  },
  {
    match: /한강공원|한강/i,
    visual:
      "Hangang Park riverside in Seoul, green lawn by the Han River, city skyline across the water, open sky, bright daylight",
  },
  {
    match: /올림픽공원/i,
    visual:
      "Olympic Park Seoul, landscaped park trees and walking paths, open green space, soft daylight",
  },
  {
    match: /남산\s*타워|N\s*서울타워|남산타워|namsan/i,
    visual:
      "N Seoul Tower (Namsan Tower) observation deck interior window view over Seoul cityscape, glass windows, panoramic skyline",
  },
  {
    match: /롯데월드타워|롯데타워/i,
    visual:
      "Lotte World Tower Seoul glass window overlook, modern skyscraper interior, city skyline through floor-to-ceiling glass",
  },
  {
    match: /코엑스|별마당/i,
    visual:
      "COEX Starfield Library Seoul, towering bookshelves, modern atrium library interior, soft ambient indoor light",
  },
  {
    match: /제주|jeju/i,
    visual:
      "Jeju Island Korea scenery, volcanic coastline mood, clear ocean air, natural daylight",
  },
  {
    match: /고궁|궁궐|palace/i,
    visual:
      "traditional Korean royal palace grounds, tiled roofs, stone courtyards, historic Joseon architecture",
  },
  {
    match: /몰디브|maldives/i,
    visual:
      "Maldives tropical beach resort, turquoise lagoon, white sand, wooden sun lounger, bright sunny daylight",
  },
  {
    match: /골프장|골프/i,
    visual:
      "manicured golf course fairway, green grass, distant trees, open sky, bright daylight",
  },
  {
    match: /테니스/i,
    visual:
      "outdoor tennis court with net and court lines, sports fencing, bright daylight",
  },
  {
    match: /캠핑/i,
    visual:
      "outdoor camping site with folding chairs, soft forest or field background, natural daylight",
  },
  {
    match: /화이트톤\s*스튜디오|스튜디오|단색\s*배경/i,
    visual:
      "clean white-tone photography studio, seamless backdrop, soft even studio lighting",
  },
  {
    match: /카페/i,
    visual:
      "bright modern cafe interior by a large window, soft indoor daylight, cozy seating",
  },
  {
    match: /서재/i,
    visual:
      "elegant study room with leather sofa, bookshelves, warm indoor lighting",
  },
  {
    match: /호텔\s*로비/i,
    visual:
      "luxury hotel lobby with designer sofa, polished floors, soft upscale interior lighting",
  },
  {
    match: /빌딩\s*로비|로비/i,
    visual:
      "modern glass office building lobby, contemporary seating, polished stone floor, soft ambient light",
  },
] as const;

const LOOKBOOK_POSE_HINTS: readonly PoseHint[] = [
  {
    match: /양손을\s*무릎|손을\s*무릎/i,
    pose: "sitting with both hands resting on the knees, upright polite posture",
  },
  {
    match: /팔짱/i,
    pose: "standing with arms crossed confidently",
  },
  {
    match: /두\s*손을\s*모으|손을\s*모으/i,
    pose: "standing with hands clasped together in front",
  },
  {
    match: /기대어\s*앉|기대어/i,
    pose: "sitting while leaning back casually against a bench or railing",
  },
  {
    match: /앉아|앉은|앉아서/i,
    pose: "naturally seated pose with feet grounded",
  },
  {
    match: /서\s*있|서서|서있는|서\s*있어요/i,
    pose: "standing upright facing camera, full or half body visible",
  },
  {
    match: /골프채/i,
    pose: "standing lightly holding a golf club",
  },
  {
    match: /테니스채/i,
    pose: "standing on court holding a tennis racket",
  },
  {
    match: /책을\s*들/i,
    pose: "standing holding an open book",
  },
] as const;

const LOOKBOOK_WARDROBE_HINTS: readonly { match: RegExp; wardrobe: string }[] = [
  {
    match: /한복/i,
    wardrobe: "wearing a traditional Korean hanbok",
  },
  {
    match: /양장|정장|수트|suit/i,
    wardrobe: "wearing a formal suit / formal attire",
  },
  {
    match: /캐주얼|casual/i,
    wardrobe: "wearing casual everyday clothes",
  },
  {
    match: /원피스|드레스|dress/i,
    wardrobe: "wearing a dress",
  },
  {
    match: /운동복|트레이닝/i,
    wardrobe: "wearing athletic / sportswear",
  },
] as const;

function collectPlaceVisuals(raw: string): string[] {
  const out: string[] = [];
  for (const entry of LOOKBOOK_PLACE_VISUALS) {
    if (!entry.match.test(raw)) continue;
    out.push(entry.visual);
    // First (most specific) place match wins — avoid stacking Jeju+rapeseed twice.
    break;
  }
  return out;
}

function collectPoseHints(raw: string): string[] {
  const out: string[] = [];
  for (const entry of LOOKBOOK_POSE_HINTS) {
    if (!entry.match.test(raw)) continue;
    out.push(entry.pose);
    break; // most specific pose first
  }
  return out;
}

function collectWardrobeHints(raw: string): string[] {
  const out: string[] = [];
  for (const entry of LOOKBOOK_WARDROBE_HINTS) {
    if (!entry.match.test(raw)) continue;
    out.push(entry.wardrobe);
    break;
  }
  return out;
}

export type LookbookSceneEnhanceResult = {
  /** Flux-safe English scene prompt with visual descriptors. */
  enhanced: string;
  /** Whether at least one place visual was injected. */
  placeMatched: boolean;
  /** Original trimmed user text (for logging / UI). */
  original: string;
};

/**
 * Expand Korean (or mixed) lookbook scene text into English visual descriptors.
 * Always returns a string safe to embed in generation commands.
 * Stateless: built only from `userPrompt` — never appends prior generation text.
 */
export function enhanceLookbookScenePrompt(
  userPrompt: string
): LookbookSceneEnhanceResult {
  const original = userPrompt.trim();
  if (!original) {
    return { enhanced: "", placeMatched: false, original: "" };
  }

  const places = collectPlaceVisuals(original);
  const poses = collectPoseHints(original);
  const wardrobe = collectWardrobeHints(original);
  const placeMatched = places.length > 0;

  const chunks: string[] = [];
  if (places.length) {
    chunks.push(`Location and scenery: ${places.join(". ")}.`);
  }
  if (poses.length) {
    chunks.push(`Subject pose and action: ${poses.join("; ")}.`);
  }
  if (wardrobe.length) {
    chunks.push(`Wardrobe: ${wardrobe.join("; ")}.`);
  } else {
    chunks.push(
      "Wardrobe: natural clothing that fits this location and pose only — do not reuse any previous outfit."
    );
  }

  if (isFluxSafeEnglishPrompt(original)) {
    chunks.push(`Additional scene direction: ${original}.`);
  } else if (!placeMatched && !poses.length) {
    chunks.push(
      "Photorealistic Korean lookbook environment with accurate local architecture, materials, vegetation, and natural daylight matching the user's intended place and mood."
    );
  } else {
    chunks.push(
      "Compose as a cohesive Korean lookbook photograph matching the described place and pose; photorealistic materials, lighting, and perspective."
    );
  }

  const enhanced = chunks.join(" ").replace(/\s+/g, " ").trim();
  return { enhanced, placeMatched, original };
}

/** Identity-priority directives prepended to base-scene generation. */
export const LOOKBOOK_IDENTITY_PRIORITY = [
  "FACE IDENTITY LOCK (highest priority): the person's face must match the reference face photo exactly — same identity, facial structure, age, and features.",
  "Do not invent a different person; wardrobe and body may change with the scene, but the face stays locked.",
].join(" ");

/**
 * Fresh Fal prompt for one base-scene click — no prior outfit/location residue.
 */
export function buildLookbookBaseFalPrompt(enhancedScene: string): string {
  const scene = enhancedScene.trim();
  return [
    LOOKBOOK_IDENTITY_PRIORITY,
    "Create one complete photorealistic lookbook photograph from the reference face image (image-to-image).",
    "This request is atomic: ignore any previous generation, previous clothing, and previous location.",
    "Do NOT output an empty background. Do NOT paste a floating cropped head.",
    "Render a natural full or half-body figure of this exact person posed inside the scene,",
    "with matching lighting, shadows, perspective, and ground contact.",
    "Medium-to-full body portrait, subject fills most of the frame height, not a distant tiny figure.",
    scene,
    "Sharp photoreal edges, no text, no watermark, no collage seams.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}