/**
 * Timed caption segments for Shorts studio (Whisper STT → timeline edit → FFmpeg).
 */

import {
  COLOR_PRESETS,
  type ColorPreset,
  type FontPreset,
} from "@/lib/thumbnailStyles";

/** Legacy constant — AI captions no longer debit the credit wallet. */
export const SHORTS_CAPTION_CREDIT_COST = 0;
/** Cap timed PNG overlays to keep FFmpeg.wasm filtergraphs manageable. */
export const SHORTS_CAPTION_RENDER_MAX = 40;

/** Whisper API hard limit is 25MB; keep a safety margin. */
export const SHORTS_STT_MAX_BYTES = 24 * 1024 * 1024;
/** Stay under typical Vercel serverless request body (~4.5MB). */
export const SHORTS_STT_VERCEL_SAFE_BYTES = 4 * 1024 * 1024;

export const SHORTS_CAPTION_Y_TOP = 0.18;
export const SHORTS_CAPTION_Y_MID = 0.5;
export const SHORTS_CAPTION_Y_BOTTOM = 0.82;
export const SHORTS_CAPTION_X_DEFAULT = 0.5;

export const SHORTS_CAPTION_TIME_STEP = 0.1;
export const SHORTS_CAPTION_MIN_DURATION = 0.1;

/** Design fontSize range for dual-studio caption slider (scaled to frame via shortsFontPx). */
export const SHORTS_CAPTION_FONT_SIZE_MIN = 12;
export const SHORTS_CAPTION_FONT_SIZE_MAX = 72;

export function clampCaptionFontSize(v: number): number {
  const n = Number.isFinite(v) ? Math.round(v) : 42;
  return Math.max(
    SHORTS_CAPTION_FONT_SIZE_MIN,
    Math.min(SHORTS_CAPTION_FONT_SIZE_MAX, n)
  );
}

export type ShortsCaptionHighlight = {
  /** Inclusive UTF-16 code unit start index in `text` */
  start: number;
  /** Exclusive UTF-16 code unit end index in `text` */
  end: number;
};

export type ShortsCaptionEntranceEffect =
  | "instant"
  | "bounce"
  | "wordHighlight"
  | "slide";

export const SHORTS_CAPTION_ENTRANCE_EFFECTS: readonly ShortsCaptionEntranceEffect[] =
  ["instant", "bounce", "wordHighlight", "slide"] as const;

export function normalizeCaptionEntranceEffect(
  value: string | null | undefined
): ShortsCaptionEntranceEffect {
  if (
    value === "bounce" ||
    value === "wordHighlight" ||
    value === "slide" ||
    value === "instant"
  ) {
    return value;
  }
  return "instant";
}

export type ShortsCaptionStyle = {
  color: ColorPreset;
  highlightColor: ColorPreset;
  /** Freeform fill HEX (takes priority over `color` preset). */
  textColor: string;
  /** Outline / text-stroke HEX. */
  strokeColor: string;
  /** Caption box fill HEX (alpha from `boxOpacity`). */
  boxColor: string;
  /** Optional keyword highlight HEX; falls back to `highlightColor` preset. */
  highlightTextColor?: string;
  fontSize: number;
  fontWeight: number;
  /** Shared caption face (overridden per-segment when `fontPreset` is set). */
  fontPreset: FontPreset;
  showBox: boolean;
  boxOpacity: number;
  showBoxBorder: boolean;
  /** Extra outline thickness multiplier (1 = default) */
  strokeWidth: number;
  /** Extra drop-shadow depth (0–3) */
  shadowDepth: number;
  /** Preview CSS pop + baked keyword scale in export */
  popKeywords: boolean;
  maxWidth: number;
  /**
   * Preview entrance motion for captions.
   * Default: appear all at once (no entrance animation).
   */
  entranceEffect: ShortsCaptionEntranceEffect;
};

export type ShortsCaptionSegment = {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
  /** Normalized center X (0–1) */
  x: number;
  /** Normalized center Y (0–1) */
  y: number;
  highlights?: ShortsCaptionHighlight[];
  stylePresetId?: string;
  /** Optional per-cue font; falls back to `ShortsCaptionStyle.fontPreset`. */
  fontPreset?: FontPreset;
  /** Optional per-cue design font size. */
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  boxColor?: string;
  /** Optional per-cue entrance effect; falls back to style.entranceEffect. */
  entranceEffect?: ShortsCaptionEntranceEffect;
};

export type ShortsCaptionPosPreset = "top" | "mid" | "bottom";

/** Popular Shorts caption palette chips (one-click). */
export const SHORTS_CAPTION_COLOR_CHIPS = [
  { id: "yellow", hex: "#FFE600" },
  { id: "white", hex: "#FFFFFF" },
  { id: "black", hex: "#000000" },
  { id: "mint", hex: "#00FFCC" },
  { id: "red", hex: "#FF0000" },
  { id: "pink", hex: "#FF007F" },
  { id: "sky", hex: "#38BDF8" },
  { id: "orange", hex: "#FF8A00" },
] as const;

export type ShortsCaptionColorChipId =
  (typeof SHORTS_CAPTION_COLOR_CHIPS)[number]["id"];

export function normalizeHexColor(
  input: string | null | undefined,
  fallback = "#FFE600"
): string {
  const raw = (input || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback.toUpperCase();
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHexColor(hex, "#000000").slice(1);
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

export function resolveCaptionTextColor(
  style: ShortsCaptionStyle,
  opts?: { highlight?: boolean }
): string {
  if (opts?.highlight) {
    if (style.highlightTextColor) {
      return normalizeHexColor(style.highlightTextColor, style.textColor);
    }
    return (
      COLOR_PRESETS[style.highlightColor]?.fill ||
      normalizeHexColor(style.textColor)
    );
  }
  if (style.textColor) return normalizeHexColor(style.textColor);
  return COLOR_PRESETS[style.color]?.fill || "#FFE600";
}

export function resolveCaptionStrokeColor(style: ShortsCaptionStyle): string {
  if (style.strokeColor) return normalizeHexColor(style.strokeColor, "#111111");
  const stroke = COLOR_PRESETS[style.color]?.stroke;
  if (stroke && stroke !== "transparent") return stroke;
  return "#111111";
}

export function resolveCaptionBoxColor(style: ShortsCaptionStyle): string {
  if (style.boxColor) return normalizeHexColor(style.boxColor, "#000000");
  return "#000000";
}

export const DEFAULT_SHORTS_CAPTION_STYLE: ShortsCaptionStyle = {
  color: "yellow",
  highlightColor: "yellow",
  textColor: "#FFE600",
  strokeColor: "#111111",
  boxColor: "#000000",
  highlightTextColor: "#FFE600",
  fontSize: 42,
  fontWeight: 800,
  fontPreset: "pretendard",
  showBox: true,
  boxOpacity: 0.55,
  showBoxBorder: false,
  strokeWidth: 1.15,
  shadowDepth: 1,
  popKeywords: true,
  maxWidth: 0.9,
  entranceEffect: "instant",
};

function newCaptionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cap_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function clampCaptionNorm(v: number, pad = 0.04): number {
  const n = Number.isFinite(v) ? v : 0.5;
  return Math.max(pad, Math.min(1 - pad, n));
}

/** Snap to 0.1s grid. */
export function clampCaptionTime(sec: number, maxSec = Infinity): number {
  const n = Number.isFinite(sec) ? sec : 0;
  const snapped = Math.round(n / SHORTS_CAPTION_TIME_STEP) * SHORTS_CAPTION_TIME_STEP;
  const clamped = Math.max(0, Math.min(maxSec, snapped));
  return Math.round(clamped * 10) / 10;
}

export function normalizeHighlights(
  text: string,
  highlights?: ShortsCaptionHighlight[] | null
): ShortsCaptionHighlight[] {
  if (!text || !Array.isArray(highlights) || !highlights.length) return [];
  const len = text.length;
  const out: ShortsCaptionHighlight[] = [];
  for (const h of highlights) {
    const start = Math.max(0, Math.min(len, Math.floor(Number(h.start) || 0)));
    const end = Math.max(start + 1, Math.min(len, Math.floor(Number(h.end) || 0)));
    if (end > start) out.push({ start, end });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

export function createCaptionSegment(
  partial?: Partial<ShortsCaptionSegment>
): ShortsCaptionSegment {
  const start = clampCaptionTime(Math.max(0, Number(partial?.startSec) || 0));
  const endRaw = Number(partial?.endSec);
  const end = Number.isFinite(endRaw)
    ? clampCaptionTime(Math.max(start + SHORTS_CAPTION_MIN_DURATION, endRaw))
    : clampCaptionTime(start + 1.5);
  const text = typeof partial?.text === "string" ? partial.text : "";
  return {
    id: partial?.id || newCaptionId(),
    text,
    startSec: start,
    endSec: end,
    x: clampCaptionNorm(partial?.x ?? SHORTS_CAPTION_X_DEFAULT),
    y: clampCaptionNorm(partial?.y ?? SHORTS_CAPTION_Y_BOTTOM),
    highlights: normalizeHighlights(text, partial?.highlights),
    stylePresetId: partial?.stylePresetId,
    fontPreset: partial?.fontPreset,
    fontSize:
      typeof partial?.fontSize === "number"
        ? clampCaptionFontSize(partial.fontSize)
        : undefined,
    textColor: partial?.textColor
      ? normalizeHexColor(partial.textColor)
      : undefined,
    strokeColor: partial?.strokeColor
      ? normalizeHexColor(partial.strokeColor, "#111111")
      : undefined,
    boxColor: partial?.boxColor
      ? normalizeHexColor(partial.boxColor, "#000000")
      : undefined,
    entranceEffect: partial?.entranceEffect
      ? normalizeCaptionEntranceEffect(partial.entranceEffect)
      : undefined,
  };
}

export function applyCaptionPosPreset(
  seg: ShortsCaptionSegment,
  preset: ShortsCaptionPosPreset
): ShortsCaptionSegment {
  const y =
    preset === "top"
      ? SHORTS_CAPTION_Y_TOP
      : preset === "mid"
        ? SHORTS_CAPTION_Y_MID
        : SHORTS_CAPTION_Y_BOTTOM;
  return { ...seg, x: SHORTS_CAPTION_X_DEFAULT, y };
}

/**
 * Split one caption into two at a character caret index.
 * Text before the caret stays on the current cue; text after becomes the next cue.
 * Timing is split at the midpoint of the original range (respecting min duration).
 */
export function splitCaptionAtCaret(
  captions: ShortsCaptionSegment[],
  captionId: string,
  caretIndex: number,
  durationSec = Infinity
): { captions: ShortsCaptionSegment[]; nextId: string } | null {
  const idx = captions.findIndex((c) => c.id === captionId);
  if (idx < 0) return null;
  const seg = captions[idx];
  const text = seg.text ?? "";
  const caret = Math.max(0, Math.min(text.length, Math.floor(caretIndex)));
  if (caret <= 0 || caret >= text.length) return null;

  const before = text.slice(0, caret);
  const after = text.slice(caret);
  if (!before.length || !after.length) return null;

  const span = Math.max(
    SHORTS_CAPTION_MIN_DURATION * 2,
    seg.endSec - seg.startSec
  );
  let splitT = clampCaptionTime(
    seg.startSec + span / 2,
    durationSec
  );
  const minEndFirst = clampCaptionTime(
    seg.startSec + SHORTS_CAPTION_MIN_DURATION,
    durationSec
  );
  const maxStartSecond = clampCaptionTime(
    seg.endSec - SHORTS_CAPTION_MIN_DURATION,
    durationSec
  );
  if (splitT < minEndFirst) splitT = minEndFirst;
  if (splitT > maxStartSecond) splitT = maxStartSecond;
  if (splitT <= seg.startSec || splitT >= seg.endSec) {
    splitT = clampCaptionTime((seg.startSec + seg.endSec) / 2, durationSec);
  }

  const first = createCaptionSegment({
    ...seg,
    id: seg.id,
    text: before,
    startSec: seg.startSec,
    endSec: splitT,
    highlights: normalizeHighlights(before, seg.highlights),
  });
  const second = createCaptionSegment({
    ...seg,
    id: undefined,
    text: after,
    startSec: first.endSec,
    endSec: Math.max(first.endSec + SHORTS_CAPTION_MIN_DURATION, seg.endSec),
    highlights: normalizeHighlights(
      after,
      (seg.highlights || []).map((h) => ({
        start: h.start - caret,
        end: h.end - caret,
      }))
    ),
  });

  const next = captions.slice();
  next.splice(idx, 1, first, second);
  return { captions: next, nextId: second.id };
}

/** Patch start/end with 0.1s snap and min duration. */
export function patchCaptionRange(
  seg: ShortsCaptionSegment,
  next: { startSec?: number; endSec?: number },
  durationSec = Infinity
): ShortsCaptionSegment {
  let start = clampCaptionTime(
    next.startSec ?? seg.startSec,
    Math.max(0, durationSec - SHORTS_CAPTION_MIN_DURATION)
  );
  let end = clampCaptionTime(
    next.endSec ?? seg.endSec,
    durationSec
  );
  if (end < start + SHORTS_CAPTION_MIN_DURATION) {
    end = clampCaptionTime(start + SHORTS_CAPTION_MIN_DURATION, durationSec);
  }
  if (start > end - SHORTS_CAPTION_MIN_DURATION) {
    start = clampCaptionTime(end - SHORTS_CAPTION_MIN_DURATION);
  }
  return { ...seg, startSec: start, endSec: end };
}

/** Move entire cue by delta seconds, preserving duration. */
export function moveCaptionRange(
  seg: ShortsCaptionSegment,
  deltaSec: number,
  durationSec = Infinity
): ShortsCaptionSegment {
  const dur = Math.max(
    SHORTS_CAPTION_MIN_DURATION,
    seg.endSec - seg.startSec
  );
  let start = clampCaptionTime(seg.startSec + deltaSec, durationSec);
  let end = clampCaptionTime(start + dur, durationSec);
  if (end > durationSec) {
    end = clampCaptionTime(durationSec);
    start = clampCaptionTime(end - dur);
  }
  return { ...seg, startSec: start, endSec: end };
}

export function activeCaptionAt(
  captions: ShortsCaptionSegment[],
  timeSec: number
): ShortsCaptionSegment | null {
  const seg = captionSegmentAt(captions, timeSec);
  if (!seg) return null;
  if (!seg.text.trim()) return null;
  return seg;
}

/**
 * Caption covering `timeSec` (including empty text) — for panel / timeline sync.
 */
export function captionSegmentAt(
  captions: ShortsCaptionSegment[],
  timeSec: number
): ShortsCaptionSegment | null {
  const t = Number.isFinite(timeSec) ? timeSec : 0;
  for (let i = captions.length - 1; i >= 0; i--) {
    const c = captions[i];
    if (t >= c.startSec && t < c.endSec) return c;
  }
  return null;
}

export function captionIndexById(
  captions: ShortsCaptionSegment[],
  id: string | null | undefined
): number {
  if (!id) return -1;
  return captions.findIndex((c) => c.id === id);
}

export function mergeCaptionStyle(
  base: ShortsCaptionStyle,
  patch?: Partial<ShortsCaptionStyle> | null
): ShortsCaptionStyle {
  return { ...base, ...(patch || {}) };
}

/** Split text into plain / highlight runs for preview + canvas. */
export function captionTextRuns(
  text: string,
  highlights?: ShortsCaptionHighlight[] | null
): { text: string; highlight: boolean }[] {
  const hs = normalizeHighlights(text, highlights);
  if (!text) return [];
  if (!hs.length) return [{ text, highlight: false }];
  const runs: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  for (const h of hs) {
    if (h.start > cursor) {
      runs.push({ text: text.slice(cursor, h.start), highlight: false });
    }
    runs.push({ text: text.slice(h.start, h.end), highlight: true });
    cursor = h.end;
  }
  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor), highlight: false });
  }
  return runs.filter((r) => r.text.length > 0);
}

export function applyStylePresetIdToAll(
  captions: ShortsCaptionSegment[],
  stylePresetId: string
): ShortsCaptionSegment[] {
  return captions.map((c) => ({ ...c, stylePresetId }));
}

export function applyFontPresetToAll(
  captions: ShortsCaptionSegment[],
  fontPreset: FontPreset
): ShortsCaptionSegment[] {
  return captions.map((c) => ({ ...c, fontPreset }));
}

export function applyFontPresetToOne(
  captions: ShortsCaptionSegment[],
  id: string,
  fontPreset: FontPreset
): ShortsCaptionSegment[] {
  return captions.map((c) => (c.id === id ? { ...c, fontPreset } : c));
}

export type ShortsCaptionVisualPatch = {
  fontPreset?: FontPreset;
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  boxColor?: string;
};

/** Apply font/color patch to one cue or every cue. */
export function applyCaptionVisualPatch(
  captions: ShortsCaptionSegment[],
  patch: ShortsCaptionVisualPatch,
  opts?: { id?: string | null; scope?: "active" | "all" }
): ShortsCaptionSegment[] {
  const next: ShortsCaptionVisualPatch = {
    ...(patch.fontPreset ? { fontPreset: patch.fontPreset } : {}),
    ...(typeof patch.fontSize === "number"
      ? { fontSize: clampCaptionFontSize(patch.fontSize) }
      : {}),
    ...(patch.textColor
      ? { textColor: normalizeHexColor(patch.textColor) }
      : {}),
    ...(patch.strokeColor
      ? { strokeColor: normalizeHexColor(patch.strokeColor, "#111111") }
      : {}),
    ...(patch.boxColor
      ? { boxColor: normalizeHexColor(patch.boxColor, "#000000") }
      : {}),
  };
  if (!Object.keys(next).length) return captions;
  if (opts?.scope === "active" && opts.id) {
    return captions.map((c) => (c.id === opts.id ? { ...c, ...next } : c));
  }
  return captions.map((c) => ({ ...c, ...next }));
}

/** Effective entrance effect: per-segment override → shared style → instant. */
export function resolveCaptionEntranceEffect(
  seg: Pick<ShortsCaptionSegment, "entranceEffect"> | null | undefined,
  style?: Partial<ShortsCaptionStyle> | null
): ShortsCaptionEntranceEffect {
  // Shared style wins (control-bar selection); per-cue override is legacy fallback.
  return normalizeCaptionEntranceEffect(
    style?.entranceEffect ||
      seg?.entranceEffect ||
      DEFAULT_SHORTS_CAPTION_STYLE.entranceEffect
  );
}

/** Apply entrance effect to one cue or every cue. */
export function applyCaptionEntranceEffect(
  captions: ShortsCaptionSegment[],
  entranceEffect: ShortsCaptionEntranceEffect,
  opts?: { id?: string | null; scope?: "active" | "all" }
): ShortsCaptionSegment[] {
  const effect = normalizeCaptionEntranceEffect(entranceEffect);
  if (opts?.scope === "active" && opts.id) {
    return captions.map((c) =>
      c.id === opts.id ? { ...c, entranceEffect: effect } : c
    );
  }
  return captions.map((c) => ({ ...c, entranceEffect: effect }));
}

/** Effective font for a cue: per-segment override → shared style → Pretendard. */
export function resolveCaptionFontPreset(
  seg: Pick<ShortsCaptionSegment, "fontPreset"> | null | undefined,
  style?: Partial<ShortsCaptionStyle> | null
): FontPreset {
  return (
    seg?.fontPreset ||
    style?.fontPreset ||
    DEFAULT_SHORTS_CAPTION_STYLE.fontPreset
  );
}

/** Merge overflow segments by concatenating text into fewer timed blocks. */
export function limitCaptionsForRender(
  captions: ShortsCaptionSegment[],
  max = SHORTS_CAPTION_RENDER_MAX
): ShortsCaptionSegment[] {
  const usable = captions.filter((c) => c.text.trim() && c.endSec > c.startSec);
  if (usable.length <= max) return usable;
  const bucket = Math.ceil(usable.length / max);
  const out: ShortsCaptionSegment[] = [];
  for (let i = 0; i < usable.length; i += bucket) {
    const chunk = usable.slice(i, i + bucket);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    const text = chunk.map((c) => c.text.trim()).join(" ");
    out.push(
      createCaptionSegment({
        id: first.id,
        text,
        startSec: first.startSec,
        endSec: last.endSec,
        x: first.x,
        y: first.y,
        stylePresetId: first.stylePresetId,
        fontPreset: first.fontPreset,
        fontSize: first.fontSize,
        textColor: first.textColor,
        strokeColor: first.strokeColor,
        boxColor: first.boxColor,
        highlights: first.highlights,
      })
    );
  }
  return out.slice(0, max);
}
