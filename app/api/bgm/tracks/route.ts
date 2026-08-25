import { NextResponse } from "next/server";
import {
  buildUpbeatItemsFromFilenames,
  buildUpbeatItemsFromObjectKeys,
} from "@/lib/bgm/buildUpbeatItems";
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

function withUrls(items: BGMItem[]) {
  return items.map((item) => ({
    ...item,
    url: resolveBgmUrl(item),
  }));
}

/** GET — curated upbeat tracks from R2 (falls back to static manifest). */
export async function GET() {
  try {
    if (isR2Configured()) {
      const config = getR2Config()!;
      const client = createR2Client(config);
      const keys = await listR2Keys(client, config.bucketName, UPBEAT_PREFIX);
      const fromR2 = buildUpbeatItemsFromObjectKeys(keys);
      if (fromR2.length > 0) {
        return NextResponse.json({
          ok: true,
          source: "r2",
          count: fromR2.length,
          tracks: withUrls(fromR2),
        });
      }
    }

    const fallback = buildUpbeatItemsFromFilenames(UPBEAT_BGM_FILENAMES);
    return NextResponse.json({
      ok: true,
      source: "static",
      count: fallback.length,
      tracks: withUrls(fallback.length ? fallback : BGM_LIBRARY),
    });
  } catch (err) {
    console.error("[api/bgm/tracks]", err);
    const fallback = buildUpbeatItemsFromFilenames(UPBEAT_BGM_FILENAMES);
    return NextResponse.json({
      ok: false,
      source: "static",
      count: fallback.length,
      tracks: withUrls(fallback),
      error: "list_failed",
    });
  }
}
