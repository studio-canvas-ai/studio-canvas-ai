export type AspectRatioKey = "9:16" | "16:9" | "1:1" | "a4";
export type ExportPreset = "original" | "id-photo" | "print-png" | "print-pdf";

export type DownloadOptions = {
  imageUrl: string;
  filename?: string;
  /** Bake brand watermark for free/trial users */
  bakeWatermark?: boolean;
  aspectRatio?: AspectRatioKey;
  exportPreset?: ExportPreset;
  /** Print paper when using print-* presets */
  printPaper?: "a4" | "a5";
};

const ASPECT_MAP: Record<AspectRatioKey, number> = {
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "1:1": 1,
  a4: 1 / Math.SQRT2,
};

/** ID photo 3.5×4.5 cm → aspect 7:9 */
const ID_PHOTO_RATIO = 3.5 / 4.5;

const PRINT_300DPI = {
  a4: { width: 2480, height: 3508 },
  a5: { width: 1748, height: 2480 },
} as const;

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageUrl;
  });
}

function coverCrop(
  srcW: number,
  srcH: number,
  targetRatio: number
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH;
  if (srcRatio > targetRatio) {
    const sw = srcH * targetRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / targetRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

function bakeWatermarkText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const text = "Studio Canvas AI";
  const fontSize = Math.max(14, Math.round(width * 0.028));
  ctx.save();
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const padding = Math.round(width * 0.03);
  const x = width - padding;
  const y = height - padding;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  const metrics = ctx.measureText(text);
  const boxPadX = fontSize * 0.45;
  const boxPadY = fontSize * 0.35;
  ctx.fillRect(
    x - metrics.width - boxPadX,
    y - fontSize - boxPadY * 0.4,
    metrics.width + boxPadX * 2,
    fontSize + boxPadY * 1.2
  );
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Download generated portrait with optional watermark baking,
 * aspect-ratio crop, ID-photo, and 300 DPI print exports.
 */
export async function downloadImageFile(options: DownloadOptions | string): Promise<void> {
  const opts: DownloadOptions =
    typeof options === "string" ? { imageUrl: options } : options;

  const {
    imageUrl,
    filename = `studio-canvas-portrait-${Date.now()}.png`,
    bakeWatermark = false,
    aspectRatio = "9:16",
    exportPreset = "original",
    printPaper = "a4",
  } = opts;

  if (exportPreset === "print-png" || exportPreset === "print-pdf") {
    const { downloadPrintPng, downloadPrintPdf } = await import("@/lib/printExport");
    if (exportPreset === "print-png") {
      await downloadPrintPng(imageUrl, printPaper);
    } else {
      await downloadPrintPdf(imageUrl, printPaper);
    }
    return;
  }

  const needsCanvas =
    bakeWatermark || exportPreset === "id-photo" || aspectRatio !== "9:16";

  if (!needsCanvas) {
    try {
      const response = await fetch(imageUrl, { mode: "cors", credentials: "omit" });
      if (response.ok) {
        triggerBlobDownload(await response.blob(), filename);
        return;
      }
    } catch {
      // fall through
    }
  }

  const img = await loadImage(imageUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const targetRatio =
    exportPreset === "id-photo" ? ID_PHOTO_RATIO : ASPECT_MAP[aspectRatio];
  const crop = coverCrop(srcW, srcH, targetRatio);

  let outW: number;
  let outH: number;
  if (exportPreset === "id-photo") {
    outW = 413;
    outH = 531;
  } else if (aspectRatio === "a4") {
    outW = PRINT_300DPI.a4.width;
    outH = PRINT_300DPI.a4.height;
  } else {
    outW = Math.round(crop.sw);
    outH = Math.round(crop.sh);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);

  if (bakeWatermark) {
    bakeWatermarkText(ctx, outW, outH);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/png",
      1
    );
  });

  triggerBlobDownload(blob, filename);
}
