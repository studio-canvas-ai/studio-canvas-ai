import { NextResponse } from "next/server";
import { BGM_LIBRARY, resolveBgmUrl, type BGMItem } from "@/lib/bgmLibrary";

export const runtime = "nodejs";
export const maxDuration = 30;

function withUrls(items: BGMItem[]) {
  return items.map((item) => ({
    ...item,
    url: resolveBgmUrl(item),
  }));
}

/**
 * GET — curated BGM tracks from static per-genre manifests
 * (`bgm/upbeat|chill|cinematic|vlog|healing` filenames). R2 public URLs are resolved
 * from objectKey; we do not replace the catalog with a live R2 listing so
 * category tabs always map to the correct genre arrays.
 */
export async function GET() {
  const tracks = withUrls(BGM_LIBRARY);
  const byCategory = {
    업비트: tracks.filter((t) => t.category === "업비트").length,
    칠: tracks.filter((t) => t.category === "칠").length,
    시네마틱: tracks.filter((t) => t.category === "시네마틱").length,
    브이로그: tracks.filter((t) => t.category === "브이로그").length,
    힐링: tracks.filter((t) => t.category === "힐링").length,
  };
  return NextResponse.json({
    ok: true,
    source: "static",
    count: tracks.length,
    byCategory,
    tracks,
  });
}
