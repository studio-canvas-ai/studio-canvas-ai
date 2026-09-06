/**
 * Screen-26 portrait purposes:
 * - AI FaceID pipeline: 증명사진 / 화보 / SNS
 * - Keep-original: 증명사진(원본유지.배경만변경) → rembg + backdrop only (no FaceID)
 * Isolation (skip Magic Layout, disable 분야, portrait BG category) applies to both.
 */

export const PORTRAIT_AI_PURPOSE_USE_IDS = [
  "id-photo",
  "lookbook",
  "sns",
] as const;

export type PortraitAiPurposeUseId =
  (typeof PORTRAIT_AI_PURPOSE_USE_IDS)[number];

/** Legacy alias — AI FaceID modes only (not keep-original). */
export const PORTRAIT_PURPOSE_USE_IDS = PORTRAIT_AI_PURPOSE_USE_IDS;
export type PortraitPurposeUseId = PortraitAiPurposeUseId;

export const ID_PHOTO_KEEP_ORIGINAL_USE_ID = "id-photo-keep-original" as const;

export const PORTRAIT_PURPOSE_BG_CATEGORY_ID = "portrait-suite";

/** FaceID / Flux InstantID generation modes only. */
export function isPortraitAiPurposeUse(
  useId: string | null | undefined
): useId is PortraitAiPurposeUseId {
  return (
    useId === "id-photo" || useId === "lookbook" || useId === "sns"
  );
}

/** 증명사진 (원본유지.배경만변경) — rembg + studio plate, never FaceID. */
export function isIdPhotoKeepOriginalUse(
  useId: string | null | undefined
): boolean {
  return useId === ID_PHOTO_KEEP_ORIGINAL_USE_ID;
}

/**
 * UI + layout isolation: AI portrait modes OR keep-original.
 * Skips Magic Layout text, locks 분야, filters BG examples.
 */
export function isPortraitPurposeUse(
  useId: string | null | undefined
): boolean {
  return isPortraitAiPurposeUse(useId) || isIdPhotoKeepOriginalUse(useId);
}

/**
 * Hard lock — keep the sitter’s natural weight, facial fullness, and proportions.
 * Applied on every Screen-26 FaceID purpose (positive prompt).
 */
export const PORTRAIT_BODY_SHAPE_LOCK =
  "Preserve the subject's natural body shape, facial fullness, and physical proportions exactly as in the reference photo. Maintain natural original physical build and weight. Do not slim, elongate, or reshape the body or face.";

/**
 * Negative constraints against emaciation / over-slimming (FaceID).
 */
export const PORTRAIT_BODY_SHAPE_NEGATIVE =
  "emaciated, gaunt, extreme slimming, distorted body proportions, underweight, overly thin face, skinny model body, hollow cheeks, stick-thin limbs, unnatural slim waist, weight-loss look";

/** Purpose-specific English locks for /api/generate-photo-ai. */
export function portraitAiPromptLock(
  useId: PortraitAiPurposeUseId | string | null | undefined
): string {
  const body = PORTRAIT_BODY_SHAPE_LOCK;
  if (useId === "id-photo") {
    return [
      "Professional studio ID photo.",
      "Force direct front-facing pose, facial symmetry, clean formal attire,",
      "solid clean studio backdrop, soft even lighting.",
      "Preserve exact facial identity — do not invent a new person.",
      body,
    ].join(" ");
  }
  if (useId === "lookbook") {
    return [
      "High-end fashion editorial pictorial.",
      "Designer styling, dramatic professional lighting, polished posing.",
      "Preserve exact facial identity — do not invent a new person.",
      body,
    ].join(" ");
  }
  if (useId === "sns") {
    return [
      "Friendly SNS profile portrait.",
      "Smart-casual posture, flattering soft lighting, tasteful blurred aesthetic background.",
      "Preserve exact facial identity — do not invent a new person.",
      body,
    ].join(" ");
  }
  return `Professional studio portrait. Preserve exact facial identity. ${body}`;
}

/** Empty-plate lock for keep-original scenic generation (no people). */
export function portraitKeepOriginalScenicLock(): string {
  return "Empty solid or soft-gradient studio ID-photo backdrop only — no people, no faces, no props.";
}
