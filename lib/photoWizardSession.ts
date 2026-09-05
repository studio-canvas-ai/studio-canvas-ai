import { PHOTO_WIZARD_PRODUCT } from "@/lib/wizard/wizardProduct";

export const PHOTO_WIZARD_SESSION_KEY = "sca_photo_wizard_v1";
export const PHOTO_STUDIO_PATH = PHOTO_WIZARD_PRODUCT.studioPath;

export const savePhotoWizardSession = PHOTO_WIZARD_PRODUCT.session.save;
export const readPhotoWizardSession = PHOTO_WIZARD_PRODUCT.session.read;
export const clearPhotoWizardSession = PHOTO_WIZARD_PRODUCT.session.clear;

export {
  defaultPhotoWizardState,
} from "@/lib/wizard/wizardProduct";
