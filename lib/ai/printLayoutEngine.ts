/**
 * Screen-26 Magic Layout Engine — Gemini JSON → TextLayer + PrintDecoLayer.
 * Coordinates: pixels (canvas W×H) or normalized 0–1 (auto-detected).
 *
 * Element types: text | rect | circle | line | icon | box (legacy alias of rect).
 * Screen-26 uses HTML overlays (not Konva); plates/circles/lines map to TextLayer
 * showBox geometry; icons map to emoji PrintDecoLayer for edit + export parity.
 */

import { createLayer, type ColorPreset, type TextLayer } from "@/lib/thumbnailStyles";
import type { PrintDecoLayer } from "@/lib/printWizardTypes";

export type PrintLayoutElementText = {
  id?: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fill?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  align?: "left" | "center" | "right";
  backgroundFill?: string;
  backgroundOpacity?: number;
  cornerRadius?: number;
};

export type PrintLayoutElementRect = {
  id?: string;
  type: "rect" | "box";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
};

export type PrintLayoutElementCircle = {
  id?: string;
  type: "circle";
  x: number;
  y: number;
  /** Circle center OR top-left — we treat x,y as top-left of bounding box when radius given. */
  radius?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type PrintLayoutElementLine = {
  id?: string;
  type: "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Alternate endpoint form */
  x2?: number;
  y2?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type PrintLayoutElementIcon = {
  id?: string;
  type: "icon";
  iconName?: string;
  /** Direct emoji if provided */
  text?: string;
  x: number;
  y: number;
  size?: number;
  width?: number;
  height?: number;
  fill?: string;
};

export type PrintLayoutElement =
  | PrintLayoutElementText
  | PrintLayoutElementRect
  | PrintLayoutElementCircle
  | PrintLayoutElementLine
  | PrintLayoutElementIcon;

export type PrintLayoutPlan = {
  bg_prompt: string;
  elements: PrintLayoutElement[];
};

export type GenerateLayoutRequest = {
  formatLabel: string;
  styleLabel: string;
  useLabel: string;
  backgroundFieldLabel: string;
  categoryLabel?: string;
  prompt: string;
  canvasWidth: number;
  canvasHeight: number;
  pageIndex?: number;
  pageCount?: number;
};

export type MappedLayoutLayers = {
  textLayers: TextLayer[];
  decoLayers: PrintDecoLayer[];
};

/** Lucide / keyword → emoji (export-safe icon deco). */
const ICON_EMOJI: Record<string, string> = {
  camera: "📷",
  calendar: "📅",
  clock: "🕐",
  time: "🕐",
  location: "📍",
  map: "🗺️",
  "map-pin": "📍",
  pin: "📍",
  phone: "📞",
  call: "📞",
  mail: "✉️",
  email: "✉️",
  star: "⭐",
  heart: "❤️",
  check: "✅",
  gift: "🎁",
  food: "🍽️",
  restaurant: "🍽️",
  coffee: "☕",
  music: "🎵",
  ticket: "🎫",
  tag: "🏷️",
  percent: "％",
  sale: "🏷️",
  users: "👥",
  user: "👤",
  home: "🏠",
  building: "🏢",
  tree: "🌳",
  flower: "🌸",
  sun: "☀️",
  moon: "🌙",
  sparkles: "✨",
  fire: "🔥",
  trophy: "🏆",
  medal: "🏅",
  party: "🎉",
  megaphone: "📢",
  info: "ℹ️",
  warning: "⚠️",
  car: "🚗",
  bus: "🚌",
  train: "🚆",
  plane: "✈️",
  walk: "🚶",
  shopping: "🛍️",
  cart: "🛒",
  book: "📖",
  pen: "✏️",
  palette: "🎨",
};

export const PRINT_LAYOUT_SYSTEM_INSTRUCTION = `You are an elite Canva Magic Studio–level graphic designer and Korean copywriter for print (flyer, poster, menu, event, coupon, brochure).

Return ONE JSON object only (no markdown fences, no commentary):
{
  "bg_prompt": "English Flux.1 prompt: cinematic print background, professional lighting, explicit NEGATIVE SPACE (empty zones for typography — e.g. open upper third or left column). NEVER include letters, logos, watermarks, or readable text in the image.",
  "elements": [ /* dynamic list — see rules */ ]
}

Element types (use freely, mix as needed):
- "text": { id, type, text, x, y, width, height?, fontSize, fontWeight, fill, align, fontFamily?, backgroundFill?, backgroundOpacity?, cornerRadius? }
- "rect": { id, type, x, y, width, height, fill, stroke?, strokeWidth?, cornerRadius? }
- "circle": { id, type, x, y, radius, fill, stroke?, strokeWidth? }  // x,y = center
- "line": { id, type, x, y, width, height?, stroke?, strokeWidth?, fill? }  // thin bar (prefer horizontal)
- "icon": { id, type, iconName, x, y, size, fill? }  // iconName = lucide-like keyword (camera, calendar, map-pin, phone, star, gift, food, music, ticket, …) OR a single emoji

DYNAMIC LAYOUT (critical):
1. Do NOT hardcode counts (e.g. always 3 badges). Infer structure from 용도 + 분야 + prompt.
   Examples: festival course → 3–5 circular step badges + labels; menu → 6–10 price rows; sale → 1 big coupon card + period emphasis; invitation → title + date/place cards + RSVP.
2. ATOMIZE: never dump many sentences into one text box. Split into independent objects (main title, subtitle, badge label, price, date, place, organizer, small captions).
3. Typical finished templates have 8–28 elements. Prefer 12–22 for richness without clutter. Minimum 6 (unless ultra-minimal brief).
4. Coordinates are PIXELS relative to the given canvas width×height. Top-left origin. Keep 4% safe margin.
5. Stack order: draw plates/rects/circles/lines first conceptually, then icons, then text on top (list plates before overlapping text in the array).
6. Korean copy must be finished and purpose-fit — no lorem, no placeholder brackets.
7. Colors: high-contrast text vs plates; use rgba for translucent cards over photo backgrounds.
8. bg_prompt English only; emphasize negative space matching where you place the densest text cluster.
9. STRICT JSON only.`;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Accept normalized 0–1 or pixel values (when canvas size known). */
export function toNormalized(
  value: number,
  axisSize: number,
  treatAsPixelIfGt1 = true
): number {
  if (!Number.isFinite(value)) return 0;
  if (treatAsPixelIfGt1 && Math.abs(value) > 1 && axisSize > 0) {
    return clamp01(value / axisSize);
  }
  return clamp01(value);
}

function parseRgba(fill: string | undefined): {
  hex: string;
  opacity: number;
} {
  const raw = (fill || "").trim();
  if (!raw) return { hex: "#000000", opacity: 0.55 };
  const rgba = raw.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (rgba) {
    const r = Math.round(Number(rgba[1]));
    const g = Math.round(Number(rgba[2]));
    const b = Math.round(Number(rgba[3]));
    const a = rgba[4] != null ? Number(rgba[4]) : 1;
    const hex = `#${[r, g, b]
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
      .join("")}`;
    return { hex, opacity: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1 };
  }
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) {
    return {
      hex:
        raw.length === 4
          ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
          : raw.slice(0, 7),
      opacity: 1,
    };
  }
  return { hex: "#000000", opacity: 0.55 };
}

function nearestTextColor(fill: string | undefined): ColorPreset | string {
  const { hex } = parseRgba(fill);
  const h = hex.toUpperCase();
  if (h === "#FFFFFF" || h === "#FFF") return "white";
  if (h === "#000000" || h === "#000") return "inkBlack";
  if (h === "#FACC15" || h === "#F59E0B") return "yellow";
  return hex;
}

function parseFontWeight(w: string | number | undefined): number {
  if (typeof w === "number" && Number.isFinite(w)) {
    return Math.max(300, Math.min(900, Math.round(w)));
  }
  const s = String(w || "").toLowerCase();
  if (s.includes("bold") || s === "700" || s === "800" || s === "900") return 800;
  if (s.includes("light") || s === "300") return 300;
  if (s === "600" || s.includes("semibold")) return 600;
  const n = Number(s);
  if (Number.isFinite(n)) return Math.max(300, Math.min(900, Math.round(n)));
  return 700;
}

function inferPos(y: number, h: number): TextLayer["pos"] {
  const mid = y + h / 2;
  if (mid < 0.33) return "top";
  if (mid > 0.66) return "bottom";
  return "center";
}

function newLayerId(prefix: string, hint?: string): string {
  const base =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return hint ? `${prefix}-${hint}-${base}` : `${prefix}-${base}`;
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() || trimmed;
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    try {
      const repaired = match[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function resolveIconSymbol(el: PrintLayoutElementIcon): string {
  const direct = (el.text || "").trim();
  if (direct && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(direct)) {
    return direct;
  }
  if (direct.length === 1 || direct.length === 2) return direct;
  const key = String(el.iconName || direct || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!key) return "✨";
  if (ICON_EMOJI[key]) return ICON_EMOJI[key]!;
  // Partial match
  for (const [k, emoji] of Object.entries(ICON_EMOJI)) {
    if (key.includes(k) || k.includes(key)) return emoji;
  }
  // Already an emoji string in iconName
  if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(el.iconName || "")) {
    return (el.iconName || "✨").trim();
  }
  return "✨";
}

export function parsePrintLayoutPlan(raw: unknown): PrintLayoutPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const bg =
    typeof obj.bg_prompt === "string"
      ? obj.bg_prompt.trim()
      : typeof obj.bgPrompt === "string"
        ? obj.bgPrompt.trim()
        : "";
  if (!bg) return null;
  const list = Array.isArray(obj.elements) ? obj.elements : [];
  const elements: PrintLayoutElement[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const el = item as Record<string, unknown>;
    const type = String(el.type || "").toLowerCase();
    const x = Number(el.x);
    const y = Number(el.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const id = typeof el.id === "string" ? el.id : undefined;

    if (type === "text") {
      const text = String(el.text ?? "").trim();
      if (!text) continue;
      elements.push({
        id,
        type: "text",
        text,
        x,
        y,
        width: Number(el.width) || undefined,
        height: Number(el.height ?? el.h) || undefined,
        fontSize: typeof el.fontSize === "number" ? el.fontSize : undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        fontFamily: typeof el.fontFamily === "string" ? el.fontFamily : undefined,
        fontWeight:
          typeof el.fontWeight === "string" || typeof el.fontWeight === "number"
            ? el.fontWeight
            : undefined,
        align:
          el.align === "left" || el.align === "right" || el.align === "center"
            ? el.align
            : "center",
        backgroundFill:
          typeof el.backgroundFill === "string"
            ? el.backgroundFill
            : typeof el.boxFill === "string"
              ? el.boxFill
              : undefined,
        backgroundOpacity:
          typeof el.backgroundOpacity === "number"
            ? el.backgroundOpacity
            : undefined,
        cornerRadius:
          typeof el.cornerRadius === "number" ? el.cornerRadius : undefined,
      });
      continue;
    }

    if (type === "rect" || type === "box") {
      const width = Number(el.width);
      const height = Number(el.height ?? el.h);
      if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
      elements.push({
        id,
        type: type === "box" ? "box" : "rect",
        x,
        y,
        width,
        height,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
        cornerRadius:
          typeof el.cornerRadius === "number" ? el.cornerRadius : undefined,
      });
      continue;
    }

    if (type === "circle") {
      const radius = Number(el.radius);
      const width = Number(el.width);
      const height = Number(el.height);
      if (!Number.isFinite(radius) && !Number.isFinite(width)) continue;
      elements.push({
        id,
        type: "circle",
        x,
        y,
        radius: Number.isFinite(radius) ? radius : undefined,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
      });
      continue;
    }

    if (type === "line") {
      elements.push({
        id,
        type: "line",
        x,
        y,
        width: Number(el.width) || undefined,
        height: Number(el.height) || undefined,
        x2: Number(el.x2) || undefined,
        y2: Number(el.y2) || undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
        stroke: typeof el.stroke === "string" ? el.stroke : undefined,
        strokeWidth:
          typeof el.strokeWidth === "number" ? el.strokeWidth : undefined,
      });
      continue;
    }

    if (type === "icon") {
      elements.push({
        id,
        type: "icon",
        iconName: typeof el.iconName === "string" ? el.iconName : undefined,
        text: typeof el.text === "string" ? el.text : undefined,
        x,
        y,
        size: typeof el.size === "number" ? el.size : undefined,
        width: Number(el.width) || undefined,
        height: Number(el.height) || undefined,
        fill: typeof el.fill === "string" ? el.fill : undefined,
      });
    }
  }

  if (!elements.length) return null;
  return { bg_prompt: bg, elements };
}

export function parsePrintLayoutPlanFromText(
  text: string
): PrintLayoutPlan | null {
  return parsePrintLayoutPlan(extractJsonObject(text));
}

function makePlateLayer(opts: {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  cornerRadiusPx?: number;
  circle?: boolean;
  stageW: number;
  stageH: number;
}): TextLayer {
  const fill = parseRgba(opts.fill);
  const minSide = Math.min(opts.w * opts.stageW, opts.h * opts.stageH) || 1;
  const radiusFrac = opts.circle
    ? 0.5
    : Math.max(
        0,
        Math.min(0.5, (opts.cornerRadiusPx ?? 8) / minSide)
      );
  return createLayer({
    id: opts.id || newLayerId("plate"),
    text: "\u200B",
    pos: inferPos(opts.y, opts.h),
    layoutLocked: true,
    boxManual: true,
    manualX: opts.x,
    manualY: opts.y,
    boxW: opts.w,
    boxH: opts.h,
    maxWidth: opts.w,
    showBox: true,
    showBoxBorder: Boolean(opts.stroke),
    boxBorderColor: opts.stroke
      ? parseRgba(opts.stroke).hex
      : undefined,
    boxColor: fill.hex,
    boxOpacity: fill.opacity,
    boxRadius: radiusFrac,
    color: "white",
    fontSize: 12,
    fontWeight: 400,
    align: "center",
    fontPreset: "pretendard",
  });
}

/**
 * Map Gemini layout → Screen-26 layers (HTML overlay + export-safe).
 * Plates/circles/lines → TextLayer showBox; icons → emoji deco; text → TextLayer.
 */
export function mapLayoutPlanToCanvasLayers(
  plan: PrintLayoutPlan,
  stageW: number,
  stageH: number
): MappedLayoutLayers {
  const short = Math.min(stageW, stageH) || 1080;
  const textLayers: TextLayer[] = [];
  const decoLayers: PrintDecoLayer[] = [];
  let decoStack = 0;

  // Soft max to avoid runaway payloads
  const elements = plan.elements.slice(0, 40);

  for (const el of elements) {
    if (el.type === "rect" || el.type === "box") {
      const x = toNormalized(el.x, stageW);
      const y = toNormalized(el.y, stageH);
      const w = Math.max(0.02, toNormalized(el.width, stageW));
      const h = Math.max(0.015, toNormalized(el.height, stageH));
      textLayers.push(
        makePlateLayer({
          id: el.id,
          x,
          y,
          w,
          h,
          fill: el.fill,
          stroke: el.stroke,
          cornerRadiusPx: el.cornerRadius,
          stageW,
          stageH,
        })
      );
      continue;
    }

    if (el.type === "circle") {
      const rPx =
        typeof el.radius === "number" && el.radius > 0
          ? el.radius
          : Math.max(
              Number(el.width) || 0,
              Number(el.height) || 0
            ) / 2 ||
            short * 0.04;
      // Gemini uses center x,y for circles; convert to top-left bounding box.
      const looksLikePixels = Math.abs(el.x) > 1 || Math.abs(el.y) > 1 || rPx > 1;
      let cx = el.x;
      let cy = el.y;
      let r = rPx;
      if (!looksLikePixels) {
        cx = el.x * stageW;
        cy = el.y * stageH;
        r = rPx <= 1 ? rPx * Math.min(stageW, stageH) : rPx;
      }
      const size = Math.max(8, r * 2);
      const x = toNormalized(cx - r, stageW);
      const y = toNormalized(cy - r, stageH);
      const w = Math.max(0.02, toNormalized(size, stageW));
      const h = Math.max(0.02, toNormalized(size, stageH));
      // Force square-ish circle plate
      const side = Math.min(w, h);
      textLayers.push(
        makePlateLayer({
          id: el.id,
          x,
          y,
          w: side,
          h: side,
          fill: el.fill || "rgba(230,126,34,0.95)",
          stroke: el.stroke,
          circle: true,
          stageW,
          stageH,
        })
      );
      continue;
    }

    if (el.type === "line") {
      let x1 = el.x;
      let y1 = el.y;
      let x2 = el.x2;
      let y2 = el.y2;
      const looksLikePixels =
        Math.abs(x1) > 1 ||
        Math.abs(y1) > 1 ||
        (typeof el.width === "number" && el.width > 1);
      if (!looksLikePixels) {
        x1 = el.x * stageW;
        y1 = el.y * stageH;
        if (typeof x2 === "number") x2 = x2 * stageW;
        if (typeof y2 === "number") y2 = y2 * stageH;
      }
      let left: number;
      let top: number;
      let widthPx: number;
      let heightPx: number;
      if (
        typeof x2 === "number" &&
        typeof y2 === "number" &&
        Number.isFinite(x2) &&
        Number.isFinite(y2)
      ) {
        left = Math.min(x1, x2);
        top = Math.min(y1, y2);
        widthPx = Math.max(4, Math.abs(x2 - x1));
        heightPx = Math.max(
          el.strokeWidth || 3,
          Math.abs(y2 - y1) || el.strokeWidth || 3
        );
      } else {
        left = x1;
        top = y1;
        widthPx =
          typeof el.width === "number" && el.width > 0
            ? looksLikePixels
              ? el.width
              : el.width * stageW
            : stageW * 0.7;
        heightPx = Math.max(
          2,
          typeof el.height === "number" && el.height > 0
            ? looksLikePixels
              ? el.height
              : el.height * stageH
            : el.strokeWidth || 3
        );
      }
      textLayers.push(
        makePlateLayer({
          id: el.id,
          x: toNormalized(left, stageW),
          y: toNormalized(top, stageH),
          w: Math.max(0.02, toNormalized(widthPx, stageW)),
          h: Math.max(0.004, toNormalized(heightPx, stageH)),
          fill: el.stroke || el.fill || "rgba(255,255,255,0.85)",
          cornerRadiusPx: 2,
          stageW,
          stageH,
        })
      );
      continue;
    }

    if (el.type === "icon") {
      const symbol = resolveIconSymbol(el);
      const sizePx =
        typeof el.size === "number" && el.size > 0
          ? el.size
          : typeof el.width === "number" && el.width > 0
            ? el.width
            : short * 0.05;
      const looksLikePixels = Math.abs(el.x) > 1 || sizePx > 1;
      const left = looksLikePixels ? el.x : el.x * stageW;
      const top = looksLikePixels ? el.y : el.y * stageH;
      const size = looksLikePixels
        ? sizePx
        : sizePx <= 1
          ? sizePx * short
          : sizePx;
      const w = Math.max(1, stageW);
      const h = Math.max(1, stageH);
      decoLayers.push({
        id: el.id || newLayerId("icon", String(decoStack++)),
        symbol,
        rotation: 0,
        x: clamp01(left / w),
        y: clamp01(top / h),
        width: Math.max(0.02, size / w),
        height: Math.max(0.02, size / h),
      });
      continue;
    }

    if (el.type === "text") {
      const x = toNormalized(el.x, stageW);
      const y = toNormalized(el.y, stageH);
      const w = Math.max(
        0.08,
        toNormalized(
          typeof el.width === "number" && el.width > 0 ? el.width : stageW * 0.8,
          stageW
        )
      );
      const fontSize =
        typeof el.fontSize === "number" && el.fontSize > 0
          ? el.fontSize
          : Math.round(short * 0.045);
      const h = Math.max(
        0.035,
        toNormalized(
          typeof el.height === "number" && el.height > 0
            ? el.height
            : fontSize * 1.45,
          stageH
        )
      );
      const bg = el.backgroundFill ? parseRgba(el.backgroundFill) : null;
      const opacity =
        typeof el.backgroundOpacity === "number"
          ? Math.max(0, Math.min(1, el.backgroundOpacity))
          : bg?.opacity ?? 0.85;
      const minSide = Math.min(w * stageW, h * stageH) || 1;
      const radiusPx = el.cornerRadius ?? 8;

      textLayers.push(
        createLayer({
          id: el.id || newLayerId("text"),
          text: el.text,
          pos: inferPos(y, h),
          layoutLocked: true,
          boxManual: true,
          manualX: x,
          manualY: y,
          boxW: w,
          boxH: h,
          maxWidth: w,
          showBox: Boolean(bg),
          showBoxBorder: false,
          boxColor: bg?.hex ?? "#000000",
          boxOpacity: bg ? opacity : 0,
          boxRadius: Math.max(0, Math.min(0.5, radiusPx / minSide)),
          color: nearestTextColor(el.fill) as TextLayer["color"],
          fontSize,
          fontWeight: parseFontWeight(el.fontWeight),
          align: el.align ?? "center",
          lineHeight: 1.25,
          fontPreset: "pretendard",
        })
      );
    }
  }

  return { textLayers, decoLayers };
}

/** @deprecated Use mapLayoutPlanToCanvasLayers — kept for callers expecting TextLayer[] only. */
export function mapLayoutElementsToTextLayers(
  plan: PrintLayoutPlan,
  stageW: number,
  stageH: number
): TextLayer[] {
  return mapLayoutPlanToCanvasLayers(plan, stageW, stageH).textLayers;
}

export function buildLayoutUserPrompt(req: GenerateLayoutRequest): string {
  const pageHint =
    typeof req.pageIndex === "number" && typeof req.pageCount === "number"
      ? `page ${req.pageIndex + 1} of ${req.pageCount}`
      : "page 1";
  return [
    `Canvas size (pixels): ${Math.round(req.canvasWidth)} x ${Math.round(req.canvasHeight)}`,
    `규격(size): ${req.formatLabel}`,
    `스타일(style): ${req.styleLabel}`,
    `용도(purpose): ${req.useLabel}`,
    `배경/분야(background/category): ${req.backgroundFieldLabel}${
      req.categoryLabel ? ` / ${req.categoryLabel}` : ""
    }`,
    `User prompt / theme: ${req.prompt.trim() || "elegant modern print"}`,
    `Face: ${pageHint}`,
    `Design a finished Canva-quality ATOMIC layout for this single page.`,
    `Choose element count and structure dynamically for this purpose — do not use a fixed template.`,
    `Coordinates must be in PIXELS for this canvas size.`,
  ].join("\n");
}
