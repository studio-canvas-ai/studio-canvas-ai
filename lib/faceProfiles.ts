import { loadJson, saveJson, STORAGE_KEYS } from "@/lib/storage";
import {
  computeExpiresAt,
  isGalleryItemExpired,
  type RetentionContext,
} from "@/lib/retentionPolicy";
import { pricingPlanIds } from "@/lib/data";

export type SubscriptionPlanId = (typeof pricingPlanIds)[number];
export type PlanId = "free" | SubscriptionPlanId;

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

/** Gallery history with retention + R2 storage metadata (#75, #76) */
export type GalleryHistoryItem = {
  id: string;
  /** Thumbnail URL for list view (WebP ~600px) */
  imageUrl: string;
  thumbnailUrl?: string;
  /** R2 object key for on-demand HD original */
  originalKey?: string;
  storageId?: string;
  createdAt: number;
  styleId?: string;
  /** null = unlimited retention */
  expiresAt?: number | null;
  planAtCreation?: PlanId;
};

export function listGalleryHistory(): GalleryHistoryItem[] {
  const list = loadJson<GalleryHistoryItem[]>(STORAGE_KEYS.galleryHistory, []);
  const now = Date.now();
  const visible = list.filter((item) => !isGalleryItemExpired(item.expiresAt, now));
  if (visible.length !== list.length) {
    saveJson(STORAGE_KEYS.galleryHistory, visible);
  }
  return visible;
}

export function pushGalleryHistory(
  item: Omit<GalleryHistoryItem, "expiresAt">,
  ctx: RetentionContext
): GalleryHistoryItem {
  const full: GalleryHistoryItem = {
    ...item,
    thumbnailUrl: item.thumbnailUrl ?? item.imageUrl,
    expiresAt: computeExpiresAt(item.createdAt, ctx),
    planAtCreation: ctx.planId,
  };
  const list = [full, ...listGalleryHistory()].slice(0, 200);
  saveJson(STORAGE_KEYS.galleryHistory, list);
  return full;
}

export function deleteGalleryHistory(id: string) {
  const next = listGalleryHistory().filter((item) => item.id !== id);
  saveJson(STORAGE_KEYS.galleryHistory, next);
  return next;
}

/** Recompute expiry for all items after subscription cancel (#76). */
export function recalculateGalleryRetentionOnCancel(ctx: RetentionContext) {
  const list = loadJson<GalleryHistoryItem[]>(STORAGE_KEYS.galleryHistory, []);
  const next = list.map((item) => ({
    ...item,
    expiresAt: computeExpiresAt(item.createdAt, ctx),
  }));
  saveJson(STORAGE_KEYS.galleryHistory, next);
  return next;
}

export type AccountMeta = {
  cancelledAt?: number;
  lastLoginAt?: number;
  hadPaidPlan?: boolean;
  dormantNotifiedAt?: number;
  planId?: PlanId;
  lastPaidPlan?: SubscriptionPlanId;
};

export function getAccountMeta(): AccountMeta {
  return loadJson<AccountMeta>(STORAGE_KEYS.accountMeta, {});
}

export function patchAccountMeta(patch: Partial<AccountMeta>) {
  const next = { ...getAccountMeta(), ...patch };
  saveJson(STORAGE_KEYS.accountMeta, next);
  return next;
}
