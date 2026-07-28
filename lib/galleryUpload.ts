import type { PlanId } from "@/lib/faceProfiles";
import { getAccountMeta } from "@/lib/faceProfiles";

export type GalleryUploadResult = {
  id: string;
  thumbnailUrl: string;
  imageUrl: string;
  thumbnailKey?: string;
  originalKey?: string;
  storageId?: string;
  originalAvailable: boolean;
  expiresAt: number | null;
};

/** Upload generated image through R2 dual-compression pipeline (#75). */
export async function uploadGalleryAsset(
  imageUrl: string,
  id: string,
  planId: PlanId
): Promise<GalleryUploadResult | null> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const meta = getAccountMeta();
    const fd = new FormData();
    fd.append("file", blob, `${id}.jpg`);
    fd.append("id", id);
    fd.append("planId", planId);
    if (meta.cancelledAt) fd.append("cancelledAt", String(meta.cancelledAt));
    if (meta.lastPaidPlan) fd.append("lastPaidPlan", meta.lastPaidPlan);

    const upload = await fetch("/api/storage/upload", { method: "POST", body: fd });
    if (!upload.ok) return null;
    return (await upload.json()) as GalleryUploadResult;
  } catch {
    return null;
  }
}

/** Fetch on-demand HD original for download (#75). */
export async function fetchOriginalAsset(storageId: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/storage/original/${encodeURIComponent(storageId)}`);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
