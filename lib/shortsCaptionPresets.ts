/**
 * One-click KR YouTube Shorts caption style presets.
 */

import {
  DEFAULT_SHORTS_CAPTION_STYLE,
  SHORTS_CAPTION_Y_BOTTOM,
  clampCaptionFontSize,
  normalizeCaptionEntranceEffect,
  normalizeHexColor,
  type ShortsCaptionSegment,
  type ShortsCaptionStyle,
} from "@/lib/shortsCaptions";
import { COLOR_PRESETS } from "@/lib/thumbnailStyles";

function styleWithHex(style: ShortsCaptionStyle): ShortsCaptionStyle {
  const fill = COLOR_PRESETS[style.color]?.fill || style.textColor || "#FFE600";
  const strokeRaw = COLOR_PRESETS[style.color]?.stroke;
  const stroke =
    strokeRaw && strokeRaw !== "transparent"
      ? strokeRaw
      : style.strokeColor || "#111111";
  const hi =
    COLOR_PRESETS[style.highlightColor]?.fill ||
    style.highlightTextColor ||
    fill;
  return {
    ...style,
    textColor: normalizeHexColor(fill),
    strokeColor: normalizeHexColor(stroke, "#111111"),
    boxColor: normalizeHexColor(style.boxColor || "#000000", "#000000"),
    highlightTextColor: normalizeHexColor(hi, fill),
  };
}

export type ShortsCaptionPresetId =
  | "bold_outline"
  | "bottom_box_yellow"
  | "neon_pop"
  | "heavy_3d_shadow";

export type ShortsCaptionPreset = {
  id: ShortsCaptionPresetId;
  /** i18n key suffix under shorts.captionPreset* */
  labelKey:
    | "captionPresetBoldOutline"
    | "captionPresetBottomBox"
    | "captionPresetNeonPop"
    | "captionPresetHeavy3d";
  style: ShortsCaptionStyle;
  /** Default vertical center for this preset */
  y: number;
};

export const SHORTS_CAPTION_PRESETS: ShortsCaptionPreset[] = [
  {
    id: "bold_outline",
    labelKey: "captionPresetBoldOutline",
    y: SHORTS_CAPTION_Y_BOTTOM,
    style: styleWithHex({
      ...DEFAULT_SHORTS_CAPTION_STYLE,
      color: "white",
      highlightColor: "yellow",
      fontSize: 46,
      fontWeight: 900,
      showBox: false,
      showBoxBorder: false,
      strokeWidth: 1.85,
      shadowDepth: 1.5,
      popKeywords: true,
      maxWidth: 0.92,
    }),
  },
  {
    id: "bottom_box_yellow",
    labelKey: "captionPresetBottomBox",
    y: SHORTS_CAPTION_Y_BOTTOM,
    style: styleWithHex({
      ...DEFAULT_SHORTS_CAPTION_STYLE,
      color: "yellow",
      highlightColor: "white",
      fontSize: 42,
      fontWeight: 800,
      showBox: true,
      boxOpacity: 0.72,
      showBoxBorder: true,
      strokeWidth: 1.2,
      shadowDepth: 1,
      popKeywords: true,
      maxWidth: 0.9,
    }),
  },
  {
    id: "neon_pop",
    labelKey: "captionPresetNeonPop",
    y: SHORTS_CAPTION_Y_BOTTOM,
    style: styleWithHex({
      ...DEFAULT_SHORTS_CAPTION_STYLE,
      color: "white",
      highlightColor: "yellow",
      fontSize: 44,
      fontWeight: 900,
      showBox: true,
      boxOpacity: 0.4,
      showBoxBorder: false,
      strokeWidth: 1.4,
      shadowDepth: 2.2,
      popKeywords: true,
      maxWidth: 0.88,
    }),
  },
  {
    id: "heavy_3d_shadow",
    labelKey: "captionPresetHeavy3d",
    y: 0.78,
    style: styleWithHex({
      ...DEFAULT_SHORTS_CAPTION_STYLE,
      color: "yellow",
      highlightColor: "hotPink",
      fontSize: 48,
      fontWeight: 900,
      showBox: false,
      strokeWidth: 1.6,
      shadowDepth: 3,
      popKeywords: true,
      maxWidth: 0.9,
    }),
  },
];

export function getCaptionPreset(
  id: string | null | undefined
): ShortsCaptionPreset | null {
  if (!id) return null;
  return SHORTS_CAPTION_PRESETS.find((p) => p.id === id) ?? null;
}

export function resolveCaptionStyle(
  stylePresetId: string | null | undefined,
  override?: Partial<ShortsCaptionStyle> | null,
  segment?: Pick<
    ShortsCaptionSegment,
    | "fontPreset"
    | "fontSize"
    | "textColor"
    | "strokeColor"
    | "boxColor"
    | "entranceEffect"
  > | null
): ShortsCaptionStyle {
  const preset = getCaptionPreset(stylePresetId);
  const merged: ShortsCaptionStyle = {
    ...DEFAULT_SHORTS_CAPTION_STYLE,
    ...(preset?.style ?? {}),
    ...(override || {}),
  };
  if (segment?.fontPreset) merged.fontPreset = segment.fontPreset;
  if (typeof segment?.fontSize === "number") {
    merged.fontSize = clampCaptionFontSize(segment.fontSize);
  }
  if (segment?.textColor) {
    merged.textColor = normalizeHexColor(segment.textColor, merged.textColor);
  }
  if (segment?.strokeColor) {
    merged.strokeColor = normalizeHexColor(
      segment.strokeColor,
      merged.strokeColor
    );
  }
  if (segment?.boxColor) {
    merged.boxColor = normalizeHexColor(segment.boxColor, merged.boxColor);
  }
  merged.textColor = normalizeHexColor(merged.textColor, "#FFE600");
  merged.strokeColor = normalizeHexColor(merged.strokeColor, "#111111");
  merged.boxColor = normalizeHexColor(merged.boxColor, "#000000");
  merged.fontSize = clampCaptionFontSize(merged.fontSize);
  merged.entranceEffect = normalizeCaptionEntranceEffect(merged.entranceEffect);
  if (!merged.fontPreset) {
    merged.fontPreset = DEFAULT_SHORTS_CAPTION_STYLE.fontPreset;
  }
  return merged;
}
