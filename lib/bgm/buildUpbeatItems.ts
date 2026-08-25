import type { BGMItem } from "@/lib/bgmLibrary";

const UPBEAT_PREFIX = "bgm/upbeat/";

function titleFromFilename(filename: string, index: number): string {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const readable = decodeURIComponent(stem)
    .replace(/-\d+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return readable || `업비트 ${String(index + 1).padStart(2, "0")}`;
}

function idFromFilename(filename: string, index: number): string {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const slug = stem.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  return slug || `upbeat_${String(index + 1).padStart(2, "0")}`;
}

export function buildUpbeatItemsFromFilenames(filenames: readonly string[]): BGMItem[] {
  return filenames.map((filename, index) => {
    const objectKey = filename.startsWith(UPBEAT_PREFIX)
      ? filename
      : `${UPBEAT_PREFIX}${filename.replace(/^\//, "")}`;
    return {
      id: idFromFilename(filename, index),
      title: titleFromFilename(filename, index),
      category: "업비트",
      duration: "—",
      objectKey,
    };
  });
}

export function buildUpbeatItemsFromObjectKeys(keys: string[]): BGMItem[] {
  const mp3Keys = keys
    .filter((key) => /^bgm\/upbeat\/.+\.mp3$/i.test(key))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const filenames = mp3Keys.map((key) => key.split("/").pop() ?? key);
  return buildUpbeatItemsFromFilenames(filenames).map((item, index) => ({
    ...item,
    objectKey: mp3Keys[index] ?? item.objectKey,
  }));
}
