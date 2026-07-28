const isBrowser = () => typeof window !== "undefined";

export function loadJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

export const STORAGE_KEYS = {
  faceProfiles: "sca_face_profiles_v1",
  tickets: "sca_support_tickets_v1",
  galleryHistory: "sca_gallery_history_v1",
  accountMeta: "sca_account_meta_v1",
  releaseSeen: "sca_release_seen_v1",
} as const;
