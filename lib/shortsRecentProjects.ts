/**
 * Screen 13 recent Shorts projects — localStorage FIFO (max 5).
 */

import {
  parseShortsStudioProject,
  type ShortsStudioProjectV1,
} from "@/lib/shortsProjectFile";

export const SHORTS_RECENT_PROJECTS_MAX = 5;
export const SHORTS_RECENT_DRAWER_KEY = "recent_files_screen_013";
export const SHORTS_RECENT_CHANGED_EVENT = "sca:shorts-recent-projects-changed";

export type ShortsRecentProjectMeta = {
  id: string;
  savedAt: number;
  label: string;
  thumbSrc: string | null;
  videoFileName: string;
};

export type ShortsRecentDrawerEntry = {
  id: string;
  meta: ShortsRecentProjectMeta;
  project: ShortsStudioProjectV1;
};

function shrinkProject(project: ShortsStudioProjectV1): ShortsStudioProjectV1 {
  const next = JSON.parse(JSON.stringify(project)) as ShortsStudioProjectV1;
  // Keep URLs; drop nothing critical — Shorts projects are JSON-sized.
  return next;
}

function readDrawer(): ShortsRecentDrawerEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHORTS_RECENT_DRAWER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ShortsRecentDrawerEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.meta || !r.project) continue;
      try {
        out.push({
          id: r.id,
          meta: r.meta as ShortsRecentProjectMeta,
          project: parseShortsStudioProject(r.project),
        });
      } catch {
        /* skip corrupt */
      }
    }
    return out.slice(0, SHORTS_RECENT_PROJECTS_MAX);
  } catch {
    return [];
  }
}

function writeDrawer(entries: ShortsRecentDrawerEntry[]): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = entries.slice(0, SHORTS_RECENT_PROJECTS_MAX);
  const payload = JSON.stringify(
    trimmed.map((e) => ({
      id: e.id,
      meta: e.meta,
      project: e.project,
    }))
  );
  try {
    localStorage.setItem(SHORTS_RECENT_DRAWER_KEY, payload);
  } catch {
    const shrunk = trimmed.map((e) => ({
      ...e,
      project: shrinkProject(e.project),
      meta: {
        ...e.meta,
        thumbSrc: e.meta.thumbSrc?.startsWith("data:") ? null : e.meta.thumbSrc,
      },
    }));
    try {
      localStorage.setItem(SHORTS_RECENT_DRAWER_KEY, JSON.stringify(shrunk));
    } catch (err) {
      console.warn("[shorts/recent] localStorage write failed", err);
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SHORTS_RECENT_CHANGED_EVENT));
  }
}

function thumbFromProject(project: ShortsStudioProjectV1): string | null {
  const src =
    project.media.hookImageUrl ||
    project.media.hook?.imageUrl ||
    null;
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return null;
  return src.slice(0, 500);
}

export function listShortsRecentProjects(): ShortsRecentProjectMeta[] {
  return readDrawer().map((e) => e.meta);
}

export function getShortsRecentProject(
  id: string
): ShortsStudioProjectV1 | null {
  const hit = readDrawer().find((e) => e.id === id);
  return hit?.project ?? null;
}

/** Push newest project; drop oldest beyond max 5 (FIFO). */
export function pushShortsRecentProject(
  project: ShortsStudioProjectV1
): ShortsRecentProjectMeta {
  const frozen = parseShortsStudioProject(
    JSON.parse(JSON.stringify(project)) as ShortsStudioProjectV1
  );
  const id = `srp_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const meta: ShortsRecentProjectMeta = {
    id,
    savedAt: frozen.savedAt || Date.now(),
    label: frozen.label,
    thumbSrc: thumbFromProject(frozen),
    videoFileName: frozen.media.videoFileName || frozen.media.fileName || "",
  };
  const prev = readDrawer().filter((e) => e.id !== id);
  writeDrawer([{ id, meta, project: frozen }, ...prev]);
  return meta;
}

export function removeShortsRecentProject(id: string): void {
  writeDrawer(readDrawer().filter((e) => e.id !== id));
}
