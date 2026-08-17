export type {
  CanvasObject,
  CanvasTextObject,
  CanvasImageObject,
  CanvasDocumentMeta,
  CanvasExportSnapshot,
} from "@/lib/canvas/types";
export {
  newCanvasObjectId,
  sortByZIndex,
  defaultImageObject,
  defaultTextObject,
  isUserImageLayer,
  fitImageInStage,
} from "@/lib/canvas/types";
export { useCanvasStore } from "@/lib/canvas/canvasStore";
export { buildObjectsFromStudioPlanes } from "@/lib/canvas/syncFromStudio";
export { addPhotoLayerFromFile, addPhotoLayerFromSrc } from "@/lib/canvas/addPhotoLayer";
export type { PhotoKind } from "@/lib/canvas/addPhotoLayer";
export {
  snapshotToPrintPayload,
  exportKonvaPrintDataUrl,
  exportSnapshotJson,
} from "@/lib/canvas/printExportFromStore";
