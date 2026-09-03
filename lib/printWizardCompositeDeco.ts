/**
 * Canvas export helpers for Lucide vectors + decorative shapes.
 * Uses react-dom/server (no react-dom/client) so API/server imports stay valid.
 */

import dynamicIconImports from "lucide-react/dynamicIconImports";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideProps } from "lucide-react";
import { normalizeLucideIconName, isEmojiGlyph } from "@/lib/printWizardLucide";
import type { PrintDecoLayer, PrintDecoShapeType } from "@/lib/printWizardTypes";

type DynamicImportKey = keyof typeof dynamicIconImports;
type LucideIconComponent = ComponentType<LucideProps>;

const iconCache = new Map<string, LucideIconComponent | null>();

async function loadIcon(name: string): Promise<LucideIconComponent | null> {
  const key = normalizeLucideIconName(name);
  if (!key || isEmojiGlyph(name)) return null;
  if (iconCache.has(key)) return iconCache.get(key) ?? null;
  const loader = dynamicIconImports[key as DynamicImportKey];
  if (!loader) {
    iconCache.set(key, null);
    return null;
  }
  try {
    const mod = await loader();
    const Comp = (mod as { default?: LucideIconComponent }).default ?? null;
    iconCache.set(key, Comp);
    return Comp;
  } catch {
    iconCache.set(key, null);
    return null;
  }
}

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

async function lucideToImage(
  name: string,
  size: number,
  color: string
): Promise<HTMLImageElement | null> {
  const Comp = await loadIcon(name);
  if (!Comp) return null;
  try {
    const markup = renderToStaticMarkup(
      createElement(Comp, {
        size: Math.round(size),
        color,
        strokeWidth: 2,
        absoluteStrokeWidth: true,
        xmlns: "http://www.w3.org/2000/svg",
      })
    );
    // Ensure xmlns for data-URL rasterization.
    const withNs = markup.includes("xmlns=")
      ? markup
      : markup.replace(
          "<svg",
          '<svg xmlns="http://www.w3.org/2000/svg"'
        );
    return await svgToImage(withNs);
  } catch {
    return null;
  }
}

function shapeSvgMarkup(
  shapeType: PrintDecoShapeType,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  cornerRadius: number
): string {
  const sw = Math.max(0.5, strokeWidth);
  if (shapeType === "line") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 12" preserveAspectRatio="none"><line x1="2" y1="6" x2="98" y2="6" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
  }
  if (shapeType === "frame") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="3" y="3" width="94" height="94" fill="none" stroke="${stroke}" stroke-width="${sw}" rx="8"/><rect x="8" y="8" width="84" height="84" fill="none" stroke="${stroke}" stroke-width="${sw * 0.55}" stroke-dasharray="4 3" rx="6" opacity="0.85"/></svg>`;
  }
  if (shapeType === "circle" || shapeType === "stamp") {
    const inner =
      shapeType === "stamp"
        ? `<circle cx="50" cy="50" r="36" fill="none" stroke="${stroke}" stroke-width="${sw * 0.6}" stroke-dasharray="3 2"/>`
        : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>${inner}</svg>`;
  }
  if (shapeType === "ribbon") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M4 6 H102 L114 20 L102 34 H4 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw * 0.6}"/></svg>`;
  }
  const rx = shapeType === "pill" ? 50 : Math.min(24, Math.max(0, cornerRadius));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="2" y="2" width="96" height="96" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
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
    const fill = layer.fill || "rgba(255,255,255,0.92)";
    const stroke = layer.stroke || "#1f2937";
    const markup = shapeSvgMarkup(
      layer.shapeType,
      Math.max(1, box.width),
      Math.max(1, box.height),
      fill,
      stroke,
      layer.strokeWidth ?? 2,
      layer.cornerRadius ?? 8
    );
    try {
      const img = await svgToImage(markup);
      ctx.drawImage(img, -box.width / 2, -box.height / 2, box.width, box.height);
    } catch {
      /* skip when Image API unavailable (non-browser) */
    }
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
