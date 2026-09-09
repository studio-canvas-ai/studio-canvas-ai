/**
 * Resolve face/selfie image URLs for /api/generate regenerate & background fusion.
 * Survives step-5 session restore when in-memory uploadedFiles were cleared.
 */
import { getFaceProfile } from "@/lib/faceProfiles";
import { GENERATE_PHOTOS_CACHE_PREFIX } from "@/lib/generateSession";
import { readResultSession } from "@/lib/resultSession";

function isImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const u = url.trim();
  return (
    u.length > 8 &&
    (u.startsWith("https://") ||
      u.startsWith("http://") ||
      u.startsWith("data:image/") ||
      u.startsWith("blob:") ||
      u.startsWith("/"))
  );
}

export function readCachedGeneratePhotos(id: string): string[] {
  if (typeof window === "undefined" || !id.trim()) return [];
  try {
    const cached = sessionStorage.getItem(`${GENERATE_PHOTOS_CACHE_PREFIX}${id}`);
    if (!cached) return [];
    const parsed = JSON.parse(cached) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isImageUrl).slice(0, 10);
  } catch {
    return [];
  }
}

export function resolveSelfieSourcesForGenerate(opts: {
  uploadedFiles?: string[];
  selectedProfileId?: string | null;
  /** Extra fallback refs (e.g. cached session selfies). */
  sessionSelfies?: string[];
  /** Last resort: active draft / portrait image contains the face identity. */
  draftFallback?: string | null;
  /** Exclude finished-work URLs mistaken for training selfies. */
  excludeUrls?: string[];
}): string[] {
  const exclude = new Set(
    (opts.excludeUrls || [])
      .filter((u): u is string => typeof u === "string" && u.trim().length > 8)
      .map((u) => u.trim())
  );

  const fromUpload = (opts.uploadedFiles || [])
    .filter(isImageUrl)
    .filter((u) => !exclude.has(u.trim()))
    .slice(0, 10);
  if (fromUpload.length) return fromUpload;

  const profileId = opts.selectedProfileId?.trim();
  if (profileId) {
    const profile = getFaceProfile(profileId);
    if (profile?.photoUrls?.length) {
      return profile.photoUrls.filter(isImageUrl).slice(0, 10);
    }
    const cached = readCachedGeneratePhotos(profileId);
    if (cached.length) return cached;
  }

  const sessionSelfies = (opts.sessionSelfies || [])
    .filter(isImageUrl)
    .filter((u) => !exclude.has(u.trim()))
    .slice(0, 10);
  if (sessionSelfies.length) return sessionSelfies;

  const session = readResultSession();
  if (session?.selfieUrls?.length) {
    const fromSession = session.selfieUrls
      .filter(isImageUrl)
      .filter((u) => !exclude.has(u.trim()))
      .slice(0, 10);
    if (fromSession.length) return fromSession;
  }

  const draftFallback = opts.draftFallback?.trim();
  if (draftFallback && isImageUrl(draftFallback) && !exclude.has(draftFallback)) {
    return [draftFallback];
  }

  return [];
}
