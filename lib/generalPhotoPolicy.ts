import type { PlanId } from "@/lib/faceProfiles";
import { hasUnlimitedProfileSlots } from "@/lib/unlimitedAccount";

/** Free tier: storage + lifetime download caps. */
export const FREE_GENERAL_PHOTO_STORAGE_LIMIT = 3;
export const FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT = 3;
export const FREE_GENERAL_PHOTO_DOWNLOAD_CREDIT_COST = 1;

/** Paid plan storage caps (subscription period — independent of credits). */
export const PLAN_GENERAL_PHOTO_LIMITS: Record<
  Exclude<PlanId, "free">,
  number
> = {
  starter: 50,
  standard: 150,
  pro: 300,
  enterprise: 500,
};

export function generalPhotoStorageLimit(
  planId: PlanId,
  email?: string | null
): number {
  if (hasUnlimitedProfileSlots(email)) return 9999;
  if (planId === "free") return FREE_GENERAL_PHOTO_STORAGE_LIMIT;
  return PLAN_GENERAL_PHOTO_LIMITS[planId] ?? FREE_GENERAL_PHOTO_STORAGE_LIMIT;
}

export function isFreeGeneralPhotoPlan(planId: PlanId): boolean {
  return planId === "free";
}

export function freeDownloadRemaining(
  planId: PlanId,
  downloadCount: number,
  email?: string | null
): number | null {
  if (hasUnlimitedProfileSlots(email)) return null;
  if (!isFreeGeneralPhotoPlan(planId)) return null;
  return Math.max(0, FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT - downloadCount);
}
