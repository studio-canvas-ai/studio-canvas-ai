import { NextResponse } from "next/server";
import { creditUser, debitCredits } from "@/lib/db/credits";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import { polishCaptionSegments } from "@/lib/shortsCaptionPolish";
import { SHORTS_CAPTION_CREDIT_COST } from "@/lib/shortsCaptions";
import {
  SHORTS_STT_MAX_BYTES,
  SHORTS_STT_VERCEL_SAFE_BYTES,
  ShortsSttError,
  getOpenAiApiKey,
  transcribeWithWhisper,
  whisperSafeFileName,
} from "@/lib/shortsStt";

export const runtime = "nodejs";
export const maxDuration = 120;

function formKeys(form: FormData): string[] {
  const keys: string[] = [];
  form.forEach((_, key) => keys.push(key));
  return keys;
}

/**
 * POST /api/shorts/stt
 * multipart fields:
 *  - file (required): audio preferred (wav/webm/mp3); small video accepted as fallback
 *  - fileName (optional)
 *  - mimeType (optional)
 *  - sourceKind (optional): "audio" | "video"
 * Debits 1 credit, restores on Whisper failure.
 */
export async function POST(req: Request) {
  const reqStarted = Date.now();
  let userId: string | null = null;
  let debitEntryMeta: Record<string, unknown> | null = null;

  try {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      console.error("[shorts/stt] OPENAI_API_KEY missing");
      return NextResponse.json(
        {
          error: "stt_unavailable",
          code: "missing_api_key",
          message: "OPENAI_API_KEY is not configured.",
        },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      console.warn("[shorts/stt] auth failed", {
        error: resolved.error,
        status: resolved.status,
      });
      return NextResponse.json(
        { error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }
    userId = resolved.user.id;

    const rl = checkUploadRateLimit(req, userId);
    if (!rl.ok) {
      console.warn("[shorts/stt] rate limited", { userId, resetAt: rl.resetAt });
      return NextResponse.json(
        { error: "rate_limited", code: "rate_limited", resetAt: rl.resetAt },
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const contentLength = req.headers.get("content-length");
    console.info("[shorts/stt] incoming", {
      userId,
      contentType: contentType.slice(0, 80),
      contentLength,
    });

    if (!contentType.includes("multipart/form-data")) {
      console.error("[shorts/stt] expected multipart", { contentType });
      return NextResponse.json(
        {
          error: "expected_multipart",
          code: "expected_multipart",
          message: "Send multipart/form-data with field `file`.",
        },
        { status: 400 }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      console.error("[shorts/stt] formData parse failed", {
        contentLength,
        err: err instanceof Error ? err.message : String(err),
        hint: "Body may exceed Vercel serverless limit (~4.5MB). Extract audio client-side.",
      });
      return NextResponse.json(
        {
          error: "payload_too_large",
          code: "formdata_parse_failed",
          message:
            "Could not read upload body. Extract audio on the client and retry with a smaller file.",
        },
        { status: 413 }
      );
    }

    const keys = formKeys(form);
    const file = form.get("file");
    const fileNameField = form.get("fileName");
    const mimeField = form.get("mimeType");
    const sourceKind = String(form.get("sourceKind") || "").toLowerCase();

    console.info("[shorts/stt] form fields", {
      keys,
      hasFile: file instanceof Blob,
      fileType:
        file instanceof Blob
          ? file.type || "(empty)"
          : typeof file === "string"
            ? "string"
            : file == null
              ? "null"
              : typeof file,
      fileSize: file instanceof Blob ? file.size : null,
      fileNameField:
        typeof fileNameField === "string" ? fileNameField.slice(0, 120) : null,
      mimeField: typeof mimeField === "string" ? mimeField : null,
      sourceKind: sourceKind || null,
    });

    if (!(file instanceof Blob) || file.size <= 0) {
      console.error("[shorts/stt] file_required", { keys });
      return NextResponse.json(
        {
          error: "file_required",
          code: "file_required",
          message: "Missing multipart field `file`.",
        },
        { status: 400 }
      );
    }

    if (file.size > SHORTS_STT_MAX_BYTES) {
      console.error("[shorts/stt] file_too_large", { bytes: file.size });
      return NextResponse.json(
        {
          error: "file_too_large",
          code: "file_too_large",
          message: `Max ${Math.floor(SHORTS_STT_MAX_BYTES / (1024 * 1024))}MB`,
          bytes: file.size,
        },
        { status: 413 }
      );
    }

    if (file.size > SHORTS_STT_VERCEL_SAFE_BYTES) {
      console.warn("[shorts/stt] upload above Vercel-safe size", {
        bytes: file.size,
        safe: SHORTS_STT_VERCEL_SAFE_BYTES,
      });
    }

    const rawName =
      (file instanceof File && file.name) ||
      (typeof fileNameField === "string" && fileNameField) ||
      "shorts-audio.wav";
    const mimeType =
      (typeof mimeField === "string" && mimeField) ||
      file.type ||
      "application/octet-stream";
    const fileName = whisperSafeFileName(rawName, mimeType);

    const debit = await debitCredits({
      userId,
      amount: SHORTS_CAPTION_CREDIT_COST,
      reason: "shorts_stt",
      meta: {
        source: "shorts_stt_api",
        fileName: fileName.slice(0, 120),
        bytes: file.size,
        mimeType: mimeType.slice(0, 80),
        sourceKind: sourceKind || "unknown",
      },
    });

    if (!debit.ok) {
      if (debit.reason === "insufficient") {
        return NextResponse.json(
          {
            error: "insufficient_credits",
            code: "insufficient_credits",
            message: "Insufficient credits.",
            credits: debit.credits ?? resolved.user.credits,
            cost: SHORTS_CAPTION_CREDIT_COST,
          },
          { status: 402 }
        );
      }
      console.error("[shorts/stt] debit failed", { reason: debit.reason });
      return NextResponse.json(
        { error: "not_found", code: "debit_failed" },
        { status: 404 }
      );
    }

    debitEntryMeta = debit.entry.meta ?? null;

    try {
      const result = await transcribeWithWhisper({
        apiKey,
        file,
        fileName,
        mimeType,
      });

      // Included in the same 1-credit STT debit — polish + keyword spans.
      const polished = await polishCaptionSegments({
        apiKey,
        language: result.language || "ko",
        segments: result.segments.map((s) => ({
          id: s.id,
          text: s.text,
          startSec: s.startSec,
          endSec: s.endSec,
        })),
      });

      const segments = polished.length
        ? polished.map((p, i) => {
            const raw = result.segments[i];
            return {
              ...p,
              x: raw?.x ?? p.x,
              y: raw?.y ?? p.y,
              startSec: raw?.startSec ?? p.startSec,
              endSec: raw?.endSec ?? p.endSec,
            };
          })
        : result.segments;

      console.info("[shorts/stt] success", {
        userId,
        ms: Date.now() - reqStarted,
        segments: segments.length,
        polished: polished.length > 0,
        creditsAfter: debit.user.credits,
      });

      return NextResponse.json({
        ok: true,
        creditsAfter: debit.user.credits,
        cost: SHORTS_CAPTION_CREDIT_COST,
        language: result.language ?? null,
        text: result.text,
        segments,
        durationSec: result.durationSec ?? null,
        polished: polished.length > 0,
      });
    } catch (err) {
      const code =
        err instanceof ShortsSttError ? err.code : "whisper_failed";
      const detail =
        err instanceof ShortsSttError
          ? err.detail || err.message
          : err instanceof Error
            ? err.message
            : String(err);
      const status =
        err instanceof ShortsSttError && err.status === 413 ? 413 : 502;

      console.error("[shorts/stt] whisper failed — restoring credit", {
        userId,
        code,
        detail: detail.slice(0, 800),
        ms: Date.now() - reqStarted,
        fileName,
        mimeType,
        bytes: file.size,
      });

      await creditUser({
        userId,
        amount: SHORTS_CAPTION_CREDIT_COST,
        reason: "system_error_restore",
        meta: {
          source: "shorts_stt_api",
          restore: "whisper_failed",
          code,
        },
        restoreFromDebitMeta: debit.entry.meta,
      });

      return NextResponse.json(
        {
          error: "stt_failed",
          code,
          message: "Speech recognition failed. Credit was restored.",
          detail: detail.slice(0, 400),
        },
        { status }
      );
    }
  } catch (err) {
    console.error("[shorts/stt] unhandled", {
      userId,
      ms: Date.now() - reqStarted,
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 1200) : undefined,
      debitEntryMeta,
    });
    return NextResponse.json(
      {
        error: "internal_error",
        code: "internal_error",
        message: "Unexpected STT server error.",
      },
      { status: 500 }
    );
  }
}
