/**
 * Shorts studio BGM — phase-1 selection / volume state + sample presets.
 * Custom uploads use blob: object URLs (session-local).
 */

export type ShortsBgmState = {
  bgmUrl: string | null;
  bgmName: string;
  /** 0–1, default 0.5 */
  bgmVolume: number;
};

export type ShortsBgmPreset = {
  id: string;
  /** i18n key under t.shorts.bgmPresets */
  nameKey: "upbeat" | "chill" | "cinematic";
  /** Demo loop URL (CORS-friendly royalty-free samples). */
  url: string;
  /** Short tagline for the chip UI */
  moodKey: "upbeatMood" | "chillMood" | "cinematicMood";
};

export const SHORTS_BGM_VOLUME_DEFAULT = 0.5;
export const SHORTS_BGM_VOLUME_MIN = 0;
export const SHORTS_BGM_VOLUME_MAX = 1;

export function createDefaultShortsBgmState(): ShortsBgmState {
  return {
    bgmUrl: null,
    bgmName: "",
    bgmVolume: SHORTS_BGM_VOLUME_DEFAULT,
  };
}

export function clampBgmVolume(v: number): number {
  if (!Number.isFinite(v)) return SHORTS_BGM_VOLUME_DEFAULT;
  return Math.max(SHORTS_BGM_VOLUME_MIN, Math.min(SHORTS_BGM_VOLUME_MAX, v));
}

/**
 * Three free demo loops for preview / selection.
 * Replaced later by R2-hosted library tracks without changing the UI contract.
 */
export const SHORTS_BGM_PRESETS: ShortsBgmPreset[] = [
  {
    id: "upbeat",
    nameKey: "upbeat",
    moodKey: "upbeatMood",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "chill",
    nameKey: "chill",
    moodKey: "chillMood",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "cinematic",
    nameKey: "cinematic",
    moodKey: "cinematicMood",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
];

export function isShortsBgmAudioFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "audio/mpeg" || type === "audio/mp3" || type === "audio/wav" || type === "audio/x-wav" || type === "audio/wave") {
    return true;
  }
  const name = file.name.toLowerCase();
  return name.endsWith(".mp3") || name.endsWith(".wav");
}
