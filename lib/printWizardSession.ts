import {
  PRINT_WIZARD_SESSION_KEY,
  defaultPrintWizardState,
  fieldById,
  type PrintWizardState,
  type PrintWizardSpecPicks,
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
  PRINT_WIZARD_STUDIO_PATH,
  PRINT_WIZARD_PRODUCT,
} from "@/lib/wizard/wizardProduct";

export { PRINT_WIZARD_SESSION_KEY };
export const PRINT_STUDIO_PATH = PRINT_WIZARD_STUDIO_PATH;

export const savePrintWizardSession = PRINT_WIZARD_PRODUCT.session.save;
export const readPrintWizardSession = PRINT_WIZARD_PRODUCT.session.read;
export const clearPrintWizardSession = PRINT_WIZARD_PRODUCT.session.clear;

export {
  defaultPrintWizardState,
  fieldById,
  migrateCategoryToFormatUse,
  normalizeFieldId,
  normalizeFormatId,
  normalizeUseId,
};

export type {
  PrintWizardState,
  PrintWizardSpecPicks,
  PrintPageCount,
  PrintCustomSize,
  SmartInputValues,
};
