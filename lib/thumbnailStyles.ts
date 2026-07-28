/** Color swatch presets for thumbnail text */
export type ColorPreset =
  | "yellow"
  | "white"
  | "red"
  | "neonLime"
  | "deepBlue"
  | "purplePink"
  | "blackGold"
  | "orange";

export type FontPreset = "variety" | "clean" | "vlog" | "neon" | "impact";
export type TextAlign = "left" | "center" | "right";
export type TextPos = "top" | "center" | "bottom";
export type DepthMode = "front" | "behind";

export type ColorRange = {
  start: number;
  end: number;
  color: ColorPreset;
};

export type TextLayer = {
  id: string;
  text: string;
  color: ColorPreset;
  fontPreset: FontPreset;
  fontSize: number;
  align: TextAlign;
  ranges: ColorRange[];
  /** Per-line vertical slot: top / center / bottom (#91) */
  pos: TextPos;
  /** Normalized offsets from snap anchor (-0.4 ~ 0.4) */
  offsetX: number;
  offsetY: number;
};

export const COLOR_PRESETS: Record<
  ColorPreset,
  { fill: string; stroke: string; shadow: string }
> = {
  yellow: { fill: "#FACC15", stroke: "#111111", shadow: "rgba(0,0,0,0.55)" },
  white: { fill: "#FFFFFF", stroke: "transparent", shadow: "rgba(0,0,0,0.65)" },
  red: { fill: "#EF4444", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.45)" },
  neonLime: { fill: "#A3E635", stroke: "#111111", shadow: "rgba(0,0,0,0.55)" },
  deepBlue: { fill: "#1D4ED8", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.5)" },
  purplePink: { fill: "#E879F9", stroke: "#7C3AED", shadow: "rgba(124,58,237,0.7)" },
  blackGold: { fill: "#F59E0B", stroke: "#111111", shadow: "rgba(0,0,0,0.6)" },
  orange: { fill: "#FB923C", stroke: "#FFFFFF", shadow: "rgba(0,0,0,0.45)" },
};

export const COLOR_PRESET_ORDER: ColorPreset[] = [
  "yellow",
  "white",
  "red",
  "neonLime",
  "deepBlue",
  "purplePink",
  "blackGold",
  "orange",
];

export const EMOJI_QUICK = ["#", "@", "[", "]", "🔥", "🚨", "👉", "✨", "💯", "⚡"] as const;

const FONT_STACK: Record<FontPreset, string> = {
  variety:
    '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Black Han Sans", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", system-ui, sans-serif',
  clean:
    '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans", system-ui, sans-serif',
  vlog:
    '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Nanum Pen Script", "Noto Sans KR", "Noto Sans JP", cursive',
  neon:
    '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Orbitron", "Noto Sans KR", "Noto Sans JP", sans-serif',
  impact:
    '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Do Hyeon", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", sans-serif',
};

export function detectScript(text: string): "ko" | "ja" | "zh" | "en" {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text) && !/[\uac00-\ud7af]/.test(text)) return "zh";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  return "en";
}

/** i18n font fallback — prevents tofu □□□ for CJK / emoji */
export function fontForText(preset: FontPreset, text: string): string {
  const script = detectScript(text);
  const emoji =
    '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol"';
  if (script === "ja") {
    return `${emoji}, "Noto Sans JP", ${FONT_STACK[preset]}`;
  }
  if (script === "zh") {
    return `${emoji}, "Noto Sans SC", ${FONT_STACK[preset]}`;
  }
  if (script === "en" && preset === "neon") {
    return `${emoji}, "Orbitron", "Noto Sans", sans-serif`;
  }
  return `${emoji}, ${FONT_STACK[preset]}`;
}

export function createLayer(partial?: Partial<TextLayer>): TextLayer {
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: "",
    color: "yellow",
    fontPreset: "variety",
    fontSize: 48,
    align: "center",
    ranges: [],
    pos: "bottom",
    offsetX: 0,
    offsetY: 0,
    ...partial,
  };
}

export function colorAtIndex(layer: TextLayer, index: number): ColorPreset {
  for (const r of layer.ranges) {
    if (index >= r.start && index < r.end) return r.color;
  }
  return layer.color;
}

/** Merge overlapping/adjacent ranges of same color */
export function applyColorRange(
  ranges: ColorRange[],
  start: number,
  end: number,
  color: ColorPreset
): ColorRange[] {
  if (start >= end) return ranges;
  const next: ColorRange[] = [];
  for (const r of ranges) {
    if (r.end <= start || r.start >= end) {
      next.push(r);
      continue;
    }
    if (r.start < start) next.push({ start: r.start, end: start, color: r.color });
    if (r.end > end) next.push({ start: end, end: r.end, color: r.color });
  }
  next.push({ start, end, color });
  return next.sort((a, b) => a.start - b.start);
}

export function isEmojiChar(ch: string): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u.test(ch);
}

export function fontForChar(preset: FontPreset, ch: string): string {
  if (isEmojiChar(ch)) {
    return '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';
  }
  return fontForText(preset, ch);
}

export const STICKER_BADGE_IDS = [
  "HOT",
  "NEW",
  "LIVE",
  "TIP",
  "인기",
  "신규",
  "라이브",
  "꿀팁",
  "추천",
] as const;
export type StickerBadgeId = (typeof STICKER_BADGE_IDS)[number];

export type StickerBadgeDef = {
  id: StickerBadgeId;
  label: string;
  emoji?: string;
  fill: string;
  stroke: string;
  glow: string;
  textColor: string;
};

export const STICKER_BADGES: Record<StickerBadgeId, StickerBadgeDef> = {
  HOT: {
    id: "HOT",
    label: "HOT",
    emoji: "🔥",
    fill: "#FF3D00",
    stroke: "#FFD600",
    glow: "rgba(255,61,0,0.85)",
    textColor: "#FFFFFF",
  },
  NEW: {
    id: "NEW",
    label: "NEW",
    fill: "#22C55E",
    stroke: "#A3E635",
    glow: "rgba(34,197,94,0.85)",
    textColor: "#0B1A0F",
  },
  LIVE: {
    id: "LIVE",
    label: "LIVE",
    fill: "#EF4444",
    stroke: "#FCA5A5",
    glow: "rgba(239,68,68,0.9)",
    textColor: "#FFFFFF",
  },
  TIP: {
    id: "TIP",
    label: "TIP",
    emoji: "⚡",
    fill: "#7C3AED",
    stroke: "#E879F9",
    glow: "rgba(124,58,237,0.85)",
    textColor: "#FFFFFF",
  },
  인기: {
    id: "인기",
    label: "인기",
    emoji: "🔥",
    fill: "#FF3D00",
    stroke: "#FFD600",
    glow: "rgba(255,61,0,0.85)",
    textColor: "#FFFFFF",
  },
  신규: {
    id: "신규",
    label: "신규",
    fill: "#22C55E",
    stroke: "#A3E635",
    glow: "rgba(34,197,94,0.85)",
    textColor: "#0B1A0F",
  },
  라이브: {
    id: "라이브",
    label: "라이브",
    fill: "#EF4444",
    stroke: "#FCA5A5",
    glow: "rgba(239,68,68,0.9)",
    textColor: "#FFFFFF",
  },
  꿀팁: {
    id: "꿀팁",
    label: "꿀팁",
    emoji: "⚡",
    fill: "#7C3AED",
    stroke: "#E879F9",
    glow: "rgba(124,58,237,0.85)",
    textColor: "#FFFFFF",
  },
  추천: {
    id: "추천",
    label: "추천",
    emoji: "✨",
    fill: "#0EA5E9",
    stroke: "#7DD3FC",
    glow: "rgba(14,165,233,0.85)",
    textColor: "#FFFFFF",
  },
};

/** @deprecated Use STICKER_BADGES + stickerToken() */
export const STICKER_TEMPLATES = STICKER_BADGE_IDS.map((id) => {
  const b = STICKER_BADGES[id];
  return b.emoji ? `${b.emoji} ${b.label}` : b.label;
}) as readonly string[];

const STICKER_TOKEN_RE = /\[\[(HOT|NEW|LIVE|TIP|인기|신규|라이브|꿀팁|추천)\]\]/g;

export function stickerToken(id: StickerBadgeId): string {
  return ` [[${id}]] `;
}

export function isStickerToken(segment: string): segment is StickerBadgeId {
  return (STICKER_BADGE_IDS as readonly string[]).includes(segment);
}

export type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "sticker"; id: StickerBadgeId };

export function segmentText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(STICKER_TOKEN_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      segments.push({ kind: "text", value: text.slice(last, idx) });
    }
    segments.push({ kind: "sticker", id: match[1] as StickerBadgeId });
    last = idx + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments.length ? segments : [{ kind: "text", value: text }];
}

const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';

/** Draw a single emoji char via offscreen canvas (color emoji fallback). */
export function drawEmojiChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  fontSize: number
): number {
  const pad = Math.ceil(fontSize * 0.15);
  const size = Math.ceil(fontSize * 1.25);
  const off = document.createElement("canvas");
  off.width = size + pad * 2;
  off.height = size + pad * 2;
  const octx = off.getContext("2d");
  if (!octx) {
    ctx.font = `700 ${fontSize}px ${EMOJI_FONT}`;
    ctx.fillText(ch, x, y);
    return ctx.measureText(ch).width || fontSize;
  }
  octx.font = `${fontSize}px ${EMOJI_FONT}`;
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.fillText(ch, off.width / 2, off.height / 2);
  const w = size;
  ctx.drawImage(off, x, y - fontSize * 0.55, w, w);
  return w;
}

export function measureStickerBadge(
  ctx: CanvasRenderingContext2D,
  id: StickerBadgeId,
  scale = 1
): number {
  const badge = STICKER_BADGES[id];
  const fontSize = Math.round(22 * scale);
  const padX = Math.round(14 * scale);
  ctx.font = `800 ${fontSize}px "Orbitron", "Noto Sans KR", sans-serif`;
  const labelW = ctx.measureText(badge.label).width;
  const emojiW = badge.emoji ? fontSize * 1.1 : 0;
  const gap = badge.emoji ? 4 * scale : 0;
  return labelW + emojiW + gap + padX * 2;
}

export function drawStickerBadge(
  ctx: CanvasRenderingContext2D,
  id: StickerBadgeId,
  x: number,
  y: number,
  scale = 1
): number {
  const badge = STICKER_BADGES[id];
  const fontSize = Math.round(22 * scale);
  const padX = Math.round(14 * scale);
  const padY = Math.round(8 * scale);
  const label = badge.label;
  ctx.save();
  ctx.font = `800 ${fontSize}px "Orbitron", "Noto Sans KR", sans-serif`;
  const labelW = ctx.measureText(label).width;
  const emojiW = badge.emoji ? fontSize * 1.1 : 0;
  const gap = badge.emoji ? 4 * scale : 0;
  const w = labelW + emojiW + gap + padX * 2;
  const h = fontSize + padY * 2;
  const rx = h / 2;
  const top = y - h / 2;

  ctx.shadowColor = badge.glow;
  ctx.shadowBlur = 14 * scale;
  ctx.beginPath();
  ctx.roundRect(x, top, w, h, rx);
  ctx.fillStyle = badge.fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5 * scale;
  ctx.strokeStyle = badge.stroke;
  ctx.stroke();

  let cx = x + padX;
  const cy = y;
  if (badge.emoji) {
    drawEmojiChar(ctx, badge.emoji, cx, cy, fontSize * 0.95);
    cx += emojiW + gap;
  }
  ctx.fillStyle = badge.textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 ${fontSize}px "Orbitron", "Noto Sans KR", sans-serif`;
  ctx.fillText(label, cx, cy);
  ctx.restore();
  return w;
}

