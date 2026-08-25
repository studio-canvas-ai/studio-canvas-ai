/**
 * Plain print-wizard text drawing — fill only, no per-char stroke or badge boxes.
 */

import {
  formatFormFieldText,
  formFieldFromLayerId,
  parseProgramEntries,
  programNumFontCss,
  programNumberColumnWidth,
} from "@/lib/printWizardTextFormat";
import {
  colorPresetFill,
  fontForText,
  type TextLayer,
} from "@/lib/thumbnailStyles";
import { hexToRgba } from "@/lib/shortsCaptions";

const PLACEHOLDER_PREFIX_RE = /^\s*(상단문구:|중간문구:|하단문구:)\s*/;

function stripLayerPlaceholderPrefix(text: string): string {
  return text.replace(PLACEHOLDER_PREFIX_RE, "");
}

export function displayTextForLayer(layer: TextLayer): string {
  const field = formFieldFromLayerId(layer.id);
  if (!field) return stripLayerPlaceholderPrefix(layer.text);
  return stripLayerPlaceholderPrefix(formatFormFieldText(field, layer.text));
}

function layerGlyphPad(fontSize: number): { padX: number; padY: number } {
  return {
    padX: Math.max(4, Math.round(fontSize * 0.16)),
    padY: Math.max(6, Math.round(fontSize * 0.22)),
  };
}

function lineXForAlign(
  align: TextLayer["align"],
  lineW: number,
  boxW: number,
  padX: number
): number {
  if (align === "left") return padX;
  if (align === "right") return Math.max(padX, boxW - padX - lineW);
  return Math.max(padX, (boxW - lineW) / 2);
}

function measureWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
): number {
  if (!text) return 0;
  const extra = Math.max(0, text.length - 1) * letterSpacing;
  return ctx.measureText(text).width + extra;
}

/** Wrap a single paragraph to maxWidth (CJK-friendly greedy break). */
export function wrapParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing = 0
): string[] {
  const width = Math.max(8, maxWidth);
  if (!text) return [""];
  const out: string[] = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (measureWithSpacing(ctx, next, letterSpacing) <= width || !current) {
      current = next;
      continue;
    }
    out.push(current);
    current = ch;
  }
  if (current) out.push(current);
  return out.length ? out : [""];
}

export function wrapMultiline(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing = 0
): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    lines.push(...wrapParagraph(ctx, para, maxWidth, letterSpacing));
  }
  return lines.length ? lines : [""];
}

/** Paint layer text into a pixel box (preview overlay / export helpers). */
export function drawPrintLayerInBox(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  boxW: number,
  boxH: number,
  scale: number
): void {
  const text = displayTextForLayer(layer);
  if (!text.trim()) return;

  const fontSize = Math.max(8, Math.round((layer.fontSize || 48) * scale));
  const fontWeight = layer.fontWeight ?? 700;
  const fontPreset = layer.fontPreset || "pretendard";
  const lineHeightMul = layer.lineHeight ?? 1.25;
  const lineHeightPx = fontSize * lineHeightMul;
  const { padX, padY } = layerGlyphPad(fontSize);
  const fill = colorPresetFill(layer.color);
  const align = layer.align || "center";
  const letterSpacing =
    formFieldFromLayerId(layer.id) === "date" ||
    formFieldFromLayerId(layer.id) === "programs"
      ? 0
      : (layer.letterSpacing ?? 0) * scale;

  ctx.save();
  ctx.textBaseline = "top";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  const opacity = Math.max(0.15, Math.min(0.9, layer.boxOpacity ?? 0.55));
  if (layer.showBox) {
    ctx.fillStyle = hexToRgba(layer.boxColor || "#000000", opacity);
    const r = Math.min(14, fontSize * 0.28);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(boxW, 0, boxW, boxH, r);
    ctx.arcTo(boxW, boxH, 0, boxH, r);
    ctx.arcTo(0, boxH, 0, 0, r);
    ctx.arcTo(0, 0, boxW, 0, r);
    ctx.closePath();
    ctx.fill();
    if (layer.showBoxBorder) {
      ctx.strokeStyle = hexToRgba("#ffffff", 0.35);
      ctx.lineWidth = Math.max(1, fontSize * 0.04);
      ctx.stroke();
    }
  }

  // Soft halo so inkBlack / light fills stay readable on busy AI backgrounds.
  const fillLum =
    fill.startsWith("#") && fill.length >= 7
      ? (parseInt(fill.slice(1, 3), 16) * 0.299 +
          parseInt(fill.slice(3, 5), 16) * 0.587 +
          parseInt(fill.slice(5, 7), 16) * 0.114) /
        255
      : 0.2;
  ctx.shadowBlur = Math.max(3, fontSize * 0.12);
  ctx.shadowColor =
    fillLum < 0.45 ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)";

  ctx.fillStyle = fill;

  const innerW = Math.max(8, boxW - padX * 2);

  if (layer.id === "form-programs") {
    const entries = parseProgramEntries(layer.text);
    if (entries.length) {
      const numColW = programNumberColumnWidth(
        entries,
        fontSize,
        fontWeight,
        ctx
      );
      const gap = fontSize * 0.35;
      const labelMax = Math.max(8, innerW - numColW - gap);
      const labelFont = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, text)}`;
      ctx.font = labelFont;
      let startX = padX;
      if (align === "right") startX = Math.max(padX, boxW - padX - innerW);
      else if (align === "center") {
        startX = Math.max(padX, (boxW - innerW) / 2);
      }

      const numFont = programNumFontCss(fontWeight, fontSize);
      let y = padY;
      for (const entry of entries) {
        ctx.font = labelFont;
        const wrapped = wrapParagraph(ctx, entry.label, labelMax, 0);
        ctx.font = numFont;
        ctx.textAlign = "right";
        ctx.fillText(`${entry.num}.`, startX + numColW, y);
        ctx.font = labelFont;
        ctx.textAlign = "left";
        for (let wi = 0; wi < wrapped.length; wi++) {
          ctx.fillText(wrapped[wi]!, startX + numColW + gap, y);
          y += lineHeightPx;
        }
      }
      ctx.restore();
      return;
    }
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, text)}`;
  const lines = wrapMultiline(ctx, text, innerW, letterSpacing);
  const blockH = lines.length * lineHeightPx;
  let y = padY;
  if (align === "center") {
    y = Math.max(padY, (boxH - blockH) / 2);
  }

  for (const line of lines) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, line)}`;
    const sample = line.length ? line : " ";
    const lineW = measureWithSpacing(ctx, sample, letterSpacing);
    const x = lineXForAlign(align, lineW, boxW, padX);
    ctx.textAlign = "left";
    if (letterSpacing > 0) {
      let cursorX = x;
      for (const ch of sample) {
        ctx.fillText(ch, cursorX, y);
        cursorX += ctx.measureText(ch).width + letterSpacing;
      }
    } else {
      ctx.fillText(line, x, y);
    }
    y += lineHeightPx;
  }

  ctx.restore();
}
