/** Space 4 / Template 04 — raster preview from export blob. */

export const SPACE4_THUMB_MAX_DATA_LEN = 200_000;

/**
 * Downscale an exported page blob into a JPEG data URL for admin queue previews.
 * Uses the same composite the user downloads (bg + photos + text + deco).
 */
export async function blobToSpace4ThumbDataUrl(
  blob: Blob,
  maxWidth = 360,
  quality = 0.82
): Promise<string | null> {
  if (!blob.size) return null;
  try {
    if (typeof createImageBitmap !== "function") {
      return await blobToDataUrlViaImage(blob, maxWidth, quality);
    }
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / Math.max(1, bmp.width));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close?.();
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length > SPACE4_THUMB_MAX_DATA_LEN) {
      return canvas.toDataURL("image/jpeg", 0.65);
    }
    return dataUrl;
  } catch {
    return null;
  }
}

async function blobToDataUrlViaImage(
  blob: Blob,
  maxWidth: number,
  quality: number
): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function normalizeSpace4ThumbSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) {
    return trimmed.length <= SPACE4_THUMB_MAX_DATA_LEN ? trimmed : null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.slice(0, 2048);
  }
  return null;
}
