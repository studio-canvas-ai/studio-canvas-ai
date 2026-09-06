/**
 * Screen-26 portrait purposes (증명사진 / 화보 / SNS):
 * lock background examples, disable 분야, skip Magic Layout text templates.
 */

export const PORTRAIT_PURPOSE_USE_IDS = [
  "id-photo",
  "lookbook",
  "sns",
] as const;

export type PortraitPurposeUseId = (typeof PORTRAIT_PURPOSE_USE_IDS)[number];

export const PORTRAIT_PURPOSE_BG_CATEGORY_ID = "portrait-suite";

export function isPortraitPurposeUse(
  useId: string | null | undefined
): useId is PortraitPurposeUseId {
  return (
    useId === "id-photo" || useId === "lookbook" || useId === "sns"
  );
}
