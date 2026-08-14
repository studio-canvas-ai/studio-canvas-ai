import {
  PRINT_WIZARD_SESSION_KEY,
  defaultPrintWizardState,
  type PrintWizardState,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
  type BgPresetId,
  type SmartInputValues,
  emptySmartInputValues,
  PRINT_FORMATS,
  PRINT_USES,
  PRINT_PAGE_COUNTS,
  BG_PRESETS,
  SMART_INPUT_FIELDS,
  migrateCategoryToFormatUse,
} from "@/lib/printWizardTypes";

export const PRINT_STUDIO_PATH = "/print-smart-form/studio";

function isFormatId(v: unknown): v is PrintFormatId {
  return typeof v === "string" && PRINT_FORMATS.some((f) => f.id === v);
}

function isUseId(v: unknown): v is PrintUseId {
  return typeof v === "string" && PRINT_USES.some((u) => u.id === v);
}

function isPageCount(v: unknown): v is PrintPageCount {
  return (
    typeof v === "number" &&
    PRINT_PAGE_COUNTS.some((p) => p.value === v)
  );
}

function isPresetId(v: unknown): v is BgPresetId {
  return typeof v === "string" && BG_PRESETS.some((p) => p.id === v);
}

function sanitizeInputs(raw: unknown): SmartInputValues {
  const base = emptySmartInputValues();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const field of SMART_INPUT_FIELDS) {
    const val = obj[field.id];
    if (typeof val === "string") base[field.id] = val;
  }
  return base;
}

export function savePrintWizardSession(state: PrintWizardState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PRINT_WIZARD_SESSION_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function readPrintWizardSession(): PrintWizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PRINT_WIZARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrintWizardState> & {
      categoryId?: string;
    };
    const defaults = defaultPrintWizardState();
    const migrated =
      !isFormatId(parsed.formatId) && typeof parsed.categoryId === "string"
        ? migrateCategoryToFormatUse(parsed.categoryId)
        : null;

    return {
      formatId: isFormatId(parsed.formatId)
        ? parsed.formatId
        : migrated?.formatId ?? defaults.formatId,
      useId: isUseId(parsed.useId)
        ? parsed.useId
        : migrated?.useId ?? defaults.useId,
      pageCount: isPageCount(parsed.pageCount)
        ? parsed.pageCount
        : defaults.pageCount,
      bgKeyword:
        typeof parsed.bgKeyword === "string"
          ? parsed.bgKeyword
          : defaults.bgKeyword,
      bgPresetId: isPresetId(parsed.bgPresetId) ? parsed.bgPresetId : null,
      backgroundUrl:
        typeof parsed.backgroundUrl === "string" && parsed.backgroundUrl
          ? parsed.backgroundUrl
          : null,
      mainPrompt:
        typeof parsed.mainPrompt === "string"
          ? parsed.mainPrompt
          : defaults.mainPrompt,
      selectedPromptPresetId:
        typeof parsed.selectedPromptPresetId === "string"
          ? parsed.selectedPromptPresetId
          : null,
      inputs: sanitizeInputs(parsed.inputs),
    };
  } catch {
    return null;
  }
}

export function clearPrintWizardSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PRINT_WIZARD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
