import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  createSignedPartUploadUrl,
  getR2Config,
  isR2Configured,
} from "@/lib/r2";
import { isOwnedShortsKey } from "@/lib/shortsVideo";

const SHORTS_PRESIGN_EXPIRES_SEC = 900;
const MAX_PART_NUMBER = 10_000;

export const runtime = "nodejs";

/**
 * POST /api/shorts/multipart/part
 * Presign one UploadPart PUT URL (no checksum headers in signature).
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

    const body = (await req.json().catch(() => null)) as {
      key?: string;
      uploadId?: string;
      partNumber?: number;
    } | null;

    const key = String(body?.key ?? "").trim();
    const uploadId = String(body?.uploadId ?? "").trim();
    const partNumber = Number(body?.partNumber ?? 0);

    if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
      return NextResponse.json(
        { error: "key, uploadId, and partNumber are required" },
        { status: 400 }
      );
    }
    if (partNumber > MAX_PART_NUMBER) {
      return NextResponse.json({ error: "part_number_too_large" }, { status: 400 });
    }
    if (!isOwnedShortsKey(userId, key)) {
      return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
    }

    const config = getR2Config()!;
    const uploadUrl = await createSignedPartUploadUrl(
      config,
      key,
      uploadId,
      partNumber,
      SHORTS_PRESIGN_EXPIRES_SEC
    );

    return NextResponse.json({
      ok: true,
      uploadUrl,
      partNumber,
      expiresInSec: SHORTS_PRESIGN_EXPIRES_SEC,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "multipart_part_failed";
    console.error("[shorts/multipart/part]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
