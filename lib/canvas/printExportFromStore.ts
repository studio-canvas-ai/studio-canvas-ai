/**
 * High-DPI export helpers from the shared canvas store / Konva stage.
 */

import type { CanvasExportSnapshot } from "@/lib/canvas/types";
import type { StudioKonvaStageHandle } from "@/components/canvas/StudioKonvaStage";

export function snapshotToPrintPayload(snapshot: CanvasExportSnapshot) {
  return {
    width: snapshot.meta.width,
    height: snapshot.meta.height,
    dpi: snapshot.meta.dpi,
    mode: snapshot.meta.mode,
    objects: snapshot.objects.map((o) => ({
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      rotation: o.rotation,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      zIndex: o.zIndex,
      content:
        o.type === "text"
          ? {
              text: o.text,
              fontSize: o.fontSize,
              fontFamily: o.fontFamily,
              fontWeight: o.fontWeight,
              fill: o.fill,
              align: o.align,
            }
          : { src: o.src },
    })),
    updatedAt: snapshot.updatedAt,
  };
}

/** Export PNG data URL from Konva at print pixel ratio. */
export function exportKonvaPrintDataUrl(
  handle: StudioKonvaStageHandle | null,
  logicalW: number,
  logicalH: number,
  targetW: number
): string | null {
  if (!handle || logicalW < 1) return null;
  const pixelRatio = Math.min(4, Math.max(1, targetW / logicalW));
  return handle.exportDataUrl(pixelRatio);
}

export function exportSnapshotJson(
  snapshot: CanvasExportSnapshot
): string {
  return JSON.stringify(snapshotToPrintPayload(snapshot), null, 2);
}
