import { NextResponse } from "next/server";
import {
  buildBgmItemsFromFilenames,
  buildBgmItemsFromObjectKeys,
} from "@/lib/bgm/buildBgmItems";
import { CHILL_BGM_FILENAMES } from "@/lib/bgm/chillFilenames";
import { UPBEAT_BGM_FILENAMES } from "@/lib/bgm/upbeatFilenames";
import { BGM_LIBRARY, resolveBgmUrl, type BGMItem } from "@/lib/bgmLibrary";
import {
  createR2Client,
  getR2Config,
  isR2Configured,
  listR2Keys,
} from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 30;

const UPBEAT_PREFIX = "bgm/upbeat/";
const CHILL_PREFIX = "bgm/chill/";

function withUrls(items: BGMItem[]) {
  return items.map((item) => ({
    ...item,
    url: resolveBgmUrl(item),
  }));
}

function staticLibrary(): BGMItem[] {
  return [
    ...buildBgmItemsFromFilenames(UPBEAT_BGM_FILENAMES, "업비트"),
    ...buildBgmItemsFromFilenames(CHILL_BGM_FILENAMES, "칠"),
  ];
}

/** GET — curated BGM tracks from R2 (falls back to static manifest). */
export async function GET() {
  try {
    if (isR2Configured()) {
      const config = getR2Config()!;
      const client = createR2Client(config);
      const [upbeatKeys, chillKeys] = await Promise.all([
        listR2Keys(client, config.bucketName, UPBEAT_PREFIX),
        listR2Keys(client, config.bucketName, CHILL_PREFIX),
      ]);
      const fromR2 = [
        ...buildBgmItemsFromObjectKeys(upbeatKeys, "업비트"),
        ...buildBgmItemsFromObjectKeys(chillKeys, "칠"),
      ];
      if (fromR2.length > 0) {
        return NextResponse.json({
          ok: true,
          source: "r2",
          count: fromR2.length,
          tracks: withUrls(fromR2),
        });
      }
    }

    const fallback = staticLibrary();
    return NextResponse.json({
      ok: true,
      source: "static",
      count: fallback.length,
      tracks: withUrls(fallback.length ? fallback : BGM_LIBRARY),
    });
  } catch (err) {
    console.error("[api/bgm/tracks]", err);
    const fallback = staticLibrary();
    return NextResponse.json({
      ok: false,
      source: "static",
      count: fallback.length,
      tracks: withUrls(fallback),
      error: "list_failed",
    });
  }
}
