/**
 * Plain print-wizard text drawing — fill + contrast shadow/stroke safety.
 */

import {
  formatFormFieldText,
  formFieldFromLayerId,
  parseProgramEntries,
  programNumFontCss,
  programNumberColumnWidth,
} from "@/lib/printWizardTextFormat";
import { stripLayerQuickInputPlaceholder } from "@/lib/layerTextPlaceholder";
import {
  colorPresetFill,
  fontForText,
  type TextLayer,
} from "@/lib/thumbnailStyles";
import { hexToRgba } from "@/lib/shortsCaptions";
import {
  isLightFillHex,
  resolveDrawTextShadow,
} from "@/lib/ai/textContrastSafety";

const PLACEHOLDER_PREFIX_RE = /^\s*(상단문구:|중간문구:|하단문구:)\s*/;

function stripLayerPlaceholderPrefix(text: string): string {
  return text.replace(PLACEHOLDER_PREFIX_RE, "");
}

export function displayTextForLayer(layer: TextLayer): string {
  const field = formFieldFromLayerId(layer.id);
  const raw = field
    ? formatFormFieldText(field, layer.text)
    : layer.text;
  return stripLayerPlaceholderPrefix(stripLayerQuickInputPlaceholder(raw));
}

function layerGlyphPad(fontSize: number): { padX: number; padY: number } {
  return {
    padX: Math.max(4, Math.round(fontSize * 0.16)),
    padY: Math.max(6, Math.round(fontSize * 0.22)),
  };
}

/** Public pad formula — keep canvas paint and edit textarea in sync. */
export function printLayerGlyphPad(fontSize: number): {
  padX: number;
  padY: number;
} {
  return layerGlyphPad(fontSize);
}

/**
 * CSS padding for the inline edit textarea so glyphs sit on the same origin
 * as `drawPrintLayerInBox` (pad + vertical center when align is center).
 */
export function layerEditTextPadding(
  layer: TextLayer,
  boxW: number,
  boxH: number,
  scale: number
): {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
} {
  const fontSize = Math.max(8, Math.round((layer.fontSize || 48) * scale));
  const { padX, padY } = layerGlyphPad(fontSize);
  const align = layer.align || "center";
  const text = displayTextForLayer(layer);

  let paddingTop = padY;
  if (align === "center" && text.trim()) {
    const lineHeightMul = layer.lineHeight ?? 1.25;
    const lineHeightPx = fontSize * lineHeightMul;
    const fontWeight = layer.fontWeight ?? 700;
    const fontPreset = layer.fontPreset || "pretendard";
    const letterSpacing =
      formFieldFromLayerId(layer.id) === "date" ||
      formFieldFromLayerId(layer.id) === "programs"
        ? 0
        : (layer.letterSpacing ?? 0) * scale;
    const innerW = Math.max(8, boxW - padX * 2);

    let lineCount = Math.max(1, text.split("\n").length);
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, text)}`;
        lineCount = wrapMultiline(ctx, text, innerW, letterSpacing).length;
      }
    }
    const blockH = lineCount * lineHeightPx;
    paddingTop = Math.max(padY, (boxH - blockH) / 2);
  }

  return {
    paddingTop,
    paddingRight: padX,
    paddingBottom: padY,
    paddingLeft: padX,
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
  const paintableText = text.replace(/\u200B/g, "").trim();

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
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const opacity = Math.max(0.15, Math.min(1, layer.boxOpacity ?? 0.55));
  if (layer.showBox) {
    ctx.fillStyle = hexToRgba(layer.boxColor || "#000000", opacity);
    const radiusFrac =
      typeof layer.boxRadius === "number" && layer.boxRadius > 0
        ? Math.min(0.5, layer.boxRadius)
        : null;
    const r = radiusFrac
      ? Math.min(boxW, boxH) * radiusFrac
      : Math.min(14, fontSize * 0.28);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(boxW, 0, boxW, boxH, r);
    ctx.arcTo(boxW, boxH, 0, boxH, r);
    ctx.arcTo(0, boxH, 0, 0, r);
    ctx.arcTo(0, 0, boxW, 0, r);
    ctx.closePath();
    ctx.fill();
    if (layer.showBoxBorder) {
      const borderHex = layer.boxBorderColor || "#ffffff";
      ctx.strokeStyle = hexToRgba(borderHex, borderHex === "#ffffff" ? 0.35 : 0.92);
      ctx.lineWidth = Math.max(
        1,
        radiusFrac ? Math.min(boxW, boxH) * 0.04 : fontSize * 0.04
      );
      ctx.stroke();
    }
  }

  if (!paintableText) {
    ctx.restore();
    return;
  }

  const shadow = resolveDrawTextShadow({
    fillHex: fill,
    textShadowColor: layer.textShadowColor,
    textShadowBlur: layer.textShadowBlur,
    textShadowOffsetX: layer.textShadowOffsetX,
    textShadowOffsetY: layer.textShadowOffsetY,
  });
  if (shadow) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * Math.max(0.5, scale);
    ctx.shadowOffsetX = shadow.offsetX * Math.max(0.5, scale);
    ctx.shadowOffsetY = shadow.offsetY * Math.max(0.5, scale);
  }

  const strokeColor =
    layer.textStroke ||
    (isLightFillHex(fill) ? "rgba(0,0,0,0.35)" : undefined);
  const strokeWidth =
    typeof layer.textStrokeWidth === "number" && layer.textStrokeWidth > 0
      ? layer.textStrokeWidth * Math.max(0.5, scale)
      : strokeColor && isLightFillHex(fill)
        ? 1.25 * Math.max(0.5, scale)
        : 0;

  const paintGlyph = (ch: string, x: number, y: number) => {
    if (strokeColor && strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(ch, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(ch, x, y);
  };

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
        paintGlyph(`${entry.num}.`, startX + numColW, y);
        ctx.font = labelFont;
        ctx.textAlign = "left";
        for (let wi = 0; wi < wrapped.length; wi++) {
          paintGlyph(wrapped[wi]!, startX + numColW + gap, y);
          y += lineHeightPx;
        }
      }
      ctx.restore();
      return;
    }
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, paintableText)}`;
  const lines = wrapMultiline(ctx, paintableText, innerW, letterSpacing);
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
        paintGlyph(ch, cursorX, y);
        cursorX += ctx.measureText(ch).width + letterSpacing;
      }
    } else {
      paintGlyph(line, x, y);
    }
    y += lineHeightPx;
  }

  ctx.restore();
}
