/**
 * Hydrate / sync canvas store from Template Studio planes + TextLayers.
 */

import type { FontPreset, TextLayer } from "@/lib/thumbnailStyles";
import {
  colorPresetFill,
  fontForText,
} from "@/lib/thumbnailStyles";
import {
  defaultImageObject,
  defaultTextObject,
  isUserImageLayer,
  type CanvasObject,
} from "@/lib/canvas/types";

const BG_ID = "plane-background";
const SUBJECT_ID = "plane-subject";

function containRect(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number
): { x: number; y: number; width: number; height: number } {
  if (srcW < 1 || srcH < 1 || boxW < 1 || boxH < 1) {
    return { x: 0, y: 0, width: boxW, height: boxH };
  }
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return {
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    width,
    height,
  };
}

function coverRect(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number
): { x: number; y: number; width: number; height: number } {
  if (srcW < 1 || srcH < 1 || boxW < 1 || boxH < 1) {
    return { x: 0, y: 0, width: boxW, height: boxH };
  }
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return {
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    width,
    height,
  };
}

export type StudioPlaneSyncInput = {
  stageW: number;
  stageH: number;
  backgroundUrl: string | null;
  subjectUrl: string | null;
  subjectNatural?: { w: number; h: number } | null;
  backgroundNatural?: { w: number; h: number } | null;
  overlayLayers: TextLayer[];
  /** Preserve transforms for existing ids when content unchanged. */
  previous?: CanvasObject[];
};

function findPrev(previous: CanvasObject[] | undefined, id: string) {
  return previous?.find((o) => o.id === id) ?? null;
}

/**
 * Keep a prior plane transform only when it still belongs on this stage.
 * Drops stale 1080-fallback coords that overflow a measured preview stage.
 */
function shouldPreservePlaneTransform(
  prev: CanvasObject | null,
  src: string,
  stageW: number,
  stageH: number
): boolean {
  if (!prev || prev.type === "text" || prev.src !== src) return false;
  const width = Math.abs(prev.width * (prev.scaleX || 1));
  const height = Math.abs(prev.height * (prev.scaleY || 1));
  if (width < 8 || height < 8) return false;
  if (width > stageW * 1.45 && height > stageH * 1.45) return false;
  return true;
}

/**
 * Build ordered canvas objects from studio planes + text overlays.
 * Keeps prior x/y/rotation/scale when the same id + src/text still exist.
 * User photo / sticker layers from `previous` are preserved (multi-layer add).
 */
export function buildObjectsFromStudioPlanes(
  input: StudioPlaneSyncInput
): CanvasObject[] {
  const {
    stageW,
    stageH,
    backgroundUrl,
    subjectUrl,
    subjectNatural,
    backgroundNatural,
    overlayLayers,
    previous,
  } = input;
  const out: CanvasObject[] = [];

  if (backgroundUrl?.trim()) {
    const prev = findPrev(previous, BG_ID);
    const natW = backgroundNatural?.w || stageW;
    const natH = backgroundNatural?.h || stageH;
    const fitted = coverRect(natW, natH, stageW, stageH);
    const keep = shouldPreservePlaneTransform(
      prev,
      backgroundUrl,
      stageW,
      stageH
    );
    out.push(
      defaultImageObject({
        id: BG_ID,
        type: "background",
        src: backgroundUrl,
        locked: true,
        zIndex: 0,
        ...(keep && prev
          ? {
              x: prev.x,
              y: prev.y,
              width: prev.width,
              height: prev.height,
              rotation: prev.rotation,
              scaleX: prev.scaleX,
              scaleY: prev.scaleY,
            }
          : fitted),
      })
    );
  }

  if (subjectUrl?.trim()) {
    const prev = findPrev(previous, SUBJECT_ID);
    const natW = subjectNatural?.w || stageW;
    const natH = subjectNatural?.h || stageH;
    const fitted = containRect(natW, natH, stageW, stageH);
    const keep = shouldPreservePlaneTransform(
      prev,
      subjectUrl,
      stageW,
      stageH
    );
    out.push(
      defaultImageObject({
        id: SUBJECT_ID,
        type: "subject",
        src: subjectUrl,
        locked: false,
        zIndex: 10,
        ...(keep && prev
          ? {
              x: prev.x,
              y: prev.y,
              width: prev.width,
              height: prev.height,
              rotation: prev.rotation,
              scaleX: prev.scaleX,
              scaleY: prev.scaleY,
            }
          : fitted),
      })
    );
  }

  // Preserve independently uploaded photo / sticker layers (do not overwrite).
  const planeIds = new Set(out.map((o) => o.id));
  const textIds = new Set(
    overlayLayers.map((layer, index) => layer.id || `text-${index}`)
  );
  const userLayers = (previous || []).filter(
    (o) =>
      isUserImageLayer(o) &&
      !planeIds.has(o.id) &&
      !textIds.has(o.id)
  );
  out.push(...userLayers.map((o) => ({ ...o })));

  overlayLayers.forEach((layer, index) => {
    const id = layer.id || `text-${index}`;
    const prev = findPrev(previous, id);
    const fontSize = Math.max(12, Math.round(layer.fontSize || 48));
    const lineHeightMul = layer.lineHeight ?? 1.25;
    const maxW = Math.max(80, stageW * (layer.maxWidth ?? 0.88));
    const text = layer.text || "";
    const lineCount = Math.max(1, text.split("\n").length);
    const height = Math.max(
      fontSize * lineHeightMul * lineCount,
      fontSize * 1.4
    );
    const posY =
      layer.pos === "top"
        ? stageH * 0.08
        : layer.pos === "center"
          ? stageH * 0.42
          : stageH * 0.78;
    const baseX = (stageW - maxW) / 2 + (layer.offsetX || 0) * stageW;
    const baseY = posY + (layer.offsetY || 0) * stageH;
    const lockedW =
      layer.boxW && layer.boxW > 0 ? Math.max(80, layer.boxW * stageW) : maxW;
    const lockedH =
      layer.boxH && layer.boxH > 0
        ? Math.max(fontSize * 1.4, layer.boxH * stageH)
        : height;

    const sameText =
      prev && prev.type === "text" && prev.text === text && prev.id === id;

    // Always take live style from TextLayer so font slider / preset clicks apply
    // to Konva (incl. emoji/special glyphs via fontForText → EMOJI_FONT).
    const fontPreset = (layer.fontPreset || "variety") as FontPreset;
    const fontFamily = fontForText(fontPreset, text || "가A");

    // Keep drag/resize pose when text content is unchanged, but never freeze
    // fontSize/fontFamily — that caused the “slider dead / emoji bomb” bugs.
    let geom: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    };
    if (
      layer.layoutLocked &&
      typeof layer.manualX === "number" &&
      typeof layer.manualY === "number"
    ) {
      geom = {
        x: layer.manualX * stageW,
        y: layer.manualY * stageH,
        width: lockedW,
        height: lockedH,
        rotation: sameText && prev?.type === "text" ? prev.rotation : 0,
        scaleX: sameText && prev?.type === "text" ? prev.scaleX : 1,
        scaleY: sameText && prev?.type === "text" ? prev.scaleY : 1,
      };
    } else if (sameText && prev.type === "text") {
      const prevFs = Math.max(1, prev.fontSize || fontSize);
      const scaledH = Math.max(
        height,
        Math.round(prev.height * (fontSize / prevFs))
      );
      geom = {
        x: prev.x,
        y: prev.y,
        width: prev.width,
        height: scaledH,
        rotation: prev.rotation,
        scaleX: prev.scaleX,
        scaleY: prev.scaleY,
      };
    } else {
      geom = {
        x: baseX,
        y: baseY,
        width: maxW,
        height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
    }

    out.push(
      defaultTextObject({
        id,
        text,
        fontFamily,
        fontWeight: layer.fontWeight ?? 700,
        fill: colorPresetFill(layer.color),
        align: layer.align || "center",
        lineHeight: lineHeightMul,
        letterSpacing: layer.letterSpacing ?? 0,
        fontSize,
        zIndex:
          sameText && prev.type === "text" ? prev.zIndex : 50 + index,
        ...geom,
      })
    );
  });

  return out;
}
