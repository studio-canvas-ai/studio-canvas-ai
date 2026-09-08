/**
 * Screen-26 portrait purposes:
 * - AI FaceID pipeline: 증명사진 / 화보 / SNS
 * - Keep-original: 증명사진·화보·SNS (원본유지, 배경만 변경) → rembg + backdrop only (no FaceID)
 * Isolation (skip Magic Layout, disable 분야, portrait BG category) applies to both.
 */

import { FEATURE_CREDIT_COST } from "@/lib/featureCreditCosts";

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
export const LOOKBOOK_KEEP_ORIGINAL_USE_ID = "lookbook-keep-original" as const;
export const SNS_KEEP_ORIGINAL_USE_ID = "sns-keep-original" as const;

export const PORTRAIT_KEEP_ORIGINAL_USE_IDS = [
  ID_PHOTO_KEEP_ORIGINAL_USE_ID,
  LOOKBOOK_KEEP_ORIGINAL_USE_ID,
  SNS_KEEP_ORIGINAL_USE_ID,
] as const;

export type PortraitKeepOriginalUseId =
  (typeof PORTRAIT_KEEP_ORIGINAL_USE_IDS)[number];

export const PORTRAIT_PURPOSE_BG_CATEGORY_ID = "portrait-suite";

/** FaceID / Flux InstantID generation modes only. */
export function isPortraitAiPurposeUse(
  useId: string | null | undefined
): useId is PortraitAiPurposeUseId {
  return (
    useId === "id-photo" || useId === "lookbook" || useId === "sns"
  );
}

/**
 * Keep-original portrait modes — rembg + studio/scenic plate, never FaceID.
 * Includes 증명사진 / 화보 / SNS 원본유지 variants.
 */
export function isPortraitKeepOriginalUse(
  useId: string | null | undefined
): useId is PortraitKeepOriginalUseId {
  return (
    useId === ID_PHOTO_KEEP_ORIGINAL_USE_ID ||
    useId === LOOKBOOK_KEEP_ORIGINAL_USE_ID ||
    useId === SNS_KEEP_ORIGINAL_USE_ID
  );
}

/** @deprecated Prefer isPortraitKeepOriginalUse — kept for call-site clarity. */
export function isIdPhotoKeepOriginalUse(
  useId: string | null | undefined
): boolean {
  return isPortraitKeepOriginalUse(useId);
}

/**
 * UI + layout isolation: AI portrait modes OR keep-original.
 * Skips Magic Layout text, locks 분야, filters BG examples.
 */
export function isPortraitPurposeUse(
  useId: string | null | undefined
): boolean {
  return isPortraitAiPurposeUse(useId) || isPortraitKeepOriginalUse(useId);
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

/** Extra negatives when pose ControlNet is disabled (화보 / SNS). */
export const PORTRAIT_FREE_POSE_NEGATIVE =
  "rigid selfie posture, locked original pose, stiff mugshot stance, identical reference pose, frozen front-facing posture, cutout paste composition, flat collage, rembg silhouette only";

export type PortraitInstantIdParams = {
  controlnet_selection?: "pose" | "canny" | "depth";
  controlnet_conditioning_scale: number;
  identity_controlnet_conditioning_scale: number;
  ip_adapter_scale: number;
  guidance_scale: number;
  num_inference_steps: number;
  enhance_face_region: boolean;
  /** Atomic prompt builder mode. */
  promptMode: "subject_studio" | "base_scene";
};

/**
 * Mode-dependent InstantID conditioning.
 * - 증명사진: strong pose + identity lock (standard ID composition)
 * - 화보 / SNS: disable pose/depth ControlNet; keep face IP-Adapter + IdentityNet
 */
export function portraitInstantIdParams(
  purpose: PortraitAiPurposeUseId | string | null | undefined
): PortraitInstantIdParams {
  if (purpose === "id-photo") {
    return {
      controlnet_selection: "pose",
      controlnet_conditioning_scale: 0.85,
      identity_controlnet_conditioning_scale: 0.9,
      ip_adapter_scale: 0.9,
      guidance_scale: 3.8,
      num_inference_steps: 30,
      enhance_face_region: true,
      promptMode: "subject_studio",
    };
  }

  // lookbook | sns — generative face-preserved img2img, free pose from prompt
  return {
    controlnet_conditioning_scale: 0,
    identity_controlnet_conditioning_scale: 0.75,
    ip_adapter_scale: 0.82,
    guidance_scale: 5.2,
    num_inference_steps: 32,
    enhance_face_region: true,
    promptMode: "base_scene",
  };
}

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
      "High-end fashion editorial pictorial — true generative InstantID synthesis, not a cutout collage.",
      "Invent a dynamic editorial pose, natural body angle, and creative composition from the scene prompt.",
      "Do not lock to the reference selfie posture or silhouette.",
      "Designer styling, dramatic professional lighting, polished fashion posing.",
      "Preserve exact facial identity — do not invent a new person.",
      body,
    ].join(" ");
  }
  if (useId === "sns") {
    return [
      "Friendly SNS profile portrait — generative face-preserved synthesis, not a cutout collage.",
      "Allow natural varied posture and flattering body angle guided by the prompt.",
      "Do not copy the reference selfie pose rigidly.",
      "Smart-casual styling, soft lighting, tasteful studio aesthetic.",
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

/**
 * Screen-26 generate CTA cost:
 * - FaceID 증명사진/화보/SNS → 50
 * - Keep-original + all other uses → 25 (background / rembg path)
 */
export function screen26GenerateCreditCost(
  useId: string | null | undefined
): number {
  if (isPortraitAiPurposeUse(useId)) {
    return FEATURE_CREDIT_COST.portraitGenerative;
  }
  return FEATURE_CREDIT_COST.aiBackground;
}

/** Dropdown suffix for FaceID 용도 items, e.g. "(50크레딧)". */
export function portraitUseCreditLabelSuffix(
  useId: string | null | undefined
): string | null {
  if (!isPortraitAiPurposeUse(useId)) return null;
  return `(${screen26GenerateCreditCost(useId)}크레딧)`;
}
