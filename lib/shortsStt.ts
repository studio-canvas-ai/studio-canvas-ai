/**
 * OpenAI Whisper transcription helper for Shorts timed captions.
 * Uses the official OpenAI SDK (audio.transcriptions.create).
 */

import OpenAI, { toFile } from "openai";
import {
  SHORTS_STT_MAX_BYTES,
  createCaptionSegment,
  type ShortsCaptionSegment,
} from "@/lib/shortsCaptions";

export { SHORTS_STT_MAX_BYTES, SHORTS_STT_VERCEL_SAFE_BYTES } from "@/lib/shortsCaptions";

export type WhisperVerboseSegment = {
  id?: number;
  seek?: number;
  start?: number;
  end?: number;
  text?: string;
};

export type WhisperVerboseJson = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: WhisperVerboseSegment[];
};

const WHISPER_SAFE_EXTS = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

export class ShortsSttError extends Error {
  code: string;
  status?: number;
  detail?: string;

  constructor(
    code: string,
    message: string,
    opts?: { status?: number; detail?: string; cause?: unknown }
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "ShortsSttError";
    this.code = code;
    this.status = opts?.status;
    this.detail = opts?.detail;
  }
}

export function getOpenAiApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

export function normalizeWhisperSegments(
  raw: WhisperVerboseJson | null | undefined
): ShortsCaptionSegment[] {
  const segs = Array.isArray(raw?.segments) ? raw!.segments! : [];
  const out: ShortsCaptionSegment[] = [];
  for (const s of segs) {
    const text = String(s.text || "").trim();
    if (!text) continue;
    const start = Math.max(0, Number(s.start) || 0);
    const end = Math.max(start + 0.05, Number(s.end) || start + 1);
    out.push(
      createCaptionSegment({
        text,
        startSec: start,
        endSec: end,
      })
    );
  }
  if (!out.length && raw?.text?.trim()) {
    out.push(
      createCaptionSegment({
        text: raw.text.trim(),
        startSec: 0,
        endSec: Math.max(1, Number(raw.duration) || 3),
      })
    );
  }
  return out;
}

function guessExt(fileName: string, mimeType: string): string {
  const fromName = fileName.match(/\.([A-Za-z0-9]{2,5})$/)?.[1]?.toLowerCase();
  if (fromName && WHISPER_SAFE_EXTS.has(fromName)) return fromName;

  const m = (mimeType || "").toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("m4a") || m.includes("mp4") || m.includes("aac")) return "m4a";
  if (m.includes("flac")) return "flac";
  return "wav";
}

/** ASCII-only Whisper-safe filename (never raw user Hangul names). */
export function whisperSafeFileName(
  fileName: string,
  mimeType: string
): string {
  const ext = guessExt(fileName, mimeType);
  return `shorts-stt.${ext}`;
}

function summarizeUnknownError(err: unknown): {
  name: string;
  message: string;
  status?: number;
  body?: string;
} {
  if (err instanceof ShortsSttError) {
    return {
      name: err.name,
      message: err.message,
      status: err.status,
      body: err.detail?.slice(0, 800),
    };
  }
  if (err && typeof err === "object") {
    const anyErr = err as {
      name?: string;
      message?: string;
      status?: number;
      statusCode?: number;
      error?: { message?: string; type?: string; code?: string };
      code?: string;
    };
    const status = anyErr.status ?? anyErr.statusCode;
    const apiMsg =
      anyErr.error?.message ||
      anyErr.message ||
      (typeof anyErr.code === "string" ? anyErr.code : "unknown_error");
    return {
      name: anyErr.name || "Error",
      message: apiMsg,
      status: typeof status === "number" ? status : undefined,
      body: anyErr.error
        ? JSON.stringify(anyErr.error).slice(0, 800)
        : undefined,
    };
  }
  return { name: "Error", message: String(err) };
}

/**
 * Transcribe audio with Whisper verbose_json + segment timestamps.
 */
export async function transcribeWithWhisper(params: {
  apiKey: string;
  file: Blob;
  fileName: string;
  mimeType?: string;
  language?: string;
}): Promise<{
  segments: ShortsCaptionSegment[];
  language?: string;
  text: string;
  durationSec?: number;
}> {
  const mimeType =
    params.mimeType ||
    params.file.type ||
    "application/octet-stream";
  const safeName = whisperSafeFileName(params.fileName, mimeType);
  const bytes = params.file.size;

  console.info("[shorts/stt] whisper request", {
    safeName,
    mimeType,
    bytes,
    language: params.language || null,
    keyPrefix: params.apiKey.slice(0, 7) + "…",
  });

  if (bytes <= 0) {
    throw new ShortsSttError("empty_file", "Uploaded audio is empty.");
  }
  if (bytes > SHORTS_STT_MAX_BYTES) {
    throw new ShortsSttError(
      "file_too_large",
      `Audio exceeds ${Math.floor(SHORTS_STT_MAX_BYTES / (1024 * 1024))}MB Whisper limit.`,
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const upload = await toFile(buffer, safeName, {
    type: mimeType.includes("/") ? mimeType : "audio/wav",
  });

  const client = new OpenAI({
    apiKey: params.apiKey,
    timeout: 90_000,
    maxRetries: 1,
  });

  const started = Date.now();
  try {
    const transcription = await client.audio.transcriptions.create({
      file: upload,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      ...(params.language ? { language: params.language } : {}),
    });

    const json = transcription as unknown as WhisperVerboseJson;
    const segments = normalizeWhisperSegments(json);
    console.info("[shorts/stt] whisper ok", {
      ms: Date.now() - started,
      language: json.language,
      segmentCount: segments.length,
      textChars: String(json.text || "").length,
      duration: json.duration,
    });

    return {
      segments,
      language: json.language,
      text: String(json.text || "").trim(),
      durationSec: Number.isFinite(Number(json.duration))
        ? Number(json.duration)
        : undefined,
    };
  } catch (err) {
    const summary = summarizeUnknownError(err);
    console.error("[shorts/stt] whisper API failed", {
      ms: Date.now() - started,
      safeName,
      mimeType,
      bytes,
      ...summary,
    });
    throw new ShortsSttError(
      summary.status ? `openai_${summary.status}` : "openai_error",
      summary.message || "OpenAI Whisper request failed",
      {
        status: summary.status,
        detail: summary.body || summary.message,
        cause: err,
      }
    );
  }
}
