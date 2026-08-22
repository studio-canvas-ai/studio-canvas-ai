/**
 * Finished-works gallery download — local device only.
 * Uses already-stored gallery / original assets and never re-uploads to R2.
 */

import {
  buildStudioProject,
  downloadImageAndProjectLocally,
  type StudioCanvasProjectV1,
} from "@/lib/canvas/projectFile";
import { defaultImageObject } from "@/lib/canvas/types";
import { getRecentProject, listRecentProjects } from "@/lib/canvas/recentProjects";
import { resolveCanvasImageUrl } from "@/lib/downloadImage";
import type { GalleryHistoryItem } from "@/lib/faceProfiles";
import { fetchOriginalAsset } from "@/lib/galleryUpload";
import {
  fetchScaGalleryProjectContent,
  fetchScaGalleryProjects,
} from "@/lib/scaGalleryProjects";

export type GalleryDownloadQuality = "standard" | "high";

const STANDARD_MAX_EDGE = 1280;

function urlFingerprint(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/media/fetch?")) {
    try {
      const src = new URL(trimmed, "http://local.invalid").searchParams.get("src");
      if (src) return urlFingerprint(src);
    } catch {
      /* fall through */
    }
  }
  try {
    const u = new URL(trimmed);
    return `${u.host}${u.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return trimmed.replace(/[#?].*$/, "").toLowerCase();
  }
}

function urlsOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  const fa = urlFingerprint(a || "");
  const fb = urlFingerprint(b || "");
  if (!fa || !fb) return false;
  return fa === fb || fa.includes(fb) || fb.includes(fa);
}

async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(resolveCanvasImageUrl(url), { credentials: "same-origin" });
  if (!res.ok) throw new Error(`gallery_fetch_${res.status}`);
  return res.blob();
}

async function downscaleBlob(blob: Blob, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const edge = Math.max(srcW, srcH);
  if (edge <= maxEdge) {
    bitmap.close();
    return blob;
  }
  const scale = maxEdge / edge;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.92)
  );
  return out || blob;
}

async function resolveImageBlob(
  item: GalleryHistoryItem,
  quality: GalleryDownloadQuality
): Promise<Blob> {
  if (quality === "high") {
    const storageId = item.storageId ?? item.id;
    if (item.originalKey || item.storageId) {
      const original = await fetchOriginalAsset(storageId);
      if (original && original.size > 0) return original;
    }
    return blobFromUrl(item.imageUrl || item.thumbnailUrl || "");
  }

  if (item.thumbnailUrl && item.thumbnailUrl !== item.imageUrl) {
    try {
      const thumb = await blobFromUrl(item.thumbnailUrl);
      if (thumb.size > 0) return thumb;
    } catch {
      /* fall through to downscale */
    }
  }

  const source = await blobFromUrl(item.imageUrl || item.thumbnailUrl || "");
  return downscaleBlob(source, STANDARD_MAX_EDGE);
}

function synthesizeProjectFromWork(
  item: GalleryHistoryItem,
  imageUrl: string
): StudioCanvasProjectV1 {
  const w = 1080;
  const h = 1920;
  return buildStudioProject({
    mode: "utility",
    subjectUrl: imageUrl,
    backgroundUrl: null,
    overlayLayers: [],
    aspectRatio: "9:16",
    customPrint: null,
    naturalSize: { w, h },
    canvas: {
      meta: { width: w, height: h, mode: "utility", dpi: 72 },
      objects: [
        defaultImageObject({
          type: "subject",
          src: imageUrl,
          x: 0,
          y: 0,
          width: w,
          height: h,
          zIndex: 10,
        }),
      ],
      selectedId: null,
      updatedAt: Date.now(),
    },
  });
}

function projectMatchesWork(
  project: StudioCanvasProjectV1,
  item: GalleryHistoryItem
): boolean {
  const projectUrls = [
    project.studio.subjectUrl,
    project.studio.backgroundUrl,
    ...project.canvas.objects
      .map((o) => ("src" in o && typeof o.src === "string" ? o.src : ""))
      .filter(Boolean),
  ];
  const workUrls = [item.imageUrl, item.thumbnailUrl];
  return workUrls.some((wu) => projectUrls.some((c) => urlsOverlap(wu, c)));
}

async function findExistingProject(
  item: GalleryHistoryItem
): Promise<{ project?: StudioCanvasProjectV1; sealed?: string } | null> {
  const metas = await listRecentProjects();
  for (const meta of metas) {
    const project = await getRecentProject(meta.id);
    if (project && projectMatchesWork(project, item)) {
      return { project };
    }
  }

  try {
    const { projects } = await fetchScaGalleryProjects();
    const hit = projects.find(
      (p) =>
        urlsOverlap(p.thumbSrc, item.imageUrl) ||
        urlsOverlap(p.thumbSrc, item.thumbnailUrl)
    );
    if (hit) {
      const sealed = await fetchScaGalleryProjectContent(hit.id);
      if (sealed.trim()) return { sealed };
    }
  } catch {
    /* gallery sca is optional */
  }

  return null;
}

/**
 * Download PNG (quality-specific) + `.sca` to the user device.
 * Does not POST gallery works, storage upload, or sca-projects.
 */
export async function downloadGalleryWorkLocally(
  item: GalleryHistoryItem,
  quality: GalleryDownloadQuality
): Promise<void> {
  const imageBlob = await resolveImageBlob(item, quality);
  const imageUrl = item.imageUrl || item.thumbnailUrl;
  if (!imageUrl) throw new Error("gallery_image_missing");

  const existing = await findExistingProject(item);
  const qualityTag = quality === "high" ? "hd" : "std";
  const baseName = `studio-canvas-${item.id}-${qualityTag}`;

  if (existing?.sealed) {
    const { downloadBlobLocally } = await import("@/lib/canvas/projectFile");
    downloadBlobLocally(imageBlob, `${baseName}-${Date.now()}.png`);
    await new Promise((r) => setTimeout(r, 180));
    downloadBlobLocally(
      new Blob([existing.sealed], { type: "application/octet-stream" }),
      `${baseName}-${Date.now()}.sca`
    );
    return;
  }

  const project =
    existing?.project || synthesizeProjectFromWork(item, imageUrl);

  await downloadImageAndProjectLocally({
    imageBlob,
    project,
    baseName,
    imageExt: "png",
  });
}

/** Reserved for a future HD credit charge — currently a no-op. */
export function previewGalleryHdCreditPolicy(): {
  quality: "high";
  chargeCredits: false;
} {
  return { quality: "high", chargeCredits: false };
}
