import {
  FREE_GENERAL_PHOTO_DOWNLOAD_CREDIT_COST,
  FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT,
  FREE_GENERAL_PHOTO_STORAGE_LIMIT,
  PLAN_GENERAL_PHOTO_LIMITS,
  generalPhotoStorageLimit,
} from "@/lib/generalPhotoPolicy";

export type GeneralPhoto = {
  id: string;
  imageUrl: string;
  name?: string;
  createdAt: number;
  storageKey?: string | null;
};

export type GeneralPhotoQuota = {
  planId: string;
  used: number;
  limit: number;
  remaining: number;
  freePlan: boolean;
  downloadCount: number | null;
  downloadLimit: number | null;
  downloadRemaining: number | null;
  downloadCreditCost: number;
};

export const GENERAL_PHOTOS_UPDATED_EVENT = "sca-general-photos-updated";

/** @deprecated Use plan quota from API — kept for legacy call sites. */
export const GENERAL_PHOTOS_SOFT_MAX = FREE_GENERAL_PHOTO_STORAGE_LIMIT;

export {
  FREE_GENERAL_PHOTO_DOWNLOAD_CREDIT_COST,
  FREE_GENERAL_PHOTO_DOWNLOAD_LIMIT,
  FREE_GENERAL_PHOTO_STORAGE_LIMIT,
  PLAN_GENERAL_PHOTO_LIMITS,
  generalPhotoStorageLimit,
};

export function notifyGeneralPhotosUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GENERAL_PHOTOS_UPDATED_EVENT));
}

export async function fetchGeneralPhotos(): Promise<{
  photos: GeneralPhoto[];
  quota: GeneralPhotoQuota | null;
  error?: string;
  status?: number;
}> {
  try {
    const res = await fetch("/api/general-photos", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      photos?: GeneralPhoto[];
      quota?: GeneralPhotoQuota | null;
      error?: string;
    };
    if (!res.ok) {
      return {
        photos: [],
        quota: data.quota ?? null,
        error: data.error ?? "fetch_failed",
        status: res.status,
      };
    }
    return {
      photos: Array.isArray(data.photos) ? data.photos : [],
      quota: data.quota ?? null,
    };
  } catch {
    return { photos: [], quota: null, error: "network_error" };
  }
}

export async function fetchGeneralPhoto(
  id: string
): Promise<GeneralPhoto | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`/api/general-photos/${encodeURIComponent(trimmed)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { photo?: GeneralPhoto };
    return data.photo ?? null;
  } catch {
    return null;
  }
}

/** @deprecated Prefer fetchGeneralPhoto — sync local lookup no longer used. */
export function getGeneralPhoto(_id: string): GeneralPhoto | null {
  return null;
}

export async function uploadGeneralPhotoFile(
  file: File,
  name?: string,
  opts?: { silent?: boolean }
): Promise<{
  ok: boolean;
  photo?: GeneralPhoto;
  error?: string;
  message?: string;
  status?: number;
  quota?: { used: number; limit: number; remaining?: number };
}> {
  const fd = new FormData();
  fd.append("file", file, file.name || "photo.webp");
  if (name) fd.append("name", name);

  try {
    const res = await fetch("/api/general-photos", {
      method: "POST",
      credentials: "same-origin",
      body: fd,
    });
    const data = (await res.json()) as {
      photo?: GeneralPhoto;
      error?: string;
      message?: string;
      quota?: { used: number; limit: number; remaining?: number };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error,
        message: data.message,
        status: res.status,
        quota: data.quota,
      };
    }
    if (!opts?.silent) notifyGeneralPhotosUpdated();
    return { ok: true, photo: data.photo, quota: data.quota };
  } catch {
    return { ok: false, error: "network_error", message: "network_error" };
  }
}

export async function deleteGeneralPhotoRemote(id: string): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/general-photos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      let error = "delete_failed";
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) error = data.error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }
    notifyGeneralPhotosUpdated();
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function authorizeGeneralPhotoDownload(id: string): Promise<{
  ok: boolean;
  imageUrl?: string;
  name?: string;
  creditsAfter?: number;
  creditCharged?: number;
  downloadRemaining?: number | null;
  error?: string;
  message?: string;
  status?: number;
}> {
  try {
    const res = await fetch(
      `/api/general-photos/${encodeURIComponent(id)}/download`,
      { method: "POST", credentials: "same-origin" }
    );
    const data = (await res.json()) as {
      imageUrl?: string;
      name?: string;
      creditsAfter?: number;
      creditCharged?: number;
      downloadRemaining?: number | null;
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error,
        message: data.message,
        status: res.status,
      };
    }
    return {
      ok: true,
      imageUrl: data.imageUrl,
      name: data.name,
      creditsAfter: data.creditsAfter,
      creditCharged: data.creditCharged,
      downloadRemaining: data.downloadRemaining,
    };
  } catch {
    return { ok: false, error: "network_error", message: "network_error" };
  }
}
