/**
 * Screen 13 (Shorts Studio) curated BGM library.
 * Tracks live under `bgm/{category}/` on Cloudflare R2.
 */

import {
  buildBgmItemsFromFilenames,
} from "@/lib/bgm/buildBgmItems";
import { CHILL_BGM_FILENAMES } from "@/lib/bgm/chillFilenames";
import { CINEMATIC_BGM_FILENAMES } from "@/lib/bgm/cinematicFilenames";
import { UPBEAT_BGM_FILENAMES } from "@/lib/bgm/upbeatFilenames";
import { VLOG_BGM_FILENAMES } from "@/lib/bgm/vlogFilenames";

export type BgmCategory = "업비트" | "칠" | "시네마틱" | "브이로그";

export interface BGMItem {
  id: string;
  title: string;
  category: BgmCategory;
  duration: string;
  /** Object key under the R2 public base (e.g. bgm/chill/track-name.mp3). */
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

/** Resolve playable URL for a library track (path segments URL-encoded). */
export function resolveBgmUrl(item: BGMItem): string {
  if (item.urlOverride?.trim()) return item.urlOverride.trim();
  const base = r2PublicBase();
  const key = item.objectKey.replace(/^\//, "");
  const encoded = key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${encoded}`;
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

const UPBEAT_LIBRARY = buildBgmItemsFromFilenames(UPBEAT_BGM_FILENAMES, "업비트");
const CHILL_LIBRARY = buildBgmItemsFromFilenames(CHILL_BGM_FILENAMES, "칠");
const CINEMATIC_LIBRARY = buildBgmItemsFromFilenames(
  CINEMATIC_BGM_FILENAMES,
  "시네마틱"
);
const VLOG_LIBRARY = buildBgmItemsFromFilenames(VLOG_BGM_FILENAMES, "브이로그");

export const BGM_LIBRARY: BGMItem[] = [
  ...UPBEAT_LIBRARY,
  ...CHILL_LIBRARY,
  ...CINEMATIC_LIBRARY,
  ...VLOG_LIBRARY,
];

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

/** UI label for category filter chips. */
export function bgmCategoryLabel(category: BgmCategory): string {
  switch (category) {
    case "업비트":
      return "업비트 (Upbeat)";
    case "칠":
      return "칠 (Chill)";
    case "시네마틱":
      return "시네마틱 (Cinematic)";
    case "브이로그":
      return "브이로그 (Vlog)";
  }
}
