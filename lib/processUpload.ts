import { ACCEPTED_IMAGE_EXT, ACCEPTED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@/lib/data";

export type ProcessedUpload = {
  url: string;
  name: string;
  convertedFromHeic?: boolean;
};

/** Max edge length for profile/gallery thumbnails stored in localStorage. */
const DATA_URL_MAX_EDGE = 1280;
const DATA_URL_JPEG_QUALITY = 0.82;

/** Cloud general-photo upload: max 1920px WebP before hitting the API. */
export const CLOUD_UPLOAD_MAX_EDGE = 1920;
export const CLOUD_UPLOAD_WEBP_QUALITY = 0.82;

function getExt(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  return fromName;
}

export function isAcceptedImageFile(file: File): boolean {
  const ext = getExt(file);
  const mime = (file.type || "").toLowerCase();
  if (ACCEPTED_IMAGE_EXT.includes(ext as (typeof ACCEPTED_IMAGE_EXT)[number])) return true;
  if (mime && ACCEPTED_IMAGE_MIME.includes(mime as (typeof ACCEPTED_IMAGE_MIME)[number])) {
    return true;
  }
  // Some iOS browsers leave HEIC type empty
  if (!mime && (ext === "heic" || ext === "heif")) return true;
  return false;
}

export function isHeicFile(file: File): boolean {
  const ext = getExt(file);
  const mime = (file.type || "").toLowerCase();
  return ext === "heic" || ext === "heif" || mime.includes("heic") || mime.includes("heif");
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  return blob as Blob;
}

type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

/** Decode via createImageBitmap, then HTMLImageElement (SVG / CMYK JPEG fallback). */
async function decodeImageBlob(blob: Blob): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(blob);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  } catch {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image_decode_failed"));
        el.src = objectUrl;
      });
      return {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, width, height) => ctx.drawImage(img, 0, 0, width, height),
        close: () => undefined,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Compress an image Blob into a JPEG Base64 data URL safe for localStorage.
 */
export async function blobToCompressedDataUrl(
  blob: Blob,
  maxEdge = DATA_URL_MAX_EDGE,
  quality = DATA_URL_JPEG_QUALITY
): Promise<string> {
  const image = await decodeImageBlob(blob);
  try {
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    image.draw(ctx, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    image.close();
  }
}

/**
 * Convert any displayable image URL (blob:/data:/http) into a compressed data URL.
 * Passes through existing data: URLs after optional re-compress when oversized.
 */
export async function urlToCompressedDataUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("empty_image_url");

  if (trimmed.startsWith("data:image/")) {
    // Already durable — re-compress only if very large (> ~900KB string).
    if (trimmed.length < 900_000) return trimmed;
    const res = await fetch(trimmed);
    const blob = await res.blob();
    return blobToCompressedDataUrl(blob);
  }

  const res = await fetch(trimmed);
  if (!res.ok) throw new Error(`image_fetch_failed:${res.status}`);
  const blob = await res.blob();
  return blobToCompressedDataUrl(blob);
}

export async function processUploadFiles(
  files: File[],
  remainingSlots: number
): Promise<{ ok: ProcessedUpload[]; errors: string[] }> {
  const slice = files.slice(0, Math.max(0, remainingSlots));
  const ok: ProcessedUpload[] = [];
  const errors: string[] = [];

  for (const file of slice) {
    if (!isAcceptedImageFile(file)) {
      errors.push(`unsupported:${file.name}`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`tooLarge:${file.name}`);
      continue;
    }

    try {
      const sourceBlob = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
      const url = await blobToCompressedDataUrl(sourceBlob);
      ok.push({
        url,
        name: isHeicFile(file)
          ? file.name.replace(/\.(heic|heif)$/i, ".jpg")
          : file.name,
        convertedFromHeic: isHeicFile(file) || undefined,
      });
    } catch {
      errors.push(`convertFail:${file.name}`);
    }
  }

  return { ok, errors };
}

/**
 * Client-side resize ≤1920px + WebP for Cloudflare R2 general-photo uploads.
 * Falls back to JPEG when WebP encoding is unavailable.
 * On any failure, returns the original file so the server sharp pipeline can process it.
 */
export async function compressFileForCloudUpload(file: File): Promise<File> {
  if (!isAcceptedImageFile(file)) {
    throw new Error(`unsupported:${file.name}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`tooLarge:${file.name}`);
  }

  try {
    const sourceBlob = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
    const image = await decodeImageBlob(sourceBlob);
    try {
      const scale = Math.min(
        1,
        CLOUD_UPLOAD_MAX_EDGE / Math.max(image.width, image.height)
      );
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas_unavailable");
      image.draw(ctx, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else {
              canvas.toBlob(
                (jpeg) =>
                  jpeg ? resolve(jpeg) : reject(new Error("encode_failed")),
                "image/jpeg",
                CLOUD_UPLOAD_WEBP_QUALITY
              );
            }
          },
          "image/webp",
          CLOUD_UPLOAD_WEBP_QUALITY
        );
      });

      const base = file.name.replace(/\.[^.]+$/, "") || "photo";
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      return new File([blob], `${base}.${ext}`, { type: blob.type });
    } finally {
      image.close();
    }
  } catch {
    // SVG / exotic codecs: let the server sharp pipeline handle conversion.
    return file;
  }
}

/** Yield to the browser so multi-file uploads do not freeze the UI. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}
