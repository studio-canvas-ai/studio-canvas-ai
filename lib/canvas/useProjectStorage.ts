/**
 * Shared recent-project storage for Template Studio + Print Smart Form.
 * Download → device export immediately; cloud gallery / Space 4 run in background.
 *
 * Browser localStorage quota failures are silent and never block cloud sync.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  downloadImageAndProjectLocally,
  stashPendingStudioProject,
  type StudioCanvasProjectV1,
} from "@/lib/canvas/projectFile";
import {
  pushRecentProject,
  shrinkProjectForStorage,
  type RecentProjectNamespace,
} from "@/lib/canvas/recentProjects";
import { beginCloudBackup, endCloudBackup } from "@/lib/cloudBackupUi";
import { uploadScaProjectToGallery } from "@/lib/scaGalleryProjects";
import { getPlanStorageLimits } from "@/lib/planStorageLimits";
import { PRINT_WIZARD_STUDIO_PATH } from "@/lib/wizard/wizardProduct";

export const TEMPLATE_STUDIO_PATH = "/template-studio";
export const RECENT_PROJECTS_SHARED = true;

export function studioPathForProject(
  project: StudioCanvasProjectV1
): typeof PRINT_WIZARD_STUDIO_PATH | typeof TEMPLATE_STUDIO_PATH {
  return project.studio.mode === "agent"
    ? PRINT_WIZARD_STUDIO_PATH
    : TEMPLATE_STUDIO_PATH;
}

export type CloudBackupResult = {
  recentOk: boolean;
  galleryOk: boolean;
  space4Ok: boolean | null;
};

/** Sync sealed `.sca` to recent FIFO + gallery + optional Space 4 (blocking). */
export async function syncProjectCloudBackup(opts: {
  project: StudioCanvasProjectV1;
  recentNamespace?: RecentProjectNamespace;
  recentMax?: number;
  depositToSpace4?: boolean;
  space4ThumbBlob?: Blob | null;
}): Promise<CloudBackupResult> {
  const cloudProject = shrinkProjectForStorage(opts.project);

  let recentOk = false;
  let galleryOk = false;
  let space4Ok: boolean | null = opts.depositToSpace4 ? false : null;

  try {
    await pushRecentProject(
      cloudProject,
      opts.recentNamespace,
      opts.recentMax
    );
    recentOk = true;
  } catch (err) {
    console.warn("[projectStorage] recent FIFO save failed (ignored)", err);
    recentOk = false;
  }

  try {
    const uploaded = await uploadScaProjectToGallery({ project: cloudProject });
    galleryOk = Boolean(uploaded?.id);
    if (!galleryOk) {
      console.warn("[projectStorage] gallery sca upload returned no id");
    }
  } catch (err) {
    console.warn("[projectStorage] gallery sca upload failed", err);
  }

  if (opts.depositToSpace4) {
    try {
      const { depositProjectToSpace4 } = await import("@/lib/space4Client");
      const deposited = await depositProjectToSpace4({
        project: cloudProject,
        source: "print-unified-editor-download",
        thumbBlob: opts.space4ThumbBlob ?? null,
      });
      space4Ok = Boolean(deposited?.id);
      if (!space4Ok) {
        console.warn("[projectStorage] Space 4 deposit returned no id");
      }
    } catch (err) {
      console.warn("[projectStorage] Space 4 deposit failed", err);
      space4Ok = false;
    }
  }

  return { recentOk, galleryOk, space4Ok };
}

function toastCloudBackupResult(
  showToast: (message: string, tone?: "success" | "error" | "info") => void,
  result: CloudBackupResult,
  space4Required: boolean
) {
  const space4Passed = !space4Required || result.space4Ok === true;
  const cloudOk = result.galleryOk && space4Passed;
  const anyCloudOk = result.galleryOk || result.space4Ok === true;

  if (cloudOk || anyCloudOk) {
    showToast("클라우드 백업이 완료됐습니다.", "success");
    return;
  }
  showToast(
    "기기 파일은 저장됐습니다. 클라우드 백업은 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    "info"
  );
}

/**
 * Download rendered export to device, then sync sealed `.sca` to cloud.
 * Cloud work (recent / gallery / Template 4) runs in the background so the UI
 * is not blocked after the device files start downloading.
 */
export async function downloadImageAndRememberRecent(opts: {
  imageBlob: Blob;
  project: StudioCanvasProjectV1;
  baseName: string;
  imageExt?: "png" | "jpg";
  recentNamespace?: RecentProjectNamespace;
  depositToSpace4?: boolean;
  space4ThumbBlob?: Blob | null;
  recentMax?: number;
  /**
   * When false, waits for cloud sync (legacy). Default true — non-blocking.
   */
  deferCloudSync?: boolean;
  onCloudBackupComplete?: (result: CloudBackupResult) => void;
}): Promise<CloudBackupResult & { deferred: boolean }> {
  const sealedProject = await downloadImageAndProjectLocally({
    imageBlob: opts.imageBlob,
    project: opts.project,
    baseName: opts.baseName,
    imageExt: opts.imageExt,
    skipLocalProject: false,
  });

  const defer = opts.deferCloudSync !== false;
  const space4Required = opts.depositToSpace4 === true;

  if (!defer) {
    const result = await syncProjectCloudBackup({
      project: sealedProject,
      recentNamespace: opts.recentNamespace,
      recentMax: opts.recentMax,
      depositToSpace4: opts.depositToSpace4,
      space4ThumbBlob: opts.space4ThumbBlob ?? opts.imageBlob,
    });
    return { ...result, deferred: false };
  }

  beginCloudBackup("클라우드 백업 중...");
  void (async () => {
    try {
      const result = await syncProjectCloudBackup({
        project: sealedProject,
        recentNamespace: opts.recentNamespace,
        recentMax: opts.recentMax,
        depositToSpace4: opts.depositToSpace4,
        space4ThumbBlob: opts.space4ThumbBlob ?? opts.imageBlob,
      });
      opts.onCloudBackupComplete?.(result);
    } catch (err) {
      console.warn("[projectStorage] background cloud backup failed", err);
      opts.onCloudBackupComplete?.({
        recentOk: false,
        galleryOk: false,
        space4Ok: space4Required ? false : null,
      });
    } finally {
      endCloudBackup();
    }
  })();

  return {
    recentOk: true,
    galleryOk: false,
    space4Ok: space4Required ? false : null,
    deferred: true,
  };
}

/** Save sealed .sca to local recent FIFO + server gallery (no PNG download). */
export async function rememberProjectInGallery(opts: {
  project: StudioCanvasProjectV1;
  recentNamespace?: RecentProjectNamespace;
  recentMax?: number;
}): Promise<{ recentOk: boolean; galleryOk: boolean }> {
  const result = await syncProjectCloudBackup({
    project: opts.project,
    recentNamespace: opts.recentNamespace,
    recentMax: opts.recentMax,
    depositToSpace4: false,
  });
  return { recentOk: result.recentOk, galleryOk: result.galleryOk };
}

export type OpenRecentProjectResult = "applied" | "navigated";

export function openRecentProjectInEditor(
  project: StudioCanvasProjectV1,
  opts: {
    currentMode?: "utility" | "agent";
    applyLocal?: (project: StudioCanvasProjectV1) => void;
    router: { push: (href: string) => void };
    studioPath?: string;
    pendingProjectKey?: string;
  }
): OpenRecentProjectResult {
  if (opts.applyLocal) {
    opts.applyLocal(project);
    return "applied";
  }
  stashPendingStudioProject(project, opts.pendingProjectKey);
  return "applied";
}

/** Hook: shared download→recent + cross-screen open helpers. */
export function useProjectStorage(config?: {
  recentNamespace?: RecentProjectNamespace;
  studioPath?: string;
  pendingProjectKey?: string;
}) {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { planId, billingInterval } = useCredits();
  const storageLimits = getPlanStorageLimits(planId, billingInterval);

  const downloadAndRemember = useCallback(
    async (downloadOpts: {
      imageBlob: Blob;
      project: StudioCanvasProjectV1;
      baseName: string;
      imageExt?: "png" | "jpg";
      successMessage?: string;
      /** Immediate toast after device save (defaults when successMessage set). */
      deviceSavedMessage?: string;
      depositToSpace4?: boolean;
      space4ThumbBlob?: Blob | null;
      /** Default true — gallery / Template 4 do not block the UI. */
      deferCloudSync?: boolean;
    }) => {
      const space4Required = downloadOpts.depositToSpace4 === true;
      const defer = downloadOpts.deferCloudSync !== false;

      const result = await downloadImageAndRememberRecent({
        ...downloadOpts,
        recentNamespace: config?.recentNamespace,
        depositToSpace4: downloadOpts.depositToSpace4,
        space4ThumbBlob: downloadOpts.space4ThumbBlob,
        recentMax: storageLimits.scaCloud,
        deferCloudSync: defer,
        onCloudBackupComplete: (cloudResult) => {
          toastCloudBackupResult(showToast, cloudResult, space4Required);
        },
      });

      if (result.deferred) {
        showToast(
          downloadOpts.deviceSavedMessage ||
            "완성본과 수정용 .sca를 기기에 저장했습니다. 클라우드 백업을 진행 중입니다.",
          "success"
        );
        return result;
      }

      // Blocking path (deferCloudSync: false).
      void result.recentOk;
      const space4Passed = !space4Required || result.space4Ok === true;
      const anyCloudOk = result.galleryOk || result.space4Ok === true;
      if (anyCloudOk && space4Passed && downloadOpts.successMessage) {
        showToast(downloadOpts.successMessage, "success");
      } else {
        toastCloudBackupResult(showToast, result, space4Required);
      }
      return result;
    },
    [config?.recentNamespace, showToast, storageLimits.scaCloud]
  );

  const openRecent = useCallback(
    (
      project: StudioCanvasProjectV1,
      localOpts?: {
        currentMode?: "utility" | "agent";
        applyLocal?: (project: StudioCanvasProjectV1) => void;
      }
    ) => {
      const result = openRecentProjectInEditor(project, {
        currentMode: localOpts?.currentMode,
        applyLocal: localOpts?.applyLocal,
        router,
        studioPath: config?.studioPath,
        pendingProjectKey: config?.pendingProjectKey,
      });
      if (result === "applied") {
        showToast("최근 수정파일을 불러와 편집 상태를 복원했습니다.", "success");
      } else {
        showToast("최근 수정파일을 불러왔습니다.", "success");
      }
      return result;
    },
    [config?.pendingProjectKey, config?.studioPath, router, showToast]
  );

  const saveToGallery = useCallback(
    async (project: StudioCanvasProjectV1) => {
      const { recentOk, galleryOk } = await rememberProjectInGallery({
        project,
        recentNamespace: config?.recentNamespace,
        recentMax: storageLimits.scaCloud,
      });
      void recentOk;
      if (galleryOk) {
        return { ok: true as const, partial: false as const };
      }
      showToast("갤러리 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
      return { ok: false as const };
    },
    [config?.recentNamespace, showToast, storageLimits.scaCloud]
  );

  return {
    downloadAndRemember,
    saveToGallery,
    openRecent,
    studioPathForProject,
    storageLimits,
  };
}
