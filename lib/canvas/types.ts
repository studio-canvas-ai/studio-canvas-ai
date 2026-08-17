/**
 * Shared interactive canvas object model (Template Studio + Print Agent).
 * Positions are in stage/logical pixels; print export scales by DPI factor.
 */

export type CanvasObjectType =
  | "background"
  | "subject"
  | "text"
  | "sticker"
  | "photo";

export type CanvasObjectBase = {
  id: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

export type CanvasImageObject = CanvasObjectBase & {
  type: "background" | "subject" | "sticker" | "photo";
  src: string;
  /** User photo uploads — original keeps bg for inpaint; cutout is rembg PNG. */
  photoKind?: "original" | "cutout";
};

export type CanvasTextObject = CanvasObjectBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fill: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
};

export type CanvasObject = CanvasImageObject | CanvasTextObject;

export type CanvasDocumentMeta = {
  /** Logical stage size (preview / design units). */
  width: number;
  height: number;
  /** Studio dual mode */
  mode: "utility" | "agent";
  dpi: number;
};

export type CanvasExportSnapshot = {
  meta: CanvasDocumentMeta;
  objects: CanvasObject[];
  selectedId: string | null;
  updatedAt: number;
};

export function newCanvasObjectId(prefix = "obj"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sortByZIndex(objects: CanvasObject[]): CanvasObject[] {
  return [...objects].sort((a, b) => a.zIndex - b.zIndex);
}

export function defaultImageObject(
  partial: Partial<CanvasImageObject> &
    Pick<CanvasImageObject, "type" | "src" | "width" | "height">
): CanvasImageObject {
  return {
    id: partial.id || newCanvasObjectId(partial.type),
    type: partial.type,
    src: partial.src,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: partial.width,
    height: partial.height,
    rotation: partial.rotation ?? 0,
    scaleX: partial.scaleX ?? 1,
    scaleY: partial.scaleY ?? 1,
    zIndex:
      partial.zIndex ??
      (partial.type === "background"
        ? 0
        : partial.type === "photo" || partial.type === "sticker"
          ? 20
          : 10),
    opacity: partial.opacity ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? partial.type === "background",
    photoKind: partial.photoKind,
  };
}

/** User-uploaded images (multi-layer) — never replaced by plane sync. */
export function isUserImageLayer(obj: CanvasObject): boolean {
  return obj.type === "photo" || obj.type === "sticker";
}

/** Fit an image into a fraction of the stage (contain). */
export function fitImageInStage(
  srcW: number,
  srcH: number,
  stageW: number,
  stageH: number,
  maxFraction = 0.55
): { x: number; y: number; width: number; height: number } {
  const boxW = Math.max(40, stageW * maxFraction);
  const boxH = Math.max(40, stageH * maxFraction);
  if (srcW < 1 || srcH < 1) {
    return { x: stageW * 0.2, y: stageH * 0.2, width: boxW, height: boxH };
  }
  const scale = Math.min(boxW / srcW, boxH / srcH, 1);
  const width = Math.max(24, srcW * scale);
  const height = Math.max(24, srcH * scale);
  return {
    x: (stageW - width) / 2,
    y: (stageH - height) / 2,
    width,
    height,
  };
}

export function defaultTextObject(
  partial: Partial<CanvasTextObject> & Pick<CanvasTextObject, "text">
): CanvasTextObject {
  return {
    id: partial.id || newCanvasObjectId("text"),
    type: "text",
    text: partial.text,
    x: partial.x ?? 40,
    y: partial.y ?? 40,
    width: partial.width ?? 320,
    height: partial.height ?? 64,
    rotation: partial.rotation ?? 0,
    scaleX: partial.scaleX ?? 1,
    scaleY: partial.scaleY ?? 1,
    zIndex: partial.zIndex ?? 50,
    opacity: partial.opacity ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    fontSize: partial.fontSize ?? 48,
    fontFamily: partial.fontFamily ?? "Pretendard, sans-serif",
    fontWeight: partial.fontWeight ?? 700,
    fill: partial.fill ?? "#F5F5DC",
    align: partial.align ?? "center",
    lineHeight: partial.lineHeight ?? 1.25,
    letterSpacing: partial.letterSpacing ?? 0,
  };
}
