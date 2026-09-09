/**
 * Print Wizard — Temporary Draft FIFO storage.
 */
import type { PrintWizardState } from "@/lib/printWizardTypes";
import { PRINT_WIZARD_PRODUCT } from "@/lib/wizard/wizardProduct";

export type PrintDraftMeta = import("@/lib/wizard/wizardDraftStorage").WizardDraftMeta;

export const savePrintDraft = PRINT_WIZARD_PRODUCT.drafts.saveDraft;
export const listPrintDrafts = PRINT_WIZARD_PRODUCT.drafts.listDrafts;
export const loadPrintDraft = PRINT_WIZARD_PRODUCT.drafts.loadDraft;
export const deletePrintDraft = PRINT_WIZARD_PRODUCT.drafts.deleteDraft;

export type { PrintWizardState };
