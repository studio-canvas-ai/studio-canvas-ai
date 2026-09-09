/**
 * Print-ready blueprints — cut/safe guides (always) + fold lines (conditional).
 */

import {
  applyAutoLayoutState,
  BLEED_MM,
  SAFE_MM,
  formatPhysicalSize,
  resolveUseProfile,
} from "@/lib/ai/autoLayoutEngine";
import type { PrintWizardState } from "@/lib/printWizardTypes";
import type {
  PrintFormatId,
  PrintPageCount,
  PrintUseId,
} from "@/lib/printWizardTypes";

export type FoldLine = {
  /** "x" = horizontal line, "y" = vertical line */
  axis: "x" | "y";
  /** Normalized position 0–1 along the perpendicular axis */
  position: number;
};

export type PrintBlueprint = {
  id: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeMarginMm: number;
  foldLines: FoldLine[];
};

export const INVITATION_FORMAT_IDS = [
  "invite-square-150",
  "invite-postcard-100x150",
] as const;

export type InvitationFormatId = (typeof INVITATION_FORMAT_IDS)[number];

/** Faces that imply physical folding — 4면, 6면, 8면… (not 단면/양면). */
export function shouldShowFoldLines(pageCount: PrintPageCount): boolean {
  return pageCount >= 4;
}

export function isInvitationFormatId(id: string): id is InvitationFormatId {
  return (INVITATION_FORMAT_IDS as readonly string[]).includes(id);
}

export function isInvitationContext(
  formatId: PrintFormatId | string,
  useId: PrintUseId | string
): boolean {
  return useId === "invitation" || isInvitationFormatId(formatId);
}

/** Cut / safe guides always visible on the preview canvas. */
export function shouldShowPrintBlueprint(
  _formatId: PrintFormatId | string,
  _useId: PrintUseId | string
): boolean {
  return true;
}

function resolveFoldLines(
  pageCount: PrintPageCount,
  widthMm: number,
  heightMm: number,
  useId: PrintUseId
): FoldLine[] {
  if (!shouldShowFoldLines(pageCount)) return [];

  const profile = resolveUseProfile(useId);
  const portrait = heightMm >= widthMm;

  if (pageCount === 4) {
    if (profile.distribution === "tri-fold" || useId === "pamphlet") {
      return [
        { axis: "y", position: 1 / 3 },
        { axis: "y", position: 2 / 3 },
      ];
    }
    return [{ axis: portrait ? "x" : "y", position: 0.5 }];
  }

  if (pageCount === 6) {
    return [
      { axis: "y", position: 1 / 3 },
      { axis: "y", position: 2 / 3 },
    ];
  }

  if (pageCount === 8) {
    return [
      { axis: "y", position: 0.25 },
      { axis: "y", position: 0.5 },
      { axis: "y", position: 0.75 },
    ];
  }

  const foldCount = Math.max(1, Math.floor(pageCount / 2) - 1);
  return Array.from({ length: foldCount }, (_, index) => ({
    axis: portrait ? ("x" as const) : ("y" as const),
    position: (index + 1) / (foldCount + 1),
  }));
}

export function resolvePrintBlueprint(
  formatId: PrintFormatId | string,
  useId: PrintUseId | string,
  pageCount: PrintPageCount,
  _pageIndex = 0,
  customSize?: import("@/lib/printWizardTypes").PrintCustomSize | null
): PrintBlueprint | null {
  const { widthMm, heightMm } = formatPhysicalSize(
    formatId as PrintFormatId,
    customSize ?? null
  );

  const foldLines = resolveFoldLines(
    pageCount,
    widthMm,
    heightMm,
    useId as PrintUseId
  );

  return {
    id: `${formatId}-${useId}-${pageCount}`,
    widthMm,
    heightMm,
    bleedMm: BLEED_MM,
    safeMarginMm: SAFE_MM,
    foldLines,
  };
}

/** Apply auto-layout engine when wizard specs change. */
export function mergeInvitationBlueprint(
  state: PrintWizardState,
  overrides: Partial<
    Pick<
      PrintWizardState,
      "formatId" | "useId" | "pageCount" | "customSize" | "foldGuidesHidden"
    >
  >
): PrintWizardState {
  const pageCount = overrides.pageCount ?? state.pageCount;
  const next = applyAutoLayoutState(state, overrides);

  const foldSpecChanged =
    overrides.pageCount !== undefined ||
    overrides.formatId !== undefined ||
    overrides.useId !== undefined;

  let foldGuidesHidden = overrides.foldGuidesHidden ?? state.foldGuidesHidden;
  if (foldSpecChanged && shouldShowFoldLines(pageCount)) {
    foldGuidesHidden = false;
  }
  if (!shouldShowFoldLines(pageCount)) {
    foldGuidesHidden = false;
  }

  return { ...next, foldGuidesHidden: foldGuidesHidden ?? false };
}

export { applyAutoLayoutState };
