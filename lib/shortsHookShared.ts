/** Shared Shorts hook-frame constants (safe for client + server). */

export const SHORTS_HOOK_COUNT_MIN = 3;
export const SHORTS_HOOK_COUNT_MAX = 5;
export const SHORTS_HOOK_SAMPLE_COUNT = 5;

export type ShortsHookFrame = {
  id: string;
  index: number;
  timestampSec: number;
  score: number;
  imageUrl: string;
  storageKey: string | null;
};

export function buildHookTimestamps(
  durationSec: number,
  count = SHORTS_HOOK_SAMPLE_COUNT
): number[] {
  const dur = Math.max(0.6, durationSec);
  const start = dur * 0.08;
  const end = dur * 0.92;
  const span = Math.max(0.2, end - start);
  const n = Math.min(SHORTS_HOOK_COUNT_MAX, Math.max(SHORTS_HOOK_COUNT_MIN, count));
  const stamps: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = start + (span * (i + 0.5)) / n;
    stamps.push(Math.round(t * 100) / 100);
  }
  return stamps;
}

export function shortsHookThumbKey(
  userId: string,
  videoId: string,
  index: number
): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `thumbs/shorts/${safeUser}/${safeId}/hook-${index}.webp`;
}
