export type AspectRatioKey =
  | "original"
  | "9:16"
  | "16:9"
  | "1:1"
  | "4:3"
  | "4:5"
  | "3:1"
  | "4:1"
  | "a2"
  | "a3"
  | "a4"
  | "id";
export type ExportPreset = "original" | "id-photo" | "print-png" | "print-pdf";

export const ASPECT_RATIO_CLASS: Record<AspectRatioKey, string> = {
  original: "",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "4:5": "aspect-[4/5]",
  "3:1": "aspect-[3/1]",
  "4:1": "aspect-[4/1]",
  a2: "aspect-[1/1.414]",
  a3: "aspect-[1/1.414]",
  a4: "aspect-[1/1.414]",
  id: "aspect-[7/9]",
};

/** Same-origin URL for canvas/fetch so R2/CDN images are not blocked by CORS. */
export function resolveCanvasImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return `/api/media/fetch?src=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

export type DownloadQuality = ExportPreset | "hd";
export type OutputSize = { width: number; height: number; name: string };

/**
 * Cover-crop framing controls.
 * - x/y: -1..1 focal offset within available crop slack (0 = centered)
 * - scale: >= 1 zoom into the cover crop (1 = true cover, no overscan empty edges)
 */
export type ImagePan = { x: number; y: number; scale: number };

export const IMAGE_SCALE_MIN = 1;
export const IMAGE_SCALE_MAX = 3;
export const DEFAULT_IMAGE_PAN: ImagePan = { x: 0, y: 0, scale: 1 };

export function clampImagePan(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

export function clampImageScale(s: number): number {
  if (!Number.isFinite(s)) return IMAGE_SCALE_MIN;
  return Math.max(IMAGE_SCALE_MIN, Math.min(IMAGE_SCALE_MAX, s));
}

export function normalizeImagePan(
  pan?: Partial<ImagePan> | null
): ImagePan {
  return {
    x: clampImagePan(pan?.x ?? 0),
    y: clampImagePan(pan?.y ?? 0),
    scale: clampImageScale(pan?.scale ?? 1),
  };
}

/** Drag distance (as fraction of frame) → pan units. */
export const IMAGE_PAN_SENSITIVITY = 2.5;

export type DownloadOptions = {
  imageUrl: string;
  filename?: string;
  /** Bake brand watermark for free/trial users */
  bakeWatermark?: boolean;
  aspectRatio?: AspectRatioKey;
  exportPreset?: DownloadQuality;
  /** Print paper when using print-* presets */
  printPaper?: "a4" | "a5";
  /** Cover-crop pan so downloads match the preview framing */
  imagePan?: ImagePan;
};

const ASPECT_MAP: Record<AspectRatioKey, number> = {
  original: 0,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "1:1": 1,
  "4:3": 4 / 3,
  "4:5": 4 / 5,
  "3:1": 3,
  "4:1": 4,
  a2: 1 / Math.SQRT2,
  a3: 1 / Math.SQRT2,
  a4: 1 / Math.SQRT2,
  id: 3.5 / 4.5,
};

/** Width/height ratio for crop frames (0 = original / unused). */
export function aspectRatioValue(key: AspectRatioKey): number {
  return ASPECT_MAP[key] ?? 0;
}

/** ID photo 3.5×4.5 cm → aspect 7:9 */
const ID_PHOTO_RATIO = 3.5 / 4.5;

const PRINT_300DPI = {
  a2: { width: 4961, height: 7016 },
  a3: { width: 3508, height: 4961 },
  a4: { width: 2480, height: 3508 },
  a5: { width: 1748, height: 2480 },
} as const;

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = resolveCanvasImageUrl(imageUrl);
  });
}

export function outputSizeForAspect(aspectRatio: AspectRatioKey): OutputSize {
  switch (aspectRatio) {
    case "original":
      return { width: 0, height: 0, name: "original" };
    case "a2":
      return { ...PRINT_300DPI.a2, name: "a2" };
    case "a3":
      return { ...PRINT_300DPI.a3, name: "a3" };
    case "a4":
      return { ...PRINT_300DPI.a4, name: "a4" };
    case "3:1":
      return { width: 4500, height: 1500, name: "3x1-banner" };
    case "4:1":
      return { width: 4800, height: 1200, name: "4x1-banner" };
    case "4:3":
      return { width: 3600, height: 2700, name: "4x3-editorial" };
    case "4:5":
      return { width: 3000, height: 3750, name: "4x5-instagram" };
    case "16:9":
      return { width: 3840, height: 2160, name: "16x9-banner" };
    case "1:1":
      return { width: 3000, height: 3000, name: "1x1-square" };
    case "id":
      return { width: 413, height: 531, name: "id-photo" };
    case "9:16":
    default:
      return { width: 2160, height: 3840, name: "9x16-portrait" };
  }
}

/**
 * Cover crop with optional zoom.
 * scale=1 → classic cover (pan only on the axis that has slack).
 * scale>1 → smaller crop window → free 2D pan while never leaving empty frame edges.
 */
export function coverCrop(
  srcW: number,
  srcH: number,
  targetRatio: number,
  panX = 0,
  panY = 0,
  scale = 1
): { sx: number; sy: number; sw: number; sh: number } {
  if (!Number.isFinite(targetRatio) || targetRatio <= 0) {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  }
  const px = clampImagePan(panX);
  const py = clampImagePan(panY);
  const zoom = clampImageScale(scale);
  const srcRatio = srcW / srcH;

  let baseSw: number;
  let baseSh: number;
  if (srcRatio > targetRatio) {
    baseSw = srcH * targetRatio;
    baseSh = srcH;
  } else {
    baseSw = srcW;
    baseSh = srcW / targetRatio;
  }

  const sw = Math.min(srcW, baseSw / zoom);
  const sh = Math.min(srcH, baseSh / zoom);
  const maxSx = Math.max(0, srcW - sw);
  const maxSy = Math.max(0, srcH - sh);

  return {
    sx: maxSx / 2 + (px * maxSx) / 2,
    sy: maxSy / 2 + (py * maxSy) / 2,
    sw,
    sh,
  };
}

/** Letterbox fit — used only when explicitly needed; not for ratio framing. */
export function containFit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): { dx: number; dy: number; dw: number; dh: number } {
  if (srcW < 1 || srcH < 1 || dstW < 1 || dstH < 1) {
    return { dx: 0, dy: 0, dw: dstW, dh: dstH };
  }
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return {
    dx: (dstW - dw) / 2,
    dy: (dstH - dh) / 2,
    dw,
    dh,
  };
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
    imagePan: imagePanRaw = DEFAULT_IMAGE_PAN,
  } = opts;
  const imagePan = normalizeImagePan(imagePanRaw);

  if (!imageUrl.trim()) {
    throw new Error("empty_image_url");
  }

  const fetchUrl = resolveCanvasImageUrl(imageUrl);
  const isId = exportPreset === "id-photo" || aspectRatio === "id";
  const isNativeOriginal = aspectRatio === "original";
  const needsCanvas =
    bakeWatermark ||
    exportPreset === "hd" ||
    isId ||
    (!isNativeOriginal && aspectRatio !== "9:16") ||
    exportPreset !== "original";

  if (!needsCanvas || (isNativeOriginal && !bakeWatermark && exportPreset === "original")) {
    try {
      const response = await fetch(fetchUrl, { credentials: "same-origin" });
      if (response.ok) {
        triggerBlobDownload(await response.blob(), filename);
        return;
      }
    } catch {
      // fall through to canvas path
    }
  }

  const img = await loadImage(imageUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  if (isNativeOriginal && !isId) {
    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(img, 0, 0);
    if (bakeWatermark) bakeWatermarkText(ctx, srcW, srcH);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
        "image/png",
        1
      );
    });
    triggerBlobDownload(blob, filename);
    return;
  }

  const targetRatio = isId ? ID_PHOTO_RATIO : ASPECT_MAP[aspectRatio];

  let outW: number;
  let outH: number;
  if (isId) {
    outW = 413;
    outH = 531;
  } else {
    const frame = outputSizeForAspect(aspectRatio);
    outW = frame.width || srcW;
    outH = frame.height || srcH;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const crop = coverCrop(
    srcW,
    srcH,
    targetRatio,
    imagePan.x,
    imagePan.y,
    imagePan.scale ?? 1
  );
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);

  if (exportPreset === "print-png" || exportPreset === "print-pdf") {
    const { downloadCanvasPrint } = await import("@/lib/printExport");
    const output = outputSizeForAspect(aspectRatio);
    await downloadCanvasPrint(canvas, exportPreset === "print-png" ? "png" : "pdf", {
      width: outW,
      height: outH,
      name: output.name || printPaper,
    });
    return;
  }

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
