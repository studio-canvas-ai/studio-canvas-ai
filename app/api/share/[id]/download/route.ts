import { NextResponse } from "next/server";
import {
  createR2Client,
  getR2Config,
  getR2Object,
} from "@/lib/r2";
import { loadShareMetaById } from "@/lib/shareImageStore.server";
import {
  filenameFromShareMeta,
  sanitizeShareId,
} from "@/lib/shareImageStore";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Same-origin attachment download so mobile browsers can save to gallery
 * without long-press on a cross-origin CDN image.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = sanitizeShareId(rawId);
    if (!id) {
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const meta = await loadShareMetaById(id);
    if (!meta) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const config = getR2Config();
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "storage_unconfigured" },
        { status: 503 }
      );
    }
    const client = createR2Client(config);
    const bytes = await getR2Object(client, config.bucketName, meta.imageKey);
    if (!bytes) {
      return NextResponse.json({ ok: false, error: "image_missing" }, { status: 404 });
    }

    const filename = filenameFromShareMeta(meta);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": meta.contentType || "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (err) {
    console.error("[share/id/download]", err);
    return NextResponse.json({ ok: false, error: "download_failed" }, { status: 500 });
  }
}
