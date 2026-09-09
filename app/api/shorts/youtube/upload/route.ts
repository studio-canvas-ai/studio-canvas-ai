import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import {
  isYoutubeApiConfigured,
  isYoutubePrivacyStatus,
  type YoutubePrivacyStatus,
} from "@/lib/youtube/config";
import {
  getAuthorizedYoutubeClient,
  YoutubeAuthError,
} from "@/lib/youtube/oauth";
import {
  createYoutubeResumableUploadSession,
  setYoutubeThumbnail,
  uploadShortsVideoToYoutube,
} from "@/lib/youtube/uploadVideo";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DIRECT_VIDEO_BYTES = 3_800_000;
const MAX_THUMB_BYTES = 2_000_000;

function authErrorResponse(err: YoutubeAuthError) {
  const status =
    err.code === "oauth_not_configured"
      ? 503
      : err.code === "not_connected" || err.code === "token_expired"
        ? 401
        : err.code === "scope_missing"
          ? 403
          : 400;
  return NextResponse.json(
    { ok: false, error: err.message, code: err.code },
    { status }
  );
}

async function fileToBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

/**
 * POST /api/shorts/youtube/upload
 *
 * Modes:
 * 1) multipart FormData: video + thumbnail + title/description/privacyStatus
 * 2) JSON { mode: "resumable_init", ... } → { uploadUrl } for client PUT (large files)
 * 3) multipart FormData: mode=thumbnail + videoId + thumbnail
 */
export async function POST(req: Request) {
  try {
    if (!isYoutubeApiConfigured()) {
      return NextResponse.json(
        { ok: false, error: "youtube_oauth_not_configured", code: "oauth_not_configured" },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }

    const rl = checkUploadRateLimit(req, resolved.user.id);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", resetAt: rl.resetAt, code: "rate_limited" },
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    // --- JSON: resumable session init (bypasses Vercel body limits) ---
    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as {
        mode?: string;
        title?: string;
        description?: string;
        privacyStatus?: string;
        videoBytes?: number;
        videoMimeType?: string;
      };

      if (body.mode !== "resumable_init") {
        return NextResponse.json(
          { ok: false, error: "unsupported_json_mode", code: "bad_request" },
          { status: 400 }
        );
      }

      const privacy: YoutubePrivacyStatus = isYoutubePrivacyStatus(
        String(body.privacyStatus || "unlisted")
      )
        ? (body.privacyStatus as YoutubePrivacyStatus)
        : "unlisted";

      const videoBytes = Number(body.videoBytes || 0);
      if (!Number.isFinite(videoBytes) || videoBytes < 1 || videoBytes > 256_000_000) {
        return NextResponse.json(
          { ok: false, error: "invalid_video_bytes", code: "bad_request" },
          { status: 400 }
        );
      }

      let auth;
      try {
        auth = await getAuthorizedYoutubeClient({
          userId: resolved.user.id,
          reqUrl: req.url,
        });
      } catch (err) {
        if (err instanceof YoutubeAuthError) return authErrorResponse(err);
        throw err;
      }

      const creds = auth.credentials;
      const accessToken = creds.access_token;
      if (!accessToken) {
        return NextResponse.json(
          { ok: false, error: "token_expired", code: "token_expired" },
          { status: 401 }
        );
      }

      const uploadUrl = await createYoutubeResumableUploadSession({
        accessToken,
        title: String(body.title || "Studio Canvas Shorts"),
        description: String(body.description || ""),
        privacyStatus: privacy,
        videoBytes,
        videoMimeType: body.videoMimeType || "video/mp4",
      });

      return NextResponse.json({
        ok: true,
        mode: "resumable" as const,
        uploadUrl,
      });
    }

    // --- multipart FormData ---
    const form = await req.formData();
    const mode = String(form.get("mode") || "upload");

    let auth;
    try {
      auth = await getAuthorizedYoutubeClient({
        userId: resolved.user.id,
        reqUrl: req.url,
      });
    } catch (err) {
      if (err instanceof YoutubeAuthError) return authErrorResponse(err);
      throw err;
    }

    if (mode === "thumbnail") {
      const videoId = String(form.get("videoId") || "").trim();
      const thumb = form.get("thumbnail");
      if (!videoId || !(thumb instanceof File) || thumb.size < 1) {
        return NextResponse.json(
          { ok: false, error: "thumbnail_required", code: "bad_request" },
          { status: 400 }
        );
      }
      if (thumb.size > MAX_THUMB_BYTES) {
        return NextResponse.json(
          { ok: false, error: "thumbnail_too_large", code: "bad_request" },
          { status: 400 }
        );
      }
      const thumbnailBuffer = await fileToBuffer(thumb);
      try {
        await setYoutubeThumbnail({
          auth,
          videoId,
          thumbnailBuffer,
          thumbnailMimeType: thumb.type || "image/jpeg",
        });
      } catch (err) {
        console.error("[shorts/youtube/upload] thumbnail", err);
        return NextResponse.json(
          { ok: false, error: "thumbnail_set_failed", code: "thumbnail_failed" },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        mode: "thumbnail" as const,
        videoId,
        watchUrl: `https://youtu.be/${videoId}`,
        thumbnailSet: true,
      });
    }

    const title = String(form.get("title") || "Studio Canvas Shorts").slice(0, 100);
    const description = String(form.get("description") || "").slice(0, 5000);
    const privacyRaw = String(form.get("privacyStatus") || "unlisted");
    const privacyStatus: YoutubePrivacyStatus = isYoutubePrivacyStatus(privacyRaw)
      ? privacyRaw
      : "unlisted";

    const video = form.get("video");
    const thumb = form.get("thumbnail");

    if (!(video instanceof File) || video.size < 1) {
      return NextResponse.json(
        { ok: false, error: "video_required", code: "bad_request" },
        { status: 400 }
      );
    }
    if (video.size > MAX_DIRECT_VIDEO_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "video_too_large_use_resumable",
          code: "use_resumable",
          maxDirectBytes: MAX_DIRECT_VIDEO_BYTES,
        },
        { status: 413 }
      );
    }

    const videoBuffer = await fileToBuffer(video);
    let thumbnailBuffer: Buffer | null = null;
    let thumbnailMimeType = "image/jpeg";
    if (thumb instanceof File && thumb.size > 0) {
      if (thumb.size > MAX_THUMB_BYTES) {
        return NextResponse.json(
          { ok: false, error: "thumbnail_too_large", code: "bad_request" },
          { status: 400 }
        );
      }
      thumbnailBuffer = await fileToBuffer(thumb);
      thumbnailMimeType = thumb.type || "image/jpeg";
    }

    try {
      const result = await uploadShortsVideoToYoutube({
        auth,
        videoBuffer,
        videoMimeType: video.type || "video/mp4",
        thumbnailBuffer,
        thumbnailMimeType,
        title,
        description,
        privacyStatus,
      });

      return NextResponse.json({
        ok: true,
        mode: "direct" as const,
        ...result,
      });
    } catch (err) {
      console.error("[shorts/youtube/upload] insert", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/insufficientPermissions|accessNotConfigured|youtubeUpload/i.test(msg)) {
        return NextResponse.json(
          { ok: false, error: msg, code: "scope_missing" },
          { status: 403 }
        );
      }
      if (/Invalid Credentials|authError|401/i.test(msg)) {
        return NextResponse.json(
          { ok: false, error: msg, code: "token_expired" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { ok: false, error: msg || "upload_failed", code: "upload_failed" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[shorts/youtube/upload]", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", code: "internal_error" },
      { status: 500 }
    );
  }
}
