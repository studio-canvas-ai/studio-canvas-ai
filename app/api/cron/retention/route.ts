import { NextResponse } from "next/server";
import { purgeExpiredOriginals } from "@/lib/storageManifest";

export const runtime = "nodejs";

/** Daily cron: delete expired originals from R2 (#75). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  if (secret && auth !== `Bearer ${secret}` && cronHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredOriginals();
  return NextResponse.json({
    ok: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
