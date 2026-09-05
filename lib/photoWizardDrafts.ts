import type { PrintWizardState } from "@/lib/printWizardTypes";
import { PHOTO_WIZARD_PRODUCT } from "@/lib/wizard/wizardProduct";

export type PhotoDraftMeta = import("@/lib/wizard/wizardDraftStorage").WizardDraftMeta;

export const savePhotoDraft = PHOTO_WIZARD_PRODUCT.drafts.saveDraft;
export const listPhotoDrafts = PHOTO_WIZARD_PRODUCT.drafts.listDrafts;
export const loadPhotoDraft = PHOTO_WIZARD_PRODUCT.drafts.loadDraft;
export const deletePhotoDraft = PHOTO_WIZARD_PRODUCT.drafts.deleteDraft;

export type { PrintWizardState };
