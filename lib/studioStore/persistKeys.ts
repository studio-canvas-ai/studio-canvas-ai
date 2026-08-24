/**
 * Studio persist keys — never deleted on logout / auth purge.
 * Browser storage is a cache; Supabase + R2 are the source of truth.
 */

export const STUDIO_PERSIST_KEY_PREFIXES = [
  "studio_canvas_",
  "sca_photo",
  "sca_recent",
  "sca_print_wizard",
  "sca_face_profiles",
  "sca_generate_photos",
  "sca_pending_studio",
  "sca_photo_pending",
  "sca_photo_wizard",
  "sca_train_selection",
  "sca_result_session",
  "sca_selected_result",
  "sca_gallery_history",
  "sca_shorts_",
] as const;

export function isProtectedStudioStorageKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  const lower = k.toLowerCase();
  for (const prefix of STUDIO_PERSIST_KEY_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) return true;
  }
  if (lower.includes("wizard") && lower.startsWith("sca_")) return true;
  return false;
}

export type StudioStoreCounts = {
  recentShared: number;
  recentPhoto: number;
  uploadVault: number;
  trainedVault: number;
};

export function studioBundleCounts(bundle: {
  recentShared: unknown[];
  recentPhoto: unknown[];
  uploadVault: unknown[];
  trainedVault: unknown[];
}): StudioStoreCounts {
  return {
    recentShared: bundle.recentShared.length,
    recentPhoto: bundle.recentPhoto.length,
    uploadVault: bundle.uploadVault.length,
    trainedVault: bundle.trainedVault.length,
  };
}

export function studioBundleIsEmpty(bundle: {
  recentShared: unknown[];
  recentPhoto: unknown[];
  uploadVault: unknown[];
  trainedVault: unknown[];
}): boolean {
  return !studioCountsNonEmpty(studioBundleCounts(bundle));
}

export function studioCountsNonEmpty(c: StudioStoreCounts): boolean {
  return (
    c.recentShared > 0 ||
    c.recentPhoto > 0 ||
    c.uploadVault > 0 ||
    c.trainedVault > 0
  );
}

/** Kinds the client sent empty while the cloud copy still has rows. */
export function preservedCloudKinds(
  incoming: {
    recentShared: unknown[];
    recentPhoto: unknown[];
    uploadVault: unknown[];
    trainedVault: unknown[];
  },
  existing: {
    recentShared: unknown[];
    recentPhoto: unknown[];
    uploadVault: unknown[];
    trainedVault: unknown[];
  }
): Array<keyof StudioStoreCounts> {
  const kept: Array<keyof StudioStoreCounts> = [];
  if (incoming.recentShared.length === 0 && existing.recentShared.length > 0) {
    kept.push("recentShared");
  }
  if (incoming.recentPhoto.length === 0 && existing.recentPhoto.length > 0) {
    kept.push("recentPhoto");
  }
  if (incoming.uploadVault.length === 0 && existing.uploadVault.length > 0) {
    kept.push("uploadVault");
  }
  if (incoming.trainedVault.length === 0 && existing.trainedVault.length > 0) {
    kept.push("trainedVault");
  }
  return kept;
}
