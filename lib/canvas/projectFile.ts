/**
 * Local editable project file (.sca) — sealed proprietary format (no server/DB).
 * Legacy plain `.sca.json` remains readable via importSecureProject.
 */

import type { TextLayer } from "@/lib/thumbnailStyles";
import { aspectRatioValue, type AspectRatioKey } from "@/lib/downloadImage";
import type { VisualStyleSelection } from "@/lib/ai/visualStylePresets";
import type {
  CanvasExportSnapshot,
  CanvasImageObject,
  CanvasObject,
  CanvasDocumentMeta,
} from "@/lib/canvas/types";
import { defaultImageObject, sortByZIndex } from "@/lib/canvas/types";
import {
  SCA_FILE_EXT,
  exportSecureProjectBlob,
  importSecureProject,
} from "@/lib/projectStorage";
import type { PhotoLookbookSnapshot } from "@/lib/photoLookbookProject";
import { isPhotoLookbookSnapshot } from "@/lib/photoLookbookProject";
import type {
  PrintDecoLayer,
  PrintPhotoLayer,
  PrintWizardState,
} from "@/lib/printWizardTypes";
import { toProviderImageUrl } from "@/lib/toProviderImageUrl";

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
  const base: StudioCanvasProjectV1 = {
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
  return enrichCanvasWithLookbookImages(base);
}

/** True when the URL cannot survive a reload (session-local object URL). */
function isEphemeralImageSrc(src: string): boolean {
  const t = src.trim();
  return t.startsWith("blob:");
}

/**
 * Convert ephemeral blob:/same-origin relative sources to durable data: URLs
 * so .sca round-trips keep image layers renderable after reload.
 * Passes through data: and http(s) unchanged.
 */
async function durableImageSrc(src: string): Promise<string> {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  // blob: and relative /api/... paths need inlining for offline .sca restore.
  if (isEphemeralImageSrc(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("./")) {
    try {
      return await toProviderImageUrl(trimmed);
    } catch {
      return trimmed;
    }
  }
  try {
    return await toProviderImageUrl(trimmed);
  } catch {
    return trimmed;
  }
}

async function mapDurableSrc(src: string | null | undefined): Promise<string> {
  if (!src) return "";
  return durableImageSrc(src);
}

/**
 * Walk studio planes, canvas image objects, and lookbook wizard/vaults —
 * replace ephemeral image sources with durable data URLs before sealing .sca.
 */
export async function hardenStudioProjectImages(
  project: StudioCanvasProjectV1
): Promise<StudioCanvasProjectV1> {
  const next = JSON.parse(JSON.stringify(project)) as StudioCanvasProjectV1;

  next.studio.subjectUrl = await mapDurableSrc(next.studio.subjectUrl);
  next.studio.backgroundUrl = next.studio.backgroundUrl
    ? (await mapDurableSrc(next.studio.backgroundUrl)) || null
    : null;

  next.canvas.objects = await Promise.all(
    next.canvas.objects.map(async (o) => {
      if (o.type === "text" || !("src" in o)) return o;
      const src = typeof o.src === "string" ? o.src : "";
      return { ...o, src: await mapDurableSrc(src) };
    })
  );

  if (next.lookbook) {
    const hardenVault = async (
      items: PhotoLookbookSnapshot["uploadVault"]
    ) =>
      Promise.all(
        items.map(async (item) => ({
          ...item,
          src: await mapDurableSrc(item.src),
        }))
      );
    const wizard = next.lookbook.wizard;
    next.lookbook = {
      ...next.lookbook,
      uploadVault: await hardenVault(next.lookbook.uploadVault),
      trainedVault: await hardenVault(next.lookbook.trainedVault),
      wizard: {
        ...wizard,
        backgroundUrl: wizard.backgroundUrl
          ? (await mapDurableSrc(wizard.backgroundUrl)) || null
          : null,
        backgroundUrls: await Promise.all(
          (wizard.backgroundUrls || []).map((u) => mapDurableSrc(u || ""))
        ),
        photoLayersByPage: await Promise.all(
          (wizard.photoLayersByPage || []).map(async (page) =>
            Promise.all(
              page.map(async (layer) => ({
                ...layer,
                src: await mapDurableSrc(layer.src),
              }))
            )
          )
        ),
      },
    };
  }

  return enrichCanvasWithLookbookImages(next);
}

/**
 * When the canvas store has no image objects (print wizard), copy background +
 * photo layers from the lookbook wizard into `canvas.objects` so the sealed
 * JSON always carries image src + geometry.
 */
export function enrichCanvasWithLookbookImages(
  project: StudioCanvasProjectV1
): StudioCanvasProjectV1 {
  const wizard = project.lookbook?.wizard;
  const stageW = Math.max(1, project.canvas.meta.width || 1080);
  const stageH = Math.max(1, project.canvas.meta.height || 1350);
  const existing = project.canvas.objects;
  const hasImageObj = existing.some(
    (o) =>
      o.type === "background" ||
      o.type === "subject" ||
      o.type === "photo" ||
      o.type === "sticker"
  );

  const bgSrc =
    (typeof project.studio.backgroundUrl === "string" &&
    project.studio.backgroundUrl.trim()
      ? project.studio.backgroundUrl
      : null) ||
    wizard?.backgroundUrl ||
    wizard?.backgroundUrls?.find((u) => typeof u === "string" && u.trim()) ||
    null;
  const subjectSrc =
    typeof project.studio.subjectUrl === "string" && project.studio.subjectUrl.trim()
      ? project.studio.subjectUrl
      : null;

  if (hasImageObj) {
    // Still ensure studio URLs stay aligned with plane objects when present.
    return project;
  }

  const objects: CanvasObject[] = existing.filter((o) => o.type === "text");
  if (bgSrc) {
    objects.push(
      defaultImageObject({
        id: "plane-background",
        type: "background",
        src: bgSrc,
        width: stageW,
        height: stageH,
        locked: true,
        zIndex: 0,
      })
    );
  }
  if (subjectSrc) {
    objects.push(
      defaultImageObject({
        id: "plane-subject",
        type: "subject",
        src: subjectSrc,
        width: stageW,
        height: stageH,
        zIndex: 10,
      })
    );
  }

  const pagePhotos: PrintPhotoLayer[] = (
    wizard?.photoLayersByPage || []
  ).flatMap((page) => page || []);
  // Prefer active page (0) layers; if empty, keep flattened unique by id order.
  const primaryPage = wizard?.photoLayersByPage?.[0] || [];
  const photoSource = primaryPage.length ? primaryPage : pagePhotos;
  photoSource.forEach((layer, i) => {
    if (!layer?.src?.trim()) return;
    objects.push(
      defaultImageObject({
        id: layer.id || `photo_${i}`,
        type: "photo",
        src: layer.src,
        photoKind: layer.photoKind,
        x: layer.x * stageW,
        y: layer.y * stageH,
        width: Math.max(8, layer.width * stageW),
        height: Math.max(8, layer.height * stageH),
        zIndex: 20 + i,
      })
    );
  });

  return {
    ...project,
    studio: {
      ...project.studio,
      backgroundUrl: project.studio.backgroundUrl || bgSrc,
      subjectUrl: project.studio.subjectUrl || subjectSrc || "",
    },
    canvas: {
      ...project.canvas,
      objects: sortByZIndex(objects),
    },
  };
}

/**
 * Recover print-wizard photo layers from a project (lookbook first, else canvas).
 */
export function photoLayersByPageFromProject(
  project: StudioCanvasProjectV1,
  pageCount: number,
  pageIndex = 0
): PrintPhotoLayer[][] {
  const fromLookbook = project.lookbook?.wizard?.photoLayersByPage;
  if (Array.isArray(fromLookbook) && fromLookbook.length) {
    const pages: PrintPhotoLayer[][] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = fromLookbook[i];
      pages.push(
        Array.isArray(page)
          ? page.map((l) => ({ ...l }))
          : []
      );
    }
    return pages;
  }

  const stageW = Math.max(1, project.canvas.meta.width || 1080);
  const stageH = Math.max(1, project.canvas.meta.height || 1350);
  const photos = project.canvas.objects.filter(
    (o): o is CanvasImageObject =>
      (o.type === "photo" || o.type === "sticker") &&
      typeof o.src === "string" &&
      o.src.trim().length > 0
  );
  const pages: PrintPhotoLayer[][] = Array.from({ length: pageCount }, () => []);
  const target = Math.min(Math.max(0, pageIndex), pageCount - 1);
  pages[target] = photos.map((o) => ({
    id: o.id,
    src: o.src,
    photoKind: o.photoKind === "cutout" ? "cutout" : "original",
    x: o.x / stageW,
    y: o.y / stageH,
    width: Math.abs(o.width * (o.scaleX || 1)) / stageW,
    height: Math.abs(o.height * (o.scaleY || 1)) / stageH,
  }));
  return pages;
}

export function decoLayersByPageFromProject(
  project: StudioCanvasProjectV1,
  pageCount: number
): PrintDecoLayer[][] | undefined {
  const fromLookbook = project.lookbook?.wizard?.decoLayersByPage;
  if (!Array.isArray(fromLookbook)) return undefined;
  const pages: PrintDecoLayer[][] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = fromLookbook[i];
    pages.push(Array.isArray(page) ? page.map((l) => ({ ...l })) : []);
  }
  return pages;
}

/** Background plate URLs from studio + lookbook wizard. */
export function backgroundStateFromProject(
  project: StudioCanvasProjectV1,
  pageCount: number,
  pageIndex = 0
): {
  backgroundUrl: string | null;
  backgroundUrls: string[];
  backgroundPansByPage?: PrintWizardState["backgroundPansByPage"];
} {
  const wizard = project.lookbook?.wizard;
  const studioBg =
    typeof project.studio.backgroundUrl === "string" &&
    project.studio.backgroundUrl.trim()
      ? project.studio.backgroundUrl
      : null;
  const canvasBg = project.canvas.objects.find(
    (o) =>
      o.type === "background" &&
      typeof o.src === "string" &&
      o.src.trim()
  );
  const canvasBgSrc =
    canvasBg && "src" in canvasBg ? String(canvasBg.src) : null;

  const backgroundUrls = Array.from({ length: pageCount }, (_, i) => {
    const fromWizard = wizard?.backgroundUrls?.[i];
    if (typeof fromWizard === "string" && fromWizard.trim()) return fromWizard;
    return "";
  });
  const fallbackBg =
    studioBg ||
    canvasBgSrc ||
    (typeof wizard?.backgroundUrl === "string" && wizard.backgroundUrl.trim()
      ? wizard.backgroundUrl
      : null);
  if (fallbackBg) {
    const idx = Math.min(Math.max(0, pageIndex), pageCount - 1);
    if (!backgroundUrls[idx]) backgroundUrls[idx] = fallbackBg;
  }

  return {
    backgroundUrl: fallbackBg || backgroundUrls.find((u) => u.trim()) || null,
    backgroundUrls,
    backgroundPansByPage: wizard?.backgroundPansByPage
      ? wizard.backgroundPansByPage.map((p) => ({ ...p }))
      : undefined,
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
}): Promise<StudioCanvasProjectV1> {
  const ext = opts.imageExt || "png";
  const stamp = Date.now();
  const base = opts.baseName.replace(/[^\w.-]+/g, "_") || "studio-canvas";
  downloadBlobLocally(opts.imageBlob, `${base}-${stamp}.${ext}`);
  await new Promise((r) => setTimeout(r, 180));
  const hardened = await hardenStudioProjectImages(opts.project);
  const projectBlob = await exportSecureProjectBlob(hardened);
  downloadBlobLocally(projectBlob, `${base}-${stamp}${PROJECT_FILE_EXT}`);
  return hardened;
}

export async function readProjectFile(file: File): Promise<StudioCanvasProjectV1> {
  const raw = await importSecureProject(file);
  try {
    return parseStudioProject(raw);
  } catch {
    throw new Error("invalid_or_tampered_project");
  }
}

const KNOWN_ASPECT_KEYS: AspectRatioKey[] = [
  "original",
  "16:9",
  "1:1",
  "4:3",
  "9:16",
  "id",
  "a4",
  "a2",
  "a3",
  "3:1",
  "4:1",
  "4:5",
];

/** Resolve print-wizard aspect saved as tab key, numeric ratio, or canvas meta. */
export function resolveProjectPrintAspect(project: StudioCanvasProjectV1): {
  aspect: number;
  customPrint: StudioProjectCustomPrint | null;
  aspectKey: AspectRatioKey | null;
} {
  const customPrint = project.studio.customPrint;
  if (customPrint && customPrint.width > 0 && customPrint.height > 0) {
    return {
      aspect: customPrint.width / Math.max(customPrint.height, 0.0001),
      customPrint,
      aspectKey: null,
    };
  }

  const raw = project.studio.aspectRatio;
  if (
    typeof raw === "string" &&
    (KNOWN_ASPECT_KEYS as readonly string[]).includes(raw)
  ) {
    const key = raw as AspectRatioKey;
    if (key === "original") {
      const ns = project.studio.naturalSize;
      const aspect =
        ns.w > 0 && ns.h > 0
          ? ns.w / ns.h
          : project.canvas.meta.width / Math.max(project.canvas.meta.height, 1);
      return { aspect, customPrint: null, aspectKey: key };
    }
    return {
      aspect: aspectRatioValue(key),
      customPrint: null,
      aspectKey: key,
    };
  }

  const numeric =
    typeof raw === "string" ? parseFloat(raw) : Number(raw);
  if (Number.isFinite(numeric) && numeric > 0.05) {
    return { aspect: numeric, customPrint: null, aspectKey: null };
  }

  const w = project.canvas.meta.width;
  const h = project.canvas.meta.height;
  if (w > 0 && h > 0) {
    return { aspect: w / h, customPrint: null, aspectKey: null };
  }
  return { aspect: 1, customPrint: null, aspectKey: null };
}

/** Deep-copy overlay layers preserving color / typography fields. */
export function cloneOverlayLayers(layers: TextLayer[]): TextLayer[] {
  return layers.map((l) => ({
    ...l,
    ranges: l.ranges?.map((r) => ({ ...r })) ?? [],
  }));
}

/** Hand-off from wizard Step-2 → studio (session only). */
export const PENDING_STUDIO_PROJECT_KEY = "sca_pending_studio_project_v1";

export function peekPendingStudioProject(
  key: string = PENDING_STUDIO_PROJECT_KEY
): StudioCanvasProjectV1 | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return parseStudioProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

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
