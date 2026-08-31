/**
 * Recent project drawer — FIFO max 10.
 * Dual cache: localStorage (index + shrunk JSON) + IndexedDB (full payloads).
 * Account cloud: `public.user_saved_forms` via /api/recent-files (any social login).
 */

import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { parseStudioProject } from "@/lib/canvas/projectFile";
import {
  loadCloudRecentFiles,
  saveCloudRecentFiles,
} from "@/lib/canvas/cloudRecentFiles";
import { idbGetRecent, idbPutRecent } from "@/lib/studioStore/idbCache";
import { mergeRecentEntries } from "@/lib/studioStore/merge";
import { scheduleStudioStoreSync } from "@/lib/studioStore/syncScheduler";
import type { RecentDrawerEntry } from "@/lib/studioStore/types";

export type { RecentDrawerEntry };
export type RecentProjectMeta = import("@/lib/studioStore/types").RecentProjectMeta;

export const RECENT_PROJECTS_MAX = 10;

/**
 * Per-screen recent drawers (SCREEN-007 / 008 / 010) — never share lists.
 * localStorage keys match product naming exactly.
 */
export type RecentProjectNamespace =
  | "screen_007"
  | "screen_008"
  | "screen_010";

/** Fired on window after drawer mutations (same-tab UI refresh). */
export const RECENT_PROJECTS_CHANGED_EVENT = "sca:recent-projects-changed";

const DRAWER_KEYS: Record<RecentProjectNamespace, string> = {
  screen_007: "recent_files_screen_007",
  screen_008: "recent_files_screen_008",
  screen_010: "recent_files_screen_010",
};

/** Legacy keys (one-shot migrate into the matching screen drawer). */
const LEGACY_SHARED_DRAWER_KEY = "sca_recent_projects_drawer_v2";
const LEGACY_PHOTO_DRAWER_KEY = "sca_photo_recent_projects_drawer_v1";
const LEGACY_META_KEY = "sca_recent_project_ids_v1";
const LEGACY_DB_NAME = "sca_recent_projects_v1";
const LEGACY_STORE = "projects";

function drawerKey(namespace: RecentProjectNamespace): string {
  return DRAWER_KEYS[namespace];
}

function idbRecentKind(
  namespace: RecentProjectNamespace
): "recent_shared" | "recent_photo" {
  // Cloud/IDB still has two buckets: map 007→shared, 010→photo; 008 stays local-LS for IDB shared isolation.
  return namespace === "screen_010" ? "recent_photo" : "recent_shared";
}

function projectLabel(project: StudioCanvasProjectV1): string {
  const title =
    project.studio.overlayLayers.find((l) => l.text?.trim())?.text?.trim() ||
    "";
  const short = title.replace(/\s+/g, " ").slice(0, 28);
  const when = new Date(project.savedAt || Date.now());
  const stamp = `${when.getMonth() + 1}/${when.getDate()} ${String(
    when.getHours()
  ).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  if (short) return `${short} · ${stamp}`;
  return project.studio.mode === "agent"
    ? `인쇄물 · ${stamp}`
    : `템플릿 · ${stamp}`;
}

function projectThumb(project: StudioCanvasProjectV1): string | null {
  const photo = project.canvas.objects.find(
    (o) =>
      (o.type === "photo" || o.type === "subject" || o.type === "background") &&
      "src" in o &&
      typeof o.src === "string" &&
      o.src.trim()
  );
  if (photo && "src" in photo && typeof photo.src === "string") {
    const src = photo.src.trim();
    if (src.startsWith("data:")) return null;
    return src.slice(0, 500);
  }
  const bg = project.studio.backgroundUrl || project.studio.subjectUrl;
  if (bg && !bg.startsWith("data:")) return bg.slice(0, 500);
  return null;
}

/** Drop oversized data-URLs so localStorage quota is less likely to blow up. */
function shrinkProjectForStorage(
  project: StudioCanvasProjectV1
): StudioCanvasProjectV1 {
  const MAX_DATA = 180_000;
  const trimSrc = (src: string | null | undefined): string => {
    if (!src) return "";
    if (src.startsWith("data:") && src.length > MAX_DATA) {
      return "";
    }
    return src;
  };
  const next = JSON.parse(JSON.stringify(project)) as StudioCanvasProjectV1;
  next.studio.subjectUrl = trimSrc(next.studio.subjectUrl);
  next.studio.backgroundUrl = next.studio.backgroundUrl
    ? trimSrc(next.studio.backgroundUrl) || null
    : null;
  next.canvas.objects = next.canvas.objects.map((o) => {
    if (o.type === "text" || !("src" in o)) return o;
    const src = typeof o.src === "string" ? o.src : "";
    if (src.startsWith("data:") && src.length > MAX_DATA) {
      return { ...o, src: "" };
    }
    return o;
  });
  if (next.lookbook) {
    const trimVault = (items: typeof next.lookbook.uploadVault) =>
      items.map((item) => ({
        ...item,
        src: trimSrc(item.src),
      }));
    next.lookbook = {
      ...next.lookbook,
      uploadVault: trimVault(next.lookbook.uploadVault),
      trainedVault: trimVault(next.lookbook.trainedVault),
      wizard: {
        ...next.lookbook.wizard,
        backgroundUrl: next.lookbook.wizard.backgroundUrl
          ? trimSrc(next.lookbook.wizard.backgroundUrl) || null
          : null,
        backgroundUrls: (next.lookbook.wizard.backgroundUrls || []).map(
          (u) => trimSrc(u || "") || ""
        ),
        photoLayersByPage: (next.lookbook.wizard.photoLayersByPage || []).map(
          (page) =>
            page.map((layer) => ({
              ...layer,
              src: trimSrc(layer.src) || "",
            }))
        ),
      },
    };
  }
  return next;
}

function readDrawer(
  namespace: RecentProjectNamespace = "screen_007"
): RecentDrawerEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(drawerKey(namespace));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RecentDrawerEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string" || !r.meta || !r.project) continue;
      try {
        out.push({
          id: r.id,
          meta: r.meta as RecentProjectMeta,
          project: parseStudioProject(r.project),
        });
      } catch {
        /* skip corrupt row */
      }
    }
    return out.slice(0, RECENT_PROJECTS_MAX);
  } catch {
    return [];
  }
}

function writeDrawer(
  entries: RecentDrawerEntry[],
  namespace: RecentProjectNamespace = "screen_007",
  opts?: { persistCloud?: boolean; max?: number }
): void {
  if (typeof localStorage === "undefined") {
    throw new Error("localstorage_unavailable");
  }
  const cap = Math.max(
    1,
    Math.min(
      200,
      typeof opts?.max === "number" && Number.isFinite(opts.max)
        ? Math.floor(opts.max)
        : RECENT_PROJECTS_MAX
    )
  );
  const trimmed = entries.slice(0, cap);
  const payload = JSON.stringify(
    trimmed.map((e) => ({
      id: e.id,
      meta: e.meta,
      project: e.project,
    }))
  );
  try {
    localStorage.setItem(drawerKey(namespace), payload);
  } catch {
    // Quota: shrink payloads and retry once.
    const shrunk = trimmed.map((e) => ({
      ...e,
      project: shrinkProjectForStorage(e.project),
      meta: {
        ...e.meta,
        thumbSrc: e.meta.thumbSrc?.startsWith("data:") ? null : e.meta.thumbSrc,
      },
    }));
    try {
      localStorage.setItem(drawerKey(namespace), JSON.stringify(shrunk));
    } catch (err) {
      // Soft-fail: cloud gallery / Space4 must still run after this throws.
      console.warn("[recentProjects] localStorage quota exceeded", err);
      throw new Error("localstorage_quota_exceeded");
    }
  }
  // Only sync IDB for 007/010 so print (008) never mixes into shared cloud bucket.
  // Account cloud (`user_saved_forms`) syncs all three screens.
  if (namespace !== "screen_008") {
    void idbPutRecent(idbRecentKind(namespace), trimmed);
    scheduleStudioStoreSync();
  }
  if (opts?.persistCloud !== false) {
    void saveCloudRecentFiles(namespace, trimmed);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECENT_PROJECTS_CHANGED_EVENT));
  }
}

/** One-shot migrate from IndexedDB + legacy id list into localStorage drawer. */
async function migrateLegacyIfNeeded(
  namespace: RecentProjectNamespace = "screen_007"
): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (readDrawer(namespace).length > 0) return;

  // Copy old drawer keys into the matching screen bucket (once).
  const legacyLsKey =
    namespace === "screen_010"
      ? LEGACY_PHOTO_DRAWER_KEY
      : namespace === "screen_007"
        ? LEGACY_SHARED_DRAWER_KEY
        : null;
  if (legacyLsKey) {
    try {
      const raw = localStorage.getItem(legacyLsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.length) {
          const entries: RecentDrawerEntry[] = [];
          for (const row of parsed) {
            if (!row || typeof row !== "object") continue;
            const r = row as Record<string, unknown>;
            if (typeof r.id !== "string" || !r.meta || !r.project) continue;
            try {
              entries.push({
                id: r.id,
                meta: r.meta as RecentProjectMeta,
                project: parseStudioProject(r.project),
              });
            } catch {
              /* skip */
            }
          }
          if (entries.length) {
            writeDrawer(entries.slice(0, RECENT_PROJECTS_MAX), namespace);
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (namespace !== "screen_007") return;
  if (typeof indexedDB === "undefined") return;

  const idsRaw = localStorage.getItem(LEGACY_META_KEY);
  let ids: string[] = [];
  try {
    const parsed = idsRaw ? (JSON.parse(idsRaw) as unknown) : [];
    if (Array.isArray(parsed)) {
      ids = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    ids = [];
  }
  if (!ids.length) return;

  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(LEGACY_DB_NAME, 1);
      req.onerror = () => reject(req.error || new Error("idb_open_failed"));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(LEGACY_STORE)) {
          d.createObjectStore(LEGACY_STORE, { keyPath: "id" });
        }
      };
    });
    const tx = db.transaction(LEGACY_STORE, "readonly");
    const store = tx.objectStore(LEGACY_STORE);
    const migrated: RecentDrawerEntry[] = [];
    for (const id of ids.slice(0, RECENT_PROJECTS_MAX)) {
      const row = await new Promise<
        | { id: string; meta: RecentProjectMeta; project: StudioCanvasProjectV1 }
        | undefined
      >((resolve, reject) => {
        const r = store.get(id);
        r.onsuccess = () =>
          resolve(
            r.result as
              | {
                  id: string;
                  meta: RecentProjectMeta;
                  project: StudioCanvasProjectV1;
                }
              | undefined
          );
        r.onerror = () => reject(r.error);
      });
      if (!row?.project || !row.meta) continue;
      try {
        migrated.push({
          id: row.id,
          meta: row.meta,
          project: parseStudioProject(row.project),
        });
      } catch {
        /* skip */
      }
    }
    db.close();
    if (migrated.length) {
      writeDrawer(migrated, namespace);
      try {
        localStorage.removeItem(LEGACY_META_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore migration failures */
  }
}

const migratePromises = new Map<RecentProjectNamespace, Promise<void>>();
const cloudHydratePromises = new Map<RecentProjectNamespace, Promise<void>>();

function ensureMigrated(
  namespace: RecentProjectNamespace = "screen_007"
): Promise<void> {
  const cached = migratePromises.get(namespace);
  if (cached) return cached;
  const next = migrateLegacyIfNeeded(namespace).then(async () => {
    if (namespace === "screen_008") return;
    const fromIdb = await idbGetRecent(idbRecentKind(namespace));
    if (!fromIdb.length) return;
    const merged = mergeRecentEntries(fromIdb, readDrawer(namespace));
    const current = readDrawer(namespace);
    if (merged.length > current.length) {
      writeDrawer(merged, namespace, { persistCloud: false });
    }
  });
  migratePromises.set(namespace, next);
  return next;
}

function drawerSignature(entries: RecentDrawerEntry[]): string {
  return entries
    .map((e) => `${e.id}:${e.meta.savedAt || 0}`)
    .join("|");
}

/** Merge signed-in account drawer into the local cache (any device / social login). */
function ensureCloudHydrated(
  namespace: RecentProjectNamespace
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const cached = cloudHydratePromises.get(namespace);
  if (cached) return cached;
  const next = (async () => {
    const cloud = await loadCloudRecentFiles(namespace);
    if (!cloud.authenticated) {
      cloudHydratePromises.delete(namespace);
      return;
    }
    const local = readDrawer(namespace);
    if (!cloud.entries.length && local.length) {
      void saveCloudRecentFiles(namespace, local);
      return;
    }
    if (!cloud.entries.length) return;
    const merged = mergeRecentEntries(cloud.entries, local);
    if (drawerSignature(merged) !== drawerSignature(local)) {
      const localHadExtra = local.some(
        (row) => !cloud.entries.some((c) => c.id === row.id)
      );
      writeDrawer(merged, namespace, { persistCloud: localHadExtra });
    }
  })().catch((err) => {
    console.warn("[recentProjects] cloud hydrate skipped", err);
  });
  cloudHydratePromises.set(namespace, next);
  return next;
}

export async function listRecentProjects(
  namespace: RecentProjectNamespace = "screen_007"
): Promise<RecentProjectMeta[]> {
  await ensureMigrated(namespace);
  await ensureCloudHydrated(namespace);
  return readDrawer(namespace)
    .slice()
    .sort((a, b) => (b.meta.savedAt || 0) - (a.meta.savedAt || 0))
    .map((e) => e.meta);
}

export async function getRecentProject(
  id: string,
  namespace: RecentProjectNamespace = "screen_007"
): Promise<StudioCanvasProjectV1 | null> {
  await ensureMigrated(namespace);
  await ensureCloudHydrated(namespace);
  const hit = readDrawer(namespace).find((e) => e.id === id);
  if (hit) {
    try {
      return parseStudioProject(hit.project);
    } catch {
      /* fall through to IDB */
    }
  }
  if (namespace === "screen_008") return null;
  const fromIdb = (await idbGetRecent(idbRecentKind(namespace))).find(
    (e) => e.id === id
  );
  if (!fromIdb) return null;
  try {
    return parseStudioProject(fromIdb.project);
  } catch {
    return null;
  }
}

/** Push newest project into the drawer; drop oldest beyond max (FIFO). */
export async function pushRecentProject(
  project: StudioCanvasProjectV1,
  namespace: RecentProjectNamespace = "screen_007",
  maxItems: number = RECENT_PROJECTS_MAX
): Promise<RecentProjectMeta> {
  await ensureMigrated(namespace);
  await ensureCloudHydrated(namespace);
  const id = `rp_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const now = Date.now();
  const frozen = parseStudioProject(
    JSON.parse(JSON.stringify(project)) as StudioCanvasProjectV1
  );
  frozen.savedAt = now;
  const meta: RecentProjectMeta = {
    id,
    savedAt: now,
    label: projectLabel(frozen),
    mode: frozen.studio.mode,
    thumbSrc: projectThumb(frozen),
  };
  const cap = Math.max(1, Math.min(200, Math.floor(maxItems) || RECENT_PROJECTS_MAX));
  const prev = readDrawer(namespace).filter((e) => e.id !== id);
  // Newest first: prepend, then keep stable by savedAt desc.
  const next: RecentDrawerEntry[] = [
    { id, meta, project: frozen },
    ...prev,
  ]
    .sort((a, b) => (b.meta.savedAt || 0) - (a.meta.savedAt || 0))
    .slice(0, cap);
  writeDrawer(next, namespace, { max: cap });
  return meta;
}

/** Replace the drawer (recovery / cloud hydrate). */
export function replaceRecentDrawer(
  entries: RecentDrawerEntry[],
  namespace: RecentProjectNamespace = "screen_007"
): void {
  writeDrawer(entries.slice(0, RECENT_PROJECTS_MAX), namespace);
}

export async function removeRecentProject(
  id: string,
  namespace: RecentProjectNamespace = "screen_007"
): Promise<void> {
  await ensureMigrated(namespace);
  await ensureCloudHydrated(namespace);
  writeDrawer(
    readDrawer(namespace).filter((e) => e.id !== id),
    namespace
  );
}

/** Debug / tests: wipe the drawer. */
export async function clearRecentProjects(
  namespace: RecentProjectNamespace = "screen_007"
): Promise<void> {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(drawerKey(namespace));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECENT_PROJECTS_CHANGED_EVENT));
  }
}
