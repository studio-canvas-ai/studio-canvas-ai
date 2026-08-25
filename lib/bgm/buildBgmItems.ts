import type { BGMItem, BgmCategory } from "@/lib/bgmLibrary";

const CATEGORY_PREFIX: Record<BgmCategory, string> = {
  업비트: "bgm/upbeat/",
  칠: "bgm/chill/",
  시네마틱: "bgm/cinematic/",
  브이로그: "bgm/vlog/",
};

const CATEGORY_ID: Record<BgmCategory, string> = {
  업비트: "upbeat",
  칠: "chill",
  시네마틱: "cinematic",
  브이로그: "vlog",
};

function titleFromFilename(filename: string, index: number, category: BgmCategory): string {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const readable = decodeURIComponent(stem)
    .replace(/-\d+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return readable || `${category} ${String(index + 1).padStart(2, "0")}`;
}

function idFromFilename(filename: string, index: number, category: BgmCategory): string {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const slug = stem.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  const base = slug || `${CATEGORY_ID[category]}_${String(index + 1).padStart(2, "0")}`;
  return `${CATEGORY_ID[category]}-${base}`.slice(0, 96);
}

export function buildBgmItemsFromFilenames(
  filenames: readonly string[],
  category: BgmCategory
): BGMItem[] {
  const prefix = CATEGORY_PREFIX[category];
  return filenames.map((filename, index) => {
    const objectKey = filename.startsWith("bgm/")
      ? filename
      : `${prefix}${filename.replace(/^\//, "")}`;
    return {
      id: idFromFilename(filename, index, category),
      title: titleFromFilename(filename, index, category),
      category,
      duration: "—",
      objectKey,
    };
  });
}

export function buildBgmItemsFromObjectKeys(
  keys: string[],
  category: BgmCategory
): BGMItem[] {
  const folder = CATEGORY_PREFIX[category].replace(/\/$/, "");
  const mp3Keys = keys
    .filter((key) => new RegExp(`^${folder}/.+\\.mp3$`, "i").test(key))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const filenames = mp3Keys.map((key) => key.split("/").pop() ?? key);
  return buildBgmItemsFromFilenames(filenames, category).map((item, index) => ({
    ...item,
    objectKey: mp3Keys[index] ?? item.objectKey,
  }));
}

/** @deprecated Use buildBgmItemsFromFilenames with category "업비트". */
export function buildUpbeatItemsFromFilenames(filenames: readonly string[]): BGMItem[] {
  return buildBgmItemsFromFilenames(filenames, "업비트");
}

/** @deprecated Use buildBgmItemsFromObjectKeys with category "업비트". */
export function buildUpbeatItemsFromObjectKeys(keys: string[]): BGMItem[] {
  return buildBgmItemsFromObjectKeys(keys, "업비트");
}

export function buildChillItemsFromFilenames(filenames: readonly string[]): BGMItem[] {
  return buildBgmItemsFromFilenames(filenames, "칠");
}

export function buildChillItemsFromObjectKeys(keys: string[]): BGMItem[] {
  return buildBgmItemsFromObjectKeys(keys, "칠");
}
