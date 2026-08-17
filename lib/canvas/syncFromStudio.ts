/**
 * Hydrate / sync canvas store from Template Studio planes + TextLayers.
 */

import type { TextLayer } from "@/lib/thumbnailStyles";
import { colorPresetFill } from "@/lib/thumbnailStyles";
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
    const sameSrc = prev && prev.type !== "text" && prev.src === backgroundUrl;
    out.push(
      defaultImageObject({
        id: BG_ID,
        type: "background",
        src: backgroundUrl,
        locked: true,
        zIndex: 0,
        ...(sameSrc
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
    const sameSrc = prev && prev.type !== "text" && prev.src === subjectUrl;
    out.push(
      defaultImageObject({
        id: SUBJECT_ID,
        type: "subject",
        src: subjectUrl,
        locked: false,
        zIndex: 10,
        ...(sameSrc
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
    const fontSize = Math.max(12, layer.fontSize || 48);
    const maxW = Math.max(80, stageW * (layer.maxWidth ?? 0.88));
    const text = layer.text || "";
    const height = Math.max(
      fontSize *
        (layer.lineHeight ?? 1.25) *
        Math.max(1, text.split("\n").length),
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

    const sameText =
      prev && prev.type === "text" && prev.text === text && prev.id === id;

    out.push(
      defaultTextObject({
        id,
        text,
        fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif",
        fontWeight: layer.fontWeight ?? 700,
        fill: colorPresetFill(layer.color),
        align: layer.align || "center",
        lineHeight: layer.lineHeight ?? 1.25,
        letterSpacing: layer.letterSpacing ?? 0,
        zIndex:
          sameText && prev.type === "text" ? prev.zIndex : 50 + index,
        ...(sameText && prev.type === "text"
          ? {
              x: prev.x,
              y: prev.y,
              width: prev.width,
              height: prev.height,
              rotation: prev.rotation,
              scaleX: prev.scaleX,
              scaleY: prev.scaleY,
              fontSize: prev.fontSize,
            }
          : {
              x: baseX,
              y: baseY,
              width: maxW,
              height,
              fontSize,
            }),
      })
    );
  });

  return out;
}
