/**
 * Shorts studio BGM — selection / volume state + curated library (Screen 13).
 * Custom uploads use blob: object URLs (session-local).
 */

import {
  BGM_LIBRARY,
  resolveBgmUrl,
  type BGMItem,
} from "@/lib/bgmLibrary";

export type ShortsBgmState = {
  bgmUrl: string | null;
  bgmName: string;
  /** 0–1, default 0.5 */
  bgmVolume: number;
};

/** @deprecated Prefer BGMItem from lib/bgmLibrary — kept for older call sites. */
export type ShortsBgmPreset = {
  id: string;
  title: string;
  category: BGMItem["category"];
  duration: string;
  url: string;
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

/** Curated R2 library mapped for the Shorts BGM picker. */
export const SHORTS_BGM_PRESETS: ShortsBgmPreset[] = BGM_LIBRARY.map((item) => ({
  id: item.id,
  title: item.title,
  category: item.category,
  duration: item.duration,
  url: resolveBgmUrl(item),
}));

export function isShortsBgmAudioFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (
    type === "audio/mpeg" ||
    type === "audio/mp3" ||
    type === "audio/wav" ||
    type === "audio/x-wav" ||
    type === "audio/wave"
  ) {
    return true;
  }
  const name = file.name.toLowerCase();
  return name.endsWith(".mp3") || name.endsWith(".wav");
}

export type { BGMItem };
export { BGM_LIBRARY, resolveBgmUrl } from "@/lib/bgmLibrary";
