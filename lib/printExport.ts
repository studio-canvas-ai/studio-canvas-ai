/** A-series paper aspect ≈ 1 : √2 (portrait height/width) */
export const A_SERIES_RATIO = 1 / Math.SQRT2; // ≈ 0.7071 (W/H)

/** Print sizes at 300 DPI (portrait) */
export const PRINT_300DPI = {
  a4: { width: 2480, height: 3508 }, // 210×297 mm
  a5: { width: 1748, height: 2480 }, // 148×210 mm
} as const;

export type PrintPaper = keyof typeof PRINT_300DPI;

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

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageUrl;
  });
}

/** Encode canvas as PNG blob */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png",
      1
    );
  });
}

async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality = 0.95
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function buildPdfWithJpeg(
  jpeg: Uint8Array,
  imgW: number,
  imgH: number
): Blob {
  const wPt = (imgW / 300) * 72;
  const hPt = (imgH / 300) * 72;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    parts.push(bytes);
    offset += bytes.length;
  };
  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    offset += b.length;
  };
  const markObj = () => {
    offsets.push(offset);
  };

  pushStr("%PDF-1.4\n");

  markObj(); // 1
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  markObj(); // 2
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  markObj(); // 3
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  markObj(); // 4 image
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  pushBytes(jpeg);
  pushStr("\nendstream\nendobj\n");

  markObj(); // 5 content
  const content = `q\n${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  pushStr(
    `5 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`
  );

  const xrefStart = offset;
  pushStr(`xref\n0 ${offsets.length}\n`);
  pushStr("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

export async function renderPrintCanvas(
  imageUrl: string,
  paper: PrintPaper = "a4"
): Promise<HTMLCanvasElement> {
  const { width, height } = PRINT_300DPI[paper];
  const img = await loadImage(imageUrl);
  const crop = coverCrop(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    width / height
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  return canvas;
}

export async function downloadPrintPng(
  imageUrl: string,
  paper: PrintPaper = "a4"
): Promise<void> {
  const canvas = await renderPrintCanvas(imageUrl, paper);
  const blob = await canvasToPngBlob(canvas);
  triggerBlobDownload(blob, `studio-canvas-print-${paper}-300dpi-${Date.now()}.png`);
}

export async function downloadPrintPdf(
  imageUrl: string,
  paper: PrintPaper = "a4"
): Promise<void> {
  const canvas = await renderPrintCanvas(imageUrl, paper);
  const jpeg = await canvasToJpegBytes(canvas, 0.92);
  const pdf = buildPdfWithJpeg(jpeg, canvas.width, canvas.height);
  triggerBlobDownload(pdf, `studio-canvas-print-${paper}-300dpi-${Date.now()}.pdf`);
}

/** Export an existing canvas (e.g. thumbnail editor) at print size */
export async function downloadCanvasPrint(
  source: HTMLCanvasElement,
  format: "png" | "pdf",
  paper: PrintPaper = "a4"
): Promise<void> {
  const { width, height } = PRINT_300DPI[paper];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(source, 0, 0, width, height);
  if (format === "png") {
    const blob = await canvasToPngBlob(canvas);
    triggerBlobDownload(blob, `studio-canvas-thumb-print-${paper}-300dpi-${Date.now()}.png`);
    return;
  }
  const jpeg = await canvasToJpegBytes(canvas, 0.92);
  const pdf = buildPdfWithJpeg(jpeg, width, height);
  triggerBlobDownload(pdf, `studio-canvas-thumb-print-${paper}-300dpi-${Date.now()}.pdf`);
}
