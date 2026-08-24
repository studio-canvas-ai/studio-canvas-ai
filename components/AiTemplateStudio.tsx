"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ChevronDown,
  Home,
  ImagePlus,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { HERO_AFTER_IMAGE } from "@/lib/data";
import {
  IMAGE_PAN_SENSITIVITY,
  aspectRatioValue,
  clampImagePan,
  containFit,
  coverCrop,
  normalizeImagePan,
  outputSizeForAspect,
  type AspectRatioKey,
  type ImagePan,
} from "@/lib/downloadImage";
import { fetchGeneralPhoto } from "@/lib/generalPhotos";
import { toDisplayImageSrc } from "@/lib/resultSession";
import {
  clampFontWeight,
  SHORTS_FONT_WEIGHT_DEFAULT,
  SHORTS_FONT_WEIGHT_MAX,
  SHORTS_FONT_WEIGHT_MIN,
  SHORTS_FONT_WEIGHT_STEP,
} from "@/lib/shortsStudioExport";
import {
  EMOJI_QUICK,
  FONT_PRESET_PRIMARY,
  TEMPLATE_STUDIO_COLOR_ORDER,
  colorAtIndex,
  colorPresetFill,
  colorPresetMeta,
  createLayer,
  drawEmojiChar,
  drawStickerBadge,
  fontForChar,
  fontForText,
  forEachCodePoint,
  isEmojiChar,
  measureStickerBadge,
  stripStickerTokens,
  swatchNeedsOutline,
  type ColorPreset,
  type FontPreset,
  type TextAlign,
  type TextLayer,
  type TextPos,
  type StickerBadgeId,
} from "@/lib/thumbnailStyles";
import { hexToRgba } from "@/lib/shortsCaptions";
import {
  displayPlaneUrl,
  processSubjectViaApi,
  requestAiCommand,
  toRawImageUrl,
} from "@/lib/aiCommand";
import {
  IMAGE_STYLE_PRESETS,
  MOOD_STYLE_PRESETS,
  emptyVisualStyleSelection,
  type VisualStyleSelection,
} from "@/lib/ai/visualStylePresets";
import {
  BgColorDropdown,
  EmojiMoreDropdown,
  StickerMoreDropdown,
} from "@/components/StudioStylePickers";
import DecoToolCatalogDropdown from "@/components/print-wizard/DecoToolCatalogDropdown";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  loadImageNaturalSize,
  readFileAsDataUrl,
  type PhotoKind,
} from "@/lib/canvas/addPhotoLayer";
import { buildObjectsFromStudioPlanes, scaleCanvasObjectsToStage } from "@/lib/canvas/syncFromStudio";
import {
  exportKonvaPrintDataUrl,
} from "@/lib/canvas/printExportFromStore";
import type { CanvasObject } from "@/lib/canvas/types";
import type { StudioKonvaStageHandle } from "@/components/canvas/StudioKonvaStage";
import CanvasUploadToolbar from "@/components/canvas/CanvasUploadToolbar";
import StudioExportButtonGroup from "@/components/canvas/StudioExportButtonGroup";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import { fillCanvas } from "@/lib/i18n";
import { shareWithFallback } from "@/lib/webShare";
import { useExportGate } from "@/lib/useExportGate";
import { useDownloadQuota } from "@/lib/useDownloadQuota";
import { projectStorageErrorMessage } from "@/lib/projectStorage";
import { useProjectStorage } from "@/lib/canvas/useProjectStorage";
import { PRINT_SMART_FORM_PATH } from "@/lib/printSmartForm";
import {
  parseProgramEntries,
  programNumFontCss,
  programNumberColumnWidth,
} from "@/lib/printWizardTextFormat";
import { wrapParagraph } from "@/lib/printWizardTextDraw";
import {
  buildStudioProject,
  cloneOverlayLayers,
  readProjectFile,
  resolveProjectPrintAspect,
  takePendingStudioProject,
  type StudioCanvasProjectV1,
  type StudioProjectCustomPrint,
} from "@/lib/canvas/projectFile";
import {
  referencePrintStageSize,
  stageFontSizeToDesign,
} from "@/lib/printWizardTextLayers";

const StudioKonvaStage = dynamic(
  () =>
    import("@/components/canvas/StudioKonvaStage").then((m) => m.StudioKonvaStage),
  { ssr: false }
);

/** Checkerboard CSS so transparent PNG alpha is visible in the preview stage. */
const TRANSPARENCY_CHECKER_STYLE: CSSProperties = {
  backgroundColor: "#1a1d27",
  backgroundImage:
    "linear-gradient(45deg, #2a2f3d 25%, transparent 25%), linear-gradient(-45deg, #2a2f3d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2f3d 75%), linear-gradient(-45deg, transparent 75%, #2a2f3d 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

/** Bust CDN/proxy cache so rembg PNG always retriggers <Image> onload + paint. */
function bustDisplayUrl(url: string): string {
  const base = url.trim();
  if (!base) return base;
  if (base.startsWith("data:") || base.startsWith("blob:")) return base;
  // Hash is client-only — does not alter /api/media/fetch?src= for toRawImageUrl.
  const withoutHash = base.replace(/#.*$/, "");
  return `${withoutHash}#cb=${Date.now().toString(36)}`;
}

function toSubjectDisplayUrl(httpsOrProxyUrl: string): string {
  return bustDisplayUrl(displayPlaneUrl(httpsOrProxyUrl));
}

const ASPECT_TABS: AspectRatioKey[] = [
  "original",
  "16:9",
  "1:1",
  "4:3",
  "9:16",
  "id",
  "a4",
];

const PROMO_ASPECT_GROUPS: Array<{
  titleKey: "printGroupPoster" | "printGroupBanner" | "printGroupSocial";
  items: AspectRatioKey[];
}> = [
  { titleKey: "printGroupPoster", items: ["a2", "a3", "a4"] },
  { titleKey: "printGroupBanner", items: ["3:1", "4:1"] },
  { titleKey: "printGroupSocial", items: ["4:3", "1:1", "4:5", "16:9"] },
];

/** Canvas-pixel tolerance for smart-guide snapping (≈5px on preview). */
const SNAP_THRESHOLD_PX = 5;
const OFFSET_CLAMP = 0.95;
const CLICK_MOVE_PX = 8;

type SnapGuides = {
  vertical: number[];
  horizontal: number[];
};

type LayerRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

function rectFromBox(box: { x: number; y: number; width: number; height: number }): LayerRect {
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
  };
}

function dedupeSnapTargets(values: number[], epsilon = 0.75): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    const last = out[out.length - 1];
    if (last == null || Math.abs(last - value) > epsilon) out.push(value);
  }
  return out;
}

function collectSnapTargets(
  canvasW: number,
  canvasH: number,
  anchors: LayerAnchor[],
  excludeId: string
): { vertical: number[]; horizontal: number[] } {
  const vertical = [0, canvasW / 2, canvasW];
  const horizontal = [0, canvasH / 2, canvasH];

  for (const anchor of anchors) {
    if (anchor.id === excludeId) continue;
    const rect = rectFromBox(anchor.box);
    vertical.push(rect.left, rect.centerX, rect.right);
    horizontal.push(rect.top, rect.centerY, rect.bottom);
  }

  return {
    vertical: dedupeSnapTargets(vertical),
    horizontal: dedupeSnapTargets(horizontal),
  };
}

function snapLayerRect(
  rect: LayerRect,
  targetsV: number[],
  targetsH: number[],
  thresholdPx: number
): { deltaX: number; deltaY: number; guides: SnapGuides } {
  let bestX: { delta: number; dist: number } | null = null;
  let bestY: { delta: number; dist: number } | null = null;

  const xEdges = [rect.left, rect.centerX, rect.right];
  const yEdges = [rect.top, rect.centerY, rect.bottom];

  for (const target of targetsV) {
    for (const edge of xEdges) {
      const dist = Math.abs(edge - target);
      if (dist <= thresholdPx && (!bestX || dist < bestX.dist)) {
        bestX = { delta: target - edge, dist };
      }
    }
  }

  for (const target of targetsH) {
    for (const edge of yEdges) {
      const dist = Math.abs(edge - target);
      if (dist <= thresholdPx && (!bestY || dist < bestY.dist)) {
        bestY = { delta: target - edge, dist };
      }
    }
  }

  const deltaX = bestX?.delta ?? 0;
  const deltaY = bestY?.delta ?? 0;
  const snapped: LayerRect = {
    left: rect.left + deltaX,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    centerX: rect.centerX + deltaX,
    centerY: rect.centerY + deltaY,
  };

  const vertical: number[] = [];
  const horizontal: number[] = [];

  if (bestX) {
    for (const target of targetsV) {
      if (
        Math.abs(snapped.left - target) <= 0.5 ||
        Math.abs(snapped.centerX - target) <= 0.5 ||
        Math.abs(snapped.right - target) <= 0.5
      ) {
        if (!vertical.some((v) => Math.abs(v - target) <= 0.5)) vertical.push(target);
      }
    }
  }

  if (bestY) {
    for (const target of targetsH) {
      if (
        Math.abs(snapped.top - target) <= 0.5 ||
        Math.abs(snapped.centerY - target) <= 0.5 ||
        Math.abs(snapped.bottom - target) <= 0.5
      ) {
        if (!horizontal.some((v) => Math.abs(v - target) <= 0.5)) horizontal.push(target);
      }
    }
  }

  return { deltaX, deltaY, guides: { vertical, horizontal } };
}

function drawLayerSelectionChrome(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  dragging: boolean
) {
  // Ultra-tight chrome — barely outside the glyph AABB.
  const pad = 1.5;
  const bx = box.x - pad;
  const by = box.y - pad;
  const bw = box.width + pad * 2;
  const bh = box.height + pad * 2;
  const radius = Math.min(6, bw / 2, bh / 2);

  ctx.save();
  ctx.fillStyle = dragging
    ? "rgba(139, 92, 246, 0.12)"
    : "rgba(139, 92, 246, 0.06)";
  ctx.strokeStyle = dragging
    ? "rgba(192, 132, 252, 1)"
    : "rgba(167, 139, 250, 0.95)";
  ctx.lineWidth = dragging ? 2 : 1.5;
  ctx.setLineDash(dragging ? [] : [6, 4]);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(bx, by, bw, bh, radius);
  } else {
    ctx.rect(bx, by, bw, bh);
  }
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  const arm = Math.min(12, bw * 0.22, bh * 0.28);
  ctx.strokeStyle = "rgba(233, 213, 255, 0.98)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const corners: [number, number, number, number][] = [
    [bx, by + arm, bx, by],
    [bx, by, bx + arm, by],
    [bw + bx - arm, by, bw + bx, by],
    [bw + bx, by, bw + bx, by + arm],
    [bx, by + bh - arm, bx, by + bh],
    [bx, by + bh, bx + arm, by + bh],
    [bw + bx - arm, by + bh, bw + bx, by + bh],
    [bw + bx, by + bh - arm, bw + bx, by + bh],
  ];
  for (const [x1, y1, x2, y2] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const handleR = Math.max(3, Math.min(4.5, Math.min(bw, bh) * 0.08));
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(167, 139, 250, 1)";
  ctx.lineWidth = 1.5;
  const handles: [number, number][] = [
    [bx, by],
    [bx + bw / 2, by],
    [bx + bw, by],
    [bx + bw, by + bh / 2],
    [bx + bw, by + bh],
    [bx + bw / 2, by + bh],
    [bx, by + bh],
    [bx, by + bh / 2],
  ];
  for (const [hx, hy] of handles) {
    ctx.beginPath();
    ctx.arc(hx, hy, handleR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

type LayerHitBox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};
const PLACEHOLDER_TEXT = "텍스트를 입력하세요";
/** Compact single-line default; grows with content via scrollHeight. */
const LAYER_TEXTAREA_MIN_PX = 44;
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 360;
const LETTER_SPACING_MIN = -8;
const LETTER_SPACING_MAX = 80;
const LETTER_SPACING_DEFAULT = 0;
const LINE_HEIGHT_MIN = 0.8;
const LINE_HEIGHT_MAX = 2.5;
const LINE_HEIGHT_STEP = 0.05;
const LINE_HEIGHT_DEFAULT = 1.2;
const PRINT_DPI = 300;
const PREVIEW_MAX_EDGE = 1200;
/** Soft cap so browser canvas stays stable on huge banner inputs. */
const EXPORT_MAX_EDGE = 24000;
const CUSTOM_SIZE_MAX_CM = 1500;
const CUSTOM_SIZE_MAX_INCH = Math.round((CUSTOM_SIZE_MAX_CM / 2.54) * 10) / 10;

type PrintUnit = "cm" | "inch";

type CustomPrintSize = {
  unit: PrintUnit;
  width: number;
  height: number;
};

function clampLetterSpacing(value: number): number {
  return Math.round(
    Math.max(LETTER_SPACING_MIN, Math.min(LETTER_SPACING_MAX, value))
  );
}

function clampLineHeight(value: number): number {
  return (
    Math.round(Math.max(LINE_HEIGHT_MIN, Math.min(LINE_HEIGHT_MAX, value)) * 100) /
    100
  );
}

function layerLetterSpacing(layer: TextLayer): number {
  return clampLetterSpacing(layer.letterSpacing ?? LETTER_SPACING_DEFAULT);
}

function layerLineHeight(layer: TextLayer): number {
  return clampLineHeight(layer.lineHeight ?? LINE_HEIGHT_DEFAULT);
}

function splitTextLines(text: string): string[] {
  if (!text) return [""];
  return text.split("\n");
}

function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  line: string,
  fontSize: number,
  fontPreset: FontPreset,
  fontWeight: number,
  letterSpacing: number
): number {
  const chars: string[] = [];
  forEachCodePoint(line, (ch) => chars.push(ch));
  if (chars.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (isEmojiChar(ch)) {
      total += fontSize * 1.1;
    } else {
      ctx.font = `${fontWeight} ${fontSize}px ${fontForChar(fontPreset, ch)}`;
      total += ctx.measureText(ch).width;
    }
    if (i < chars.length - 1) total += letterSpacing;
  }
  return total;
}

function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontPreset: FontPreset,
  fontWeight: number,
  letterSpacing: number,
  lineHeightMul: number
): { lines: string[]; lineWidths: number[]; contentW: number; blockH: number } {
  const lines = splitTextLines(text);
  const lineWidths = lines.map((line) =>
    measureLineWidth(ctx, line, fontSize, fontPreset, fontWeight, letterSpacing)
  );
  const lineHeightPx = fontSize * lineHeightMul;
  const measured = Math.max(0, ...lineWidths);
  // Empty/placeholder overlayLayers keep a small clickable footprint; real text hugs glyphs.
  const contentW = measured > 0 ? measured : fontSize * 2.2;
  return {
    lines,
    lineWidths,
    contentW,
    blockH: Math.max(lineHeightPx, lines.length * lineHeightPx),
  };
}

function lineAnchorX(
  align: TextAlign,
  lineW: number,
  xAnchor: number,
  width: number,
  offsetX: number
): number {
  const base =
    align === "left"
      ? width * 0.08
      : align === "right"
        ? width * 0.92 - lineW
        : xAnchor - lineW / 2;
  return base + offsetX * width;
}

function physicalToPixels(
  width: number,
  height: number,
  unit: PrintUnit,
  dpi = PRINT_DPI
): { width: number; height: number } {
  const toInch = (v: number) => (unit === "cm" ? v / 2.54 : v);
  return {
    width: Math.max(1, Math.round(toInch(width) * dpi)),
    height: Math.max(1, Math.round(toInch(height) * dpi)),
  };
}

function clampExportSize(width: number, height: number) {
  const scale = Math.min(1, EXPORT_MAX_EDGE / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function scaleToPreview(width: number, height: number) {
  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Fit source into a box without changing aspect ratio (letterbox / contain). */
function fitContain(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (srcW < 1 || srcH < 1 || maxW < 1 || maxH < 1) return { w: 0, h: 0 };
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return {
    w: Math.max(1, Math.round(srcW * scale)),
    h: Math.max(1, Math.round(srcH * scale)),
  };
}

/** Clamp zoom viewport translate so both axes stay within the stage.
 * Port must be the unzoomed canvas frame (viewSize), not the full column —
 * otherwise portrait letterboxing locks X via forced centering.
 */
function clampViewOffset(
  x: number,
  y: number,
  contentW: number,
  contentH: number,
  portW: number,
  portH: number
): { x: number; y: number } {
  if (portW < 1 || portH < 1) return { x: 0, y: 0 };

  let nextX = x;
  let nextY = y;

  if (contentW <= portW + 0.5) {
    nextX = 0;
  } else {
    const minX = portW - contentW;
    nextX = Math.max(minX, Math.min(0, x));
  }

  if (contentH <= portH + 0.5) {
    nextY = 0;
  } else {
    const minY = portH - contentH;
    nextY = Math.max(minY, Math.min(0, y));
  }

  return { x: nextX, y: nextY };
}

type LayerAnchor = {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  box: { x: number; y: number; width: number; height: number };
};

type DragState =
  | {
      kind: "layer";
      layerId: string;
      startClientX: number;
      startClientY: number;
      startOffsetX: number;
      startOffsetY: number;
      canvasX: number;
      moved: boolean;
    }
  | {
      kind: "pan";
      mode: "viewport" | "image";
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
      startViewX: number;
      startViewY: number;
      moved: boolean;
    };

function autoResizeLayerTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(LAYER_TEXTAREA_MIN_PX, el.scrollHeight)}px`;
}

function clampOffset(v: number) {
  return Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, v));
}

/** Spread new overlayLayers so they don't stack on the same spot. */
function dispersedPlacement(index: number): {
  pos: TextPos;
  offsetX: number;
  offsetY: number;
} {
  const slots: TextPos[] = ["top", "center", "bottom"];
  const pos = slots[index % 3]!;
  const ring = Math.floor(index / 3);
  const col = index % 3;
  const offsetX = clampOffset((col - 1) * 0.1 + (ring % 2 === 0 ? 0 : 0.04));
  const offsetY = clampOffset(
    (pos === "top" ? 0.02 : pos === "bottom" ? -0.02 : 0) +
      ring * (col === 1 ? 0.1 : 0.07) * (index % 2 === 0 ? 1 : -1)
  );
  return { pos, offsetX, offsetY };
}

function makeDefaultLayer(index = 0): TextLayer {
  const place = dispersedPlacement(index);
  return createLayer({
    // `-layer-` keeps empty rows through print wizard zone prune.
    id: `add-layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: "",
    color: "softIvory",
    fontPreset: "variety",
    fontSize: 48,
    fontWeight: 600,
    letterSpacing: LETTER_SPACING_DEFAULT,
    lineHeight: LINE_HEIGHT_DEFAULT,
    pos: place.pos,
    align: "center",
    offsetX: place.offsetX,
    offsetY: place.offsetY,
  });
}

const FONT_KEYS = [
  "variety",
  "clean",
  "vlog",
  "neon",
  "impact",
  "serif",
  "rounded",
  "poster",
  "pretendard",
  "gmarket",
  "scoreDream",
  "kccAhnjunggeun",
  "cafe24Dangdanghae",
  "cafe24Ohsquare",
  "ridiBatang",
  "jua",
  "jalnan",
  "calligraphy",
  "classicMyeongjo",
  "handwriting",
  "vintageCinema",
  "slimGothic",
] as const satisfies readonly FontPreset[];

type BgPreset = {
  label: string;
  prompt: string;
  dot: string;
  emoji?: string;
};

const BG_PRESETS: BgPreset[] = [
  { label: "화사한 봄날", prompt: "화사한 봄날 벚꽃길", dot: "#f9a8d4" },
  { label: "노을 명당", prompt: "노을 지는 명소 풍경", dot: "#fb923c" },
  { label: "신비로운 숲속", prompt: "신비로운 숲속 안개", dot: "#86efac" },
  { label: "모던 스튜디오", prompt: "모던한 스튜디오 배경", dot: "#c4b5fd" },
  { label: "몽환 파스텔", prompt: "몽환적 파스텔 배경", dot: "#fde68a" },
  {
    label: "봄꽃 축제 팜플렛",
    prompt: "봄꽃 축제 A4 팜플렛 행사 포스터",
    dot: "#f472b6",
    emoji: "🌸",
  },
  {
    label: "가을 단풍 행사",
    prompt: "가을 단풍 축제 행사 포스터",
    dot: "#ea580c",
    emoji: "🍁",
  },
  {
    label: "전통 한복 무대",
    prompt: "전통 한복 무대 공연 모델 선발대회",
    dot: "#a78bfa",
    emoji: "🏛️",
  },
  {
    label: "고품격 시상식 포스터",
    prompt: "고품격 시상식 행사 포스터",
    dot: "#fbbf24",
    emoji: "✨",
  },
  {
    label: "모던 비즈니스 브로셔",
    prompt: "모던 비즈니스 브로셔 A4 팜플렛",
    dot: "#60a5fa",
    emoji: "🏙️",
  },
];

export type AiTemplateStudioProps = {
  /** utility = Template Studio; agent = Print Form-to-Design */
  mode?: "utility" | "agent";
  initialBackgroundUrl?: string | null;
  initialOverlayLayers?: TextLayer[];
  /** Controlled overlay layers (print wizard preview sync). */
  controlledOverlayLayers?: TextLayer[];
  onControlledOverlayLayersChange?: (layers: TextLayer[]) => void;
  /** Controlled active text layer (canvas ↔ side-list highlight sync). */
  controlledActiveLayerId?: string | null;
  onControlledActiveLayerChange?: (id: string | null) => void;
  /** Overlay-only form copy (never sent to Flux as burn-in). */
  formFields?: Record<string, string> | null;
  /** Seed style / mood selection (print wizard → agent). */
  initialVisualStyle?: VisualStyleSelection | null;
  /** Print wizard Step-1 aspect (SCREEN-008 → SCREEN-009 parity). */
  initialPrintAspect?: number;
  /** Reference stage natural size from print wizard preview. */
  initialNaturalSize?: { w: number; h: number } | null;
  /** Custom print size from wizard session. */
  initialCustomPrint?: { unit: "cm" | "inch"; width: number; height: number } | null;
  /** Hide home chrome when embedded in print wizard studio. */
  embedded?: boolean;
  /** print-wizard-step2 = 2-column canvas + edit panel (Step 2 wizard). */
  layout?: "default" | "print-wizard-step2";
  /** Edit panel only — no header, no Konva preview (print wizard Step 2 right column). */
  panelOnly?: boolean;
  /** Hide built-in download stack (parent provides export). */
  hideExport?: boolean;
  /** Hide conversational AI command box (print wizard Step 2). */
  hideAiCommand?: boolean;
  /** Render text-layer list into this host (print wizard middle gutter). */
  textLayersHost?: HTMLElement | null;
  /** Return to Step 1 planning instead of routing away. */
  onBackToPlanning?: () => void;
  /** Print wizard — insert deco tool from catalog onto canvas. */
  onDecoCatalogPick?: (decoId: string) => void;
  /** Print wizard — insert emoji/symbol as independent canvas object. */
  onCanvasSymbolPick?: (symbol: string) => void;
  heading?: string;
  /** Isolated pending-project hand-off key (print vs photo wizard). */
  pendingProjectKey?: string;
  recentNamespace?: RecentProjectNamespace;
};

export default function AiTemplateStudio({
  mode = "utility",
  initialBackgroundUrl = null,
  initialOverlayLayers,
  controlledOverlayLayers,
  onControlledOverlayLayersChange,
  controlledActiveLayerId,
  onControlledActiveLayerChange,
  formFields = null,
  initialVisualStyle = null,
  initialPrintAspect,
  initialNaturalSize = null,
  initialCustomPrint = null,
  embedded = false,
  layout = "default",
  panelOnly = false,
  hideExport = false,
  hideAiCommand = false,
  textLayersHost = null,
  onBackToPlanning,
  onDecoCatalogPick,
  onCanvasSymbolPick,
  heading,
  pendingProjectKey,
  recentNamespace = "screen_007",
}: AiTemplateStudioProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const { showToast } = useFeedback();
  const { requireSubscription, premiumModal } = useExportGate();
  const { spendForQuality, quotaEmptyMessage } = useDownloadQuota();
  const { downloadAndRemember, openRecent } = useProjectStorage({
    pendingProjectKey,
    recentNamespace,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const konvaStageRef = useRef<StudioKonvaStageHandle | null>(null);
  /** Full-width host used only to measure available preview width. */
  const stageHostRef = useRef<HTMLDivElement>(null);
  /** Clipped canvas viewport (sized to unzoomed viewSize). */
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportFitDoneRef = useRef(false);
  /** When true, next plane→store sync discards prior image transforms (fresh Center & Fit). Starts true so first measured stage never inherits 1080-fallback coords. */
  const forcePlaneRefitRef = useRef(true);
  /** One-shot: preserve imported object transforms across the next plane sync. */
  const hydrateCanvasObjectsRef = useRef<CanvasObject[] | null>(null);
  /** Stage size the hydrated objects were authored against. */
  const hydrateCanvasMetaRef = useRef<{ w: number; h: number } | null>(null);
  /** Defer canvas restore until stageBounds yields a measurable viewSize. */
  const pendingRestoreRef = useRef<StudioCanvasProjectV1 | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const loadedBgImageRef = useRef<HTMLImageElement | null>(null);
  const paintRef = useRef<() => void>(() => undefined);
  const layerTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const layerAnchorsRef = useRef<LayerAnchor[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const overlayLayersRef = useRef<TextLayer[]>([]);
  const selectionClearedRef = useRef(false);
  const hydratedEntryRef = useRef<string | null>(null);
  const clipboardLayerRef = useRef<TextLayer | null>(null);
  const pasteCountRef = useRef(0);
  const viewOffsetRef = useRef({ x: 0, y: 0 });
  const [hasClipboardLayer, setHasClipboardLayer] = useState(false);

  useEffect(() => {
    useCanvasStore.getState().resetDocument({
      mode,
      dpi: PRINT_DPI,
    });
    return () => {
      useCanvasStore.getState().resetDocument({
        mode: "utility",
        dpi: PRINT_DPI,
      });
    };
  }, [mode, pendingProjectKey, recentNamespace]);

  const canvasObjects = useCanvasStore((s) => s.objects);
  const hasUserPhotoLayers = canvasObjects.some((o) => o.type === "photo");

  /** SubjectLayer — cutout / portrait (transparent PNG after ImageProcessor). */
  const [subjectLayer, setSubjectLayer] = useState(HERO_AFTER_IMAGE);
  /** BackgroundImage — scenic AI plane under the subject. */
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    () => initialBackgroundUrl
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>(() =>
    mode === "agent" && (initialPrintAspect || initialCustomPrint)
      ? "original"
      : "1:1"
  );
  const [pan, setPan] = useState<ImagePan>(normalizeImagePan({ x: 0, y: 0, scale: 1 }));
  const [zoomPct, setZoomPct] = useState(100);
  const [naturalSize, setNaturalSize] = useState(() => {
    if (initialNaturalSize?.w && initialNaturalSize?.h) {
      return { w: initialNaturalSize.w, h: initialNaturalSize.h };
    }
    if (mode === "agent" && initialPrintAspect) {
      const ref = referencePrintStageSize(initialPrintAspect);
      return { w: ref.w, h: ref.h };
    }
    return { w: 1080, h: 1350 };
  });
  /** OverlayLayers — text / stickers (never cleared by bg commands). */
  const [internalOverlayLayers, setInternalOverlayLayers] = useState<TextLayer[]>(() =>
    initialOverlayLayers?.length
      ? cloneOverlayLayers(initialOverlayLayers)
      : [makeDefaultLayer(0)]
  );
  const isOverlayControlled =
    controlledOverlayLayers != null && onControlledOverlayLayersChange != null;
  const overlayLayers = isOverlayControlled
    ? controlledOverlayLayers
    : internalOverlayLayers;
  const setOverlayLayers = useCallback(
    (updater: TextLayer[] | ((prev: TextLayer[]) => TextLayer[])) => {
      if (isOverlayControlled && onControlledOverlayLayersChange) {
        const next =
          typeof updater === "function"
            ? updater(controlledOverlayLayers)
            : updater;
        onControlledOverlayLayersChange(next);
        return;
      }
      setInternalOverlayLayers(updater);
    },
    [
      isOverlayControlled,
      controlledOverlayLayers,
      onControlledOverlayLayersChange,
    ]
  );
  const [internalActiveLayerId, setInternalActiveLayerId] = useState<
    string | null
  >(null);
  const isActiveLayerControlled =
    onControlledActiveLayerChange != null;
  const activeLayerId = isActiveLayerControlled
    ? (controlledActiveLayerId ?? null)
    : internalActiveLayerId;
  const setActiveLayerId = useCallback(
    (id: string | null) => {
      if (isActiveLayerControlled) {
        onControlledActiveLayerChange?.(id);
        return;
      }
      setInternalActiveLayerId(id);
    },
    [isActiveLayerControlled, onControlledActiveLayerChange]
  );
  /** Live style draft while dragging range sliders (avoids full plane rebuilds). */
  const [styleDraft, setStyleDraft] = useState<Partial<TextLayer> | null>(null);
  const styleDragActiveRef = useRef(false);
  const styleDraftRef = useRef<Partial<TextLayer> | null>(null);
  const styleCommitRafRef = useRef<number | null>(null);
  const [commandInput, setCommandInput] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandLog, setCommandLog] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promoMenuOpen, setPromoMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [visualStyle, setVisualStyle] = useState<VisualStyleSelection>(() =>
    initialVisualStyle
      ? {
          imageStyleId: initialVisualStyle.imageStyleId,
          moodStyleId: initialVisualStyle.moodStyleId,
        }
      : emptyVisualStyleSelection()
  );
  const [customSizeOpen, setCustomSizeOpen] = useState(false);
  const [customUnit, setCustomUnit] = useState<PrintUnit>("cm");
  const [customWidthInput, setCustomWidthInput] = useState("21");
  const [customHeightInput, setCustomHeightInput] = useState("29.7");
  const [customPrint, setCustomPrint] = useState<CustomPrintSize | null>(
    () => initialCustomPrint ?? null
  );
  const [dragging, setDragging] = useState(false);
  const [dragKind, setDragKind] = useState<"layer" | "pan" | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({
    vertical: [],
    horizontal: [],
  });
  const [layerHitBoxes, setLayerHitBoxes] = useState<LayerHitBox[]>([]);
  const [entrySource, setEntrySource] = useState<"default" | "general-photo">("default");
  /** Available stage box for preview fitting (aspect-preserving). */
  const [stageBounds, setStageBounds] = useState({ w: 0, h: 0 });
  /** Zoom viewport pan (CSS px) — independent X/Y so horizontal drag is never clipped by layout. */
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    layerId: string | null;
  } | null>(null);

  const zoomScale = zoomPct / 100;

  const syncLayerTextareaHeights = useCallback(() => {
    for (const el of Object.values(layerTextareaRefs.current)) {
      autoResizeLayerTextarea(el);
    }
  }, []);

  useLayoutEffect(() => {
    syncLayerTextareaHeights();
  }, [overlayLayers, syncLayerTextareaHeights]);

  overlayLayersRef.current = overlayLayers;

  const activeLayerBase = activeLayerId
    ? (overlayLayers.find((l) => l.id === activeLayerId) ?? null)
    : null;
  const activeLayer = activeLayerBase
    ? styleDraft
      ? { ...activeLayerBase, ...styleDraft }
      : activeLayerBase
    : null;
  /** SCREEN-024: keep style tools live even when canvas selection is cleared. */
  const stylePanelLayer =
    activeLayer ?? (panelOnly ? overlayLayers[0] ?? null : null);

  useEffect(() => {
    if (!overlayLayers[0]) return;
    const stillValid =
      Boolean(activeLayerId) &&
      overlayLayers.some((l) => l.id === activeLayerId);
    if (stillValid) return;
    if (panelOnly) {
      // Always keep a style target so the right panel never goes empty.
      selectionClearedRef.current = false;
      setActiveLayerId(overlayLayers[0].id);
      return;
    }
    // Uncontrolled studios: auto-pick unless user explicitly cleared selection.
    if (isActiveLayerControlled) return;
    if (!selectionClearedRef.current) {
      setActiveLayerId(overlayLayers[0].id);
    }
  }, [
    activeLayerId,
    isActiveLayerControlled,
    overlayLayers,
    panelOnly,
    setActiveLayerId,
  ]);

  useEffect(() => {
    const source = searchParams.get("source");
    const photoId = searchParams.get("photoId")?.trim() ?? "";
    const photoUrl = searchParams.get("photoUrl")?.trim() ?? "";
    const entryKey = `${source}:${photoId}:${photoUrl}`;
    if (hydratedEntryRef.current === entryKey) return;
    hydratedEntryRef.current = entryKey;

    if (source !== "general-photo") {
      setEntrySource("default");
      return;
    }

    let cancelled = false;

    void (async () => {
      let nextUrl = "";
      if (photoId) {
        const photo = await fetchGeneralPhoto(photoId);
        if (photo?.imageUrl) {
          nextUrl = photo.imageUrl;
        }
      }

      if (!nextUrl && photoUrl) {
        try {
          nextUrl = decodeURIComponent(photoUrl);
        } catch {
          nextUrl = photoUrl;
        }
      }

      if (cancelled || !nextUrl) {
        if (!cancelled) {
          showToast("편집할 일반사진을 불러오지 못했습니다.", "error");
        }
        return;
      }

      const displayUrl = toDisplayImageSrc(nextUrl);
      const layer = makeDefaultLayer(0);
      setEntrySource("general-photo");
      setBackgroundImage(null);
      loadedBgImageRef.current = null;
      setAspectRatio("original");
      setPan(normalizeImagePan({ x: 0, y: 0, scale: 1 }));
      setZoomPct(100);
      setViewOffset({ x: 0, y: 0 });
      viewOffsetRef.current = { x: 0, y: 0 };
      setOverlayLayers([layer]);
      setActiveLayerId(layer.id);
      setCommandInput("");
      setPromoMenuOpen(false);
      setCustomSizeOpen(false);
      setCustomPrint(null);
      // Auto rembg so gallery photos also land as transparent SubjectLayer.
      try {
        const cutout = await processSubjectViaApi(toRawImageUrl(nextUrl));
        if (!cancelled) {
          loadedImageRef.current = null;
          setSubjectLayer(toSubjectDisplayUrl(cutout));
        }
      } catch {
        if (!cancelled) setSubjectLayer(bustDisplayUrl(displayUrl));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, showToast]);

  const aspect = useMemo(() => {
    if (customPrint) {
      return customPrint.width / Math.max(customPrint.height, 0.0001);
    }
    if (aspectRatio === "original") {
      return naturalSize.w > 0 && naturalSize.h > 0
        ? naturalSize.w / naturalSize.h
        : 4 / 5;
    }
    return aspectRatioValue(aspectRatio);
  }, [aspectRatio, customPrint, naturalSize.h, naturalSize.w]);

  const isPrintAgentCanvas =
    mode === "agent" && (embedded || layout === "print-wizard-step2");

  const exportSize = useMemo(() => {
    if (customPrint) {
      const px = physicalToPixels(
        customPrint.width,
        customPrint.height,
        customPrint.unit
      );
      return clampExportSize(px.width, px.height);
    }
    if (aspectRatio === "original") {
      const maxEdge = 2400;
      const scale = Math.min(
        1,
        maxEdge / Math.max(naturalSize.w, naturalSize.h, 1)
      );
      return {
        width: Math.max(1, Math.round(naturalSize.w * scale)),
        height: Math.max(1, Math.round(naturalSize.h * scale)),
      };
    }
    if (aspectRatio === "id") return { width: 413, height: 531 };
    const output = outputSizeForAspect(aspectRatio);
    if (output.width > 0 && output.height > 0) {
      return clampExportSize(output.width, output.height);
    }
    return { width: 1080, height: Math.round(1080 / aspect) };
  }, [aspect, aspectRatio, customPrint, naturalSize.h, naturalSize.w]);

  const canvasSize = useMemo(() => {
    if (isPrintAgentCanvas) {
      const ref = referencePrintStageSize(aspect);
      return { width: ref.w, height: ref.h };
    }
    return scaleToPreview(exportSize.width, exportSize.height);
  }, [aspect, exportSize.height, exportSize.width, isPrintAgentCanvas]);

  /** CSS layout size for the canvas group — always matches canvasSize aspect. */
  const viewSize = useMemo(
    () =>
      fitContain(
        canvasSize.width,
        canvasSize.height,
        stageBounds.w,
        stageBounds.h
      ),
    [canvasSize.height, canvasSize.width, stageBounds.h, stageBounds.w]
  );

  // Sync Template Studio planes → shared Konva canvas store (utility + agent).
  // panelOnly embeds PreviewCanvas instead of Konva — skip expensive store rebuilds.
  useEffect(() => {
    if (panelOnly) return;
    // Wait for the real host box. Fitting against canvasSize (1080) then
    // keeping those coords on a ~400px stage is what left-shifts the hero.
    const stageW = Math.round(viewSize.w);
    const stageH = Math.round(viewSize.h);
    if (stageW < 16 || stageH < 16) return;
    useCanvasStore.getState().setMeta({
      width: stageW,
      height: stageH,
      mode,
      dpi: PRINT_DPI,
    });
    const prev = useCanvasStore.getState().objects;
    const forceRefit = forcePlaneRefitRef.current;
    if (forceRefit) forcePlaneRefitRef.current = false;
    const hydrated = hydrateCanvasObjectsRef.current;
    const hydrateMeta = hydrateCanvasMetaRef.current;
    if (hydrated) {
      hydrateCanvasObjectsRef.current = null;
      hydrateCanvasMetaRef.current = null;
    }
    // Fresh image fit: ignore prior image/photo transforms (keep text only).
    // Import restore: use hydrated objects so transforms survive plane sync.
    let previous = forceRefit
      ? prev.filter((o) => o.type === "text")
      : hydrated
        ? scaleCanvasObjectsToStage(
            hydrated,
            hydrateMeta?.w ?? stageW,
            hydrateMeta?.h ?? stageH,
            stageW,
            stageH
          )
        : prev;
    // Real image metrics arrived after a placeholder 1080×1350 fit — Center & Fit again.
    if (
      !hydrated &&
      !forceRefit &&
      naturalSize.w > 1 &&
      naturalSize.h > 1
    ) {
      const subject = previous.find((o) => o.id === "plane-subject");
      if (subject && subject.type !== "text") {
        const boxAspect =
          Math.abs(subject.width * (subject.scaleX || 1)) /
          Math.max(1, Math.abs(subject.height * (subject.scaleY || 1)));
        const natAspect = naturalSize.w / naturalSize.h;
        const aspectDrift =
          Math.abs(boxAspect - natAspect) /
          Math.max(boxAspect, natAspect, 0.0001);
        if (aspectDrift > 0.04 && Math.abs(subject.rotation || 0) < 0.5) {
          previous = previous.filter((o) => o.id !== "plane-subject");
        }
      }
    }
    const next = buildObjectsFromStudioPlanes({
      stageW,
      stageH,
      backgroundUrl: backgroundImage,
      subjectUrl: subjectLayer,
      subjectNatural: naturalSize,
      overlayLayers,
      previous,
      printTextLayout: mode === "agent",
    });
    useCanvasStore.getState().setObjects(next);
  }, [
    backgroundImage,
    mode,
    naturalSize.h,
    naturalSize.w,
    overlayLayers,
    panelOnly,
    subjectLayer,
    viewSize.h,
    viewSize.w,
  ]);

  // Bidirectional selection: side-panel active layer ↔ Konva selection
  useEffect(() => {
    if (panelOnly) return;
    if (activeLayerId) {
      useCanvasStore.getState().select(activeLayerId);
    } else {
      useCanvasStore.getState().clearSelection();
    }
  }, [activeLayerId, panelOnly]);

  useEffect(() => {
    if (panelOnly) return;
    const unsub = useCanvasStore.subscribe((s, prev) => {
      if (s.selectedId === prev.selectedId) return;
      if (!s.selectedId) {
        selectionClearedRef.current = true;
        setActiveLayerId(null);
        return;
      }
      if (s.selectedId.startsWith("plane-")) return;
      if (s.selectedId.startsWith("photo_")) return;
      const isTextLayer = overlayLayersRef.current.some(
        (l) => l.id === s.selectedId
      );
      if (!isTextLayer) return;
      selectionClearedRef.current = false;
      setActiveLayerId(s.selectedId);
    });
    return unsub;
  }, [panelOnly, setActiveLayerId]);

  useEffect(() => {
    // Drop in-progress slider draft when the selected layer changes.
    styleDragActiveRef.current = false;
    styleDraftRef.current = null;
    setStyleDraft(null);
    if (styleCommitRafRef.current != null) {
      cancelAnimationFrame(styleCommitRafRef.current);
      styleCommitRafRef.current = null;
    }
  }, [activeLayerId]);

  const canvasAspectCss = `${canvasSize.width} / ${Math.max(canvasSize.height, 1)}`;

  const zoomedContent = useMemo(
    () => ({
      w: viewSize.w > 0 ? viewSize.w * zoomScale : 0,
      h: viewSize.h > 0 ? viewSize.h * zoomScale : 0,
    }),
    [viewSize.h, viewSize.w, zoomScale]
  );

  /** Pan viewport = unzoomed canvas frame (not the full column). */
  const stagePort = useMemo(() => {
    if (viewSize.w < 1 || viewSize.h < 1) return { w: 0, h: 0 };
    return { w: viewSize.w, h: viewSize.h };
  }, [viewSize.h, viewSize.w]);

  const setViewOffsetSafe = useCallback(
    (next: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
      setViewOffset((prev) => {
        const raw = typeof next === "function" ? next(prev) : next;
        const clamped = clampViewOffset(
          raw.x,
          raw.y,
          zoomedContent.w,
          zoomedContent.h,
          stagePort.w,
          stagePort.h
        );
        viewOffsetRef.current = clamped;
        return prev.x === clamped.x && prev.y === clamped.y ? prev : clamped;
      });
    },
    [stagePort.h, stagePort.w, zoomedContent.h, zoomedContent.w]
  );

  useLayoutEffect(() => {
    if (zoomedContent.w < 1 || stagePort.w < 1) return;
    if (zoomScale <= 1.001) {
      viewOffsetRef.current = { x: 0, y: 0 };
      setViewOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
      return;
    }
    setViewOffsetSafe((prev) => prev);
  }, [
    zoomedContent.h,
    zoomedContent.w,
    stagePort.h,
    stagePort.w,
    zoomScale,
    subjectLayer,
    backgroundImage,
    aspectRatio,
    setViewOffsetSafe,
  ]);

  const drawStyledText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      xAnchor: number,
      y: number,
      width: number,
      height: number,
      opts?: { placeholder?: boolean }
    ) => {
      const { fontSize, fontPreset, align, stickerId } = layer;
      const fontWeight = clampFontWeight(
        layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
      );
      const letterSpacing = layerLetterSpacing(layer);
      const lineHeightMul = layerLineHeight(layer);
      const asPlaceholder = Boolean(opts?.placeholder);
      const pureText = asPlaceholder
        ? PLACEHOLDER_TEXT
        : stripStickerTokens(layer.text);
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const { lines, lineWidths, contentW, blockH } = measureTextBlock(
        ctx,
        pureText,
        fontSize,
        fontPreset,
        fontWeight,
        letterSpacing,
        lineHeightMul
      );
      const lineHeightPx = fontSize * lineHeightMul;
      const drawY = y + layer.offsetY * height;
      const blockTop = drawY - blockH / 2;
      const blockX =
        align === "left"
          ? width * 0.08 + layer.offsetX * width
          : align === "right"
            ? width * 0.92 - contentW + layer.offsetX * width
            : xAnchor - contentW / 2 + layer.offsetX * width;

      if (!asPlaceholder && layer.showBox && (pureText.trim() || stickerId)) {
        const padX = fontSize * 0.35;
        const padY = fontSize * 0.45;
        const topPad = stickerId ? fontSize * 1.55 : padY;
        const boxX = blockX - padX;
        const boxY = blockTop - topPad;
        const boxW = contentW + padX * 2;
        const boxH = blockH + topPad + padY;
        const opacity = Math.max(0.15, Math.min(0.9, layer.boxOpacity ?? 0.55));
        ctx.save();
        ctx.fillStyle = hexToRgba(layer.boxColor || "#000000", opacity);
        ctx.beginPath();
        const r = Math.min(14, fontSize * 0.28);
        ctx.moveTo(boxX + r, boxY);
        ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
        ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
        ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
        ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (asPlaceholder) {
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li] ?? "";
          const lineW = lineWidths[li] ?? fontSize * 2.2;
          const lineY = blockTop + (li + 0.5) * lineHeightPx;
          const lineX = lineAnchorX(
            align,
            lineW,
            xAnchor,
            width,
            layer.offsetX
          );
          ctx.save();
          ctx.font = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, line)}`;
          ctx.fillStyle = "rgba(255,255,255,0.38)";
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.fillText(line, lineX, lineY);
          ctx.restore();
        }
      } else {
        const isPlainPrintLayer =
          layer.id.startsWith("form-") && !stickerId;
        const fillColor = colorPresetFill(layer.color);

        if (isPlainPrintLayer && layer.id === "form-programs") {
          const entries = parseProgramEntries(pureText);
          if (entries.length) {
            const numColW = programNumberColumnWidth(
              entries,
              fontSize,
              fontWeight,
              ctx
            );
            const gap = fontSize * 0.35;
            const labelFont = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, pureText)}`;
            ctx.font = labelFont;
            const labelMax = Math.max(8, contentW - numColW - gap);
            let startX = blockX;
            if (align === "center") startX = blockX;
            else if (align === "right") startX = blockX + contentW - (numColW + gap + labelMax);

            ctx.save();
            ctx.fillStyle = fillColor;
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            const numFont = programNumFontCss(fontWeight, fontSize);
            let lineY = blockTop + 0.5 * lineHeightPx;
            for (const entry of entries) {
              ctx.font = labelFont;
              const wrapped = wrapParagraph(ctx, entry.label, labelMax, 0);
              ctx.font = numFont;
              ctx.textAlign = "right";
              ctx.fillText(`${entry.num}.`, startX + numColW, lineY);
              ctx.font = labelFont;
              ctx.textAlign = "left";
              for (let wi = 0; wi < wrapped.length; wi++) {
                ctx.fillText(wrapped[wi]!, startX + numColW + gap, lineY);
                lineY += lineHeightPx;
              }
            }
            ctx.restore();
            ctx.shadowBlur = 0;
            return;
          }
        }

        if (isPlainPrintLayer) {
          for (let li = 0; li < lines.length; li++) {
            const line = lines[li] ?? "";
            const lineW = lineWidths[li] ?? fontSize * 2.2;
            const lineY = blockTop + (li + 0.5) * lineHeightPx;
            const lineX = lineAnchorX(
              align,
              lineW,
              xAnchor,
              width,
              layer.offsetX
            );
            ctx.save();
            ctx.font = `${fontWeight} ${fontSize}px ${fontForText(fontPreset, line)}`;
            ctx.fillStyle = fillColor;
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
            ctx.fillText(line, lineX, lineY);
            ctx.restore();
          }
          ctx.shadowBlur = 0;
          return;
        }

        const lineStartOffsets: number[] = [];
        let offset = 0;
        for (let li = 0; li < lines.length; li++) {
          lineStartOffsets.push(offset);
          offset += lines[li]?.length ?? 0;
          if (li < lines.length - 1) offset += 1;
        }

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li] ?? "";
          const lineW = lineWidths[li] ?? fontSize * 2.2;
          const lineY = blockTop + (li + 0.5) * lineHeightPx;
          let cursorX = lineAnchorX(align, lineW, xAnchor, width, layer.offsetX);
          const linePoints: Array<{ ch: string; relIndex: number }> = [];
          forEachCodePoint(line, (ch, relIndex) =>
            linePoints.push({ ch, relIndex })
          );
          for (let i = 0; i < linePoints.length; i++) {
            const { ch, relIndex } = linePoints[i]!;
            if (isEmojiChar(ch)) {
              cursorX += drawEmojiChar(ctx, ch, cursorX, lineY, fontSize);
              if (i < linePoints.length - 1) cursorX += letterSpacing;
              continue;
            }
            const utf16Index = (lineStartOffsets[li] ?? 0) + relIndex;
            const presetKey = colorAtIndex(layer, utf16Index);
            const preset = colorPresetMeta(presetKey);
            ctx.font = `${fontWeight} ${fontSize}px ${fontForChar(fontPreset, ch)}`;
            const w = ctx.measureText(ch).width;
            ctx.shadowColor = preset.shadow;
            ctx.shadowBlur =
              presetKey === "white" || presetKey === "purplePink" ? 12 : 6;
            ctx.lineWidth = Math.max(3, fontSize * 0.08);
            if (preset.stroke !== "transparent") {
              ctx.strokeStyle = preset.stroke;
              ctx.strokeText(ch, cursorX, lineY);
            }
            ctx.fillStyle = preset.fill;
            ctx.fillText(ch, cursorX, lineY);
            cursorX += w + (i < linePoints.length - 1 ? letterSpacing : 0);
          }
        }
        ctx.shadowBlur = 0;

        if (stickerId) {
          const scale = Math.max(0.7, fontSize / 48);
          const badgeY = blockTop - fontSize * 0.95;
          const badgeX =
            align === "left"
              ? width * 0.08 + layer.offsetX * width
              : align === "right"
                ? width * 0.92 +
                  layer.offsetX * width -
                  measureStickerBadge(ctx, stickerId, scale)
                : xAnchor +
                  layer.offsetX * width -
                  measureStickerBadge(ctx, stickerId, scale) / 2;
          drawStickerBadge(ctx, stickerId, badgeX, badgeY, scale);
        }
      }
    },
    []
  );

  const measureLayerBox = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      xAnchor: number,
      y: number,
      width: number,
      height: number
    ) => {
      const { fontSize, fontPreset, align } = layer;
      const fontWeight = clampFontWeight(
        layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
      );
      const letterSpacing = layerLetterSpacing(layer);
      const lineHeightMul = layerLineHeight(layer);
      const pureText = stripStickerTokens(layer.text);
      const measureText =
        pureText.trim() || layer.stickerId ? pureText : PLACEHOLDER_TEXT;

      const { lines, lineWidths, contentW, blockH } = measureTextBlock(
        ctx,
        measureText,
        fontSize,
        fontPreset,
        fontWeight,
        letterSpacing,
        lineHeightMul
      );

      const drawY = y + layer.offsetY * height;
      const lineHeightPx = fontSize * lineHeightMul;
      const blockTop = drawY - blockH / 2;
      // Stroke expands glyphs slightly beyond measureText width.
      const strokePad = Math.max(1, fontSize * 0.04);

      // Tight AABB from each line's real drawn glyphs (baseline = middle).
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (let li = 0; li < lines.length; li++) {
        const lineW = lineWidths[li] ?? 0;
        if (lineW <= 0) continue;
        const lineX = lineAnchorX(
          align,
          lineW,
          xAnchor,
          width,
          layer.offsetX
        );
        const lineY = blockTop + (li + 0.5) * lineHeightPx;
        // Glyph height ≈ fontSize when baseline is middle.
        const glyphHalf = fontSize * 0.52;
        minX = Math.min(minX, lineX);
        maxX = Math.max(maxX, lineX + lineW);
        minY = Math.min(minY, lineY - glyphHalf);
        maxY = Math.max(maxY, lineY + glyphHalf);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) {
        const fallbackX = lineAnchorX(
          align,
          contentW,
          xAnchor,
          width,
          layer.offsetX
        );
        minX = fallbackX;
        maxX = fallbackX + Math.max(contentW, fontSize * 0.5);
        minY = drawY - fontSize * 0.52;
        maxY = drawY + fontSize * 0.52;
      }

      if (layer.stickerId) {
        minY = Math.min(minY, blockTop - fontSize * 1.05);
      }

      // Ultra-tight pad — only stroke bleed, no loose empty space.
      const padX = strokePad;
      const padY = strokePad;

      return {
        x: minX - padX,
        y: minY - padY,
        width: Math.max(2, maxX - minX) + padX * 2,
        height: Math.max(2, maxY - minY) + padY * 2,
      };
    },
    []
  );

  const computeLayerBoundsAtOffset = useCallback(
    (layer: TextLayer, offsetX: number, offsetY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const { width, height } = canvasSize;
      if (width < 1 || height < 1) return null;

      const fontScale = width / Math.max(canvasSize.width, 1);
      const scaled: TextLayer = {
        ...layer,
        offsetX,
        offsetY,
        fontSize: Math.max(1, Math.round(layer.fontSize * fontScale)),
        letterSpacing: layerLetterSpacing(layer) * fontScale,
      };
      const layerPos: TextPos = scaled.pos ?? "bottom";
      const baseY =
        layerPos === "top"
          ? scaled.fontSize * 1.2
          : layerPos === "center"
            ? height / 2
            : height - scaled.fontSize * 1.1;
      const baseX = width / 2;
      const box = measureLayerBox(ctx, scaled, baseX, baseY, width, height);
      return { box, baseX, baseY };
    },
    [canvasSize, measureLayerBox]
  );

  const paintTo = useCallback(
    (
      target: HTMLCanvasElement,
      width: number,
      height: number,
      opts?: { updateAnchors?: boolean }
    ) => {
      const bgImg = loadedBgImageRef.current;
      const subjectImg = loadedImageRef.current;
      const hasBg = Boolean(bgImg && bgImg.naturalWidth > 0);
      const hasSubject = Boolean(subjectImg && subjectImg.naturalWidth > 0);
      if (!hasBg && !hasSubject) return;

      const ctx = target.getContext("2d");
      if (!ctx) return;

      const fontScale = width / Math.max(canvasSize.width, 1);
      target.width = width;
      target.height = height;
      ctx.clearRect(0, 0, width, height);

      // 1) Background layer (full-bleed cover) — only when AI/mood bg is set.
      //    When absent, leave pixels cleared so stage checkerboard shows through alpha.
      if (hasBg && bgImg) {
        const bgCrop = coverCrop(
          bgImg.naturalWidth,
          bgImg.naturalHeight,
          aspect,
          0,
          0,
          1
        );
        ctx.drawImage(
          bgImg,
          bgCrop.sx,
          bgCrop.sy,
          bgCrop.sw,
          bgCrop.sh,
          0,
          0,
          width,
          height
        );
      }

      // 2) Subject / cutout layer (transparent PNG). Always contain-fit so rembg
      //    alpha edges are not cropped away by cover framing.
      if (hasSubject && subjectImg) {
        const fit = containFit(
          subjectImg.naturalWidth,
          subjectImg.naturalHeight,
          width,
          height
        );
        const zoom = Math.max(0.5, pan.scale);
        const dw = fit.dw * zoom;
        const dh = fit.dh * zoom;
        const dx =
          fit.dx - (dw - fit.dw) / 2 + (pan.x * Math.max(0, width - dw)) / 2;
        const dy =
          fit.dy - (dh - fit.dh) / 2 + (pan.y * Math.max(0, height - dh)) / 2;
        ctx.drawImage(
          subjectImg,
          0,
          0,
          subjectImg.naturalWidth,
          subjectImg.naturalHeight,
          dx,
          dy,
          dw,
          dh
        );
      }

      // 3) Text / sticker overlayLayers (unchanged)
      const anchors: LayerAnchor[] = [];
      overlayLayers.forEach((layer) => {
        const scaled: TextLayer = {
          ...layer,
          fontSize: Math.max(1, Math.round(layer.fontSize * fontScale)),
          letterSpacing: layerLetterSpacing(layer) * fontScale,
        };
        const layerPos: TextPos = scaled.pos ?? "bottom";
        const baseY =
          layerPos === "top"
            ? scaled.fontSize * 1.2
            : layerPos === "center"
              ? height / 2
              : height - scaled.fontSize * 1.1;
        const baseX = width / 2;
        const box = measureLayerBox(ctx, scaled, baseX, baseY, width, height);
        anchors.push({
          id: layer.id,
          baseX,
          baseY,
          x: baseX + layer.offsetX * width,
          y: baseY + layer.offsetY * height,
          box,
        });
        const isEmpty = !layer.text.trim() && !layer.stickerId;
        drawStyledText(ctx, scaled, baseX, baseY, width, height, {
          placeholder: isEmpty,
        });
      });
      if (opts?.updateAnchors !== false && width === canvasSize.width) {
        layerAnchorsRef.current = anchors;
      }
    },
    [
      aspect,
      canvasSize.width,
      drawStyledText,
      overlayLayers,
      measureLayerBox,
      pan.x,
      pan.y,
      pan.scale,
    ]
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintTo(canvas, canvasSize.width, canvasSize.height, { updateAnchors: true });
  }, [canvasSize.height, canvasSize.width, paintTo]);

  paintRef.current = paint;

  useLayoutEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const measure = () => {
      const w = Math.max(0, Math.floor(host.clientWidth));
      const h = Math.max(0, Math.floor(host.clientHeight));
      const vh =
        typeof window !== "undefined" ? window.innerHeight : 800;
      // Prefer real host box; fall back until flex layout resolves height.
      const next = {
        w: w > 8 ? w : Math.max(280, Math.floor(vh * 0.35)),
        h: h > 8 ? h : Math.max(240, Math.floor(Math.min(vh * 0.5, 640))),
      };
      setStageBounds((prev) =>
        prev.w === next.w && prev.h === next.h ? prev : next
      );
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    ro?.observe(host);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Initial Center & Fit: 100% zoom, zero pan once host has a real size.
  useLayoutEffect(() => {
    if (viewportFitDoneRef.current) return;
    if (stageBounds.w < 16 || stageBounds.h < 16) return;
    viewportFitDoneRef.current = true;
    setZoomPct(100);
    setViewOffset({ x: 0, y: 0 });
    viewOffsetRef.current = { x: 0, y: 0 };
  }, [stageBounds.h, stageBounds.w]);

  useEffect(() => {
    if (!subjectLayer.trim()) {
      loadedImageRef.current = null;
      paintRef.current();
      return;
    }
    const img = new Image();
    let cancelled = false;
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    loadedImageRef.current = null;
    // Clear stale opaque frame while the new transparent PNG decodes.
    paintRef.current();
    img.onload = () => {
      if (cancelled || img.naturalWidth < 1) return;
      loadedImageRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      paintRef.current();
    };
    img.onerror = () => {
      if (cancelled) return;
      loadedImageRef.current = null;
      paintRef.current();
      showToast("업로드 이미지를 불러오지 못했습니다.", "error");
    };
    img.src = subjectLayer;
    if (img.complete && img.naturalWidth > 0) {
      loadedImageRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      paintRef.current();
    }
    return () => {
      cancelled = true;
    };
  }, [subjectLayer, showToast]);

  useEffect(() => {
    if (!backgroundImage?.trim()) {
      loadedBgImageRef.current = null;
      paintRef.current();
      return;
    }
    const img = new Image();
    let cancelled = false;
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    loadedBgImageRef.current = null;
    img.onload = () => {
      if (cancelled || img.naturalWidth < 1) return;
      loadedBgImageRef.current = img;
      paintRef.current();
    };
    img.onerror = () => {
      if (cancelled) return;
      loadedBgImageRef.current = null;
      paintRef.current();
      showToast(
        "배경 이미지를 불러오지 못했습니다. 다시 생성해 주세요.",
        "error"
      );
    };
    img.src = backgroundImage;
    if (img.complete && img.naturalWidth > 0) {
      loadedBgImageRef.current = img;
      paintRef.current();
    }
    return () => {
      cancelled = true;
    };
  }, [backgroundImage, showToast]);

  useEffect(() => {
    paint();
    const { width, height } = canvasSize;
    if (width < 1 || height < 1) return;
    setLayerHitBoxes(
      layerAnchorsRef.current.map((a) => {
        // Minimal hit slop so nearby overlayLayers stay independently clickable.
        const padX = 2;
        const padY = 2;
        return {
          id: a.id,
          left: ((a.box.x - padX) / width) * 100,
          top: ((a.box.y - padY) / height) * 100,
          width: ((a.box.width + padX * 2) / width) * 100,
          height: ((a.box.height + padY * 2) / height) * 100,
        };
      })
    );
  }, [paint, canvasSize.height, canvasSize.width]);

  useEffect(() => {
    const canvas = guideCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (activeLayerId) {
      const anchor = layerAnchorsRef.current.find((a) => a.id === activeLayerId);
      if (anchor) {
        drawLayerSelectionChrome(
          ctx,
          anchor.box,
          dragging && dragKind === "layer"
        );
      }
    }

    // Smart guides — only while dragging a text layer.
    if (
      dragging &&
      dragKind === "layer" &&
      (snapGuides.vertical.length > 0 || snapGuides.horizontal.length > 0)
    ) {
      ctx.save();
      ctx.strokeStyle = "rgba(244, 114, 182, 0.95)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      for (const gx of snapGuides.vertical) {
        ctx.beginPath();
        ctx.moveTo(Math.round(gx) + 0.5, 0);
        ctx.lineTo(Math.round(gx) + 0.5, height);
        ctx.stroke();
      }
      for (const gy of snapGuides.horizontal) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(gy) + 0.5);
        ctx.lineTo(width, Math.round(gy) + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [canvasSize, dragging, dragKind, snapGuides, paint, activeLayerId, layerHitBoxes]);

  /** Click / tap on canvas text → matching layer textarea, cursor blinking. */
  const focusLayerTextarea = useCallback(
    (layerId: string, opts?: { canvasX?: number; selectAll?: boolean }) => {
      selectionClearedRef.current = false;
      setActiveLayerId(layerId);

      const applyFocus = (attempt: number) => {
        const node =
          layerTextareaRefs.current[layerId] ??
          (document.querySelector(
            `textarea[data-layer-id="${layerId}"]`
          ) as HTMLTextAreaElement | null);
        if (!node) {
          if (attempt < 12) {
            window.setTimeout(() => applyFocus(attempt + 1), 20);
          }
          return;
        }
        node.scrollIntoView({ block: "nearest", behavior: "smooth" });
        node.focus({ preventScroll: true });
        const layer = overlayLayersRef.current.find((l) => l.id === layerId);
        try {
          if (opts?.selectAll && layer?.text) {
            node.select();
          } else {
            const pos = layer?.text.length ?? 0;
            node.setSelectionRange(pos, pos);
          }
        } catch {
          /* ignore */
        }
      };

      applyFocus(0);
      window.requestAnimationFrame(() => applyFocus(1));
      window.setTimeout(() => applyFocus(2), 40);
      window.setTimeout(() => applyFocus(3), 120);
    },
    []
  );

  const stageRect = () =>
    canvasRef.current?.getBoundingClientRect() ??
    stageRef.current?.getBoundingClientRect() ??
    null;

  const handleLayerPointerDown = (
    e: React.PointerEvent<HTMLElement>,
    layerId: string
  ) => {
    e.stopPropagation();
    const layer = overlayLayersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    const rect = stageRect();
    const canvasX = rect?.width
      ? ((e.clientX - rect.left) * canvasSize.width) / rect.width
      : 0;
    dragRef.current = {
      kind: "layer",
      layerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: layer.offsetX,
      startOffsetY: layer.offsetY,
      canvasX,
      moved: false,
    };
    selectionClearedRef.current = false;
    setActiveLayerId(layerId);
  };

  const handlePanPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const useViewportPan = zoomScale > 1.001;
    const origin = viewOffsetRef.current;
    dragRef.current = {
      kind: "pan",
      mode: useViewportPan ? "viewport" : "image",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      startViewX: origin.x,
      startViewY: origin.y,
      moved: false,
    };
    setDragKind("pan");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (Math.hypot(dx, dy) > CLICK_MOVE_PX) {
      if (!drag.moved) {
        drag.moved = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* already captured or unsupported */
        }
        if (drag.kind === "layer") setDragKind("layer");
        if (drag.kind === "pan") setDragKind("pan");
        setDragging(true);
      }
    }

    if (drag.kind === "pan") {
      if (!drag.moved) return;
      if (drag.mode === "viewport") {
        // Screen-space pan: X and Y use the same delta math (no centering lock).
        setViewOffsetSafe({
          x: drag.startViewX + dx,
          y: drag.startViewY + dy,
        });
        return;
      }
      const rect = stageRect();
      if (!rect?.width || !rect.height) return;
      const dxNorm = dx / rect.width;
      const dyNorm = dy / rect.height;
      setPan(
        normalizeImagePan({
          x: clampImagePan(drag.startPanX - dxNorm * IMAGE_PAN_SENSITIVITY),
          y: clampImagePan(drag.startPanY - dyNorm * IMAGE_PAN_SENSITIVITY),
          scale: pan.scale,
        })
      );
      return;
    }

    const rect = stageRect();
    if (!rect?.width || !rect.height) return;
    if (!drag.moved) return;

    const dxNorm = dx / rect.width;
    const dyNorm = dy / rect.height;

    const layer = overlayLayersRef.current.find((l) => l.id === drag.layerId);
    if (!layer) return;

    const { width, height } = canvasSize;
    const proposedOffsetX = drag.startOffsetX + dxNorm;
    const proposedOffsetY = drag.startOffsetY + dyNorm;
    const bounds = computeLayerBoundsAtOffset(
      layer,
      proposedOffsetX,
      proposedOffsetY
    );

    if (!bounds) {
      setSnapGuides({ vertical: [], horizontal: [] });
      setOverlayLayers((prev) =>
        prev.map((l) =>
          l.id === drag.layerId
            ? {
                ...l,
                offsetX: clampOffset(proposedOffsetX),
                offsetY: clampOffset(proposedOffsetY),
              }
            : l
        )
      );
      return;
    }

    const layerRect = rectFromBox(bounds.box);
    const targets = collectSnapTargets(
      width,
      height,
      layerAnchorsRef.current,
      drag.layerId
    );
    const { deltaX, deltaY, guides } = snapLayerRect(
      layerRect,
      targets.vertical,
      targets.horizontal,
      SNAP_THRESHOLD_PX
    );

    setSnapGuides(guides);
    setOverlayLayers((prev) =>
      prev.map((l) =>
        l.id === drag.layerId
          ? {
              ...l,
              offsetX: clampOffset(proposedOffsetX + deltaX / width),
              offsetY: clampOffset(proposedOffsetY + deltaY / height),
            }
          : l
      )
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const wasClick = !drag.moved;
    const layerClick =
      drag.kind === "layer" && wasClick
        ? { layerId: drag.layerId, canvasX: drag.canvasX }
        : null;
    dragRef.current = null;
    setDragging(false);
    setDragKind(null);
    setSnapGuides({ vertical: [], horizontal: [] });

    if (drag.kind === "pan" && wasClick) {
      selectionClearedRef.current = true;
      setActiveLayerId(null);
      return;
    }

    if (layerClick) {
      focusLayerTextarea(layerClick.layerId, { canvasX: layerClick.canvasX });
    }
  };

  const handleLayerClick = (
    e: React.MouseEvent<HTMLElement>,
    layerId: string
  ) => {
    e.stopPropagation();
    if (dragRef.current?.moved) return;
    const rect = stageRect();
    const canvasX = rect?.width
      ? ((e.clientX - rect.left) * canvasSize.width) / rect.width
      : undefined;
    focusLayerTextarea(layerId, { canvasX });
  };

  const handleLayerDoubleClick = (
    e: React.MouseEvent<HTMLElement>,
    layerId: string
  ) => {
    e.stopPropagation();
    dragRef.current = null;
    setDragging(false);
    setDragKind(null);
    focusLayerTextarea(layerId, { selectAll: true });
  };

  const handleAspectChange = (key: AspectRatioKey) => {
    setCustomPrint(null);
    setCustomSizeOpen(false);
    setAspectRatio(key);
    setPan(normalizeImagePan({ x: 0, y: 0, scale: 1 }));
    setPromoMenuOpen(false);
  };

  const applyCustomPrintSize = () => {
    const width = Number(customWidthInput);
    const height = Number(customHeightInput);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      showToast("가로·세로 값을 올바르게 입력해 주세요.", "error");
      return;
    }
    const maxPhysical =
      customUnit === "cm" ? CUSTOM_SIZE_MAX_CM : CUSTOM_SIZE_MAX_INCH;
    if (width > maxPhysical || height > maxPhysical) {
      showToast(
        `한 변은 최대 ${maxPhysical}${customUnit}까지 입력할 수 있습니다.`,
        "error"
      );
      return;
    }
    setCustomPrint({ unit: customUnit, width, height });
    setPan(normalizeImagePan({ x: 0, y: 0, scale: 1 }));
    setPromoMenuOpen(false);
    setCustomSizeOpen(false);
    const px = physicalToPixels(width, height, customUnit);
    const clamped = clampExportSize(px.width, px.height);
    const scaledNote =
      clamped.width !== px.width || clamped.height !== px.height
        ? ` (출력 안전 한도 적용 → ${clamped.width}×${clamped.height}px)`
        : "";
    showToast(
      `프리 사이즈 적용: ${width}×${height}${customUnit} → ${px.width}×${px.height}px @ ${PRINT_DPI}DPI${scaledNote}`,
      "success"
    );
  };

  const updateActive = (patch: Partial<TextLayer>) => {
    const id =
      activeLayerId ?? (panelOnly ? overlayLayers[0]?.id ?? null : null);
    if (!id) {
      showToast("먼저 텍스트 레이어를 선택해 주세요.", "info");
      return;
    }
    if (!activeLayerId && panelOnly) {
      selectionClearedRef.current = false;
      setActiveLayerId(id);
    }
    setOverlayLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
    // Keep Konva selection on the edited text layer.
    if (!panelOnly) {
      useCanvasStore.getState().select(id);
    }
  };

  /** Patch Konva text node immediately; commit TextLayer once on pointer-up. */
  const patchActiveStyleLive = (patch: Partial<TextLayer>) => {
    const id =
      activeLayerId ?? (panelOnly ? overlayLayers[0]?.id ?? null : null);
    if (!id) {
      showToast("먼저 텍스트 레이어를 선택해 주세요.", "info");
      return;
    }
    if (!activeLayerId && panelOnly) {
      selectionClearedRef.current = false;
      setActiveLayerId(id);
    }
    styleDragActiveRef.current = true;
    const nextDraft = { ...(styleDraftRef.current || {}), ...patch };
    styleDraftRef.current = nextDraft;
    setStyleDraft(nextDraft);
    if (!panelOnly) {
      const storePatch: Record<string, unknown> = {};
      if (patch.fontSize != null) storePatch.fontSize = patch.fontSize;
      if (patch.fontWeight != null) storePatch.fontWeight = patch.fontWeight;
      if (patch.letterSpacing != null)
        storePatch.letterSpacing = patch.letterSpacing;
      if (patch.lineHeight != null) storePatch.lineHeight = patch.lineHeight;
      if (Object.keys(storePatch).length) {
        useCanvasStore.getState().updateObject(id, storePatch);
      }
      useCanvasStore.getState().select(id);
      return;
    }
    // PreviewCanvas reads overlay layers — rAF-batch commits while dragging.
    if (styleCommitRafRef.current != null) return;
    styleCommitRafRef.current = requestAnimationFrame(() => {
      styleCommitRafRef.current = null;
      const draft = styleDraftRef.current;
      const layerId = activeLayerId;
      if (!draft || !layerId) return;
      setOverlayLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, ...draft } : l))
      );
    });
  };

  const commitActiveStyleDrag = () => {
    if (!styleDragActiveRef.current) return;
    styleDragActiveRef.current = false;
    const draft = styleDraftRef.current;
    styleDraftRef.current = null;
    setStyleDraft(null);
    if (styleCommitRafRef.current != null) {
      cancelAnimationFrame(styleCommitRafRef.current);
      styleCommitRafRef.current = null;
    }
    if (draft && Object.keys(draft).length) {
      updateActive(draft);
    }
  };

  /** Insert a new text layer immediately below the given row. */
  const addLayerAfter = (afterId: string) => {
    const next = makeDefaultLayer(overlayLayers.length);
    setOverlayLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === afterId);
      const source = idx >= 0 ? prev[idx] : null;
      const placed: TextLayer = {
        ...next,
        pos: source?.pos ?? next.pos,
        offsetX: source?.offsetX ?? next.offsetX,
        offsetY: (source?.offsetY ?? next.offsetY) + 0.075,
        color: source?.color ?? next.color,
        fontPreset: source?.fontPreset ?? next.fontPreset,
        fontSize: source?.fontSize ?? next.fontSize,
        fontWeight: source?.fontWeight ?? next.fontWeight,
      };
      if (idx < 0) return [...prev, placed];
      const copy = prev.slice();
      copy.splice(idx + 1, 0, placed);
      return copy;
    });
    selectionClearedRef.current = false;
    setActiveLayerId(next.id);
  };

  const removeLayer = (id: string) => {
    setOverlayLayers((prev) => {
      const next = prev.filter((l) => l.id !== id);
      return next.length ? next : [makeDefaultLayer(0)];
    });
  };

  const deleteSelectedCanvasObject = useCallback(() => {
    const store = useCanvasStore.getState();
    const id = store.selectedId;
    if (!id) {
      showToast("삭제할 객체를 선택해 주세요.", "info");
      return false;
    }
    const obj = store.objects.find((o) => o.id === id);
    if (!obj || obj.locked || obj.type === "background") {
      showToast("이 객체는 삭제할 수 없습니다.", "info");
      return false;
    }
    if (obj.type === "text") {
      removeLayer(id);
    } else if (obj.type === "subject") {
      setSubjectLayer("");
      loadedImageRef.current = null;
    }
    store.removeObject(id);
    showToast("선택한 객체를 삭제했습니다.", "success");
    return true;
  }, [showToast]);

  const bringSelectedToFront = useCallback(() => {
    const id = useCanvasStore.getState().selectedId;
    if (!id) return;
    useCanvasStore.getState().bringToFront(id);
  }, []);

  const sendSelectedToBack = useCallback(() => {
    const id = useCanvasStore.getState().selectedId;
    if (!id) return;
    useCanvasStore.getState().sendToBack(id);
  }, []);

  const copyActiveLayer = useCallback(
    (layerId?: string | null) => {
      const id = layerId ?? activeLayerId;
      const layer =
        (id ? overlayLayersRef.current.find((l) => l.id === id) : null) ?? null;
      if (!layer) {
        showToast("복사할 텍스트 레이어를 선택해 주세요.", "info");
        return false;
      }
      clipboardLayerRef.current = { ...layer, ranges: [...layer.ranges] };
      pasteCountRef.current = 0;
      setHasClipboardLayer(true);
      showToast("텍스트 레이어를 복사했습니다.", "success");
      return true;
    },
    [activeLayerId, showToast]
  );

  const pasteClipboardLayer = useCallback(() => {
    const source = clipboardLayerRef.current;
    if (!source) {
      showToast("붙여넣을 레이어가 없습니다. 먼저 복사해 주세요.", "info");
      return false;
    }
    pasteCountRef.current += 1;
    const n = pasteCountRef.current;
    const { id: _id, ...rest } = source;
    const clone = createLayer({
      ...rest,
      ranges: source.ranges.map((r) => ({ ...r })),
      offsetX: clampOffset(source.offsetX + 0.045 * n),
      offsetY: clampOffset(source.offsetY + 0.055 * n),
    });
    selectionClearedRef.current = false;
    setOverlayLayers((prev) => [...prev, clone]);
    setActiveLayerId(clone.id);
    setContextMenu(null);
    showToast("텍스트 레이어를 붙여넣었습니다.", "success");
    return true;
  }, [showToast]);

  const duplicateLayer = useCallback(
    (layerId?: string | null) => {
      const id = layerId ?? activeLayerId;
      const source =
        (id ? overlayLayersRef.current.find((l) => l.id === id) : null) ?? null;
      if (!source) {
        showToast("복제할 텍스트 레이어를 선택해 주세요.", "info");
        return false;
      }
      clipboardLayerRef.current = { ...source, ranges: [...source.ranges] };
      setHasClipboardLayer(true);
      const { id: _id, ...rest } = source;
      const clone = createLayer({
        ...rest,
        ranges: source.ranges.map((r) => ({ ...r })),
        offsetX: clampOffset(source.offsetX + 0.04),
        offsetY: clampOffset(source.offsetY + 0.06),
      });
      pasteCountRef.current = 1;
      selectionClearedRef.current = false;
      setOverlayLayers((prev) => [...prev, clone]);
      setActiveLayerId(clone.id);
      setContextMenu(null);
      showToast("텍스트 레이어를 복제했습니다.", "success");
      return true;
    },
    [activeLayerId, showToast]
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") {
        const el = target as HTMLInputElement | HTMLTextAreaElement;
        // Let native copy work when user selected a text substring.
        return el.selectionStart !== el.selectionEnd;
      }
      return target.isContentEditable;
    };

    const isTypingField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "TEXTAREA" ||
        tag === "INPUT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isTypingField(e.target)
      ) {
        if (deleteSelectedCanvasObject()) e.preventDefault();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "v" && key !== "d") return;
      if (isEditableTarget(e.target)) return;

      if (key === "c") {
        if (copyActiveLayer()) e.preventDefault();
        return;
      }
      if (key === "v") {
        if (pasteClipboardLayer()) e.preventDefault();
        return;
      }
      if (key === "d") {
        if (duplicateLayer()) e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    copyActiveLayer,
    pasteClipboardLayer,
    duplicateLayer,
    deleteSelectedCanvasObject,
  ]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const insertSymbol = (symbol: string) => {
    if (onCanvasSymbolPick) {
      onCanvasSymbolPick(symbol);
      return;
    }
    if (!activeLayer) return;
    const el = layerTextareaRefs.current[activeLayer.id];
    const start = el?.selectionStart ?? activeLayer.text.length;
    const end = el?.selectionEnd ?? start;
    const next =
      activeLayer.text.slice(0, start) + symbol + activeLayer.text.slice(end);
    updateActive({ text: stripStickerTokens(next) });
    requestAnimationFrame(() => {
      const node = layerTextareaRefs.current[activeLayer.id];
      if (!node) return;
      const caret = start + symbol.length;
      node.focus();
      node.setSelectionRange(caret, caret);
      autoResizeLayerTextarea(node);
    });
  };

  const insertSticker = (id: StickerBadgeId) => {
    if (!activeLayer) return;
    updateActive({ stickerId: activeLayer.stickerId === id ? null : id });
  };

  const resetViewportCenterFit = useCallback(() => {
    setZoomPct(100);
    setViewOffset({ x: 0, y: 0 });
    viewOffsetRef.current = { x: 0, y: 0 };
    setPan(normalizeImagePan({ x: 0, y: 0, scale: 1 }));
  }, []);

  /** Drop residual image/photo layers and force next sync to Center & Fit. */
  const clearResidualVisualAssets = useCallback(() => {
    useCanvasStore.getState().clearImageLayers();
    forcePlaneRefitRef.current = true;
  }, []);

  /**
   * Upload → sole main subject: clear old hero/bg/photos, mount new asset
   * centered in the stage (Center & Fit).
   */
  const installMainAssetFromFile = useCallback(
    async (file: File, mode: PhotoKind) => {
      if (!file.type.startsWith("image/")) {
        throw new Error("image_only");
      }
      setEntrySource("default");
      clearResidualVisualAssets();
      loadedBgImageRef.current = null;
      loadedImageRef.current = null;
      setBackgroundImage(null);

      const dataUrl = await readFileAsDataUrl(file);
      let displaySrc = dataUrl;
      if (mode === "cutout") {
        const cutoutHttps = await processSubjectViaApi(toRawImageUrl(dataUrl));
        displaySrc = toSubjectDisplayUrl(cutoutHttps);
      }
      const natural = await loadImageNaturalSize(displaySrc);
      setNaturalSize({ w: natural.w, h: natural.h });
      forcePlaneRefitRef.current = true;
      setSubjectLayer(displaySrc);
      resetViewportCenterFit();
      requestAnimationFrame(() => paintRef.current());
    },
    [clearResidualVisualAssets, resetViewportCenterFit]
  );

  const onPickFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    void (async () => {
      setUploadProcessing(true);
      try {
        await installMainAssetFromFile(file, "original");
        showToast("원본 이미지를 중앙에 장착했습니다.", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "사진 업로드에 실패했습니다.",
          "error"
        );
      } finally {
        setUploadProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    })();
  };

  const resetStudio = () => {
    setEntrySource("default");
    setSubjectLayer(HERO_AFTER_IMAGE);
    setBackgroundImage(null);
    loadedBgImageRef.current = null;
    setNaturalSize({ w: 1080, h: 1080 });
    setAspectRatio("1:1");
    setPan(normalizeImagePan({ x: 0, y: 0, scale: 1 }));
    setZoomPct(100);
    setViewOffset({ x: 0, y: 0 });
    viewOffsetRef.current = { x: 0, y: 0 };
    const layer = makeDefaultLayer(0);
    setOverlayLayers([layer]);
    setActiveLayerId(layer.id);
    setCommandInput("");
    setCommandLog([]);
    setPromoMenuOpen(false);
    setCustomSizeOpen(false);
    setCustomPrint(null);
    viewportFitDoneRef.current = false;
    forcePlaneRefitRef.current = true;
    useCanvasStore.getState().resetDocument({
      mode,
      dpi: PRINT_DPI,
    });
  };

  const resolveAspectForAi = () =>
    customPrint
      ? `${customPrint.width}:${customPrint.height}`
      : aspectRatio === "original"
        ? naturalSize.w && naturalSize.h
          ? `${naturalSize.w}:${naturalSize.h}`
          : "1:1"
        : aspectRatio;

  const applyPlaneActions = (
    actions: Array<{ plane: "subject" | "background"; imageUrl: string }>,
    opts?: { intent?: string; kind?: string }
  ) => {
    const isRemoveBg =
      opts?.intent === "remove_bg" ||
      /remove.?bg|rembg|누끼|배경\s*지워/i.test(opts?.kind || "");

    // Drop leftover photo residuals; force Center & Fit on next sync.
    clearResidualVisualAssets();

    for (const action of actions) {
      if (action.plane === "subject") {
        const display = toSubjectDisplayUrl(action.imageUrl);
        loadedImageRef.current = null;
        setSubjectLayer(display);
        // Pure cutout: drop scenic bg so alpha shows on checkerboard.
        if (isRemoveBg) {
          loadedBgImageRef.current = null;
          setBackgroundImage(null);
        }
      } else if (action.plane === "background") {
        loadedBgImageRef.current = null;
        setBackgroundImage(bustDisplayUrl(displayPlaneUrl(action.imageUrl)));
      }
    }
    resetViewportCenterFit();
    requestAnimationFrame(() => paintRef.current());
  };

  const runStudioCommand = async (rawCommand?: string) => {
    // Atomic reset: capture THIS click's text, then clear the input immediately
    // so a second click cannot concatenate / reuse leftover fragments.
    const command = (rawCommand ?? commandInput).trim();
    if (!command || commandBusy || uploadProcessing) return;
    setCommandInput("");
    setCommandBusy(true);
    setCommandLog((prev) => [...prev.slice(-9), { role: "user", text: command }]);
    try {
      const selectedObj = useCanvasStore
        .getState()
        .objects.find((o) => o.id === useCanvasStore.getState().selectedId);
      const commandSubjectSrc =
        selectedObj &&
        selectedObj.type === "photo" &&
        selectedObj.src.trim()
          ? selectedObj.src
          : subjectLayer;
      const result = await requestAiCommand({
        command,
        mode,
        subjectUrl: toRawImageUrl(commandSubjectSrc),
        backgroundUrl: backgroundImage
          ? toRawImageUrl(backgroundImage)
          : null,
        aspectRatio: resolveAspectForAi(),
        identityRefUrl: toRawImageUrl(commandSubjectSrc),
        formFields: formFields || undefined,
        imageStyleId: visualStyle.imageStyleId,
        moodStyleId: visualStyle.moodStyleId,
      });
      applyPlaneActions(result.actions, {
        intent: result.intent,
        kind: result.kind,
      });
      const lang = result.language && result.language !== "und" ? result.language : "en";
      const warn = result.routerError
        ? ` · ${result.routerError.code}`
        : "";
      const detail = result.englishPrompt
        ? `${result.message} (${lang} → EN Flux)${warn}`
        : result.message;
      setCommandLog((prev) => [
        ...prev.slice(-9),
        {
          role: "assistant",
          text: `[${result.kind}] ${detail}`,
        },
      ]);
      if (result.routerError) {
        console.warn("[AiTemplateStudio] routerWarning", result.routerError);
      }
      showToast(result.message, "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "명령 처리에 실패했습니다.";
      console.error("[AiTemplateStudio] command failed", err);
      setCommandLog((prev) => [
        ...prev.slice(-9),
        { role: "assistant", text: msg },
      ]);
      showToast(msg, "error");
    } finally {
      setCommandBusy(false);
    }
  };

  const captureExportDataUrl = (targetW: number): string => {
    const fromKonva =
      exportKonvaPrintDataUrl(
        konvaStageRef.current,
        Math.max(1, viewSize.w),
        Math.max(1, viewSize.h),
        targetW
      ) || "";
    if (fromKonva) return fromKonva;
    const exportCanvas = document.createElement("canvas");
    const tw = Math.max(1, Math.round(targetW));
    const th = Math.max(
      1,
      Math.round((tw * exportSize.height) / Math.max(1, exportSize.width))
    );
    paintTo(exportCanvas, tw, th, { updateAnchors: false });
    return exportCanvas.toDataURL("image/png");
  };

  const buildCurrentProject = () => {
    const snapshot = useCanvasStore.getState().getExportSnapshot();
    return buildStudioProject({
      mode,
      subjectUrl: subjectLayer,
      backgroundUrl: backgroundImage,
      overlayLayers,
      aspectRatio,
      customPrint,
      naturalSize,
      visualStyle,
      canvas: snapshot,
    });
  };

  /** Local-only dual download: result PNG + sealed editable .sca (subscribers). */
  const downloadWithProject = async (quality: "standard" | "high") => {
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      const spent = await spendForQuality(quality);
      if (!spent.ok) {
        showToast(quotaEmptyMessage, "error");
        return;
      }
      const targetW =
        quality === "high"
          ? exportSize.width
          : Math.min(
              1280,
              Math.max(720, Math.round(exportSize.width * 0.42))
            );
      const dataUrl = captureExportDataUrl(targetW);
      if (!dataUrl) throw new Error("export_empty");
      const imageBlob = await (await fetch(dataUrl)).blob();
      const project = buildCurrentProject();
      const label = customPrint
        ? `print-${customPrint.width}x${customPrint.height}${customPrint.unit}`
        : mode === "agent"
          ? "print-agent"
          : "ai-template-studio";
      await downloadAndRemember({
        imageBlob,
        project,
        baseName: `${label}-${quality}`,
        successMessage:
          quality === "high"
            ? `고화질 PNG + 수정파일 저장 · 최근 파일에 등록 (${targetW}px)`
            : `일반화질 PNG + 수정파일 저장 · 최근 파일에 등록 (${targetW}px)`,
      });
    } catch {
      showToast("다운로드에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const applyStudioProject = useCallback(
    (project: StudioCanvasProjectV1) => {
      forcePlaneRefitRef.current = false;
      hydrateCanvasObjectsRef.current = project.canvas.objects;
      hydrateCanvasMetaRef.current = {
        w: project.canvas.meta.width,
        h: project.canvas.meta.height,
      };
      loadedImageRef.current = null;
      loadedBgImageRef.current = null;
      setEntrySource("default");
      setSubjectLayer(project.studio.subjectUrl || "");
      setBackgroundImage(project.studio.backgroundUrl);

      const resolved = resolveProjectPrintAspect(project);
      if (resolved.customPrint) {
        setCustomPrint(resolved.customPrint);
        setNaturalSize(project.studio.naturalSize);
      } else {
        setCustomPrint(null);
        if (resolved.aspectKey) {
          setAspectRatio(resolved.aspectKey);
          setNaturalSize(project.studio.naturalSize);
        } else {
          const ref = referencePrintStageSize(resolved.aspect);
          setAspectRatio("original");
          setNaturalSize(ref);
        }
      }

      const nextLayers =
        project.studio.overlayLayers.length > 0
          ? cloneOverlayLayers(project.studio.overlayLayers)
          : [makeDefaultLayer(0)];
      setOverlayLayers(nextLayers);
      selectionClearedRef.current = false;
      setActiveLayerId(nextLayers[0]!.id);
      if (project.studio.visualStyle) {
        setVisualStyle(project.studio.visualStyle);
      }
      const stageW = Math.round(viewSize.w);
      const stageH = Math.round(viewSize.h);
      if (stageW < 16 || stageH < 16) {
        pendingRestoreRef.current = project;
        return;
      }
      pendingRestoreRef.current = null;
      const scaled = scaleCanvasObjectsToStage(
        project.canvas.objects,
        project.canvas.meta.width,
        project.canvas.meta.height,
        stageW,
        stageH
      );
      useCanvasStore.getState().setMeta({
        ...project.canvas.meta,
        width: stageW,
        height: stageH,
      });
      useCanvasStore.getState().setObjects(scaled);
      useCanvasStore.getState().select(project.canvas.selectedId);
      resetViewportCenterFit();
      requestAnimationFrame(() => paintRef.current());
    },
    [resetViewportCenterFit, setActiveLayerId, viewSize.h, viewSize.w]
  );

  const loadProjectFromFile = async (file: File | null) => {
    if (!file) return;
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      const project = await readProjectFile(file);
      applyStudioProject(project);
      showToast("수정파일을 불러와 편집 상태를 복원했습니다.", "success");
    } catch (err) {
      showToast(projectStorageErrorMessage(err), "error");
    } finally {
      setBusy(false);
      if (projectFileInputRef.current) projectFileInputRef.current.value = "";
    }
  };

  // Restore project handed off from print Step-2 recent-file picker.
  useEffect(() => {
    const pending = takePendingStudioProject(pendingProjectKey);
    if (!pending) return;
    applyStudioProject(pending);
    showToast("최근 수정파일을 복원했습니다.", "success");
  }, [applyStudioProject, pendingProjectKey, showToast]);

  // Finish deferred restore once the preview host reports a real viewSize.
  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    const stageW = Math.round(viewSize.w);
    const stageH = Math.round(viewSize.h);
    if (stageW < 16 || stageH < 16) return;
    applyStudioProject(pending);
  }, [applyStudioProject, viewSize.h, viewSize.w]);

  const shareImage = async () => {
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      const dataUrl = captureExportDataUrl(
        Math.min(1920, Math.max(1080, exportSize.width))
      );
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File(
        [blob],
        mode === "agent" ? "print-agent.png" : "ai-template-studio.png",
        { type: "image/png" }
      );
      const result = await shareWithFallback({
        title:
          mode === "agent"
            ? "AI 1분 인쇄물 뚝딱 생성기"
            : "AI 템플릿 스튜디오",
        text: "Studio Canvas AI에서 만든 이미지를 공유합니다.",
        file,
      });
      if (result === "shared") {
        showToast("기기 공유 시트로 이미지를 공유했습니다.", "success");
      } else if (result === "copied") {
        showToast("공유가 지원되지 않아 링크/텍스트를 복사했습니다.", "info");
      }
    } catch {
      showToast("공유가 취소되었거나 실패했습니다.", "info");
    } finally {
      setBusy(false);
    }
  };

  const aspectLabel = (key: AspectRatioKey) => {
    if (key === "original") return t.creator.aspectOriginal;
    if (key === "9:16") return t.creator.aspect916;
    if (key === "16:9") return t.creator.aspect169;
    if (key === "1:1") return t.creator.aspect11;
    if (key === "4:3") return t.creator.aspect43;
    if (key === "4:5") return t.creator.aspect45;
    if (key === "3:1") return t.creator.aspect31;
    if (key === "4:1") return t.creator.aspect41;
    if (key === "id") return t.creator.aspectId;
    if (key === "a2") return t.creator.aspectA2;
    if (key === "a3") return t.creator.aspectA3;
    if (key === "a4") return t.creator.aspectA4;
    return key;
  };

  const alignBtn = (
    value: TextAlign,
    Icon: typeof AlignLeft,
    label: string
  ) => (
    <button
      key={value}
      type="button"
      title={label}
      onClick={() => updateActive({ align: value })}
      className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs transition ${
        stylePanelLayer?.align === value
          ? "bg-white/15 text-white"
          : "text-white/45 hover:bg-white/5 hover:text-white/80"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  const goBack = () => {
    if (onBackToPlanning) {
      onBackToPlanning();
      return;
    }
    if (mode === "agent" || embedded) {
      router.push(PRINT_SMART_FORM_PATH);
      return;
    }
    router.push("/");
  };

  const textLayersPanel = textLayersHost ? (
    <div className="w-full rounded-2xl border border-white/10 bg-black/35 p-3">
      <div className="flex min-w-0 items-center gap-2 pb-2">
        <p className="shrink-0 text-sm font-medium whitespace-nowrap text-white/70">
          {cs.textLayers}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {overlayLayers.map((layer, idx) => (
          <div
            key={layer.id}
            className={`flex min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
              activeLayer?.id === layer.id
                ? "border-purple-400/50 bg-purple-500/5"
                : "border-white/10 bg-black/25"
            }`}
            onClick={() => {
              selectionClearedRef.current = false;
              setActiveLayerId(layer.id);
            }}
          >
            <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
              {fillCanvas(cs.layerN, { n: idx + 1 })}
            </span>
            <input
              type="text"
              data-layer-id={layer.id}
              value={layer.text}
              onFocus={() => {
                selectionClearedRef.current = false;
                setActiveLayerId(layer.id);
              }}
              onChange={(e) => {
                const nextValue = stripStickerTokens(e.target.value);
                setOverlayLayers((prev) =>
                  prev.map((l) =>
                    l.id === layer.id ? { ...l, text: nextValue } : l
                  )
                );
              }}
              placeholder={PLACEHOLDER_TEXT}
              className={`font-emoji min-w-0 flex-1 truncate rounded-lg border bg-black/30 px-2 py-1 text-sm font-semibold whitespace-nowrap text-white outline-none placeholder:text-sm placeholder:font-normal placeholder:text-white/35 ${
                activeLayer?.id === layer.id
                  ? "border-purple-400/70 ring-2 ring-purple-400/30"
                  : "border-white/10 focus:border-purple-400/40"
              }`}
            />
            <button
              type="button"
              aria-label={cs.addTextLayer}
              title={cs.addTextLayer}
              onClick={(e) => {
                e.stopPropagation();
                addLayerAfter(layer.id);
              }}
              className="shrink-0 rounded-md p-1 text-emerald-300/90 hover:bg-emerald-500/15"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete layer"
              onClick={(e) => {
                e.stopPropagation();
                removeLayer(layer.id);
              }}
              className="shrink-0 rounded-md p-1 text-red-300/80 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/70">{cs.textLayers}</p>
      </div>
      <div className="space-y-2">
        {overlayLayers.map((layer, idx) => (
          <div
            key={layer.id}
            className={`rounded-xl border p-2.5 transition ${
              activeLayer?.id === layer.id
                ? "border-purple-400/50 bg-purple-500/5"
                : "border-white/10 bg-black/25"
            }`}
            onClick={() => {
              selectionClearedRef.current = false;
              setActiveLayerId(layer.id);
            }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                {fillCanvas(cs.layerN, { n: idx + 1 })}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={cs.addTextLayer}
                  title={cs.addTextLayer}
                  onClick={(e) => {
                    e.stopPropagation();
                    addLayerAfter(layer.id);
                  }}
                  className="rounded-md p-1 text-emerald-300/90 hover:bg-emerald-500/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Delete layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                  className="rounded-md p-1 text-red-300/80 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <textarea
              ref={(node) => {
                layerTextareaRefs.current[layer.id] = node;
                autoResizeLayerTextarea(node);
              }}
              data-layer-id={layer.id}
              value={layer.text}
              onFocus={() => {
                selectionClearedRef.current = false;
                setActiveLayerId(layer.id);
              }}
              onChange={(e) => {
                const nextValue = stripStickerTokens(e.target.value);
                setOverlayLayers((prev) =>
                  prev.map((l) =>
                    l.id === layer.id ? { ...l, text: nextValue } : l
                  )
                );
                autoResizeLayerTextarea(e.currentTarget);
              }}
              rows={1}
              placeholder={PLACEHOLDER_TEXT}
              className={`font-emoji w-full resize-y overflow-hidden rounded-lg border bg-black/30 px-3 py-1.5 text-2xl font-bold leading-tight tracking-wide text-white outline-none placeholder:text-sm placeholder:font-normal placeholder:text-white/35 ${
                activeLayer?.id === layer.id
                  ? "border-purple-400/70 ring-2 ring-purple-400/30"
                  : "border-white/10 focus:border-purple-400/40"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const isPrintWizardStep2 = layout === "print-wizard-step2";
  const isPanelOnly = panelOnly === true;
  const shellHeightClass = isPanelOnly
    ? "min-h-0"
    : isPrintWizardStep2
      ? "h-full min-h-0"
      : "h-[100dvh]";
  const gridClass = isPanelOnly
    ? "flex min-h-0 flex-col gap-2.5"
    : isPrintWizardStep2
      ? "lg:grid-cols-2 [&>section:first-child]:lg:row-span-2 [&>section:nth-child(2)]:lg:col-start-2 [&>section:nth-child(2)]:lg:row-start-1 [&>section:nth-child(3)]:lg:col-start-2 [&>section:nth-child(3)]:lg:row-start-2"
      : "lg:grid-cols-3";
  const panelSectionClass = isPanelOnly
    ? "flex min-h-0 flex-col gap-4 rounded-2xl border border-white/10 bg-black/35 p-4"
    : "flex min-h-0 flex-col gap-4 rounded-2xl border border-white/10 bg-black/35 p-4 lg:overflow-y-auto";

  return (
    <div
      className={`flex ${shellHeightClass} flex-col ${
        isPanelOnly
          ? "overflow-visible text-white"
          : "overflow-hidden bg-[#0b0d12] text-white"
      }`}
    >
      {!isPanelOnly ? (
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label={
              isPrintWizardStep2 ? cs.wizardBackToPlanning : cs.backAria
            }
            title={isPrintWizardStep2 ? cs.wizardBackToPlanning : cs.backAria}
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-purple-300/80">
              {mode === "agent" ? cs.agentEyebrow : cs.utilityEyebrow}
            </p>
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {heading ||
                (isPrintWizardStep2
                  ? cs.wizardStep2Title
                  : mode === "agent"
                    ? cs.agentTitle
                    : cs.utilityTitle)}
            </h1>
            <p className="hidden text-xs text-white/45 sm:block">
              {isPrintWizardStep2
                ? cs.wizardStep2Subtitle
                : mode === "agent"
                  ? cs.agentSubtitle
                  : entrySource === "general-photo"
                    ? cs.generalPhotoSubtitle
                    : cs.utilitySubtitle}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resetStudio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {cs.reset}
          </button>
          {embedded ? null : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              <Home className="h-3.5 w-3.5" />
              {cs.goHome}
            </Link>
          )}
        </div>
      </header>
      ) : null}

      <div
        className={
          isPanelOnly
            ? gridClass
            : `grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:gap-6 lg:overflow-hidden lg:px-6 lg:pb-6 ${gridClass}`
        }
      >
        {!isPanelOnly ? (
        <section className="flex min-h-0 min-w-0 flex-col gap-2 rounded-2xl border border-white/10 bg-black/35 p-3 sm:p-4 lg:h-full lg:overflow-hidden">
          {/* Single-line canvas toolbar — above stage only */}
          <div className="flex w-full min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CanvasUploadToolbar
              dense
              nowrap
              className="shrink-0"
              disabled={uploadProcessing || commandBusy || busy}
              requireSubscription={requireSubscription}
              onInstallFile={async (file, mode) => {
                setUploadProcessing(true);
                try {
                  await installMainAssetFromFile(file, mode);
                } finally {
                  setUploadProcessing(false);
                }
              }}
              onLoadRecentProject={(project) => {
                openRecent(project, {
                  currentMode: mode,
                  applyLocal: applyStudioProject,
                });
              }}
              recentNamespace={recentNamespace}
              onDeleteObject={(id, type) => {
                if (type === "text") removeLayer(id);
                else if (type === "subject") {
                  setSubjectLayer("");
                  loadedImageRef.current = null;
                }
              }}
            />
          </div>

          <div
            ref={stageHostRef}
            className="relative flex min-h-0 min-w-0 w-full max-w-full flex-1 items-center justify-center overflow-hidden"
          >
            <div
              ref={stageRef}
              className="relative overflow-hidden overscroll-none rounded-xl border border-white/10"
              style={
                viewSize.w > 0
                  ? {
                      ...TRANSPARENCY_CHECKER_STYLE,
                      width: viewSize.w,
                      height: viewSize.h,
                      maxWidth: "100%",
                    }
                  : {
                      ...TRANSPARENCY_CHECKER_STYLE,
                      width: "100%",
                      aspectRatio: canvasAspectCss,
                      maxHeight: "min(70vh, 780px)",
                    }
              }
            >
              {/* Viewport zoom — Konva stage handles select / drag / resize / rotate */}
              <div
                className="absolute left-0 top-0"
                style={{
                  width: zoomedContent.w > 0 ? zoomedContent.w : "100%",
                  height: zoomedContent.h > 0 ? zoomedContent.h : "100%",
                  transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)`,
                  willChange: "transform",
                }}
              >
                <div
                  className="relative"
                  style={
                    viewSize.w > 0
                      ? {
                          width: viewSize.w,
                          height: viewSize.h,
                          transform: `scale(${zoomScale})`,
                          transformOrigin: "top left",
                        }
                      : {
                          width: "100%",
                          height: "100%",
                          aspectRatio: canvasAspectCss,
                        }
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      layerId:
                        useCanvasStore.getState().selectedId || activeLayerId,
                    });
                  }}
                >
                  {viewSize.w > 0 && viewSize.h > 0 ? (
                    <StudioKonvaStage
                      ref={konvaStageRef}
                      width={Math.round(viewSize.w)}
                      height={Math.round(viewSize.h)}
                      className="block"
                      onTextContentChange={(id, text) => {
                        setOverlayLayers((prev) =>
                          prev.map((l) => (l.id === id ? { ...l, text } : l))
                        );
                      }}
                      onTextStyleChange={(id, patch) => {
                        if (typeof patch.fontSize !== "number") return;
                        const stageW = Math.round(viewSize.w);
                        const stageH = Math.round(viewSize.h);
                        const designSize =
                          mode === "agent" && stageW >= 16 && stageH >= 16
                            ? stageFontSizeToDesign(
                                patch.fontSize,
                                stageW,
                                stageH
                              )
                            : patch.fontSize;
                        setOverlayLayers((prev) =>
                          prev.map((l) =>
                            l.id === id
                              ? { ...l, fontSize: designSize }
                              : l
                          )
                        );
                      }}
                    />
                  ) : null}
                  {/* Legacy offscreen paint target for fallback export */}
                  <canvas ref={canvasRef} className="hidden" />
                  <canvas ref={guideCanvasRef} className="hidden" />
                </div>
              </div>
              {contextMenu ? (
              <div
                className="fixed z-50 min-w-[9.5rem] overflow-hidden rounded-xl border border-white/15 bg-[#12161f]/95 py-1 shadow-2xl backdrop-blur-xl"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10"
                  onClick={() => {
                    if (contextMenu.layerId) {
                      selectionClearedRef.current = false;
                      setActiveLayerId(contextMenu.layerId);
                    }
                    copyActiveLayer(contextMenu.layerId);
                    setContextMenu(null);
                  }}
                >
                  <span>{cs.copy}</span>
                  <span className="text-[10px] text-white/35">Ctrl+C</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10"
                  onClick={() => {
                    duplicateLayer(contextMenu.layerId);
                  }}
                >
                  <span>{cs.duplicate}</span>
                  <span className="text-[10px] text-white/35">Ctrl+D</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={!hasClipboardLayer}
                  onClick={() => {
                    pasteClipboardLayer();
                  }}
                >
                  <span>{cs.paste}</span>
                  <span className="text-[10px] text-white/35">Ctrl+V</span>
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10"
                  onClick={() => {
                    if (contextMenu.layerId) {
                      useCanvasStore.getState().select(contextMenu.layerId);
                    }
                    bringSelectedToFront();
                    setContextMenu(null);
                  }}
                >
                  <span>{cs.bringFront}</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10"
                  onClick={() => {
                    if (contextMenu.layerId) {
                      useCanvasStore.getState().select(contextMenu.layerId);
                    }
                    sendSelectedToBack();
                    setContextMenu(null);
                  }}
                >
                  <span>{cs.sendBack}</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-red-200/90 hover:bg-red-500/10"
                  onClick={() => {
                    if (contextMenu.layerId) {
                      useCanvasStore.getState().select(contextMenu.layerId);
                    }
                    deleteSelectedCanvasObject();
                    setContextMenu(null);
                  }}
                >
                  <span>{cs.delete}</span>
                  <span className="text-[10px] text-white/35">Del</span>
                </button>
              </div>
            ) : null}
            {!subjectLayer && !backgroundImage && !hasUserPhotoLayers ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 text-white/50"
              >
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm">{cs.uploadImage}</span>
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadProcessing}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoomPct((z) => Math.max(50, z - 10))}
              className="rounded-md border border-white/10 px-2 py-1 text-sm text-white/70 hover:bg-white/5"
            >
              −
            </button>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={zoomPct}
              onChange={(e) => setZoomPct(Number(e.target.value))}
              className="w-full accent-purple-400"
            />
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoomPct((z) => Math.min(200, z + 10))}
              className="rounded-md border border-white/10 px-2 py-1 text-sm text-white/70 hover:bg-white/5"
            >
              +
            </button>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-white/60">
              {zoomPct}%
            </span>
          </div>
        </section>
        ) : null}

        {/* Column 2 — Background & copy */}
        <section
          className={
            isPanelOnly && hideAiCommand && textLayersHost
              ? "contents"
              : panelSectionClass
          }
        >
          {!(isPrintWizardStep2 || isPanelOnly) ? (
          <div>
            <p className="mb-2 text-sm font-medium text-white/70">
              {t.creator.aspectRatioLabel}
            </p>
            <div className="flex flex-wrap items-start gap-2">
              {ASPECT_TABS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleAspectChange(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    !customPrint && aspectRatio === key
                      ? "bg-white/15 text-white ring-1 ring-white/40"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {aspectLabel(key)}
                </button>
              ))}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setStyleMenuOpen(false);
                    setPromoMenuOpen((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    promoMenuOpen ||
                    customPrint ||
                    ["a2", "a3", "3:1", "4:1", "4:5"].includes(aspectRatio)
                      ? "bg-purple-500/20 text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <span>
                    {customPrint
                      ? `프리 ${customPrint.width}×${customPrint.height}${customPrint.unit}`
                      : t.creator.printPromoMenu}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      promoMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {promoMenuOpen ? (
                  <div className="absolute left-0 z-30 mt-2 w-[19rem] rounded-2xl border border-white/10 bg-[#0f1420]/95 p-3 shadow-2xl backdrop-blur-xl">
                    <div className="space-y-3">
                      {PROMO_ASPECT_GROUPS.map((group) => (
                        <div key={group.titleKey} className="space-y-1.5">
                          <p className="px-1 text-[11px] font-semibold text-white/40">
                            {t.creator[group.titleKey]}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {group.items.map((key) => (
                              <button
                                key={`${group.titleKey}-${key}`}
                                type="button"
                                onClick={() => handleAspectChange(key)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  !customPrint && aspectRatio === key
                                    ? "bg-emerald-500/15 text-white ring-1 ring-emerald-400/40"
                                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {aspectLabel(key)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="border-t border-white/10 pt-3">
                        <button
                          type="button"
                          onClick={() => setCustomSizeOpen((v) => !v)}
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                            customPrint || customSizeOpen
                              ? "border-purple-400/40 bg-purple-500/10 text-white"
                              : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                          }`}
                        >
                          <span>{cs.customSize}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              customSizeOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {customSizeOpen ? (
                          <div className="mt-2 space-y-2.5 rounded-xl border border-white/10 bg-black/30 p-2.5">
                            <div className="flex overflow-hidden rounded-lg border border-white/10">
                              {(["cm", "inch"] as const).map((unit) => (
                                <button
                                  key={unit}
                                  type="button"
                                  onClick={() => setCustomUnit(unit)}
                                  className={`flex-1 py-1.5 text-[11px] font-semibold transition ${
                                    customUnit === unit
                                      ? "bg-white text-black"
                                      : "bg-transparent text-white/55 hover:text-white"
                                  }`}
                                >
                                  {unit}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1">
                                <span className="text-[10px] text-white/45">
                                  {cs.width} ({customUnit})
                                </span>
                                <input
                                  type="number"
                                  min={0.1}
                                  step={0.1}
                                  value={customWidthInput}
                                  onChange={(e) =>
                                    setCustomWidthInput(e.target.value)
                                  }
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-purple-400/50"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[10px] text-white/45">
                                  {cs.height} ({customUnit})
                                </span>
                                <input
                                  type="number"
                                  min={0.1}
                                  step={0.1}
                                  value={customHeightInput}
                                  onChange={(e) =>
                                    setCustomHeightInput(e.target.value)
                                  }
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-purple-400/50"
                                />
                              </label>
                            </div>
                            <p className="text-[10px] leading-relaxed text-white/40">
                              최대 {CUSTOM_SIZE_MAX_CM}cm / {CUSTOM_SIZE_MAX_INCH}
                              inch · 적용 시 {PRINT_DPI} DPI로 환산됩니다.
                              {(() => {
                                const w = Number(customWidthInput);
                                const h = Number(customHeightInput);
                                if (
                                  !Number.isFinite(w) ||
                                  !Number.isFinite(h) ||
                                  w <= 0 ||
                                  h <= 0
                                ) {
                                  return null;
                                }
                                const px = physicalToPixels(w, h, customUnit);
                                return (
                                  <>
                                    {" "}
                                    예상 {px.width}×{px.height}px
                                  </>
                                );
                              })()}
                            </p>
                            <button
                              type="button"
                              onClick={applyCustomPrintSize}
                              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                            >
                              {cs.apply}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Style selection — bound into Gemini / Flux modifiers */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPromoMenuOpen(false);
                    setStyleMenuOpen((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    styleMenuOpen ||
                    visualStyle.imageStyleId ||
                    visualStyle.moodStyleId
                      ? "bg-indigo-500/25 text-white ring-1 ring-indigo-400/35"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <span className="max-w-[11rem] truncate">
                    {[
                      visualStyle.imageStyleId
                        ? cs.imageStyles[
                            visualStyle.imageStyleId as keyof typeof cs.imageStyles
                          ]
                        : null,
                      visualStyle.moodStyleId
                        ? cs.moodStyles[
                            visualStyle.moodStyleId as keyof typeof cs.moodStyles
                          ]
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || cs.styleSelect}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                      styleMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {styleMenuOpen ? (
                  <div className="absolute left-0 z-30 mt-2 w-[20rem] rounded-2xl border border-white/10 bg-[#0f1420]/95 p-3 shadow-2xl backdrop-blur-xl">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="px-1 text-[11px] font-semibold text-white/40">
                          {cs.imageStyle}
                        </p>
                        <div className="flex flex-col gap-1">
                          {IMAGE_STYLE_PRESETS.map((preset) => {
                            const active =
                              visualStyle.imageStyleId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setVisualStyle((prev) => ({
                                    ...prev,
                                    imageStyleId: active ? null : preset.id,
                                  }));
                                }}
                                className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                                  active
                                    ? "bg-indigo-500/20 text-white ring-1 ring-indigo-400/40"
                                    : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <span className="block">
                                  {
                                    cs.imageStyles[
                                      preset.id as keyof typeof cs.imageStyles
                                    ]
                                  }
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border-t border-white/10 pt-3 space-y-1.5">
                        <p className="px-1 text-[11px] font-semibold text-white/40">
                          {cs.moodStyle}
                        </p>
                        <div className="flex flex-col gap-1">
                          {MOOD_STYLE_PRESETS.map((preset) => {
                            const active =
                              visualStyle.moodStyleId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setVisualStyle((prev) => ({
                                    ...prev,
                                    moodStyleId: active ? null : preset.id,
                                  }));
                                }}
                                className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                                  active
                                    ? "bg-amber-500/15 text-white ring-1 ring-amber-400/35"
                                    : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <span className="block">
                                  {
                                    cs.moodStyles[
                                      preset.id as keyof typeof cs.moodStyles
                                    ]
                                  }
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVisualStyle(emptyVisualStyleSelection());
                          setStyleMenuOpen(false);
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/55 hover:bg-white/10 hover:text-white/80"
                      >
                        {cs.styleReset}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {customPrint ? (
                <p className="w-full text-[11px] text-white/45">
                  인쇄 규격 {customPrint.width}×{customPrint.height}
                  {customPrint.unit} · 출력 {exportSize.width}×{exportSize.height}
                  px @ {PRINT_DPI}DPI
                </p>
              ) : null}
            </div>
          </div>
          ) : null}

          {!hideAiCommand ? (
          <div
            className={`rounded-xl p-4 shadow-lg ${
              entrySource === "general-photo"
                ? "border border-emerald-500/30 bg-emerald-950/20"
                : "border border-purple-500/35 bg-gray-900/80"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-sm font-semibold ${
                  entrySource === "general-photo" ? "text-emerald-200" : "text-purple-300"
                }`}
              >
                {cs.aiCommand}
              </span>
              <span className="text-xs text-gray-400">
                {uploadProcessing
                  ? "사진 레이어 추가 중…"
                  : "KR / EN / JA / ES… any language → English Flux prompt"}
              </span>
            </div>
            {commandLog.length > 0 ? (
              <div className="mb-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-black/30 px-2.5 py-2 text-[11px]">
                {commandLog.map((row, i) => (
                  <p
                    key={`${row.role}-${i}`}
                    className={
                      row.role === "user" ? "text-white/70" : "text-indigo-200/90"
                    }
                  >
                    <span className="mr-1.5 font-semibold text-white/35">
                      {row.role === "user" ? "You" : "AI"}
                    </span>
                    {row.text}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runStudioCommand();
                  }
                }}
                placeholder="자연어로 편집하세요…"
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
                disabled={commandBusy || uploadProcessing}
              />
              <button
                type="button"
                disabled={!commandInput.trim() || commandBusy || uploadProcessing}
                onClick={() => void runStudioCommand()}
                className="whitespace-nowrap rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commandBusy ? cs.processing : cs.run}
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap content-start gap-x-1.5 gap-y-2">
              {(
                [
                  { label: "배경 지워줘", cmd: "배경 지워줘" },
                  { label: "남산으로 합성", cmd: "남산 배경으로 합성해줘" },
                  { label: "양장으로 바꿔줘", cmd: "옷을 양장으로 바꿔줘" },
                  ...BG_PRESETS.slice(0, 4).map((tag) => ({
                    label: tag.label,
                    cmd: `${tag.prompt} 배경으로 합성해줘`,
                  })),
                ] as const
              ).map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setCommandInput(chip.cmd);
                    void runStudioCommand(chip.cmd);
                  }}
                  disabled={commandBusy || uploadProcessing}
                  className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-purple-400/40 hover:text-white disabled:opacity-40"
                >
                  <span className="truncate">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
          ) : null}

          {textLayersHost
            ? createPortal(textLayersPanel, textLayersHost)
            : textLayersPanel}
        </section>

        {/* Column 3 — Style & download */}
        <section className={panelSectionClass}>
          {stylePanelLayer ? (
            <>
              <div>
                <p className="mb-2 text-xs font-medium text-white/60">
                  {t.thumbnail.symbolsLabel}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {EMOJI_QUICK.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => insertSymbol(s)}
                      className="font-emoji rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/80 transition hover:border-white/25 hover:bg-white/5"
                    >
                      {s}
                    </button>
                  ))}
                  <EmojiMoreDropdown
                    label={t.thumbnail.symbolsMoreLabel}
                    onPick={insertSymbol}
                  />
                </div>
              </div>

              <div className="relative z-10">
                <StickerMoreDropdown
                  label={t.thumbnail.stickers}
                  selectedId={stylePanelLayer.stickerId}
                  onPick={insertSticker}
                />
              </div>

              {onDecoCatalogPick ? (
                <DecoToolCatalogDropdown onPick={onDecoCatalogPick} />
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium text-white/60">
                  {t.thumbnail.fontLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_KEYS.map((fp) => (
                    <button
                      key={fp}
                      type="button"
                      onClick={() => updateActive({ fontPreset: fp })}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                        stylePanelLayer.fontPreset === fp
                          ? "bg-white text-black"
                          : "bg-black/25 text-white/45 hover:text-white/80"
                      }`}
                      style={{
                        fontFamily: `"${FONT_PRESET_PRIMARY[fp]}", ${fontForText(fp, "가A")}`,
                        fontWeight: 700,
                      }}
                    >
                      {t.thumbnail.fonts[fp] ?? fp}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                  <span>{t.thumbnail.sizeLabel}</span>
                  <span className="tabular-nums text-white/80">
                    {stylePanelLayer.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={Math.min(
                    FONT_SIZE_MAX,
                    Math.max(FONT_SIZE_MIN, stylePanelLayer.fontSize)
                  )}
                  onChange={(e) =>
                    patchActiveStyleLive({ fontSize: Number(e.target.value) })
                  }
                  onPointerUp={commitActiveStyleDrag}
                  onPointerCancel={commitActiveStyleDrag}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                  <span>{t.thumbnail.fontWeightLabel}</span>
                  <span className="tabular-nums text-white/80">
                    {clampFontWeight(
                      stylePanelLayer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={SHORTS_FONT_WEIGHT_MIN}
                  max={SHORTS_FONT_WEIGHT_MAX}
                  step={SHORTS_FONT_WEIGHT_STEP}
                  value={clampFontWeight(
                    stylePanelLayer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                  )}
                  onChange={(e) =>
                    patchActiveStyleLive({
                      fontWeight: clampFontWeight(Number(e.target.value)),
                    })
                  }
                  onPointerUp={commitActiveStyleDrag}
                  onPointerCancel={commitActiveStyleDrag}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                  <span>{t.thumbnail.letterSpacingLabel}</span>
                  <span className="tabular-nums text-white/80">
                    {layerLetterSpacing(stylePanelLayer)}px
                  </span>
                </div>
                <input
                  type="range"
                  min={LETTER_SPACING_MIN}
                  max={LETTER_SPACING_MAX}
                  value={layerLetterSpacing(stylePanelLayer)}
                  onChange={(e) =>
                    patchActiveStyleLive({
                      letterSpacing: clampLetterSpacing(Number(e.target.value)),
                    })
                  }
                  onPointerUp={commitActiveStyleDrag}
                  onPointerCancel={commitActiveStyleDrag}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                  <span>{t.thumbnail.lineHeightLabel}</span>
                  <span className="tabular-nums text-white/80">
                    {layerLineHeight(stylePanelLayer).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={LINE_HEIGHT_MIN}
                  max={LINE_HEIGHT_MAX}
                  step={LINE_HEIGHT_STEP}
                  value={layerLineHeight(stylePanelLayer)}
                  onChange={(e) =>
                    patchActiveStyleLive({
                      lineHeight: clampLineHeight(Number(e.target.value)),
                    })
                  }
                  onPointerUp={commitActiveStyleDrag}
                  onPointerCancel={commitActiveStyleDrag}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-white/60">
                  {t.thumbnail.alignLabel}
                </p>
                <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/25">
                  {alignBtn("left", AlignLeft, t.thumbnail.alignLeft)}
                  {alignBtn("center", AlignCenter, t.thumbnail.alignCenter)}
                  {alignBtn("right", AlignRight, t.thumbnail.alignRight)}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-medium text-white/60">
                  {t.thumbnail.colorLabel}
                </p>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-6">
                  {TEMPLATE_STUDIO_COLOR_ORDER.map((c: ColorPreset) => {
                    const selected = stylePanelLayer.color === c;
                    const fill = colorPresetFill(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        title={t.thumbnail.colors[c]}
                        aria-label={t.thumbnail.colors[c]}
                        onClick={() =>
                          updateActive({ color: c, ranges: [] })
                        }
                        className={`aspect-square w-full max-w-[2rem] justify-self-center rounded-full transition duration-150 ease-out hover:scale-110 hover:opacity-95 active:scale-95 ${
                          selected
                            ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0b0d12]"
                            : "ring-1 ring-white/10 hover:ring-white/35"
                        }`}
                        style={{
                          backgroundColor: fill,
                          border: swatchNeedsOutline(c)
                            ? "1px solid #555555"
                            : "1px solid transparent",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-white/60">
                  {t.thumbnail.bgColorLabel}
                </p>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-white/70">
                    <input
                      type="checkbox"
                      checked={Boolean(stylePanelLayer.showBox)}
                      onChange={(e) =>
                        updateActive({ showBox: e.target.checked })
                      }
                      className="h-3.5 w-3.5 accent-emerald-400"
                    />
                    {t.thumbnail.bgColorEnable}
                  </label>
                  <BgColorDropdown
                    label={t.thumbnail.bgColorLabel}
                    value={stylePanelLayer.boxColor || "#000000"}
                    onChange={(hex) =>
                      updateActive({
                        boxColor: hex,
                        showBox: true,
                      })
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          {!hideExport ? (
          <StudioExportButtonGroup
            busy={busy}
            onDownloadStandard={() => void downloadWithProject("standard")}
            onDownloadHigh={() => void downloadWithProject("high")}
            onLoadProjectClick={() => {
              if (!requireSubscription()) return;
              projectFileInputRef.current?.click();
            }}
            onLoadFromGallery={(project) => applyStudioProject(project)}
            requireSubscription={requireSubscription}
            onShare={() => void shareImage()}
            fileInputRef={projectFileInputRef}
            onFileChange={(file) => void loadProjectFromFile(file)}
          />
          ) : null}
        </section>
      </div>
      {premiumModal}
    </div>
  );
}
