/**
 * Screen 13 (Shorts Studio) curated BGM library.
 * Files live under `bgm/` on Cloudflare R2; public base from NEXT_PUBLIC_R2_PUBLIC_URL.
 */

export type BgmCategory = "업비트" | "칠" | "시네마틱" | "브이로그";

export interface BGMItem {
  id: string;
  title: string;
  category: BgmCategory;
  duration: string;
  /** Object key under the R2 public base (e.g. bgm/upbeat_01.mp3). */
  objectKey: string;
  /** Optional hard-coded absolute URL override. */
  urlOverride?: string;
}

/** Demo loops used when R2 public URL is not configured yet. */
const DEMO_FALLBACK_BY_ID: Record<string, string> = {
  upbeat_01: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  chill_01: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  cinematic_01: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  vlog_01: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
};

function r2PublicBase(): string {
  const raw =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_BGM_BASE_URL)) ||
    "";
  return raw.trim().replace(/\/$/, "");
}

/** Resolve playable URL for a library track. */
export function resolveBgmUrl(item: BGMItem): string {
  if (item.urlOverride?.trim()) return item.urlOverride.trim();
  const base = r2PublicBase();
  if (base) return `${base}/${item.objectKey.replace(/^\//, "")}`;
  return DEMO_FALLBACK_BY_ID[item.id] || DEMO_FALLBACK_BY_ID.upbeat_01;
}

export const BGM_LIBRARY: BGMItem[] = [
  {
    id: "upbeat_01",
    title: "업비트 에너지 01",
    category: "업비트",
    duration: "02:30",
    objectKey: "bgm/upbeat_01.mp3",
  },
  {
    id: "chill_01",
    title: "칠 그루브 01",
    category: "칠",
    duration: "03:15",
    objectKey: "bgm/chill_01.mp3",
  },
  {
    id: "cinematic_01",
    title: "시네마틱 펄스 01",
    category: "시네마틱",
    duration: "02:50",
    objectKey: "bgm/cinematic_01.mp3",
  },
  {
    id: "vlog_01",
    title: "브이로그 하이라이트 01",
    category: "브이로그",
    duration: "02:10",
    objectKey: "bgm/vlog_01.mp3",
  },
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
