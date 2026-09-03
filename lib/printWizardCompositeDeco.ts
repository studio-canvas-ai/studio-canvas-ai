/**
 * Canvas export helpers for Lucide vectors + decorative shapes.
 * No react-dom imports — safe for Next server/client shared modules.
 */

import { normalizeLucideIconName, isEmojiGlyph } from "@/lib/printWizardLucide";
import type { PrintDecoLayer, PrintDecoShapeType } from "@/lib/printWizardTypes";

function svgToImage(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("image_unavailable"));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("svg_image_failed"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });
}

/** Load Lucide SVG (browser export). Falls back silently if offline/unavailable. */
async function lucideToImage(
  name: string,
  size: number,
  color: string
): Promise<HTMLImageElement | null> {
  const key = normalizeLucideIconName(name);
  if (!key || isEmojiGlyph(name) || typeof fetch === "undefined") return null;
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/lucide-static@0.469.0/icons/${key}.svg`,
      { mode: "cors" }
    );
    if (!res.ok) return null;
    let svg = await res.text();
    svg = svg
      .replace(/stroke="currentColor"/g, `stroke="${color}"`)
      .replace(/fill="none"/g, 'fill="none"')
      .replace(/\swidth="24"/, ` width="${Math.round(size)}"`)
      .replace(/\sheight="24"/, ` height="${Math.round(size)}"`);
    if (!svg.includes("xmlns=")) {
      svg = svg.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }
    return await svgToImage(svg);
  } catch {
    return null;
  }
}

function drawShapePrimitive(
  ctx: CanvasRenderingContext2D,
  shapeType: PrintDecoShapeType,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  cornerRadius: number
) {
  const sw = Math.max(0.5, strokeWidth);
  ctx.save();
  ctx.translate(-w / 2, -h / 2);
  ctx.lineWidth = sw;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  if (shapeType === "line") {
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h / 2);
    ctx.lineTo(w * 0.98, h / 2);
    ctx.strokeStyle = stroke || fill;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (shapeType === "circle" || shapeType === "stamp") {
    const r = Math.min(w, h) * 0.44;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (shapeType === "stamp") {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r * 0.82, 0, Math.PI * 2);
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    return;
  }

  if (shapeType === "frame") {
    const inset = Math.max(4, sw * 2);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(inset * 2, inset * 2, w - inset * 4, h - inset * 4);
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  if (shapeType === "ribbon") {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.15);
    ctx.lineTo(w * 0.85, h * 0.15);
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(w * 0.85, h * 0.85);
    ctx.lineTo(0, h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // pill | rect
  const r =
    shapeType === "pill"
      ? Math.min(w, h) / 2
      : Math.min(cornerRadius, Math.min(w, h) / 2);
  const x = sw / 2;
  const y = sw / 2;
  const rw = w - sw;
  const rh = h - sw;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, rw, rh, r);
  } else {
    ctx.rect(x, y, rw, rh);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export async function drawDecoLayerOnCanvas(
  ctx: CanvasRenderingContext2D,
  layer: PrintDecoLayer,
  box: { x: number; y: number; width: number; height: number }
): Promise<void> {
  ctx.save();
  ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);

  if (layer.lucideIcon) {
    const size = Math.max(12, Math.min(box.width, box.height));
    const color = layer.fill || layer.stroke || "#111827";
    const img = await lucideToImage(layer.lucideIcon, size, color);
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
    return;
  }

  if (layer.shapeType) {
    drawShapePrimitive(
      ctx,
      layer.shapeType,
      Math.max(1, box.width),
      Math.max(1, box.height),
      layer.fill || "rgba(255,255,255,0.92)",
      layer.stroke || "#1f2937",
      layer.strokeWidth ?? 2,
      layer.cornerRadius ?? 8
    );
    ctx.restore();
    return;
  }

  if (layer.symbol) {
    const size = Math.max(12, Math.min(box.width, box.height));
    ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(layer.symbol, 0, 0);
  }

  ctx.restore();
}
