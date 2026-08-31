/**
 * Shorts / video-thumbnail — video upload policy & R2 key helpers (phase 2+).
 *
 * Large clips use presigned PUT → Cloudflare R2 (not proxied through Vercel).
 */

import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";

export { SHORTS_THUMBNAIL_PATH };

/** Default max clip size for Shorts upload (presigned R2). Override via SHORTS_MAX_VIDEO_BYTES. */
export const DEFAULT_SHORTS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const SHORTS_VIDEO_ACCEPT = "video/*,.mp4,.mov,.webm,.m4v,.avi" as const;

export const SHORTS_ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-msvideo",
  "video/avi",
  /** Android / legacy mobile captures */
  "video/3gpp",
  "video/3gpp2",
] as const;

/** Primary formats surfaced in UI copy (MP4 · MOV · WebM). */
export const SHORTS_PRIMARY_VIDEO_EXTENSIONS = ["mp4", "mov", "webm"] as const;

const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  "3g2": "video/3gpp2",
};

export type ShortsUploadFileMeta = {
  fileName: string;
  mime: string;
  sizeBytes: number;
};

/**
 * Normalize mobile File objects — iOS/Android often ship empty names, "blob", or
 * generic MIME types while the extension is still valid.
 */
export function normalizeShortsUploadFile(file: File): ShortsUploadFileMeta {
  const rawName = (file.name || "").trim();
  const mime = (file.type || "").trim().toLowerCase();
  let fileName = rawName;

  if (
    !fileName ||
    fileName === "blob" ||
    fileName === "unknown" ||
    fileName === "image.dat"
  ) {
    const extFromMime =
      mime.includes("quicktime") || mime.includes("mov")
        ? "mov"
        : mime.includes("webm")
          ? "webm"
          : mime.includes("3gpp2")
            ? "3g2"
            : mime.includes("3gpp") || mime.includes("3gp")
              ? "3gp"
              : "mp4";
    fileName = `shorts-upload-${Date.now()}.${extFromMime}`;
  }

  const sizeBytes =
    typeof file.size === "number" && Number.isFinite(file.size) ? file.size : 0;

  return { fileName, mime, sizeBytes };
}

export type ShortsStorageMode = "r2" | "local";

export type ShortsUploadPhase =
  | "idle"
  | "uploading"
  | "ready"
  | "extracting"
  | "hooks_ready"
  | "error";

export type ShortsVideoAsset = {
  videoId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  /** Local object URL for immediate <video> preview (revoke on replace/clear). */
  previewUrl: string;
  storageKey: string | null;
  playbackUrl: string | null;
  storage: ShortsStorageMode;
};

export function getShortsMaxVideoBytes(): number {
  const raw = process.env.SHORTS_MAX_VIDEO_BYTES?.trim();
  if (!raw) return DEFAULT_SHORTS_MAX_VIDEO_BYTES;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SHORTS_MAX_VIDEO_BYTES;
}

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() || fileName;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function resolveShortsVideoContentType(
  mime: string | undefined | null,
  fileName: string
): string | null {
  const t = (mime || "").trim().toLowerCase();
  const ext = extensionOf(fileName);
  const fromExt = ext ? EXT_TO_MIME[ext] : null;

  if (t && (SHORTS_ALLOWED_VIDEO_MIME as readonly string[]).includes(t)) {
    return t;
  }

  // iOS gallery / Android content providers often report octet-stream.
  if (
    t === "application/octet-stream" ||
    t === "binary/octet-stream" ||
    t === "application/x-mp4"
  ) {
    return fromExt;
  }

  if (t.startsWith("video/")) {
    // Prefer extension mapping when mobile sends a non-canonical video/* subtype.
    if (fromExt) return fromExt;
    return t;
  }

  return fromExt;
}

export function isAllowedShortsVideo(
  mime: string | undefined | null,
  fileName: string,
  sizeBytes: number,
  maxBytes = getShortsMaxVideoBytes()
): { ok: true; contentType: string } | { ok: false; error: string } {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: "empty_file" };
  }
  if (sizeBytes > maxBytes) {
    return { ok: false, error: "file_too_large" };
  }
  const contentType = resolveShortsVideoContentType(mime, fileName);
  if (!contentType) {
    return { ok: false, error: "unsupported_type" };
  }
  return { ok: true, contentType };
}

export function shortsVideoKey(
  userId: string,
  videoId: string,
  fileName: string
): string {
  const ext = extensionOf(fileName) || "mp4";
  const safeExt = /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : "mp4";
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `shorts/${safeUser}/${safeId}.${safeExt}`;
}

export function isOwnedShortsKey(userId: string, key: string): boolean {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  return key.startsWith(`shorts/${safeUser}/`) && !key.includes("..");
}

export function formatBytes(bytes: number, locale = "en"): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toLocaleString(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })} ${units[i]}`;
}
