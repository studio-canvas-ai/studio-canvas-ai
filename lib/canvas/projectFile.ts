/**
 * Local editable project file (.sca) — sealed proprietary format (no server/DB).
 * Legacy plain `.sca.json` remains readable via importSecureProject.
 */

import type { TextLayer } from "@/lib/thumbnailStyles";
import type { AspectRatioKey } from "@/lib/downloadImage";
import type { VisualStyleSelection } from "@/lib/ai/visualStylePresets";
import type {
  CanvasExportSnapshot,
  CanvasObject,
  CanvasDocumentMeta,
} from "@/lib/canvas/types";
import { sortByZIndex } from "@/lib/canvas/types";
import {
  SCA_FILE_EXT,
  exportSecureProjectBlob,
  importSecureProject,
} from "@/lib/projectStorage";
import type { PhotoLookbookSnapshot } from "@/lib/photoLookbookProject";
import { isPhotoLookbookSnapshot } from "@/lib/photoLookbookProject";

export const PROJECT_FILE_KIND = "studio-canvas-project" as const;
export const PROJECT_FILE_VERSION = 1 as const;
/** Proprietary sealed extension (replaces legacy `.sca.json` downloads). */
export const PROJECT_FILE_EXT = SCA_FILE_EXT;
/** @deprecated Kept for accept= filters / migration copy */
export const PROJECT_FILE_EXT_LEGACY = ".sca.json";

export type StudioProjectCustomPrint = {
  unit: "cm" | "inch";
  width: number;
  height: number;
};

export type StudioCanvasProjectV1 = {
  kind: typeof PROJECT_FILE_KIND;
  version: typeof PROJECT_FILE_VERSION;
  savedAt: number;
  studio: {
    mode: "utility" | "agent";
    subjectUrl: string;
    backgroundUrl: string | null;
    overlayLayers: TextLayer[];
    aspectRatio: AspectRatioKey | string;
    customPrint: StudioProjectCustomPrint | null;
    naturalSize: { w: number; h: number };
    visualStyle?: VisualStyleSelection | null;
  };
  canvas: CanvasExportSnapshot;
  /** Photo lookbook: wizard + vault snapshot for recent restore. */
  lookbook?: PhotoLookbookSnapshot;
};

export type BuildProjectInput = {
  mode: "utility" | "agent";
  subjectUrl: string;
  backgroundUrl: string | null;
  overlayLayers: TextLayer[];
  aspectRatio: AspectRatioKey | string;
  customPrint: StudioProjectCustomPrint | null;
  naturalSize: { w: number; h: number };
  visualStyle?: VisualStyleSelection | null;
  canvas: CanvasExportSnapshot;
  lookbook?: PhotoLookbookSnapshot;
};

export function buildStudioProject(
  input: BuildProjectInput
): StudioCanvasProjectV1 {
  return {
    kind: PROJECT_FILE_KIND,
    version: PROJECT_FILE_VERSION,
    savedAt: Date.now(),
    studio: {
      mode: input.mode,
      subjectUrl: input.subjectUrl || "",
      backgroundUrl: input.backgroundUrl,
      overlayLayers: input.overlayLayers.map((l) => ({
        ...l,
        ranges: l.ranges?.map((r) => ({ ...r })) ?? [],
      })),
      aspectRatio: input.aspectRatio,
      customPrint: input.customPrint
        ? { ...input.customPrint }
        : null,
      naturalSize: { ...input.naturalSize },
      visualStyle: input.visualStyle
        ? { ...input.visualStyle }
        : null,
    },
    canvas: {
      meta: { ...input.canvas.meta },
      objects: sortByZIndex(input.canvas.objects).map((o) => ({ ...o })),
      selectedId: input.canvas.selectedId,
      updatedAt: input.canvas.updatedAt || Date.now(),
    },
    ...(input.lookbook ? { lookbook: input.lookbook } : {}),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function parseStudioProject(raw: unknown): StudioCanvasProjectV1 {
  if (!isObject(raw)) throw new Error("invalid_project");
  if (raw.kind !== PROJECT_FILE_KIND) throw new Error("unsupported_project_kind");
  if (raw.version !== PROJECT_FILE_VERSION) {
    throw new Error("unsupported_project_version");
  }
  if (!isObject(raw.studio) || !isObject(raw.canvas)) {
    throw new Error("invalid_project_shape");
  }
  const studio = raw.studio;
  const canvas = raw.canvas;
  if (!isObject(canvas.meta) || !Array.isArray(canvas.objects)) {
    throw new Error("invalid_canvas_snapshot");
  }
  if (!Array.isArray(studio.overlayLayers)) {
    throw new Error("invalid_overlay_layers");
  }

  return {
    kind: PROJECT_FILE_KIND,
    version: PROJECT_FILE_VERSION,
    savedAt: typeof raw.savedAt === "number" ? raw.savedAt : Date.now(),
    studio: {
      mode: studio.mode === "agent" ? "agent" : "utility",
      subjectUrl:
        typeof studio.subjectUrl === "string" ? studio.subjectUrl : "",
      backgroundUrl:
        typeof studio.backgroundUrl === "string"
          ? studio.backgroundUrl
          : null,
      overlayLayers: studio.overlayLayers as TextLayer[],
      aspectRatio:
        typeof studio.aspectRatio === "string" ? studio.aspectRatio : "1:1",
      customPrint: isObject(studio.customPrint)
        ? (studio.customPrint as StudioProjectCustomPrint)
        : null,
      naturalSize: isObject(studio.naturalSize)
        ? {
            w: Number(studio.naturalSize.w) || 1080,
            h: Number(studio.naturalSize.h) || 1350,
          }
        : { w: 1080, h: 1350 },
      visualStyle: (studio.visualStyle as VisualStyleSelection) || null,
    },
    canvas: {
      meta: canvas.meta as CanvasDocumentMeta,
      objects: canvas.objects as CanvasObject[],
      selectedId:
        typeof canvas.selectedId === "string" ? canvas.selectedId : null,
      updatedAt:
        typeof canvas.updatedAt === "number" ? canvas.updatedAt : Date.now(),
    },
    ...(isPhotoLookbookSnapshot(raw.lookbook)
      ? { lookbook: raw.lookbook }
      : {}),
  };
}

/** Trigger a single local file download (no server). */
export function downloadBlobLocally(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so Safari finishes the download.
  window.setTimeout(() => URL.revokeObjectURL(href), 2_000);
}

/** Download image + sealed editable project (.sca) back-to-back. */
export async function downloadImageAndProjectLocally(opts: {
  imageBlob: Blob;
  project: StudioCanvasProjectV1;
  baseName: string;
  imageExt?: "png" | "jpg";
}) {
  const ext = opts.imageExt || "png";
  const stamp = Date.now();
  const base = opts.baseName.replace(/[^\w.-]+/g, "_") || "studio-canvas";
  downloadBlobLocally(opts.imageBlob, `${base}-${stamp}.${ext}`);
  await new Promise((r) => setTimeout(r, 180));
  const projectBlob = await exportSecureProjectBlob(opts.project);
  downloadBlobLocally(projectBlob, `${base}-${stamp}${PROJECT_FILE_EXT}`);
}

export async function readProjectFile(file: File): Promise<StudioCanvasProjectV1> {
  const raw = await importSecureProject(file);
  try {
    return parseStudioProject(raw);
  } catch {
    throw new Error("invalid_or_tampered_project");
  }
}

/** Hand-off from wizard Step-2 → studio (session only). */
export const PENDING_STUDIO_PROJECT_KEY = "sca_pending_studio_project_v1";

export function stashPendingStudioProject(
  project: StudioCanvasProjectV1,
  key: string = PENDING_STUDIO_PROJECT_KEY
) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(project));
}

export function takePendingStudioProject(
  key: string = PENDING_STUDIO_PROJECT_KEY
): StudioCanvasProjectV1 | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    return parseStudioProject(JSON.parse(raw));
  } catch {
    return null;
  }
}
