/**
 * Concept Gallery → Fal Flux Kontext Pro prompt mapping.
 * Keys match `stylePacksMeta[].id` in lib/data.ts, plus short aliases.
 */

export type StylePromptSpec = {
  /** Canonical gallery pack id */
  id: string;
  /** Short human label */
  label: string;
  /** Primary edit instruction for Flux Kontext (image + text) */
  prompt: string;
  /** Optional negative / avoid cues appended as soft constraints */
  avoid?: string;
};

const IDENTITY_LOCK =
  "Keep the exact same person and facial identity from the reference photo — same eyes, nose, mouth, jawline, skin tone, age, and distinctive features. Do not morph into a different face. Re-draw the entire scene as one photograph — never paste or overlay the face.";

const PHOTO_QUALITY =
  "Photorealistic high-resolution editorial photograph, sharp focus on the face, natural skin texture, professional color grading, no watermark, no text overlay.";

export const STYLE_PROMPT_SPECS: Record<string, StylePromptSpec> = {
  "luxury-lifestyle": {
    id: "luxury-lifestyle",
    label: "Travel Editorial",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a bright travel pictorial: outdoor natural daylight, lively vacation destination background (coast, city plaza, or scenic overlook), casual refined fashion, relaxed confident pose.",
      "Lifestyle / Instagram-feed energy — airy, vibrant, aspirational travel snap.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "dark studio, heavy makeup, corporate suit, indoor office",
  },
  "cinematic-poster": {
    id: "cinematic-poster",
    label: "Cinematic",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a cinematic movie-poster portrait: dramatic key light, rich contrast, shallow depth of field, premium studio or dusk city atmosphere.",
      "Comp-card / trailer-thumbnail mood — glamorous, intense, film still quality.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "flat lighting, casual selfie, overexposed daylight",
  },
  "business-executive": {
    id: "business-executive",
    label: "Business",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a professional business headshot: clean modern office or soft neutral backdrop, tailored business attire, polished grooming, confident friendly expression.",
      "Resume / LinkedIn / employee-ID ready portrait.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "casual streetwear, neon lights, fantasy costume",
  },
  "cultural-elegance-east": {
    id: "cultural-elegance-east",
    label: "Heritage East",
    prompt: [
      IDENTITY_LOCK,
      "Transform into an elegant East-Asian traditional pictorial: hanbok or refined traditional dress with accurate fabric detail, classic wooden architecture or garden pavilion background, graceful posture.",
      "Soft warm color palette, heritage elegance, full-body or three-quarter framing when natural.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "western tuxedo, neon cyberpunk, modern streetwear",
  },
  "cultural-elegance-west": {
    id: "cultural-elegance-west",
    label: "Heritage West",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a Western period-drama concept: classic European costume or formal period attire, elegant historic interior or garden estate, refined aristocratic mood.",
      "Costume-play / classic profile energy with luxurious fabrics and soft painterly light.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "hanbok, neon city, modern office",
  },
  "classic-western": {
    id: "classic-western",
    label: "Classic",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a vintage classic pictorial: timeless close-up or upper-body mood shot, film-grain softness, muted warm tones, pamphlet / retro magazine aesthetic.",
      "Elegant, nostalgic, refined classic profile.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "harsh neon, ultra-modern techwear",
  },
  "neon-urban": {
    id: "neon-urban",
    label: "Neon City",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a neon-city night pictorial: rain-slick streets, cyan/magenta neon signs, hip street fashion, album-jacket / shorts-thumbnail energy.",
      "Full-body or dynamic three-quarter framing, cinematic nightlife glow.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "daylight beach, corporate office, traditional hanbok",
  },
  "soft-studio": {
    id: "soft-studio",
    label: "Soft",
    prompt: [
      IDENTITY_LOCK,
      "Transform into a soft studio headshot: gentle diffused beauty lighting, creamy bokeh backdrop, natural makeup, warm intimate atmosphere.",
      "Daily / dating-profile pictorial — flattering, calm, high-end beauty portrait.",
      PHOTO_QUALITY,
    ].join(" "),
    avoid: "harsh shadows, neon, crowded street",
  },
};

/** Short aliases used in docs / API examples → gallery pack ids */
export const STYLE_ID_ALIASES: Record<string, string> = {
  travel: "luxury-lifestyle",
  "travel-photo": "luxury-lifestyle",
  lifestyle: "luxury-lifestyle",
  cinematic: "cinematic-poster",
  business: "business-executive",
  corporate: "business-executive",
  traditional: "cultural-elegance-east",
  "traditional-east": "cultural-elegance-east",
  "traditional-west": "cultural-elegance-west",
  east: "cultural-elegance-east",
  west: "cultural-elegance-west",
  classic: "classic-western",
  vintage: "classic-western",
  neon: "neon-urban",
  "neon-city": "neon-urban",
  urban: "neon-urban",
  soft: "soft-studio",
  studio: "soft-studio",
};

export function resolveStylePackId(styleId: string | null | undefined): string | null {
  if (!styleId || typeof styleId !== "string") return null;
  const key = styleId.trim().toLowerCase();
  if (!key) return null;
  if (STYLE_PROMPT_SPECS[key]) return key;
  const aliased = STYLE_ID_ALIASES[key];
  if (aliased && STYLE_PROMPT_SPECS[aliased]) return aliased;
  // Case-sensitive pack id passthrough
  if (STYLE_PROMPT_SPECS[styleId.trim()]) return styleId.trim();
  return null;
}

export function getStylePromptSpec(styleId: string | null | undefined): StylePromptSpec | null {
  const id = resolveStylePackId(styleId);
  if (!id) return null;
  return STYLE_PROMPT_SPECS[id] ?? null;
}

/**
 * Build the final Kontext / provider prompt from gallery style(s) + optional user text.
 */
export function buildMappedStylePrompt(opts: {
  styleIds?: string[];
  userPrompt?: string;
}): string {
  const ids = (opts.styleIds || [])
    .map((id) => resolveStylePackId(id))
    .filter((id): id is string => Boolean(id));

  const unique = [...new Set(ids)];
  const styleBlocks = unique
    .map((id) => STYLE_PROMPT_SPECS[id]?.prompt)
    .filter(Boolean);

  const user = (opts.userPrompt || "").trim();
  const parts = [
    styleBlocks.length
      ? styleBlocks.join(" Also: ")
      : `${IDENTITY_LOCK} Create a polished professional portrait photograph. ${PHOTO_QUALITY}`,
    user ? `Additional direction from the user: ${user}` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

export function listMappedStyleIds(): string[] {
  return Object.keys(STYLE_PROMPT_SPECS);
}
