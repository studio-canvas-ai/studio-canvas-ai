/**
 * Shorts studio — multi text-layer model + PNG composite export.
 * Preview DOM and canvas share the same metrics helpers so width / wrap /
 * box / border / fonts stay pixel-aligned.
 */

import { resolveCanvasImageUrl } from "@/lib/downloadImage";
import {
  DEFAULT_SHORTS_CAPTION_STYLE,
  hexToRgba,
  resolveCaptionBoxColor,
  resolveCaptionStrokeColor,
  resolveCaptionTextColor,
  type ShortsCaptionHighlight,
  type ShortsCaptionStyle,
} from "@/lib/shortsCaptions";
import {
  FONT_PRESET_PRIMARY,
  SHORTS_WEBFONT_FAMILIES,
  type ColorPreset,
  type FontPreset,
  type StickerBadgeId,
  type TextAlign,
  canvasFontShorthand,
  colorPresetMeta,
  createLayer,
  drawEmojiChar,
  drawStickerBadge,
  forEachCodePoint,
  isEmojiChar,
  measureStickerBadge,
  stripStickerTokens,
} from "@/lib/thumbnailStyles";

/** Design reference height used by fontSize (48 ≈ comfortable on 720px frame). */
export const SHORTS_DESIGN_HEIGHT = 720;

export type ShortsTextLayer = {
  id: string;
  text: string;
  color: ColorPreset;
  fontPreset: FontPreset;
  /** Design size relative to SHORTS_DESIGN_HEIGHT. */
  fontSize: number;
  /** CSS / canvas font-weight (300–900, step 100). Default 800. */
  fontWeight: number;
  align: TextAlign;
  showBox: boolean;
  boxOpacity: number;
  /** Outline stroke around the background box (only when showBox). */
  showBoxBorder: boolean;
  /** Background box fill (#RRGGBB). Defaults to black. */
  boxColor: string;
  /**
   * Text wrap width as a fraction of frame width (0.3–0.95).
   * Identical for live preview and PNG export.
   */
  maxWidth: number;
  /** Accent sticker badge (overlay — never written into textarea). */
  stickerId: StickerBadgeId | null;
  /** Normalized center of the text block within the frame (0–1). */
  x: number;
  y: number;
};

export const SHORTS_BOX_WIDTH_MIN = 0.3;
/** 1 = full-bleed edge-to-edge text box on the 9:16 canvas. */
export const SHORTS_BOX_WIDTH_MAX = 1;
export const SHORTS_FONT_WEIGHT_MIN = 300;
export const SHORTS_FONT_WEIGHT_MAX = 900;
export const SHORTS_FONT_WEIGHT_STEP = 100;
export const SHORTS_FONT_WEIGHT_DEFAULT = 800;
export const SHORTS_LINE_HEIGHT = 1.28;
export const SHORTS_BOX_PAD_RATIO = 0.4;
export const SHORTS_BOX_BORDER_RATIO = 0.055;

export function clampBoxWidth(v: number): number {
  return Math.max(
    SHORTS_BOX_WIDTH_MIN,
    Math.min(SHORTS_BOX_WIDTH_MAX, Number.isFinite(v) ? v : 0.88)
  );
}

/** True when the text box should span the full canvas width (no side gutter). */
export function isFullBleedBoxWidth(v: number): boolean {
  return clampBoxWidth(v) >= SHORTS_BOX_WIDTH_MAX - 0.0005;
}

/** Usable text block width in px; full-bleed drops side edge padding. */
export function shortsTextBlockWidth(
  frameW: number,
  maxWidth: number,
  minPx: number
): { maxTextW: number; edgePad: number; fullBleed: boolean } {
  const fullBleed = isFullBleedBoxWidth(maxWidth);
  const edgePad = fullBleed ? 0 : Math.round(frameW * SHORTS_OFFSET_CLAMP);
  const maxTextW = Math.max(
    minPx,
    Math.min(frameW - edgePad * 2, frameW * clampBoxWidth(maxWidth))
  );
  return { maxTextW, edgePad, fullBleed };
}

export function clampFontWeight(v: number): number {
  const raw = Number.isFinite(v) ? v : SHORTS_FONT_WEIGHT_DEFAULT;
  const stepped =
    Math.round(raw / SHORTS_FONT_WEIGHT_STEP) * SHORTS_FONT_WEIGHT_STEP;
  return Math.max(
    SHORTS_FONT_WEIGHT_MIN,
    Math.min(SHORTS_FONT_WEIGHT_MAX, stepped)
  );
}

export const SHORTS_FONT_PRESETS: FontPreset[] = [
  "pretendard",
  "variety",
  "gmarket",
  "jua",
  "jalnan",
  "maple",
  "tmon",
  "clean",
  "vlog",
  "neon",
  "impact",
  "serif",
  "rounded",
  "poster",
];

export const SHORTS_OFFSET_CLAMP = 0.02;

export function clampNorm(v: number, pad = SHORTS_OFFSET_CLAMP): number {
  return Math.max(pad, Math.min(1 - pad, v));
}

/** Shared size scale: design fontSize → rendered px for a given frame height. */
export function shortsSizeScale(frameHeight: number): number {
  return Math.max(0.01, frameHeight / SHORTS_DESIGN_HEIGHT);
}

export function shortsFontPx(fontSize: number, frameHeight: number): number {
  return Math.max(12, Math.round(fontSize * shortsSizeScale(frameHeight)));
}

export function shortsBoxPad(fontPx: number): number {
  return Math.round(fontPx * SHORTS_BOX_PAD_RATIO);
}

export function shortsBorderWidth(fontPx: number): number {
  return Math.max(2, Math.round(fontPx * SHORTS_BOX_BORDER_RATIO));
}

export function createShortsTextLayer(
  partial?: Partial<ShortsTextLayer>
): ShortsTextLayer {
  const base = createLayer({
    text: partial?.text ?? "",
    color: partial?.color ?? "yellow",
    fontPreset: partial?.fontPreset ?? "variety",
    fontSize: partial?.fontSize ?? 48,
    align: partial?.align ?? "center",
    pos: "bottom",
    stickerId: partial?.stickerId ?? null,
  });
  return {
    id: base.id,
    text: base.text,
    color: base.color,
    fontPreset: base.fontPreset,
    fontSize: base.fontSize,
    fontWeight: clampFontWeight(
      partial?.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
    ),
    align: base.align,
    showBox: partial?.showBox ?? true,
    boxOpacity: partial?.boxOpacity ?? 0.55,
    showBoxBorder: partial?.showBoxBorder ?? false,
    boxColor: partial?.boxColor ?? "#000000",
    maxWidth: clampBoxWidth(partial?.maxWidth ?? 0.88),
    stickerId: partial?.stickerId ?? null,
    x: clampNorm(partial?.x ?? 0.5),
    y: clampNorm(partial?.y ?? 0.78),
  };
}

/**
 * Wait for stylesheet + explicit family loads so canvas measureText/fillText
 * match the live preview (CJK / Devanagari / display faces).
 * Loads multiple weights — Anton/Black Han Sans are often 400-only; Noto uses 700/800.
 */
export async function ensureShortsFontsReady(
  presets?: FontPreset[]
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }

  const weights = [300, 400, 500, 600, 700, 800, 900] as const;
  const sizes = [48, 72] as const;
  const families = new Set<string>([...SHORTS_WEBFONT_FAMILIES]);
  for (const p of presets ?? []) {
    families.add(FONT_PRESET_PRIMARY[p]);
  }

  const probes: string[] = [];
  for (const family of families) {
    for (const w of weights) {
      for (const size of sizes) {
        probes.push(`${w} ${size}px "${family}"`);
      }
    }
  }

  try {
    await Promise.allSettled(probes.map((desc) => document.fonts.load(desc)));
  } catch {
    /* ignore — system fallbacks still render */
  }

  // Probe full canvas shorthand for each preset (ensures stack parse works).
  try {
    const list = presets?.length
      ? presets
      : (Object.keys(FONT_PRESET_PRIMARY) as FontPreset[]);
    await Promise.allSettled(
      list.map((p) => document.fonts.load(canvasFontShorthand(p, 48, "가A Aa")))
    );
  } catch {
    /* ignore */
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Eagerly load one preset's primary face (call on font-chip click). */
export async function ensurePresetFontLoaded(
  preset: FontPreset
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const family = FONT_PRESET_PRIMARY[preset];
  try {
    await document.fonts.ready;
    await Promise.allSettled([
      document.fonts.load(`300 48px "${family}"`),
      document.fonts.load(`400 48px "${family}"`),
      document.fonts.load(`500 48px "${family}"`),
      document.fonts.load(`600 48px "${family}"`),
      document.fonts.load(`700 48px "${family}"`),
      document.fonts.load(`800 48px "${family}"`),
      document.fonts.load(`900 48px "${family}"`),
      document.fonts.load(canvasFontShorthand(preset, 48, "가A Aa", 800)),
    ]);
  } catch {
    /* ignore */
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    if (!url.startsWith("data:") && !url.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = resolveCanvasImageUrl(url);
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontPreset: FontPreset,
  fontSize: number,
  fontWeight: number
): string[] {
  const pure = stripStickerTokens(text);
  const paragraphs = pure.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  const weight = clampFontWeight(fontWeight);

  const measure = (s: string) => {
    let w = 0;
    forEachCodePoint(s, (ch) => {
      if (isEmojiChar(ch)) w += fontSize * 1.1;
      else {
        ctx.font = canvasFontShorthand(fontPreset, fontSize, ch, weight);
        w += ctx.measureText(ch).width;
      }
    });
    return w;
  };

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    // Prefer whitespace wrap; CJK/emoji without spaces fall through to grapheme chunking.
    const words = para.split(/(\s+)/).filter((p) => p.length > 0);
    let line = "";
    for (const word of words) {
      if (/^\s+$/.test(word)) {
        if (line) line += " ";
        continue;
      }
      const test = line ? `${line} ${word}` : word;
      if (measure(test) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        if (measure(word) > maxWidth) {
          let chunk = "";
          forEachCodePoint(word, (ch) => {
            const next = chunk + ch;
            if (measure(next) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk = next;
            }
          });
          line = chunk;
        } else {
          line = word;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  line: string,
  fontPreset: FontPreset,
  fontSize: number,
  fontWeight: number
): number {
  const weight = clampFontWeight(fontWeight);
  let w = 0;
  forEachCodePoint(line, (ch) => {
    if (isEmojiChar(ch)) w += fontSize * 1.1;
    else {
      ctx.font = canvasFontShorthand(fontPreset, fontSize, ch, weight);
      w += ctx.measureText(ch).width;
    }
  });
  return w;
}

/** Draw one layer centered at (cx, cy) in canvas pixels. */
export function drawShortsTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: ShortsTextLayer,
  frameW: number,
  frameH: number,
  sizeScale = shortsSizeScale(frameH)
) {
  const text = stripStickerTokens(layer.text).trim();
  const hasSticker = Boolean(layer.stickerId);
  if (!text && !hasSticker) return;

  const fontSize = Math.max(12, Math.round(layer.fontSize * sizeScale));
  const fontWeight = clampFontWeight(
    layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
  );
  const { maxTextW, edgePad } = shortsTextBlockWidth(
    frameW,
    layer.maxWidth,
    fontSize * 2
  );
  const lines = text
    ? wrapLines(ctx, text, maxTextW, layer.fontPreset, fontSize, fontWeight)
    : [];
  const lineHeight = Math.round(fontSize * SHORTS_LINE_HEIGHT);
  const blockH = Math.max(lineHeight, lines.length * lineHeight);
  const boxPad = shortsBoxPad(fontSize);
  const blockW = maxTextW;

  const cx = layer.x * frameW;
  const cy = layer.y * frameH;
  let blockLeft = cx - blockW / 2;
  if (edgePad <= 0) {
    blockLeft = 0;
  } else {
    blockLeft = Math.max(
      edgePad,
      Math.min(frameW - edgePad - blockW, blockLeft)
    );
  }
  const blockTop = cy - blockH / 2;

  if (layer.showBox && (text || hasSticker)) {
    const alpha = Math.max(0, Math.min(1, layer.boxOpacity));
    const stickerExtra = hasSticker ? fontSize * 1.35 : 0;
    let bx = blockLeft - boxPad;
    let bw = blockW + boxPad * 2;
    if (edgePad <= 0) {
      bx = 0;
      bw = frameW;
    }
    const by = blockTop - boxPad - stickerExtra * 0.15;
    const bh = blockH + boxPad * 2 + stickerExtra * 0.35;
    const br = edgePad <= 0 ? 0 : Math.round(fontSize * 0.35);
    roundRectPath(ctx, bx, by, bw, bh, br);
    ctx.fillStyle = hexToRgba(layer.boxColor || "#000000", alpha);
    ctx.fill();
    if (layer.showBoxBorder) {
      ctx.lineWidth = shortsBorderWidth(fontSize);
      ctx.strokeStyle = "rgba(255,255,255,0.88)";
      ctx.stroke();
    }
  }

  if (layer.stickerId) {
    const scale = shortsSizeScale(frameH);
    const badgeW = measureStickerBadge(ctx, layer.stickerId, scale);
    let badgeX = blockLeft + (blockW - badgeW) / 2;
    if (layer.align === "left") badgeX = blockLeft;
    if (layer.align === "right") badgeX = blockLeft + blockW - badgeW;
    const badgeY = blockTop - fontSize * 0.85;
    drawStickerBadge(ctx, layer.stickerId, badgeX, badgeY, scale);
  }

  if (!text) return;

  const preset = colorPresetMeta(layer.color);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineW = measureLineWidth(
      ctx,
      line,
      layer.fontPreset,
      fontSize,
      fontWeight
    );

    let x = blockLeft;
    if (layer.align === "center") x = blockLeft + (blockW - lineW) / 2;
    if (layer.align === "right") x = blockLeft + blockW - lineW;
    const y = blockTop + i * lineHeight;

    forEachCodePoint(line, (ch) => {
      if (isEmojiChar(ch)) {
        const w = drawEmojiChar(ctx, ch, x, y + fontSize * 0.55, fontSize);
        x += w;
        return;
      }
      // e.g. `700 70px "Black Han Sans", "Noto Sans KR", ...`
      ctx.font = canvasFontShorthand(
        layer.fontPreset,
        fontSize,
        ch,
        fontWeight
      );
      const w = ctx.measureText(ch).width;
      ctx.shadowColor = preset.shadow;
      ctx.shadowBlur =
        layer.color === "white" ||
        layer.color === "purplePink" ||
        layer.color === "hotPink" ||
        layer.color === "skyBlue"
          ? 12
          : 6;
      ctx.lineWidth = Math.max(3, fontSize * 0.08);
      if (preset.stroke !== "transparent") {
        ctx.strokeStyle = preset.stroke;
        ctx.strokeText(ch, x, y);
      }
      ctx.fillStyle = preset.fill;
      ctx.fillText(ch, x, y);
      x += w;
    });
  }
  ctx.shadowBlur = 0;
}

export async function exportShortsThumbnailPng(params: {
  imageUrl: string;
  layers: ShortsTextLayer[];
  maxHeight?: number;
}): Promise<Blob> {
  const presets = [
    ...new Set(params.layers.map((l) => l.fontPreset)),
  ] as FontPreset[];
  await ensureShortsFontsReady(presets);

  const img = await loadImage(params.imageUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const maxH = params.maxHeight ?? 1920;
  const scale = srcH > maxH ? maxH / srcH : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const sizeScale = shortsSizeScale(h);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.drawImage(img, 0, 0, w, h);
  for (const layer of params.layers) {
    drawShortsTextLayer(ctx, layer, w, h, sizeScale);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("png_encode_failed"))),
      "image/png",
      1
    );
  });
}

/**
 * Transparent PNG of text/sticker layers only — sized to the target video frame
 * for FFmpeg `overlay=0:0` compositing.
 */
export async function exportShortsOverlayPng(params: {
  layers: ShortsTextLayer[];
  width: number;
  height: number;
}): Promise<Blob> {
  const presets = [
    ...new Set(params.layers.map((l) => l.fontPreset)),
  ] as FontPreset[];
  await ensureShortsFontsReady(presets);

  const w = Math.max(1, Math.round(params.width));
  const h = Math.max(1, Math.round(params.height));
  const sizeScale = shortsSizeScale(h);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.clearRect(0, 0, w, h);
  for (const layer of params.layers) {
    drawShortsTextLayer(ctx, layer, w, h, sizeScale);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("overlay_png_failed"))),
      "image/png",
      1
    );
  });
}

/**
 * Draw caption text with per-run highlight colors (and optional keyword scale bump).
 * Used by timed caption PNG burn so MP4 matches the full-studio preview.
 */
export function drawCaptionTextWithHighlights(
  ctx: CanvasRenderingContext2D,
  params: {
    text: string;
    x: number;
    y: number;
    frameW: number;
    frameH: number;
    style: ShortsCaptionStyle;
    highlights?: ShortsCaptionHighlight[] | null;
  }
) {
  const text = params.text.trim();
  if (!text) return;

  const style = params.style;
  const sizeScale = shortsSizeScale(params.frameH);
  const baseFont = Math.max(12, Math.round(style.fontSize * sizeScale));
  const fontWeight = clampFontWeight(style.fontWeight);
  const fontPreset: FontPreset =
    style.fontPreset || DEFAULT_SHORTS_CAPTION_STYLE.fontPreset;
  const { maxTextW, edgePad } = shortsTextBlockWidth(
    params.frameW,
    style.maxWidth,
    baseFont * 2
  );

  const highlightMask = new Uint8Array(text.length);
  for (const h of params.highlights || []) {
    for (let i = Math.max(0, h.start); i < Math.min(text.length, h.end); i++) {
      highlightMask[i] = 1;
    }
  }

  const lines = wrapLines(ctx, text, maxTextW, fontPreset, baseFont, fontWeight);
  const lineHeight = Math.round(baseFont * SHORTS_LINE_HEIGHT * 1.05);
  const blockH = Math.max(lineHeight, lines.length * lineHeight);
  const boxPad = shortsBoxPad(baseFont);
  const blockW = maxTextW;
  const cx = params.x * params.frameW;
  const cy = params.y * params.frameH;
  let blockLeft = cx - blockW / 2;
  if (edgePad <= 0) {
    blockLeft = 0;
  } else {
    blockLeft = Math.max(
      edgePad,
      Math.min(params.frameW - edgePad - blockW, blockLeft)
    );
  }
  const blockTop = cy - blockH / 2;

  if (style.showBox) {
    const alpha = Math.max(0, Math.min(1, style.boxOpacity));
    const boxHex = resolveCaptionBoxColor(style);
    let bx = blockLeft - boxPad;
    let bw = blockW + boxPad * 2;
    if (edgePad <= 0) {
      bx = 0;
      bw = params.frameW;
    }
    roundRectPath(
      ctx,
      bx,
      blockTop - boxPad,
      bw,
      blockH + boxPad * 2,
      edgePad <= 0 ? 0 : Math.round(baseFont * 0.35)
    );
    ctx.fillStyle = hexToRgba(boxHex, alpha);
    ctx.fill();
    if (style.showBoxBorder) {
      ctx.lineWidth = shortsBorderWidth(baseFont);
      ctx.strokeStyle = resolveCaptionStrokeColor(style);
      ctx.stroke();
    }
  }

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const fillColor = resolveCaptionTextColor(style);
  const strokeColor = resolveCaptionStrokeColor(style);
  const hiFill = resolveCaptionTextColor(style, { highlight: true });

  let scanFrom = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const idx = text.indexOf(line, scanFrom);
    const lineStart = idx >= 0 ? idx : scanFrom;
    scanFrom = lineStart + line.length;

    const lineW = measureLineWidth(ctx, line, fontPreset, baseFont, fontWeight);
    let x = blockLeft + (blockW - lineW) / 2;
    const y = blockTop + i * lineHeight;

    let local = 0;
    forEachCodePoint(line, (ch) => {
      const absIndex = lineStart + local;
      const isHi = highlightMask[absIndex] === 1;
      const fontSize =
        isHi && style.popKeywords ? Math.round(baseFont * 1.12) : baseFont;
      const fill = isHi ? hiFill : fillColor;

      if (isEmojiChar(ch)) {
        const w = drawEmojiChar(ctx, ch, x, y + fontSize * 0.55, fontSize);
        x += w;
        local += ch.length;
        return;
      }

      ctx.font = canvasFontShorthand(fontPreset, fontSize, ch, fontWeight);
      const w = ctx.measureText(ch).width;
      const blurBase = 6 + style.shadowDepth * 4;
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = blurBase;
      ctx.shadowOffsetX = Math.round(style.shadowDepth);
      ctx.shadowOffsetY = Math.round(style.shadowDepth * 1.2);
      ctx.lineWidth = Math.max(3, fontSize * 0.08 * style.strokeWidth);
      if (strokeColor && strokeColor.toLowerCase() !== "transparent") {
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(ch, x, y);
      }
      ctx.fillStyle = fill;
      ctx.fillText(ch, x, y);
      x += w;
      local += ch.length;
    });
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Single timed-caption frame as transparent PNG (full canvas, text at segment x/y).
 */
export async function exportCaptionOverlayPng(params: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: ColorPreset;
  fontSize?: number;
  highlights?: ShortsCaptionHighlight[] | null;
  style?: ShortsCaptionStyle | null;
}): Promise<Blob> {
  const style = {
    ...DEFAULT_SHORTS_CAPTION_STYLE,
    ...(params.style || {}),
    ...(params.color ? { color: params.color } : {}),
    ...(params.fontSize ? { fontSize: params.fontSize } : {}),
  };

  await ensureShortsFontsReady([
    style.fontPreset || DEFAULT_SHORTS_CAPTION_STYLE.fontPreset,
  ]);

  const w = Math.max(1, Math.round(params.width));
  const h = Math.max(1, Math.round(params.height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.clearRect(0, 0, w, h);

  drawCaptionTextWithHighlights(ctx, {
    text: params.text,
    x: params.x,
    y: params.y,
    frameW: w,
    frameH: h,
    style,
    highlights: params.highlights,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("overlay_png_failed"))),
      "image/png",
      1
    );
  });
}

/** Read intrinsic pixel size from a video blob (for overlay sizing). */
export function probeVideoDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      if (width < 2 || height < 2) {
        reject(new Error("video_dimensions_invalid"));
        return;
      }
      resolve({ width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("video_metadata_failed"));
    };
    video.src = url;
  });
}

export function triggerPngDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** @deprecated single-style API — kept for type compatibility during migration */
export type ShortsOverlayStyle = {
  text: string;
  fontSizePx: number;
  color: string;
  align: "left" | "center" | "right";
  vAlign: "top" | "middle" | "bottom";
  showBox: boolean;
  boxOpacity: number;
};
