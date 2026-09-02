/** Persist mobile playback URLs across tab navigation (no File re-upload). */
const PREFIX = "sca_shorts_playback_";

export type ShortsPlaybackSession = {
  videoId: string;
  storageKey: string;
  /** Original R2 signed URL (immediate after upload). */
  playbackUrl: string | null;
  /** H.264 preview MP4 URL after transcode. */
  h264Url: string | null;
  posterDataUrl: string | null;
  savedAt: number;
};

function key(videoId: string): string {
  return `${PREFIX}${videoId}`;
}

export function saveShortsPlaybackSession(entry: ShortsPlaybackSession): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key(entry.videoId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function readShortsPlaybackSession(
  videoId: string
): ShortsPlaybackSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(videoId));
    if (!raw) return null;
    return JSON.parse(raw) as ShortsPlaybackSession;
  } catch {
    return null;
  }
}

export function clearShortsPlaybackSession(videoId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(key(videoId));
  } catch {
    /* ignore */
  }
}
