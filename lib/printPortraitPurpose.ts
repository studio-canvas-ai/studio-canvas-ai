/**
 * Screen-26 portrait purposes (증명사진 / 화보 / SNS):
 * lock background examples, disable 분야, skip Magic Layout text templates,
 * dual-mode studio pipeline (basic rembg vs generative FaceID).
 */

export const PORTRAIT_PURPOSE_USE_IDS = [
  "id-photo",
  "lookbook",
  "sns",
] as const;

export type PortraitPurposeUseId = (typeof PORTRAIT_PURPOSE_USE_IDS)[number];

export const PORTRAIT_PURPOSE_BG_CATEGORY_ID = "portrait-suite";

/** Mode A = fast rembg + studio plate; Mode B = generative FaceID (credits). */
export type PortraitStudioMode = "basic" | "generative";

/** Mid of directive range 15–20. */
export const PORTRAIT_GENERATIVE_CREDIT_COST = 18;

export function isPortraitPurposeUse(
  useId: string | null | undefined
): useId is PortraitPurposeUseId {
  return (
    useId === "id-photo" || useId === "lookbook" || useId === "sns"
  );
}

/** Default: ID photo → basic; pictorial / SNS → generative. */
export function defaultPortraitStudioMode(
  useId: string | null | undefined
): PortraitStudioMode {
  return useId === "id-photo" ? "basic" : "generative";
}

/** Purpose-specific generative prompt locks (Mode B). */
export function portraitGenerativePromptLock(
  useId: string | null | undefined
): string {
  if (useId === "id-photo") {
    return [
      "Professional studio ID photo.",
      "Force direct front-facing pose, facial symmetry, clean formal suit attire,",
      "solid clean studio backdrop, soft even lighting.",
      "Preserve exact facial identity — do not invent a new person.",
    ].join(" ");
  }
  if (useId === "lookbook") {
    return [
      "High-end fashion editorial pictorial.",
      "Designer styling, dramatic professional lighting, polished posing.",
      "Preserve exact facial identity — do not invent a new person.",
    ].join(" ");
  }
  if (useId === "sns") {
    return [
      "Friendly SNS profile portrait.",
      "Smart-casual posture, flattering soft lighting, tasteful blurred aesthetic background.",
      "Preserve exact facial identity — do not invent a new person.",
    ].join(" ");
  }
  return "Professional studio portrait. Preserve exact facial identity.";
}

/** Empty-plate lock for Mode A scenic generation (no people). */
export function portraitBasicScenicLock(
  useId: string | null | undefined
): string {
  if (useId === "id-photo") {
    return "Empty solid or soft-gradient studio ID-photo backdrop only — no people, no faces, no props.";
  }
  if (useId === "lookbook") {
    return "Empty high-end fashion studio or editorial location plate only — no people, no faces.";
  }
  if (useId === "sns") {
    return "Empty soft aesthetic / lightly blurred lifestyle backdrop only — no people, no faces.";
  }
  return "Empty studio backdrop only — no people, no faces.";
}
