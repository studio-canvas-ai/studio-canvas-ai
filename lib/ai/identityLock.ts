/**
 * Face & identity preservation controls for Fal Kontext / inpaint.
 * Face stays locked; pose may change when the user asks for action / hands / stance.
 */

export type IdentityLockParams = {
  /** Prompt suffix locking identity. */
  promptSuffix: string;
  /** Kontext CFG — lower sticks closer to reference image. */
  guidanceScale: number;
  /** Inpaint denoising strength (0.01–1). Lower = more identity keep. */
  strength: number;
  /** Prefer masked inpaint when maskUrl is provided. */
  preferMaskedInpaint: boolean;
  /** Re-use subject as reference_image_url for identity. */
  useSubjectAsReference: boolean;
  enhancePrompt: boolean;
};

export const DEFAULT_IDENTITY_LOCK: IdentityLockParams = {
  promptSuffix:
    "Keep the exact same person identity, face, facial features, skin tone, hairline, and body proportions. Only change the requested clothing or local region. Photorealistic, high detail.",
  guidanceScale: 2.8,
  /** ~0.72 balances wardrobe change vs face lock on Kontext inpaint. */
  strength: 0.72,
  preferMaskedInpaint: true,
  useSubjectAsReference: true,
  enhancePrompt: false,
};

/** Wardrobe / clothing edits — stronger identity lock, moderate strength. */
export const WARDROBE_IDENTITY_LOCK: IdentityLockParams = {
  ...DEFAULT_IDENTITY_LOCK,
  guidanceScale: 2.5,
  strength: 0.68,
  promptSuffix:
    "IDENTITY LOCK: preserve the exact same face, eyes, nose, mouth, jawline, hair, and skin tone. Change only the clothing / outfit described in the editable upper region. Keep the style and clothing of the lower body consistent. Seamless waistline blend. Do not redraw or morph the face. Photorealistic.",
};

/**
 * Pose / action edits — lock face identity, ALLOW pose / hands / arms to change.
 * Background is frozen by the black mask region, not by this suffix.
 */
export const POSE_IDENTITY_LOCK: IdentityLockParams = {
  ...DEFAULT_IDENTITY_LOCK,
  guidanceScale: 2.6,
  strength: 0.84,
  promptSuffix:
    "IDENTITY LOCK: preserve the exact same face, eyes, nose, mouth, jawline, hair, and skin tone. The person may change pose, hand position, and arm position as requested. Do not morph the face. Photorealistic.",
};

export function isWardrobeEditPrompt(englishPrompt: string): boolean {
  return /(suit|tuxedo|dress|outfit|clothes|clothing|wardrobe|jacket|tie|hanbok|양장|정장|옷|한복|복장|의상)/i.test(
    englishPrompt
  );
}

export function isPoseEditPrompt(englishPrompt: string): boolean {
  return /(손|두손|팔|포즈|자세|들고|들어|올려|앉아|서\s*있|걷|뛰|춤|pose|hand|arm|sit|stand|hold|raise|wave|gesture|action)/i.test(
    englishPrompt
  );
}

export function resolveIdentityLock(englishPrompt: string): IdentityLockParams {
  if (isPoseEditPrompt(englishPrompt)) return POSE_IDENTITY_LOCK;
  if (isWardrobeEditPrompt(englishPrompt)) return WARDROBE_IDENTITY_LOCK;
  return DEFAULT_IDENTITY_LOCK;
}

export function applyIdentityLockPrompt(
  englishPrompt: string,
  lock: IdentityLockParams = resolveIdentityLock(englishPrompt)
): string {
  const core = englishPrompt.trim();
  if (/identity lock|keep the (exact )?same (person|face)/i.test(core)) {
    // Already has identity language — still strip conflicting "keep pose" if pose edit.
    if (isPoseEditPrompt(core) && /keep[^.]*pose/i.test(core)) {
      return `${core.replace(/keep[^.]*pose[^.]*\./gi, "").trim()} ${lock.promptSuffix}`;
    }
    return core;
  }
  return `${core}. ${lock.promptSuffix}`;
}
