/**
 * Screen 13 (Shorts Studio) curated BGM library.
 * Upbeat tracks live under `bgm/upbeat/` on Cloudflare R2.
 */

import { buildUpbeatItemsFromFilenames } from "@/lib/bgm/buildUpbeatItems";
import { UPBEAT_BGM_FILENAMES } from "@/lib/bgm/upbeatFilenames";

export type BgmCategory = "업비트" | "칠" | "시네마틱" | "브이로그";

export interface BGMItem {
  id: string;
  title: string;
  category: BgmCategory;
  duration: string;
  /** Object key under the R2 public base (e.g. bgm/upbeat/track-name.mp3). */
  objectKey: string;
  /** Optional hard-coded absolute URL override. */
  urlOverride?: string;
}

/** Production R2 public base for Screen 13 BGM. */
export const R2_BGM_PUBLIC_BASE =
  "https://pub-bb48348c54c946a7b4a57af9900c473b.r2.dev";

function r2PublicBase(): string {
  const raw =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_BGM_BASE_URL ||
        process.env.R2_PUBLIC_URL)) ||
    "";
  return (raw.trim() || R2_BGM_PUBLIC_BASE).replace(/\/$/, "");
}

/** Resolve playable URL for a library track. */
export function resolveBgmUrl(item: BGMItem): string {
  if (item.urlOverride?.trim()) return item.urlOverride.trim();
  const base = r2PublicBase();
  return `${base}/${item.objectKey.replace(/^\//, "")}`;
}

/** Same-origin proxy URL for FFmpeg.wasm fetch (avoids R2 CORS on mix). */
export function resolveBgmMixUrl(publicUrl: string): string {
  const trimmed = publicUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "pub-bb48348c54c946a7b4a57af9900c473b.r2.dev") {
      return `/api/bgm/stream?src=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    /* keep original */
  }
  return trimmed;
}

const UPBEAT_LIBRARY = buildUpbeatItemsFromFilenames(UPBEAT_BGM_FILENAMES);

export const BGM_LIBRARY: BGMItem[] = [...UPBEAT_LIBRARY];

export const BGM_CATEGORIES: BgmCategory[] = [
  "업비트",
  "칠",
  "시네마틱",
  "브이로그",
];

export function bgmItemsByCategory(category: BgmCategory | "all"): BGMItem[] {
  if (category === "all") return BGM_LIBRARY;
  return BGM_LIBRARY.filter((item) => item.category === category);
}
