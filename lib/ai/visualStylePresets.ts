/**
 * Visual style / mood presets for Template Studio & Print Agent.
 * Selected IDs → precise English Flux modifiers bound through the core engine.
 */

export type VisualStyleCategory = "image" | "mood";

export type VisualStylePreset = {
  id: string;
  category: VisualStyleCategory;
  /** UI label (KR) */
  labelKo: string;
  hintKo?: string;
  /** UI label (EN) */
  labelEn: string;
  hintEn?: string;
  /** Compact Flux / Gemini modifier clause */
  modifiers: string;
};

/** Image style category */
export const IMAGE_STYLE_PRESETS: VisualStylePreset[] = [
  {
    id: "photorealistic",
    category: "image",
    labelKo: "프리미엄 실사",
    hintKo: "선명하고 사실적인 사진",
    labelEn: "Photorealistic",
    hintEn: "sharp, true-to-life photo",
    modifiers:
      "ultra-photorealistic photography, natural skin and material detail, sharp optical focus, true-to-life color, shot on full-frame camera",
  },
  {
    id: "clean-illustration",
    category: "image",
    labelKo: "모던 일러스트",
    hintKo: "세련되고 트렌디한 그림",
    labelEn: "Clean Illustration",
    hintEn: "refined trendy drawing",
    modifiers:
      "clean modern vector illustration style, flat refined shapes, smooth gradients, editorial graphic look, no photorealism",
  },
  {
    id: "pixar-3d",
    category: "image",
    labelKo: "3D 픽사풍",
    hintKo: "입체적이고 귀여운 애니메이션",
    labelEn: "3D Pixar Style",
    hintEn: "cute dimensional animation",
    modifiers:
      "stylized 3D Pixar-like animation look, soft subsurface skin, appealing character volumes, cinematic CGI lighting, polished render",
  },
  {
    id: "warm-watercolor",
    category: "image",
    labelKo: "따뜻한 수채화",
    hintKo: "감성적이고 부드러운 물감",
    labelEn: "Warm Watercolor",
    hintEn: "soft emotional washes",
    modifiers:
      "warm watercolor painting, soft wet-on-wet washes, gentle paper texture, luminous pigments, hand-painted atmosphere",
  },
  {
    id: "corporate-minimal",
    category: "image",
    labelKo: "비즈니스 미니멀",
    hintKo: "깔끔하고 정돈된 홍보 느낌",
    labelEn: "Corporate Minimal",
    hintEn: "clean promotional look",
    modifiers:
      "corporate minimal visual style, clean negative space, restrained palette, crisp geometric composition, premium business aesthetic",
  },
  {
    id: "cinematic-film",
    category: "image",
    labelKo: "시네마틱 필름",
    hintKo: "영화 같은 깊이감 있는 톤",
    labelEn: "Cinematic Film",
    hintEn: "movie-like depth and tone",
    modifiers:
      "cinematic film still, anamorphic depth, rich color grade, dramatic lighting, movie-like atmosphere, shallow depth of field",
  },
  {
    id: "neon-cyberpunk",
    category: "image",
    labelKo: "네온 사이버펑크",
    hintKo: "화려하고 감각적인 야경",
    labelEn: "Neon Cyberpunk",
    hintEn: "vivid sensory night city",
    modifiers:
      "neon cyberpunk night city, vivid magenta and cyan lighting, rain-slick streets, futuristic sensory nightlife, no text",
  },
  {
    id: "vintage-retro",
    category: "image",
    labelKo: "빈티지 레트로",
    hintKo: "추억 돋는 아기자기한 감성",
    labelEn: "Vintage Retro",
    hintEn: "nostalgic charming retro",
    modifiers:
      "vintage retro nostalgia, analog film grain, warm faded palette, charming retro graphic mood, mid-century print aesthetic",
  },
  {
    id: "minimal-flat-art",
    category: "image",
    labelKo: "미니멀 플랫아트",
    hintKo: "심플하고 직관적인 포스터",
    labelEn: "Minimal Flat Art",
    hintEn: "simple intuitive poster",
    modifiers:
      "minimal flat design poster, simple geometric shapes, bold clear icons, intuitive infographic look, limited color palette",
  },
  {
    id: "fantasy-epic",
    category: "image",
    labelKo: "판타지 에픽 톤",
    hintKo: "웅장하고 극적인 분위기",
    labelEn: "Fantasy Epic",
    hintEn: "grand dramatic atmosphere",
    modifiers:
      "epic fantasy atmosphere, grand dramatic scale, volumetric god rays, mythic cinematic mood, majestic landscape",
  },
  {
    id: "id-photo-studio",
    category: "image",
    labelKo: "증명사진용",
    hintKo: "원본 인물 고정 · 단색 스튜디오 배경",
    labelEn: "ID Photo Studio",
    hintEn: "lock original person · solid studio backdrop",
    modifiers:
      "Professional studio ID photo, clean solid color background, studio soft lighting, passport-style head-and-shoulders framing, even exposure, natural skin, no beauty distortion, preserve exact facial identity",
  },
];

/** Lighting & mood category */
export const MOOD_STYLE_PRESETS: VisualStylePreset[] = [
  {
    id: "bright",
    category: "mood",
    labelKo: "화사하고 밝은",
    labelEn: "Bright",
    modifiers:
      "bright airy lighting, soft daylight, high-key exposure, fresh cheerful atmosphere, clean highlights",
  },
  {
    id: "luxurious-cinematic",
    category: "mood",
    labelKo: "고급스러운 시네마틱",
    labelEn: "Luxurious Cinematic",
    modifiers:
      "luxurious cinematic lighting, rich contrast, dramatic key light, shallow depth of field, film-still color grade",
  },
  {
    id: "studio-lighting",
    category: "mood",
    labelKo: "전문가 스튜디오 조명",
    labelEn: "Studio Lighting",
    modifiers:
      "professional studio lighting setup, softbox key and fill, controlled catchlights, even polished commercial look",
  },
];

export const ALL_VISUAL_STYLE_PRESETS: VisualStylePreset[] = [
  ...IMAGE_STYLE_PRESETS,
  ...MOOD_STYLE_PRESETS,
];

const PRESET_BY_ID = new Map(
  ALL_VISUAL_STYLE_PRESETS.map((p) => [p.id, p] as const)
);

export type VisualStyleSelection = {
  /** Image style preset id (optional) */
  imageStyleId: string | null;
  /** Mood / lighting preset id (optional) */
  moodStyleId: string | null;
};

export function emptyVisualStyleSelection(): VisualStyleSelection {
  return { imageStyleId: null, moodStyleId: null };
}

export function resolveVisualStylePreset(
  id: string | null | undefined
): VisualStylePreset | null {
  if (!id) return null;
  return PRESET_BY_ID.get(id.trim()) ?? null;
}

/** Normalize client payload → validated selection. */
export function normalizeVisualStyleSelection(raw?: {
  imageStyleId?: string | null;
  moodStyleId?: string | null;
  styleIds?: string[] | null;
} | null): VisualStyleSelection {
  let imageStyleId: string | null = null;
  let moodStyleId: string | null = null;

  if (raw?.imageStyleId) {
    const p = resolveVisualStylePreset(raw.imageStyleId);
    if (p?.category === "image") imageStyleId = p.id;
  }
  if (raw?.moodStyleId) {
    const p = resolveVisualStylePreset(raw.moodStyleId);
    if (p?.category === "mood") moodStyleId = p.id;
  }

  // Allow flat styleIds array (first image + first mood win).
  if (Array.isArray(raw?.styleIds)) {
    for (const id of raw!.styleIds!) {
      const p = resolveVisualStylePreset(id);
      if (!p) continue;
      if (p.category === "image" && !imageStyleId) imageStyleId = p.id;
      if (p.category === "mood" && !moodStyleId) moodStyleId = p.id;
    }
  }

  return { imageStyleId, moodStyleId };
}

export function selectedVisualStylePresets(
  selection: VisualStyleSelection
): VisualStylePreset[] {
  const out: VisualStylePreset[] = [];
  const img = resolveVisualStylePreset(selection.imageStyleId);
  const mood = resolveVisualStylePreset(selection.moodStyleId);
  if (img) out.push(img);
  if (mood) out.push(mood);
  return out;
}

/** Combined Flux modifier string (empty if nothing selected). */
export function buildVisualStyleModifiers(
  selection: VisualStyleSelection
): string {
  return selectedVisualStylePresets(selection)
    .map((p) => p.modifiers)
    .filter(Boolean)
    .join(". ");
}

/**
 * Append style modifiers to an English Flux prompt without duplicating.
 */
export function applyVisualStyleModifiers(
  englishPrompt: string,
  selection: VisualStyleSelection
): string {
  const core = englishPrompt.trim();
  const mods = buildVisualStyleModifiers(selection);
  if (!mods) return core;
  if (!core) return mods;
  // Avoid double-append if already present.
  if (core.toLowerCase().includes(mods.slice(0, 40).toLowerCase())) return core;
  return `${core}. Style & lighting: ${mods}`;
}

export function visualStyleSelectionLabel(
  selection: VisualStyleSelection,
  locale: "ko" | "en" = "ko"
): string | null {
  const parts = selectedVisualStylePresets(selection).map((p) =>
    locale === "ko" ? p.labelKo : p.labelEn
  );
  if (!parts.length) return null;
  return parts.join(" · ");
}
