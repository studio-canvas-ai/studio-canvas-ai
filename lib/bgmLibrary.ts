/**
 * Screen 13 (Shorts Studio) curated BGM library.
 * Tracks live under `bgm/{category}/` on Cloudflare R2.
 */

import {
  buildBgmItemsFromFilenames,
} from "@/lib/bgm/buildBgmItems";
import { CHILL_BGM_FILENAMES } from "@/lib/bgm/chillFilenames";
import { CINEMATIC_BGM_FILENAMES } from "@/lib/bgm/cinematicFilenames";
import { HEALING_BGM_FILENAMES } from "@/lib/bgm/healingFilenames";
import { UPBEAT_BGM_FILENAMES } from "@/lib/bgm/upbeatFilenames";
import { VLOG_BGM_FILENAMES } from "@/lib/bgm/vlogFilenames";

export type BgmCategory = "업비트" | "칠" | "시네마틱" | "브이로그" | "힐링";

export interface BGMItem {
  id: string;
  title: string;
  category: BgmCategory;
  duration: string;
  /** Object key under the R2 public base (e.g. bgm/healing/track-name.mp3). */
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
const HEALING_LIBRARY = buildBgmItemsFromFilenames(HEALING_BGM_FILENAMES, "힐링");

export const BGM_LIBRARY: BGMItem[] = [
  ...UPBEAT_LIBRARY,
  ...CHILL_LIBRARY,
  ...CINEMATIC_LIBRARY,
  ...VLOG_LIBRARY,
  ...HEALING_LIBRARY,
];

export const BGM_CATEGORIES: BgmCategory[] = [
  "업비트",
  "칠",
  "시네마틱",
  "브이로그",
  "힐링",
];

const CATEGORY_OBJECT_PREFIX: Record<BgmCategory, string> = {
  업비트: "bgm/upbeat/",
  칠: "bgm/chill/",
  시네마틱: "bgm/cinematic/",
  브이로그: "bgm/vlog/",
  힐링: "bgm/healing/",
};

/** True when item.category and objectKey folder agree. */
export function bgmItemMatchesCategory(
  item: BGMItem,
  category: BgmCategory
): boolean {
  if (item.category !== category) return false;
  return item.objectKey.startsWith(CATEGORY_OBJECT_PREFIX[category]);
}

export function bgmItemsByCategory(category: BgmCategory | "all"): BGMItem[] {
  if (category === "all") return BGM_LIBRARY;
  const items = BGM_LIBRARY.filter((item) =>
    bgmItemMatchesCategory(item, category)
  );
  // Put genre-unique titles first so tab switches are obvious
  // (many Pixabay files are shared across folders with the same cleaned name).
  const otherTitles = new Set(
    BGM_LIBRARY.filter((item) => item.category !== category).map((item) =>
      item.title.toLowerCase()
    )
  );
  const unique: BGMItem[] = [];
  const shared: BGMItem[] = [];
  for (const item of items) {
    if (otherTitles.has(item.title.toLowerCase())) shared.push(item);
    else unique.push(item);
  }
  return [...unique, ...shared];
}

export function bgmCategoryCounts(): Record<BgmCategory, number> {
  return {
    업비트: bgmItemsByCategory("업비트").length,
    칠: bgmItemsByCategory("칠").length,
    시네마틱: bgmItemsByCategory("시네마틱").length,
    브이로그: bgmItemsByCategory("브이로그").length,
    힐링: bgmItemsByCategory("힐링").length,
  };
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
    case "힐링":
      return "힐링 (Healing)";
  }
}
