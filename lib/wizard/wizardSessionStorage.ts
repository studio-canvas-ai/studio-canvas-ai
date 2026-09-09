/**
 * Parameterized wizard session persistence (sessionStorage).
 * Print + Photo generators each use isolated keys.
 */
import {
  defaultPrintWizardState,
  fieldById,
  migrateCategoryToFormatUse,
  normalizeFieldId,
  normalizeFormatId,
  normalizeUseId,
  PRINT_PAGE_COUNTS,
  SMART_INPUT_FIELDS,
  emptySmartInputValues,
  type PrintWizardState,
  type PrintWizardSpecPicks,
  type PrintPageCount,
  type PrintCustomSize,
  type SmartInputValues,
} from "@/lib/printWizardTypes";
import {
  normalizeVisualStyleSelection,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";
import { sanitizeTextLayersByPage } from "@/lib/printWizardTextLayers";
import { sanitizeDecoLayersByPage } from "@/lib/printWizardDecoLayers";
import { sanitizePhotoLayersByPage } from "@/lib/printWizardPhotoLayers";
import { sanitizeBackgroundPans } from "@/lib/printWizardBg";

export type WizardSessionStorageConfig = {
  sessionKey: string;
  legacyKeys?: string[];
  defaultState?: () => PrintWizardState;
};

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

function sanitizeSpecPicks(
  raw: unknown,
  visualStyle: VisualStyleSelection
): PrintWizardSpecPicks {
  if (!raw || typeof raw !== "object") {
    return {
      format: true,
      style: Boolean(visualStyle.imageStyleId || visualStyle.moodStyleId),
      use: true,
      pages: true,
    };
  }
  const obj = raw as Record<string, unknown>;
  return {
    format: obj.format === true,
    style: obj.style === true,
    use: obj.use === true,
    pages: obj.pages === true,
  };
}

function parseWizardSessionRaw(
  raw: string,
  defaults: PrintWizardState
): PrintWizardState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PrintWizardState> & {
      categoryId?: string;
    };
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

    const base: PrintWizardState = {
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
      backgroundPansByPage: sanitizeBackgroundPans(
        (parsed as { backgroundPansByPage?: unknown }).backgroundPansByPage
      ),
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
      photoLayersByPage: sanitizePhotoLayersByPage(
        (parsed as { photoLayersByPage?: unknown }).photoLayersByPage
      ),
      decoLayersByPage: sanitizeDecoLayersByPage(
        (parsed as { decoLayersByPage?: unknown }).decoLayersByPage
      ),
      visualStyle: sanitizeVisualStyle(
        (parsed as { visualStyle?: unknown }).visualStyle
      ),
      wizardStep:
        parsed.wizardStep === 2 ? 2 : parsed.wizardStep === 1 ? 1 : 1,
      draftReady: parsed.draftReady === true,
      foldGuidesHidden: parsed.foldGuidesHidden === true,
    };
    return {
      ...base,
      specPicks: sanitizeSpecPicks(
        (parsed as { specPicks?: unknown }).specPicks,
        base.visualStyle
      ),
    };
  } catch {
    return null;
  }
}

export type WizardSessionStorage = {
  save: (state: PrintWizardState) => void;
  read: () => PrintWizardState | null;
  clear: () => void;
};

export function createWizardSessionStorage(
  config: WizardSessionStorageConfig
): WizardSessionStorage {
  const defaults = config.defaultState ?? defaultPrintWizardState;

  return {
    save(state: PrintWizardState) {
      if (typeof window === "undefined") return;
      try {
        sessionStorage.setItem(config.sessionKey, JSON.stringify(state));
      } catch {
        /* quota */
      }
    },
    read(): PrintWizardState | null {
      if (typeof window === "undefined") return null;
      try {
        const keys = [
          config.sessionKey,
          ...(config.legacyKeys ?? []),
        ];
        for (const key of keys) {
          const raw = sessionStorage.getItem(key);
          if (!raw) continue;
          const parsed = parseWizardSessionRaw(raw, defaults());
          if (parsed) return parsed;
        }
        return null;
      } catch {
        return null;
      }
    },
    clear() {
      if (typeof window === "undefined") return;
      try {
        sessionStorage.removeItem(config.sessionKey);
        for (const key of config.legacyKeys ?? []) {
          sessionStorage.removeItem(key);
        }
      } catch {
        /* ignore */
      }
    },
  };
}
