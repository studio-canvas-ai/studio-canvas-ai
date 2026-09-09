/**
 * Dual-mode studio architecture.
 *
 * - utility: AI Template Studio — fast cutout / scenic bg / download
 * - agent:   Print Smart Form — Form-to-Design + identity edits + print export
 */

export type StudioCoreMode = "utility" | "agent";

export const STUDIO_CORE_MODES = ["utility", "agent"] as const;

export function resolveStudioMode(
  raw?: string | null
): StudioCoreMode {
  const v = (raw || "").trim().toLowerCase();
  if (v === "agent" || v === "print" || v === "print-agent") return "agent";
  return "utility";
}

export type StudioModeProfile = {
  mode: StudioCoreMode;
  /** Accept Form-to-Design text layers (never burned into Flux). */
  formToDesign: boolean;
  /** Prefer identity-lock edit / inpaint for wardrobe changes. */
  identityLock: boolean;
  /** Offer High-DPI + R2 print-ready export. */
  printReadyExport: boolean;
  /** Allow multi-page print session seeding. */
  multiPage: boolean;
  label: string;
};

export function studioModeProfile(mode: StudioCoreMode): StudioModeProfile {
  if (mode === "agent") {
    return {
      mode: "agent",
      formToDesign: true,
      identityLock: true,
      printReadyExport: true,
      multiPage: true,
      label: "AI 1분 인쇄물 에이전트",
    };
  }
  return {
    mode: "utility",
    formToDesign: false,
    identityLock: true,
    printReadyExport: true,
    multiPage: false,
    label: "AI 템플릿 스튜디오",
  };
}
