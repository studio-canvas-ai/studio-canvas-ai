/**
 * Product configs for Print vs Photo wizard — isolated storage + routes.
 */
import {
  defaultPrintWizardState,
  emptySpecPicks,
  PRINT_WIZARD_SESSION_KEY,
  type PrintWizardState,
} from "@/lib/printWizardTypes";
import {
  createWizardDraftStorage,
  type WizardDraftStorage,
} from "@/lib/wizard/wizardDraftStorage";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import {
  createWizardSessionStorage,
  type WizardSessionStorage,
} from "@/lib/wizard/wizardSessionStorage";

export type WizardProductId = "print" | "photo";

export type WizardProductConfig = {
  id: WizardProductId;
  homePath: string;
  studioPath: string;
  pendingProjectKey: string;
  recentNamespace: RecentProjectNamespace;
  session: WizardSessionStorage;
  drafts: WizardDraftStorage;
  defaultState: () => PrintWizardState;
};

export const PRINT_WIZARD_HOME_PATH = "/print-smart-form";
export const PRINT_WIZARD_STUDIO_PATH = "/print-smart-form/studio";
export const PHOTO_WIZARD_HOME_PATH = "/ai-photo-generator";
export const PHOTO_WIZARD_STUDIO_PATH = "/ai-photo-generator/studio";

export const PRINT_PENDING_PROJECT_KEY = "sca_pending_studio_project_v1";
export const PHOTO_PENDING_PROJECT_KEY = "sca_photo_pending_studio_project_v1";

export function defaultPhotoWizardState(): PrintWizardState {
  return {
    ...defaultPrintWizardState(),
    formatId: "ratio-9-16",
    useId: "lookbook",
    pageCount: 1,
    // 화보는 단면 고정 — UI에서 장수/분야를 숨기므로 pages는 미리 충족
    specPicks: { ...emptySpecPicks(), pages: true },
  };
}

const printSession = createWizardSessionStorage({
  sessionKey: PRINT_WIZARD_SESSION_KEY,
  legacyKeys: ["sca_print_wizard_v4", "sca_print_wizard_v3"],
  defaultState: defaultPrintWizardState,
});

const printDrafts = createWizardDraftStorage({
  draftsKey: "sca_print_wizard_drafts_v1",
  changedEvent: "sca:print-drafts-changed",
  labelPrefix: "초안",
});

const photoSession = createWizardSessionStorage({
  sessionKey: "sca_photo_wizard_v1",
  defaultState: defaultPhotoWizardState,
});

const photoDrafts = createWizardDraftStorage({
  draftsKey: "sca_photo_wizard_drafts_v1",
  changedEvent: "sca:photo-drafts-changed",
  labelPrefix: "화보 초안",
});

export const PRINT_WIZARD_PRODUCT: WizardProductConfig = {
  id: "print",
  homePath: PRINT_WIZARD_HOME_PATH,
  studioPath: PRINT_WIZARD_STUDIO_PATH,
  pendingProjectKey: PRINT_PENDING_PROJECT_KEY,
  recentNamespace: "shared",
  session: printSession,
  drafts: printDrafts,
  defaultState: defaultPrintWizardState,
};

export const PHOTO_WIZARD_PRODUCT: WizardProductConfig = {
  id: "photo",
  homePath: PHOTO_WIZARD_HOME_PATH,
  studioPath: PHOTO_WIZARD_STUDIO_PATH,
  pendingProjectKey: PHOTO_PENDING_PROJECT_KEY,
  recentNamespace: "photo",
  session: photoSession,
  drafts: photoDrafts,
  defaultState: defaultPhotoWizardState,
};

export function getWizardProduct(id: WizardProductId): WizardProductConfig {
  return id === "photo" ? PHOTO_WIZARD_PRODUCT : PRINT_WIZARD_PRODUCT;
}
