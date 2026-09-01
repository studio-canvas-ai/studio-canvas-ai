import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  getR2Config,
  isR2Configured,
  uploadR2Part,
} from "@/lib/r2";
import { isOwnedShortsKey, SHORTS_SERVER_CHUNK_BYTES } from "@/lib/shortsVideo";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/shorts/chunk
 * Receive one 4 MB chunk and upload as an R2 multipart part (same-origin — no CORS).
 */
export async function POST(req: Request) {
  try {
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status }
      );
    }
    const userId = resolved.user.id;

    const contentTypeHeader = req.headers.get("content-type") || "";
    if (!contentTypeHeader.includes("multipart/form-data")) {
      return NextResponse.json({ error: "multipart_required" }, { status: 400 });
    }

    const form = await req.formData();
    const key = String(form.get("key") ?? "").trim();
    const uploadId = String(form.get("uploadId") ?? "").trim();
    const partNumber = Number(form.get("partNumber") ?? 0);
    const chunk = form.get("chunk");

    if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
      return NextResponse.json(
        { error: "key, uploadId, and partNumber are required" },
        { status: 400 }
      );
    }
    if (!isOwnedShortsKey(userId, key)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }
    if (!(chunk instanceof Blob) || chunk.size === 0) {
      return NextResponse.json({ error: "chunk_required" }, { status: 400 });
    }
    if (chunk.size > SHORTS_SERVER_CHUNK_BYTES + 256 * 1024) {
      return NextResponse.json({ error: "chunk_too_large" }, { status: 413 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
    }

    const config = getR2Config()!;
    const bytes = Buffer.from(await chunk.arrayBuffer());
    const etag = await uploadR2Part(config, key, uploadId, partNumber, bytes);

    return NextResponse.json({
      ok: true,
      partNumber,
      etag,
      sizeBytes: bytes.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "chunk_upload_failed";
    console.error("[shorts/chunk]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
