/**
 * Persist Shorts phase-3 → phase-4 handoff (selected hook + video metadata).
 * Blob object URLs are not stored — studio uses hook.imageUrl + optional playbackUrl.
 */

import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import type { ShortsStorageMode } from "@/lib/shortsVideo";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";

export const SHORTS_STUDIO_PATH = `${SHORTS_THUMBNAIL_PATH}/studio` as const;

const SESSION_KEY = "sca_shorts_studio_v1";

export type ShortsStudioSession = {
  videoId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  storageKey: string | null;
  playbackUrl: string | null;
  /** Explicit video URL for studio mix (playback or preview). */
  videoUrl?: string | null;
  videoFileName?: string;
  storage: ShortsStorageMode;
  hook: ShortsHookFrame;
  savedAt: number;
};

export function saveShortsStudioSession(
  session: Omit<ShortsStudioSession, "savedAt">
): void {
  try {
    const payload: ShortsStudioSession = {
      ...session,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadShortsStudioSession(): ShortsStudioSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShortsStudioSession;
    if (!parsed?.hook?.imageUrl || !parsed?.videoId) return null;
    // Stale after 2 hours
    if (Date.now() - (parsed.savedAt || 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearShortsStudioSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
