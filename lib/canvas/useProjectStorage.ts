"use client";

/**
 * Shared recent-project storage for Template Studio + Print Smart Form.
 * Download → device export + recent FIFO + gallery FIFO + optional Space4.
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

/**
 * Download rendered export to device, then sync sealed `.sca` to:
 * recent-files cloud, works gallery, and (optional) Space 4 vault.
 *
 * Local recent-drawer failures (e.g. QuotaExceededError) are swallowed —
 * gallery / Template 4 deposition always still runs.
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
}): Promise<{
  recentOk: boolean;
  galleryOk: boolean;
  space4Ok: boolean | null;
}> {
  const sealedProject = await downloadImageAndProjectLocally({
    imageBlob: opts.imageBlob,
    project: opts.project,
    baseName: opts.baseName,
    imageExt: opts.imageExt,
    skipLocalProject: false,
  });

  // Slim copy for cloud APIs — strip huge data-URLs that blow request bodies / R2.
  const cloudProject = shrinkProjectForStorage(sealedProject);

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
    // Silent: never surface localStorage quota to the user.
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
        thumbBlob: opts.space4ThumbBlob ?? opts.imageBlob,
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

/** Save sealed .sca to local recent FIFO + server gallery (no PNG download). */
export async function rememberProjectInGallery(opts: {
  project: StudioCanvasProjectV1;
  recentNamespace?: RecentProjectNamespace;
  recentMax?: number;
}): Promise<{ recentOk: boolean; galleryOk: boolean }> {
  const cloudProject = shrinkProjectForStorage(opts.project);
  let recentOk = false;
  let galleryOk = false;
  try {
    await pushRecentProject(
      cloudProject,
      opts.recentNamespace,
      opts.recentMax
    );
    recentOk = true;
  } catch (err) {
    console.warn("[projectStorage] recent FIFO save failed (ignored)", err);
  }
  try {
    const uploaded = await uploadScaProjectToGallery({ project: cloudProject });
    galleryOk = Boolean(uploaded?.id);
  } catch (err) {
    console.warn("[projectStorage] gallery sca upload failed", err);
  }
  return { recentOk, galleryOk };
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
      depositToSpace4?: boolean;
      space4ThumbBlob?: Blob | null;
    }) => {
      const { recentOk, galleryOk, space4Ok } =
        await downloadImageAndRememberRecent({
          ...downloadOpts,
          recentNamespace: config?.recentNamespace,
          depositToSpace4: downloadOpts.depositToSpace4,
          space4ThumbBlob: downloadOpts.space4ThumbBlob,
          recentMax: storageLimits.scaCloud,
        });

      // recentOk is informational only — never drives error toasts.
      void recentOk;

      const space4Required = downloadOpts.depositToSpace4 === true;
      const space4Passed = !space4Required || space4Ok === true;
      const cloudOk = galleryOk && space4Passed;
      const anyCloudOk = galleryOk || space4Ok === true;

      if (cloudOk) {
        if (downloadOpts.successMessage) {
          showToast(downloadOpts.successMessage, "success");
        }
        return { recentOk, galleryOk, space4Ok };
      }

      if (anyCloudOk) {
        // One cloud path worked — treat as success for UX; log the other.
        if (downloadOpts.successMessage) {
          showToast(downloadOpts.successMessage, "success");
        } else {
          showToast("클라우드 백업이 완료됐습니다.", "success");
        }
        return { recentOk, galleryOk, space4Ok };
      }

      // True cloud failure only — never mention browser localStorage.
      showToast(
        "기기 파일은 저장됐습니다. 클라우드 백업은 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
        "info"
      );
      return { recentOk, galleryOk, space4Ok };
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
      void recentOk; // local recent failure is silent
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
