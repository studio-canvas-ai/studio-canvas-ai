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
    '"Black Han Sans", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif',
  clean:
    '"Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Sans", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif',
  vlog:
    '"Nanum Pen Script", "Noto Sans KR", "Noto Sans JP", "Noto Color Emoji", cursive',
  neon:
    '"Orbitron", "Noto Sans KR", "Noto Sans JP", "Noto Color Emoji", sans-serif',
  impact:
    '"Do Hyeon", "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", "Noto Color Emoji", sans-serif',
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
    '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
  if (script === "ja") {
    return `"Noto Sans JP", ${FONT_STACK[preset]}, ${emoji}`;
  }
  if (script === "zh") {
    return `"Noto Sans SC", ${FONT_STACK[preset]}, ${emoji}`;
  }
  if (script === "en" && preset === "neon") {
    return `"Orbitron", "Noto Sans", ${emoji}, sans-serif`;
  }
  return `${FONT_STACK[preset]}, ${emoji}`;
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
    return '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
  }
  return fontForText(preset, ch);
}

export const STICKER_TEMPLATES = ["🔥 HOT", "NEW", "LIVE", "⚡ TIP", "🚨"] as const;

