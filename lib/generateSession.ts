/**
 * Ephemeral /generate wizard scratch (sessionStorage).
 * Does NOT wipe saved face profiles or cloud gallery history.
 */

import {
  clearResultSession,
  RESULT_SESSION_KEY,
  SELECTED_RESULT_URL_KEY,
} from "@/lib/resultSession";
import {
  clearTrainSelection,
  TRAIN_SELECTION_STORAGE_KEY,
} from "@/lib/trainSelection";

export const GENERATE_PHOTOS_CACHE_PREFIX = "sca_generate_photos_";

/** Style gallery → wizard entry (subject/age step after style lock). */
export function buildGenerateStyleHref(styleId: string): string {
  const id = encodeURIComponent(styleId.trim());
  return `/generate?style=${id}&fresh=1`;
}

export function clearGeneratePhotoCaches() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(GENERATE_PHOTOS_CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Wipe prior generate/result scratch so a new pictorial run starts clean.
 * Keeps auth cookies and saved face-profile vault (localStorage).
 */
export function clearGenerateSessionScratch() {
  if (typeof window === "undefined") return;
  clearResultSession();
  clearTrainSelection();
  clearGeneratePhotoCaches();
  try {
    sessionStorage.removeItem(RESULT_SESSION_KEY);
    sessionStorage.removeItem(SELECTED_RESULT_URL_KEY);
    sessionStorage.removeItem(TRAIN_SELECTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
