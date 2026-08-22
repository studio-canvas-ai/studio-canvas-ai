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

export const FACE_PROFILES_UPDATED_EVENT = "sca-face-profiles-updated";

export function notifyFaceProfilesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FACE_PROFILES_UPDATED_EVENT));
}

export function listFaceProfiles(): FaceProfile[] {
  return loadJson<FaceProfile[]>(STORAGE_KEYS.faceProfiles, []);
}

export function getFaceProfile(id: string): FaceProfile | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  return listFaceProfiles().find((p) => p.id === trimmed) ?? null;
}

/** Drop dead blob: URLs; keep only renderable data:/http(s) entries. */
export function sanitizeFaceProfilePhotos(profiles: FaceProfile[]): FaceProfile[] {
  return profiles
    .map((p) => ({
      ...p,
      photoUrls: (p.photoUrls ?? []).filter(
        (u) =>
          typeof u === "string" &&
          (u.startsWith("data:image/") ||
            u.startsWith("https://") ||
            u.startsWith("http://"))
      ),
    }))
    .filter((p) => p.photoUrls.length > 0);
}

export function saveFaceProfiles(profiles: FaceProfile[]) {
  saveJson(STORAGE_KEYS.faceProfiles, sanitizeFaceProfilePhotos(profiles));
  notifyFaceProfilesUpdated();
}

/** Prefer cloud profiles; migrate local-only rows after login. */
export async function fetchFaceProfilesFromServer(): Promise<FaceProfile[]> {
  const local = sanitizeFaceProfilePhotos(listFaceProfiles());
  try {
    const res = await fetch("/api/face-profiles", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return local;
    const data = (await res.json()) as { profiles?: FaceProfile[] };
    const remote = sanitizeFaceProfilePhotos(
      Array.isArray(data.profiles) ? data.profiles : []
    );
    const remoteIds = new Set(remote.map((p) => p.id));

    // Push any local-only profiles that never synced (pre-cloud / offline).
    const pending = local.filter((p) => !remoteIds.has(p.id));
    for (const profile of pending) {
      await syncFaceProfileToServer(profile);
    }

    if (pending.length) {
      const retry = await fetch("/api/face-profiles", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (retry.ok) {
        const again = (await retry.json()) as { profiles?: FaceProfile[] };
        const merged = sanitizeFaceProfilePhotos(
          Array.isArray(again.profiles) ? again.profiles : remote
        );
        saveFaceProfiles(merged);
        return merged;
      }
    }

    saveFaceProfiles(remote);
    return remote;
  } catch {
    return local;
  }
}

export async function syncFaceProfileToServer(
  profile: FaceProfile
): Promise<FaceProfile | null> {
  try {
    const res = await fetch("/api/face-profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: profile.id,
        name: profile.name,
        slot: profile.slot,
        photoUrls: profile.photoUrls,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: FaceProfile };
    return data.profile ?? profile;
  } catch {
    return null;
  }
}

export function upsertFaceProfile(profile: FaceProfile) {
  const list = listFaceProfiles();
  const idx = list.findIndex((p) => p.id === profile.id);
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  saveFaceProfiles(list);
  void syncFaceProfileToServer(profile).then((remote) => {
    if (!remote) return;
    const next = listFaceProfiles();
    const i = next.findIndex((p) => p.id === remote.id);
    if (i >= 0) next[i] = { ...next[i], ...remote, photoUrls: remote.photoUrls };
    else next.push(remote);
    saveFaceProfiles(sanitizeFaceProfilePhotos(next));
  });
  return list;
}

export async function upsertFaceProfileAndSync(
  profile: FaceProfile
): Promise<FaceProfile[]> {
  const list = listFaceProfiles();
  const idx = list.findIndex((p) => p.id === profile.id);
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  saveFaceProfiles(list);

  const remote = await syncFaceProfileToServer(profile);
  if (remote) {
    const next = listFaceProfiles();
    const i = next.findIndex((p) => p.id === remote.id);
    if (i >= 0) next[i] = { ...next[i], ...remote, photoUrls: remote.photoUrls };
    else next.push(remote);
    const cleaned = sanitizeFaceProfilePhotos(next);
    saveFaceProfiles(cleaned);
    return cleaned;
  }
  return sanitizeFaceProfilePhotos(list);
}

/**
 * Local-only removal (no API). Prefer {@link deleteFaceProfileRemote} from UI
 * so the server delete finishes before FACE_PROFILES_UPDATED re-syncs.
 */
export function deleteFaceProfile(id: string) {
  const next = listFaceProfiles().filter((p) => p.id !== id);
  saveFaceProfiles(next);
  return next;
}

/** Awaitable vault delete — server + local, same pattern as general photos. */
export async function deleteFaceProfileRemote(id: string): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "id_required" };

  try {
    const res = await fetch(
      `/api/face-profiles?id=${encodeURIComponent(trimmed)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
      }
    );
    if (!res.ok && res.status !== 404) {
      let error = "delete_failed";
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) error = data.error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }

    // Remove locally only after server ack (or already-gone) so the
    // FACE_PROFILES_UPDATED listener cannot resurrect the row from R2.
    deleteFaceProfile(trimmed);
    return { ok: true, status: res.status };
  } catch {
    return { ok: false, error: "network_error" };
  }
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
  /** Face/object profile linked when saved from direct edit */
  profileId?: string;
  profileName?: string;
  /** Original training selfies linked to this finished work (never the work URL itself). */
  selfieUrls?: string[];
  /** null = unlimited retention */
  expiresAt?: number | null;
  planAtCreation?: PlanId;
};

/** Fired after local gallery history mutates (same-tab refresh). */
export const GALLERY_UPDATED_EVENT = "sca-gallery-updated";

export function notifyGalleryUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GALLERY_UPDATED_EVENT));
}

function syncGalleryWorkToServer(item: GalleryHistoryItem): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return fetch("/api/gallery-works", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: item.id,
      imageUrl: item.imageUrl,
      thumbnailUrl: item.thumbnailUrl ?? item.imageUrl,
      originalKey: item.originalKey,
      storageId: item.storageId ?? item.id,
      createdAt: item.createdAt,
      styleId: item.styleId,
      profileId: item.profileId,
      profileName: item.profileName,
      selfieUrls: item.selfieUrls?.length ? item.selfieUrls.slice(0, 10) : undefined,
      expiresAt: item.expiresAt ?? null,
      planAtCreation: item.planAtCreation,
    }),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

export function listGalleryHistory(): GalleryHistoryItem[] {
  const list = loadJson<GalleryHistoryItem[]>(STORAGE_KEYS.galleryHistory, []);
  const now = Date.now();
  const visible = list.filter((item) => !isGalleryItemExpired(item.expiresAt, now));
  if (visible.length !== list.length) {
    saveJson(STORAGE_KEYS.galleryHistory, visible);
  }
  return visible;
}

/** Prefer cloud works; migrate any local-only rows to the server. */
export async function fetchGalleryHistoryFromServer(): Promise<GalleryHistoryItem[]> {
  const local = listGalleryHistory();
  try {
    const res = await fetch("/api/gallery-works", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return local;
    const data = (await res.json()) as { works?: GalleryHistoryItem[] };
    const remote = Array.isArray(data.works) ? data.works : [];
    const remoteIds = new Set(remote.map((w) => w.id));

    // Re-upload local-only items that never made it to R2 (pre-fix / race).
    const pending = local.filter((item) => !remoteIds.has(item.id));
    if (pending.length) {
      await Promise.all(pending.map((item) => syncGalleryWorkToServer(item)));
      if (pending.length) {
        const retry = await fetch("/api/gallery-works", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (retry.ok) {
          const again = (await retry.json()) as { works?: GalleryHistoryItem[] };
          const merged = Array.isArray(again.works) ? again.works : remote;
          saveJson(STORAGE_KEYS.galleryHistory, merged.slice(0, 200));
          return merged;
        }
      }
    }

    // Server is source of truth after auth (including empty).
    saveJson(STORAGE_KEYS.galleryHistory, remote.slice(0, 200));
    return remote;
  } catch {
    return local;
  }
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
  const list = [full, ...listGalleryHistory().filter((x) => x.id !== full.id)].slice(
    0,
    200
  );
  saveJson(STORAGE_KEYS.galleryHistory, list);
  notifyGalleryUpdated();
  void syncGalleryWorkToServer(full);
  return full;
}

/** Awaitable variant — use after download so cloud sync finishes before navigation/logout. */
export async function pushGalleryHistoryAndSync(
  item: Omit<GalleryHistoryItem, "expiresAt">,
  ctx: RetentionContext
): Promise<GalleryHistoryItem> {
  const full = pushGalleryHistory(item, ctx);
  await syncGalleryWorkToServer(full);
  return full;
}

export function deleteGalleryHistory(id: string) {
  const next = listGalleryHistory().filter((item) => item.id !== id);
  saveJson(STORAGE_KEYS.galleryHistory, next);
  notifyGalleryUpdated();
  if (typeof window !== "undefined") {
    void fetch(`/api/gallery-works?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => {
      /* ignore */
    });
  }
  return next;
}

/** Await server DELETE; rolls back local cache on failure. */
export async function deleteGalleryHistoryAsync(
  id: string
): Promise<{ ok: true; works: GalleryHistoryItem[] } | { ok: false; works: GalleryHistoryItem[] }> {
  const prev = listGalleryHistory();
  const next = prev.filter((item) => item.id !== id);
  saveJson(STORAGE_KEYS.galleryHistory, next);
  notifyGalleryUpdated();
  if (typeof window === "undefined") {
    return { ok: true, works: next };
  }
  try {
    const res = await fetch(`/api/gallery-works?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, works: next };
  } catch {
    saveJson(STORAGE_KEYS.galleryHistory, prev);
    notifyGalleryUpdated();
    return { ok: false, works: prev };
  }
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
