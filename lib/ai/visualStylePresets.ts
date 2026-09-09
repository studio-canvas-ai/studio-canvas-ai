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
    id: "portrait-lock-studio",
    category: "image",
    labelKo: "증명사진, 화보, SNS",
    hintKo: "원본고정, 스튜디오배경",
    labelEn: "ID / Lookbook / SNS",
    hintEn: "keep original · studio backdrop only",
    modifiers:
      "Preserve the exact original subject silhouette and identity; replace only with a clean solid studio backdrop; rembg cutout + studio plate; photorealistic; no FaceID identity rewrite",
  },
  {
    id: "portrait-new-bg",
    category: "image",
    labelKo: "증명사진, 화보, SNS",
    hintKo: "새 배경생성",
    labelEn: "ID / Lookbook / SNS",
    hintEn: "generate new background (FaceID)",
    modifiers:
      "FaceID InstantID portrait with freshly generated scenic or studio background, preserve facial identity, photorealistic environmental backdrop generation",
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

/** Keep-original / rembg path (원본고정 · 스튜디오배경) — lower credit. */
export const PORTRAIT_LOCK_STUDIO_STYLE_ID = "portrait-lock-studio";
/** FaceID InstantID path (새 배경생성) — 50-credit generative uses. */
export const PORTRAIT_NEW_BG_STYLE_ID = "portrait-new-bg";

/** @deprecated Legacy id — maps to keep-original style. */
export const PURPOSE_GENERAL_STYLE_ID = PORTRAIT_LOCK_STUDIO_STYLE_ID;
export const PURPOSE_STYLE_TAG_DEFAULT =
  "증명사진, 화보, SNS (원본고정, 스튜디오배경)";

const LEGACY_STYLE_ID_MAP: Record<string, string> = {
  "id-photo-studio": PORTRAIT_LOCK_STUDIO_STYLE_ID,
  "lookbook-studio": PORTRAIT_LOCK_STUDIO_STYLE_ID,
  "sns-studio": PORTRAIT_LOCK_STUDIO_STYLE_ID,
  "purpose-general": PORTRAIT_LOCK_STUDIO_STYLE_ID,
};

const USE_TO_STYLE_ID: Record<string, string> = {
  "id-photo-keep-original": PORTRAIT_LOCK_STUDIO_STYLE_ID,
  "lookbook-keep-original": PORTRAIT_LOCK_STUDIO_STYLE_ID,
  "sns-keep-original": PORTRAIT_LOCK_STUDIO_STYLE_ID,
  "id-photo": PORTRAIT_NEW_BG_STYLE_ID,
  lookbook: PORTRAIT_NEW_BG_STYLE_ID,
  sns: PORTRAIT_NEW_BG_STYLE_ID,
};

const USE_TO_STYLE_TAG: Record<string, string> = {
  "id-photo-keep-original": PURPOSE_STYLE_TAG_DEFAULT,
  "lookbook-keep-original": PURPOSE_STYLE_TAG_DEFAULT,
  "sns-keep-original": PURPOSE_STYLE_TAG_DEFAULT,
  "id-photo": "증명사진, 화보, SNS (새 배경생성)",
  lookbook: "증명사진, 화보, SNS (새 배경생성)",
  sns: "증명사진, 화보, SNS (새 배경생성)",
  증명사진: "증명사진, 화보, SNS (새 배경생성)",
  화보: "증명사진, 화보, SNS (새 배경생성)",
  SNS: "증명사진, 화보, SNS (새 배경생성)",
  "프로필 / SNS": "증명사진, 화보, SNS (새 배경생성)",
};

/** Map 용도 → style preset id (Screen-26 purpose ↔ style tag sync). */
export function imageStyleIdForPurpose(
  useId: string | null | undefined
): string | null {
  if (!useId) return null;
  return USE_TO_STYLE_ID[useId] ?? null;
}

/** Map 용도/라벨 → style tag display text. */
export function styleTagLabelForPurpose(
  useIdOrLabel: string | null | undefined
): string {
  if (!useIdOrLabel) return PURPOSE_STYLE_TAG_DEFAULT;
  return USE_TO_STYLE_TAG[useIdOrLabel] ?? PURPOSE_STYLE_TAG_DEFAULT;
}

/**
 * Reverse: purpose-bound style → matching use id.
 * 1) portrait-lock-studio → 원본유지 (배경만 변경)
 * 2) portrait-new-bg → FaceID 50크레딧
 */
export function purposeUseIdForStyle(
  imageStyleId: string | null | undefined,
  currentUseId?: string | null
):
  | "id-photo"
  | "lookbook"
  | "sns"
  | "id-photo-keep-original"
  | "lookbook-keep-original"
  | "sns-keep-original"
  | null {
  const resolved =
    (imageStyleId && LEGACY_STYLE_ID_MAP[imageStyleId]) || imageStyleId;

  // 1) 원본고정 → keep-original (low credit)
  if (resolved === PORTRAIT_LOCK_STUDIO_STYLE_ID) {
    if (
      currentUseId === "id-photo-keep-original" ||
      currentUseId === "lookbook-keep-original" ||
      currentUseId === "sns-keep-original"
    ) {
      return currentUseId;
    }
    if (currentUseId === "id-photo") return "id-photo-keep-original";
    if (currentUseId === "lookbook") return "lookbook-keep-original";
    if (currentUseId === "sns") return "sns-keep-original";
    return "id-photo-keep-original";
  }

  // 2) 새 배경생성 → FaceID 50-credit uses
  if (resolved === PORTRAIT_NEW_BG_STYLE_ID) {
    if (
      currentUseId === "id-photo" ||
      currentUseId === "lookbook" ||
      currentUseId === "sns"
    ) {
      return currentUseId;
    }
    if (currentUseId === "id-photo-keep-original") return "id-photo";
    if (currentUseId === "lookbook-keep-original") return "lookbook";
    if (currentUseId === "sns-keep-original") return "sns";
    return "id-photo";
  }

  // Legacy per-purpose styles → FaceID siblings
  if (resolved === "id-photo-studio") return "id-photo";
  if (resolved === "lookbook-studio") return "lookbook";
  if (resolved === "sns-studio") return "sns";
  return null;
}

export function resolveVisualStylePreset(
  id: string | null | undefined
): VisualStylePreset | null {
  if (!id) return null;
  const mapped = LEGACY_STYLE_ID_MAP[id.trim()] ?? id.trim();
  return PRESET_BY_ID.get(mapped) ?? null;
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
