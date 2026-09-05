import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveDownloadUrl } from "@/lib/downloadUrl";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import {
  createR2Client,
  getR2Config,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";
import {
  extFromContentType,
  buildShareViewerUrl,
  sharePublicImageKey,
  sharePublicMetaKey,
  type ShareImageMeta,
} from "@/lib/shareImageStore";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** Long-lived share links when CDN public URL is unavailable. */
const SIGNED_SHARE_TTL_SEC = 60 * 60 * 24 * 30;

const DEFAULT_TITLE = "Studio Canvas AI로 만든 인쇄물";
const DEFAULT_DESCRIPTION =
  "Studio Canvas AI에서 디자인한 인쇄물입니다. 버튼을 눌러 이미지를 바로 저장하세요.";

/**
 * Upload a canvas export for Kakao / messenger share.
 * Body: multipart FormData with `file` (+ optional title/description).
 * Returns image URL + viewer page URL (`/share/{id}`).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId =
      (session?.user as { id?: string } | undefined)?.id?.trim() || "anon";

    const rl = checkUploadRateLimit(req, userId === "anon" ? null : userId);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", resetAt: rl.resetAt },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "storage_unconfigured",
          message: "이미지 공유 스토리지가 설정되지 않았습니다.",
        },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const title =
      String(form.get("title") ?? "").trim() || DEFAULT_TITLE;
    const description =
      String(form.get("description") ?? "").trim() || DEFAULT_DESCRIPTION;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "file_required", message: "이미지 파일이 필요합니다." },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "file_too_large", message: "이미지 용량이 너무 큽니다." },
        { status: 413 }
      );
    }

    const contentType = (file.type || "image/png").toLowerCase();
    if (!ALLOWED_MIME.has(contentType)) {
      return NextResponse.json(
        {
          ok: false,
          error: "unsupported_type",
          message: "PNG 또는 JPG 이미지만 공유할 수 있습니다.",
        },
        { status: 415 }
      );
    }

    const ext = extFromContentType(contentType);
    const shareId = randomUUID().replace(/-/g, "");
    const imageKey = sharePublicImageKey(shareId, ext);
    const metaKey = sharePublicMetaKey(shareId);
    const bytes = Buffer.from(await file.arrayBuffer());

    const config = getR2Config()!;
    const client = createR2Client(config);
    await putR2Object(client, config.bucketName, imageKey, bytes, contentType);

    const meta: ShareImageMeta = {
      id: shareId,
      title,
      description,
      contentType,
      imageKey,
      createdAt: Date.now(),
    };
    await putR2Object(
      client,
      config.bucketName,
      metaKey,
      Buffer.from(JSON.stringify(meta), "utf8"),
      "application/json"
    );

    const resolved = await resolveDownloadUrl({
      key: imageKey,
      expiresInSec: SIGNED_SHARE_TTL_SEC,
    });

    const viewerUrl = buildShareViewerUrl(shareId);

    return NextResponse.json({
      ok: true,
      id: shareId,
      url: resolved.url,
      imageUrl: resolved.url,
      viewerUrl,
      contentType,
      mode: resolved.mode,
    });
  } catch (err) {
    console.error("[share/image]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "upload_failed",
        message: "이미지 업로드에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
