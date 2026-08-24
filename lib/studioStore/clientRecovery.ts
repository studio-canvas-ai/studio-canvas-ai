/**
 * Client dual-cache + auto-recovery for recent files / upload vault / trained vault.
 * Merge order: IndexedDB + localStorage + /api/studio-store/recover (Supabase/R2 aliases).
 */

import { parseStudioProject } from "@/lib/canvas/projectFile";
import { importSecureProject } from "@/lib/projectStorage";
import {
  PHOTO_ACTIVE_TRAINED_CHANGED_EVENT,
  PHOTO_TRAINED_VAULT_CHANGED_EVENT,
  PHOTO_UPLOAD_VAULT_CHANGED_EVENT,
  getActiveTrainedVaultId,
  listTrainedVault,
  listUploadVault,
  replaceTrainedVault,
  replaceUploadVault,
  setActiveTrainedVaultId,
} from "@/lib/photoVaultStorage";
import {
  RECENT_PROJECTS_CHANGED_EVENT,
  getRecentProject,
  listRecentProjects,
  replaceRecentDrawer,
  type RecentProjectNamespace,
} from "@/lib/canvas/recentProjects";
import { fetchScaGalleryProjectContent, fetchScaGalleryProjects } from "@/lib/scaGalleryProjects";
import { saveFaceProfiles, type FaceProfile } from "@/lib/faceProfiles";
import {
  idbGetRecent,
  idbGetVault,
  idbPutRecent,
  idbPutVault,
} from "@/lib/studioStore/idbCache";
import { mergeRecentEntries, mergeVaultItems } from "@/lib/studioStore/merge";
import type {
  RecentDrawerEntry,
  StudioStoreBundle,
  StudioStoreRecoverResult,
} from "@/lib/studioStore/types";
import { withoutStudioStoreSync } from "@/lib/studioStore/syncScheduler";
import {
  studioBundleIsEmpty,
} from "@/lib/studioStore/persistKeys";

export const STUDIO_STORE_RECOVERED_EVENT = "sca:studio-store-recovered";

let recoverInFlight: Promise<StudioStoreRecoverResult | null> | null = null;
let lastRecoverAt = 0;
let lastResult: StudioStoreRecoverResult | null = null;

async function readLocalRecent(
  namespace: RecentProjectNamespace
): Promise<RecentDrawerEntry[]> {
  const kind = namespace === "photo" ? "recent_photo" : "recent_shared";
  const fromIdb = await idbGetRecent(kind);
  const metas = await listRecentProjects(namespace);
  const fromLs: RecentDrawerEntry[] = [];
  for (const meta of metas) {
    const project = await getRecentProject(meta.id, namespace);
    if (!project) continue;
    fromLs.push({ id: meta.id, meta, project });
  }
  return mergeRecentEntries(fromIdb, fromLs);
}

async function hydrateScaGallery(): Promise<RecentDrawerEntry[]> {
  try {
    const { projects } = await fetchScaGalleryProjects();
    const out: RecentDrawerEntry[] = [];
    for (const meta of projects) {
      try {
        const sealed = await fetchScaGalleryProjectContent(meta.id);
        const raw = await importSecureProject(sealed);
        const project = parseStudioProject(raw);
        out.push({
          id: meta.id,
          meta: {
            id: meta.id,
            savedAt: meta.createdAt,
            label: meta.label,
            mode: meta.mode,
            thumbSrc: meta.thumbSrc,
          },
          project,
        });
      } catch {
        /* skip one sealed file */
      }
    }
    return out;
  } catch {
    return [];
  }
}

function applyBundle(bundle: StudioStoreBundle): void {
  withoutStudioStoreSync(() => {
    if (bundle.recentShared.length) {
      replaceRecentDrawer(bundle.recentShared, "shared");
    }
    if (bundle.recentPhoto.length) {
      replaceRecentDrawer(bundle.recentPhoto, "photo");
    }
    if (bundle.uploadVault.length) {
      replaceUploadVault(bundle.uploadVault);
    }
    if (bundle.trainedVault.length) {
      replaceTrainedVault(bundle.trainedVault);
    }
    if (bundle.activeTrainedId) {
      setActiveTrainedVaultId(bundle.activeTrainedId);
    }
  });
  if (bundle.recentShared.length) {
    void idbPutRecent("recent_shared", bundle.recentShared);
  }
  if (bundle.recentPhoto.length) {
    void idbPutRecent("recent_photo", bundle.recentPhoto);
  }
  if (bundle.uploadVault.length) {
    void idbPutVault("upload_vault", bundle.uploadVault);
  }
  if (bundle.trainedVault.length) {
    void idbPutVault("trained_vault", bundle.trainedVault, {
      activeTrainedId: bundle.activeTrainedId,
    });
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECENT_PROJECTS_CHANGED_EVENT));
    window.dispatchEvent(new Event(PHOTO_UPLOAD_VAULT_CHANGED_EVENT));
    window.dispatchEvent(new Event(PHOTO_TRAINED_VAULT_CHANGED_EVENT));
    window.dispatchEvent(new Event(PHOTO_ACTIVE_TRAINED_CHANGED_EVENT));
    window.dispatchEvent(
      new CustomEvent(STUDIO_STORE_RECOVERED_EVENT, { detail: bundle })
    );
  }
}

async function snapshotLocal(): Promise<StudioStoreBundle> {
  const [recentShared, recentPhoto, idbUpload, idbTrained] = await Promise.all([
    readLocalRecent("shared"),
    readLocalRecent("photo"),
    idbGetVault("upload_vault"),
    idbGetVault("trained_vault"),
  ]);
  return {
    recentShared,
    recentPhoto,
    uploadVault: mergeVaultItems(listUploadVault(), idbUpload.items),
    trainedVault: mergeVaultItems(listTrainedVault(), idbTrained.items),
    activeTrainedId:
      getActiveTrainedVaultId() ||
      idbTrained.activeTrainedId ||
      null,
  };
}

/**
 * Merge browser caches with cloud (alias-aware). Safe to call often — coalesced.
 */
export async function recoverStudioStores(opts?: {
  force?: boolean;
}): Promise<StudioStoreRecoverResult | null> {
  if (typeof window === "undefined") return null;
  const now = Date.now();
  if (recoverInFlight) return recoverInFlight;
  if (!opts?.force && now - lastRecoverAt < 8_000 && lastResult) {
    return lastResult;
  }

  recoverInFlight = (async () => {
    try {
    const local = await snapshotLocal();

    let remote: StudioStoreRecoverResult | null = null;
    try {
      const res = await fetch("/api/studio-store/recover", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        remote = (await res.json()) as StudioStoreRecoverResult;
      }
    } catch (err) {
      console.warn("[studioStore] recover fetch failed", err);
    }

    // After server rekeys alias manifests onto this account, unseal `.sca` gallery.
    const gallery = await hydrateScaGallery();
    const cloudFirst = Boolean(remote && !studioBundleIsEmpty(remote));

    const merged: StudioStoreBundle = cloudFirst
      ? {
          recentShared: mergeRecentEntries(
            remote!.recentShared,
            gallery,
            local.recentShared
          ),
          recentPhoto: mergeRecentEntries(
            remote!.recentPhoto,
            local.recentPhoto
          ),
          uploadVault: mergeVaultItems(
            remote!.uploadVault,
            local.uploadVault
          ),
          trainedVault: mergeVaultItems(
            remote!.trainedVault,
            local.trainedVault
          ),
          activeTrainedId:
            remote!.activeTrainedId || local.activeTrainedId || null,
        }
      : {
          recentShared: mergeRecentEntries(local.recentShared, gallery),
          recentPhoto: local.recentPhoto,
          uploadVault: local.uploadVault,
          trainedVault: local.trainedVault,
          activeTrainedId: local.activeTrainedId,
        };

    applyBundle(merged);

    if (remote?.faceProfiles?.length) {
      saveFaceProfiles(remote.faceProfiles as FaceProfile[]);
    }

    lastResult = {
      ok: true as const,
      ...merged,
      faceProfiles: remote?.faceProfiles ?? [],
      diagnostics: remote?.diagnostics ?? {
        aliasesTried: [],
        manifestsFound: [],
        supabaseRows: 0,
        scaProjectsRecovered: gallery.length,
        faceProfilesRecovered: remote?.faceProfiles?.length ?? 0,
        vaultsFromLookbooks: 0,
        emptyR2Skipped: 0,
      },
    };
    lastRecoverAt = Date.now();

    if (remote?.ok && !studioBundleIsEmpty(merged)) {
      void fetch("/api/studio-store", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      }).catch(() => undefined);
    }

    return lastResult;
    } catch (err) {
      console.warn("[studioStore] recover failed", err);
      return lastResult;
    }
  })();

  try {
    return await recoverInFlight;
  } finally {
    recoverInFlight = null;
  }
}

export async function pushLocalStoresToServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const local = await snapshotLocal();
  if (studioBundleIsEmpty(local)) return;
  void idbPutRecent("recent_shared", local.recentShared);
  void idbPutRecent("recent_photo", local.recentPhoto);
  void idbPutVault("upload_vault", local.uploadVault);
  void idbPutVault("trained_vault", local.trainedVault, {
    activeTrainedId: local.activeTrainedId,
  });
  try {
    await fetch("/api/studio-store", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local),
    });
  } catch (err) {
    console.warn("[studioStore] push failed", err);
  }
}
