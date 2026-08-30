"use client";

/**
 * Shared recent-project storage for Template Studio + Print Smart Form.
 * Download → PC files + localStorage FIFO drawer (max 10) + server gallery FIFO.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  downloadImageAndProjectLocally,
  stashPendingStudioProject,
  type StudioCanvasProjectV1,
} from "@/lib/canvas/projectFile";
import {
  pushRecentProject,
  type RecentProjectNamespace,
} from "@/lib/canvas/recentProjects";
import { uploadScaProjectToGallery } from "@/lib/scaGalleryProjects";
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
 * Download PNG + sealed `.sca` then push into the shared recent FIFO (max 10).
 * Caller must enforce subscription before invoking.
 */
export async function downloadImageAndRememberRecent(opts: {
  imageBlob: Blob;
  project: StudioCanvasProjectV1;
  baseName: string;
  imageExt?: "png" | "jpg";
  recentNamespace?: RecentProjectNamespace;
  /** Screen 26 — also deposit sealed .sca into Space 4 operator vault. */
  depositToSpace4?: boolean;
  /** Canvas composite blob for Space 4 admin preview thumbnail. */
  space4ThumbBlob?: Blob | null;
}): Promise<{ recentOk: boolean }> {
  const sealedProject = await downloadImageAndProjectLocally(opts);
  try {
    await pushRecentProject(sealedProject, opts.recentNamespace);
  } catch (err) {
    console.warn("[projectStorage] recent FIFO save failed", err);
    return { recentOk: false };
  }
  try {
    await uploadScaProjectToGallery({ project: sealedProject });
  } catch (err) {
    console.warn("[projectStorage] gallery sca upload failed", err);
  }
  if (opts.depositToSpace4) {
    try {
      const { depositProjectToSpace4 } = await import("@/lib/space4Client");
      await depositProjectToSpace4({
        project: sealedProject,
        source: "print-unified-editor-download",
        thumbBlob: opts.space4ThumbBlob ?? opts.imageBlob,
      });
    } catch (err) {
      console.warn("[projectStorage] Space 4 deposit failed", err);
    }
  }
  return { recentOk: true };
}

/** Save sealed .sca to local recent FIFO + server gallery (no PNG download). */
export async function rememberProjectInGallery(opts: {
  project: StudioCanvasProjectV1;
  recentNamespace?: RecentProjectNamespace;
}): Promise<{ recentOk: boolean; galleryOk: boolean }> {
  let recentOk = false;
  let galleryOk = false;
  try {
    await pushRecentProject(opts.project, opts.recentNamespace);
    recentOk = true;
  } catch (err) {
    console.warn("[projectStorage] recent FIFO save failed", err);
  }
  try {
    await uploadScaProjectToGallery({ project: opts.project });
    galleryOk = true;
  } catch (err) {
    console.warn("[projectStorage] gallery sca upload failed", err);
  }
  return { recentOk, galleryOk };
}

export type OpenRecentProjectResult = "applied" | "navigated";

/**
 * Restore on the current editor canvas only — never navigate to a sub-studio.
 */
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
  // No in-place handler: keep project stashed but do not redirect (SCREEN-007/008/010).
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
      const { recentOk } = await downloadImageAndRememberRecent({
        ...downloadOpts,
        recentNamespace: config?.recentNamespace,
        depositToSpace4: downloadOpts.depositToSpace4,
        space4ThumbBlob: downloadOpts.space4ThumbBlob,
      });
      if (!recentOk) {
        showToast(
          "파일은 저장됐지만 최근 목록 등록에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.",
          "info"
        );
        return { recentOk: false as const };
      }
      if (downloadOpts.successMessage) {
        showToast(downloadOpts.successMessage, "success");
      }
      return { recentOk: true as const };
    },
    [config?.recentNamespace, showToast]
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
      });
      if (!recentOk && !galleryOk) {
        showToast("갤러리 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        return { ok: false as const };
      }
      if (!recentOk || !galleryOk) {
        showToast(
          "일부 저장 경로에만 반영됐습니다. 브라우저 저장 공간을 확인해 주세요.",
          "info"
        );
        return { ok: true as const, partial: true as const };
      }
      return { ok: true as const, partial: false as const };
    },
    [config?.recentNamespace, showToast]
  );

  return {
    downloadAndRemember,
    saveToGallery,
    openRecent,
    studioPathForProject,
  };
}
