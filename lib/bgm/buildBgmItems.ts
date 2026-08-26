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

/** Vendor / artist prefixes that crowd the start of every Pixabay-style filename. */
const ARTIST_PREFIXES = [
  "alex-morgan",
  "prettyjohn1",
  "tape-echo",
  "vibemode",
  "the_mountain",
  "sigmamusicart",
  "paulyudin",
  "nastelbom",
  "ikoliks",
  "groza",
] as const;

function titleCaseToken(token: string): string {
  if (/^\d+$/.test(token)) return token;
  if (/^\d+s$/i.test(token)) return token.toLowerCase();
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Human-readable list title from an R2 object filename.
 * Strips vendor prefixes, Pixabay IDs, and marks copy/duration variants.
 */
export function formatBgmDisplayTitle(
  filename: string,
  index: number,
  category: BgmCategory
): { title: string; pixabayId: string | null } {
  const rawStem = decodeURIComponent(filename.replace(/\.[^.]+$/, "").trim());

  let version: number | null = null;
  const versionMatch = rawStem.match(/\s*\((\d+)\)\s*$/);
  let body = versionMatch
    ? rawStem.slice(0, versionMatch.index).trim()
    : rawStem;
  if (versionMatch) {
    // "(1)" is usually the second download of the same track.
    version = Number(versionMatch[1]) + 1;
  }

  const durationTags: string[] = [];
  body = body.replace(/[_-](\d+)\s*sec/gi, (_m, n: string) => {
    durationTags.push(`${n}s`);
    return "";
  });

  let pixabayId: string | null = null;
  const idMatch = body.match(/[_-](\d{4,})$/);
  if (idMatch) {
    pixabayId = idMatch[1];
    body = body.slice(0, -idMatch[0].length);
  }

  const lower = body.toLowerCase();
  for (const prefix of ARTIST_PREFIXES) {
    if (lower === prefix || lower.startsWith(`${prefix}-`) || lower.startsWith(`${prefix}_`)) {
      body = body.slice(prefix.length).replace(/^[-_]+/, "");
      break;
    }
  }

  let tokens = body.split(/[-_]+/).map((t) => t.trim()).filter(Boolean);
  tokens = tokens.filter(
    (t, i) => i === 0 || t.toLowerCase() !== tokens[i - 1]!.toLowerCase()
  );

  // Drop a lone trailing "music" when a richer descriptor already exists.
  if (tokens.length >= 2 && tokens[tokens.length - 1]!.toLowerCase() === "music") {
    tokens = tokens.slice(0, -1);
  }

  let core =
    tokens.map(titleCaseToken).join(" ").replace(/\s+/g, " ").trim() ||
    `${category} ${String(index + 1).padStart(2, "0")}`;

  const extras: string[] = [];
  if (durationTags.length) extras.push(durationTags.join(" · "));
  if (version != null) extras.push(`v${version}`);

  if (extras.length) {
    core = `${core} · ${extras.join(" · ")}`;
  }

  return { title: core, pixabayId };
}

function idFromFilename(filename: string, index: number, category: BgmCategory): string {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const slug = stem.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  const base = slug || `${CATEGORY_ID[category]}_${String(index + 1).padStart(2, "0")}`;
  return `${CATEGORY_ID[category]}-${base}`.slice(0, 96);
}

/** Basename from an object key (for tooltips). */
export function bgmFilenameFromObjectKey(objectKey: string): string {
  const parts = objectKey.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || objectKey;
}

export function buildBgmItemsFromFilenames(
  filenames: readonly string[],
  category: BgmCategory
): BGMItem[] {
  const prefix = CATEGORY_PREFIX[category];
  const drafted = filenames.map((filename, index) => {
    const objectKey = filename.startsWith("bgm/")
      ? filename
      : `${prefix}${filename.replace(/^\//, "")}`;
    const { title, pixabayId } = formatBgmDisplayTitle(filename, index, category);
    return {
      id: idFromFilename(filename, index, category),
      title,
      pixabayId,
      category,
      duration: "—",
      objectKey,
    };
  });

  // Disambiguate identical display titles within the same category.
  const titleCounts = new Map<string, number>();
  for (const item of drafted) {
    const key = item.title.toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  return drafted.map((item, index) => {
    const key = item.title.toLowerCase();
    if ((titleCounts.get(key) ?? 0) <= 1) {
      const { pixabayId: _drop, ...rest } = item;
      return rest;
    }
    const tag =
      item.pixabayId?.slice(-4) ||
      String(index + 1).padStart(2, "0");
    const { pixabayId: _drop, ...rest } = item;
    return {
      ...rest,
      title: `${item.title} · #${tag}`,
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
