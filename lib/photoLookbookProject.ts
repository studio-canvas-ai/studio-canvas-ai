/**
 * Photo lookbook (.sca) extras — wizard session + vaults for recent restore.
 */

import {
  listTrainedVault,
  listUploadVault,
  replaceTrainedVault,
  replaceUploadVault,
  type PhotoVaultItem,
} from "@/lib/photoVaultStorage";
import { mergeVaultItems } from "@/lib/studioStore/merge";
import {
  compositePrintWizardPageBlob,
  printWizardHasExportableFrame,
} from "@/lib/printWizardComposite";
import type { PrintWizardState } from "@/lib/printWizardTypes";

export const PHOTO_LOOKBOOK_SNAPSHOT_VERSION = 1 as const;

export type PhotoLookbookSnapshot = {
  version: typeof PHOTO_LOOKBOOK_SNAPSHOT_VERSION;
  wizard: PrintWizardState;
  uploadVault: PhotoVaultItem[];
  trainedVault: PhotoVaultItem[];
};

export function capturePhotoLookbookSnapshot(
  wizard: PrintWizardState
): PhotoLookbookSnapshot {
  return {
    version: PHOTO_LOOKBOOK_SNAPSHOT_VERSION,
    wizard: JSON.parse(JSON.stringify(wizard)) as PrintWizardState,
    uploadVault: listUploadVault(),
    trainedVault: listTrainedVault(),
  };
}

export function isPhotoLookbookSnapshot(
  raw: unknown
): raw is PhotoLookbookSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    o.version === PHOTO_LOOKBOOK_SNAPSHOT_VERSION &&
    Boolean(o.wizard) &&
    typeof o.wizard === "object" &&
    Array.isArray(o.uploadVault) &&
    Array.isArray(o.trainedVault)
  );
}

export function applyPhotoLookbookSnapshot(snapshot: PhotoLookbookSnapshot): {
  wizard: PrintWizardState;
} {
  const upload = mergeVaultItems(listUploadVault(), snapshot.uploadVault ?? []);
  const trained = mergeVaultItems(listTrainedVault(), snapshot.trainedVault ?? []);
  if (upload.length) replaceUploadVault(upload);
  if (trained.length) replaceTrainedVault(trained);
  const wizard: PrintWizardState = {
    ...snapshot.wizard,
    wizardStep: 1,
  };
  return { wizard };
}

/** Rasterize current lookbook page (bg + photos + text layers). */
export async function compositePhotoLookbookBlob(opts: {
  state: PrintWizardState;
  pageIndex?: number;
  quality: "standard" | "high";
}): Promise<Blob> {
  return compositePrintWizardPageBlob(opts);
}

export function photoLookbookHasExportableFrame(
  state: PrintWizardState
): boolean {
  return printWizardHasExportableFrame(state);
}
