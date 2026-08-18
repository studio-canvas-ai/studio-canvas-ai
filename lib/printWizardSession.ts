import {
  PRINT_WIZARD_SESSION_KEY,
  defaultPrintWizardState,
  fieldById,
  type PrintWizardState,
  type PrintPageCount,
  type PrintCustomSize,
  type SmartInputValues,
  emptySmartInputValues,
  PRINT_PAGE_COUNTS,
  SMART_INPUT_FIELDS,
  migrateCategoryToFormatUse,
  normalizeFormatId,
  normalizeUseId,
  normalizeFieldId,
} from "@/lib/printWizardTypes";
import {
  normalizeVisualStyleSelection,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";
import { sanitizeTextLayersByPage } from "@/lib/printWizardTextLayers";

export const PRINT_STUDIO_PATH = "/print-smart-form/studio";

function sanitizeVisualStyle(raw: unknown): VisualStyleSelection {
  if (!raw || typeof raw !== "object") {
    return normalizeVisualStyleSelection(null);
  }
  const obj = raw as Record<string, unknown>;
  return normalizeVisualStyleSelection({
    imageStyleId:
      typeof obj.imageStyleId === "string" ? obj.imageStyleId : null,
    moodStyleId: typeof obj.moodStyleId === "string" ? obj.moodStyleId : null,
  });
}

function isPageCount(v: unknown): v is PrintPageCount {
  return (
    typeof v === "number" && PRINT_PAGE_COUNTS.some((p) => p.value === v)
  );
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

function sanitizeCustomSize(raw: unknown): PrintCustomSize | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const unit = obj.unit === "inch" ? "inch" : obj.unit === "cm" ? "cm" : null;
  const width = typeof obj.width === "number" ? obj.width : Number(obj.width);
  const height =
    typeof obj.height === "number" ? obj.height : Number(obj.height);
  if (
    !unit ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { unit, width, height };
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
    const raw =
      sessionStorage.getItem(PRINT_WIZARD_SESSION_KEY) ??
      sessionStorage.getItem("sca_print_wizard_v4") ??
      sessionStorage.getItem("sca_print_wizard_v3");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrintWizardState> & {
      categoryId?: string;
    };
    const defaults = defaultPrintWizardState();
    const migrated =
      !normalizeFormatId(parsed.formatId) &&
      typeof parsed.categoryId === "string"
        ? migrateCategoryToFormatUse(parsed.categoryId)
        : null;

    const bgPresetId = normalizeFieldId(parsed.bgPresetId);
    let bgKeyword =
      typeof parsed.bgKeyword === "string"
        ? parsed.bgKeyword
        : defaults.bgKeyword;
    const presetKw = bgPresetId ? fieldById(bgPresetId)?.keyword : null;
    if (presetKw && bgKeyword.trim() === presetKw.trim()) {
      bgKeyword = "";
    }

    return {
      formatId:
        normalizeFormatId(parsed.formatId) ??
        migrated?.formatId ??
        defaults.formatId,
      useId:
        normalizeUseId(parsed.useId) ?? migrated?.useId ?? defaults.useId,
      pageCount: isPageCount(parsed.pageCount)
        ? parsed.pageCount
        : defaults.pageCount,
      bgKeyword,
      bgPresetId,
      backgroundUrl:
        typeof parsed.backgroundUrl === "string" && parsed.backgroundUrl
          ? parsed.backgroundUrl
          : null,
      backgroundUrls: Array.isArray(parsed.backgroundUrls)
        ? parsed.backgroundUrls.filter(
            (u): u is string => typeof u === "string" && Boolean(u)
          )
        : [],
      mainPrompt:
        typeof parsed.mainPrompt === "string"
          ? parsed.mainPrompt
          : defaults.mainPrompt,
      selectedPromptPresetId:
        typeof parsed.selectedPromptPresetId === "string"
          ? parsed.selectedPromptPresetId
          : null,
      customSize: sanitizeCustomSize(parsed.customSize),
      inputs: sanitizeInputs(parsed.inputs),
      textLayersByPage: sanitizeTextLayersByPage(
        (parsed as { textLayersByPage?: unknown }).textLayersByPage
      ),
      visualStyle: sanitizeVisualStyle(
        (parsed as { visualStyle?: unknown }).visualStyle
      ),
      wizardStep:
        parsed.wizardStep === 2 ? 2 : parsed.wizardStep === 1 ? 1 : 1,
      draftReady: parsed.draftReady === true,
      foldGuidesHidden: parsed.foldGuidesHidden === true,
    };
  } catch {
    return null;
  }
}

export function clearPrintWizardSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PRINT_WIZARD_SESSION_KEY);
    sessionStorage.removeItem("sca_print_wizard_v4");
    sessionStorage.removeItem("sca_print_wizard_v3");
  } catch {
    /* ignore */
  }
}
