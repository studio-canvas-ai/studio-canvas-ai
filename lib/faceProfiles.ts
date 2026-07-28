import { loadJson, saveJson, STORAGE_KEYS } from "@/lib/storage";

export type FaceProfile = {
  id: string;
  name: string;
  slot: number;
  photoUrls: string[];
  createdAt: number;
  updatedAt: number;
};

export function listFaceProfiles(): FaceProfile[] {
  return loadJson<FaceProfile[]>(STORAGE_KEYS.faceProfiles, []);
}

export function saveFaceProfiles(profiles: FaceProfile[]) {
  saveJson(STORAGE_KEYS.faceProfiles, profiles);
}

export function upsertFaceProfile(profile: FaceProfile) {
  const list = listFaceProfiles();
  const idx = list.findIndex((p) => p.id === profile.id);
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  saveFaceProfiles(list);
  return list;
}

export function deleteFaceProfile(id: string) {
  const next = listFaceProfiles().filter((p) => p.id !== id);
  saveFaceProfiles(next);
  return next;
}

/** Permanently keep gallery history even after cancel (#57) */
export type GalleryHistoryItem = {
  id: string;
  imageUrl: string;
  createdAt: number;
  styleId?: string;
};

export function listGalleryHistory(): GalleryHistoryItem[] {
  return loadJson<GalleryHistoryItem[]>(STORAGE_KEYS.galleryHistory, []);
}

export function pushGalleryHistory(item: GalleryHistoryItem) {
  const list = [item, ...listGalleryHistory()].slice(0, 200);
  saveJson(STORAGE_KEYS.galleryHistory, list);
  return list;
}

export type AccountMeta = {
  cancelledAt?: number;
  lastLoginAt?: number;
  hadPaidPlan?: boolean;
  dormantNotifiedAt?: number;
};

export function getAccountMeta(): AccountMeta {
  return loadJson<AccountMeta>(STORAGE_KEYS.accountMeta, {});
}

export function patchAccountMeta(patch: Partial<AccountMeta>) {
  const next = { ...getAccountMeta(), ...patch };
  saveJson(STORAGE_KEYS.accountMeta, next);
  return next;
}
