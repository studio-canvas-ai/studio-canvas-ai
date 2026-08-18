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
export {
  addPhotoLayerFromFile,
  addPhotoLayerFromSrc,
  readFileAsDataUrl,
  loadImageNaturalSize,
} from "@/lib/canvas/addPhotoLayer";
export type { PhotoKind } from "@/lib/canvas/addPhotoLayer";
export {
  snapshotToPrintPayload,
  exportKonvaPrintDataUrl,
  exportSnapshotJson,
} from "@/lib/canvas/printExportFromStore";
export {
  buildStudioProject,
  parseStudioProject,
  readProjectFile,
  downloadBlobLocally,
  downloadImageAndProjectLocally,
  stashPendingStudioProject,
  takePendingStudioProject,
  PROJECT_FILE_EXT,
  PROJECT_FILE_EXT_LEGACY,
  PROJECT_FILE_KIND,
  PENDING_STUDIO_PROJECT_KEY,
} from "@/lib/canvas/projectFile";
export type {
  StudioCanvasProjectV1,
  BuildProjectInput,
} from "@/lib/canvas/projectFile";
export {
  pushRecentProject,
  listRecentProjects,
  getRecentProject,
  RECENT_PROJECTS_MAX,
} from "@/lib/canvas/recentProjects";
export {
  downloadImageAndRememberRecent,
  openRecentProjectInEditor,
  studioPathForProject,
  useProjectStorage,
  TEMPLATE_STUDIO_PATH,
} from "@/lib/canvas/useProjectStorage";
