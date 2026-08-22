/**
 * Client helpers for server-stored `.sca` FIFO (max 10 per user).
 * Stores sealed project text only — no heavy PNG payloads.
 */

import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { exportSecureProject } from "@/lib/projectStorage";

export type ScaGalleryProjectMeta = {
  id: string;
  label: string;
  mode: "utility" | "agent";
  createdAt: number;
  thumbSrc: string | null;
};

export async function fetchScaGalleryProjects(): Promise<{
  projects: ScaGalleryProjectMeta[];
  max: number;
}> {
  const res = await fetch("/api/sca-projects", { credentials: "same-origin", cache: "no-store" });
  const data = (await res.json()) as {
    projects?: ScaGalleryProjectMeta[];
    max?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "sca_gallery_list_failed");
  }
  return {
    projects: Array.isArray(data.projects) ? data.projects : [],
    max: typeof data.max === "number" ? data.max : 10,
  };
}

export async function fetchScaGalleryProjectContent(id: string): Promise<string> {
  const res = await fetch(`/api/sca-projects?id=${encodeURIComponent(id)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await res.json()) as {
    project?: { sealedContent?: string };
    error?: string;
  };
  if (!res.ok || !data.project?.sealedContent) {
    throw new Error(data.error || "sca_gallery_fetch_failed");
  }
  return data.project.sealedContent;
}

export async function uploadScaProjectToGallery(opts: {
  project: StudioCanvasProjectV1;
  sealedContent?: string;
  label?: string;
}): Promise<{ id: string } | null> {
  try {
    const sealed =
      opts.sealedContent?.trim() ||
      (await exportSecureProject(opts.project));
    const label =
      opts.label?.trim() ||
      (opts.project.studio.mode === "agent" ? "인쇄물 프로젝트" : "템플릿 프로젝트");

    const thumb = opts.project.studio.backgroundUrl || opts.project.studio.subjectUrl;
    const thumbSrc =
      thumb && !thumb.startsWith("data:") ? thumb.slice(0, 500) : null;

    const res = await fetch("/api/sca-projects", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        mode: opts.project.studio.mode,
        sealedContent: sealed,
        createdAt: opts.project.savedAt || Date.now(),
        thumbSrc,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { project?: { id?: string } };
    return data.project?.id ? { id: data.project.id } : null;
  } catch (err) {
    console.warn("[scaGalleryProjects] upload failed", err);
    return null;
  }
}
