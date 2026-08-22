import { NextResponse } from "next/server";
import {
  loadStorageManifest,
  resolveOriginalExpiry,
  touchOriginalAccess,
} from "@/lib/storageManifest";
import { getR2Config } from "@/lib/r2";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import { checkDownloadRateLimit } from "@/lib/rateLimit";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * HD original download (#75 + abuse protection).
 * - Rate limit by IP / account
 * - Redirect to CDN public URL or short-lived signed R2 URL
 * - Touches lastAccessedAt so active work keeps the 24h idle original TTL
 */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const rl = checkDownloadRateLimit(req, userId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const config = getR2Config();
  if (!config) {
    return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  }

  const manifest = await loadStorageManifest(id);
  if (!manifest) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (manifest.originalDeleted) {
    return NextResponse.json({ error: "original expired and deleted" }, { status: 410 });
  }

  const originalDeadline = resolveOriginalExpiry(manifest);
  if (originalDeadline != null && originalDeadline <= Date.now()) {
    return NextResponse.json({ error: "original idle retention expired" }, { status: 410 });
  }

  // Active download = activity → extend 24h idle window for in-progress sessions.
  void touchOriginalAccess(id).catch(() => undefined);

  const url = new URL(req.url);
  const forceProxy = url.searchParams.get("proxy") === "1";

  if (!forceProxy) {
    try {
      const resolved = await resolveDownloadUrl({
        key: manifest.originalKey,
        expiresInSec: Number(process.env.DOWNLOAD_URL_TTL_SEC || 300),
      });
      return NextResponse.redirect(resolved.url, {
        headers: {
          "Cache-Control":
            resolved.mode === "cdn"
              ? "public, max-age=60, s-maxage=300"
              : "private, max-age=60",
          "X-Download-Mode": resolved.mode,
          "X-RateLimit-Remaining": String(rl.remaining),
        },
      });
    } catch {
      /* fall through to proxy */
    }
  }

  const { createR2Client, getR2Object } = await import("@/lib/r2");
  const client = createR2Client(config);
  const buffer = await getR2Object(client, config.bucketName, manifest.originalKey);
  if (!buffer) {
    return NextResponse.json({ error: "original not found" }, { status: 404 });
  }

  const ext = manifest.originalKey.split(".").pop() ?? "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="studio-canvas-${id}.${ext}"`,
      "Cache-Control": "private, no-store",
      "X-Download-Mode": "proxy",
      "X-RateLimit-Remaining": String(rl.remaining),
    },
  });
}
