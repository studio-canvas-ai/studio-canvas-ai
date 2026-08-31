"use client";

/**
 * Shared recent-project storage for Template Studio + Print Smart Form.
 * Download → device export + recent FIFO + gallery FIFO + optional Space4.
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
 * Local recent-drawer failures (e.g. QuotaExceededError) must NOT block
 * gallery or Template 4 / Space 4 deposition.
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
  /** Plan scaCloud cap for recent-files FIFO. */
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
    // Device: final export + editable .sca. Clouds still get .sca below.
    skipLocalProject: false,
  });

  let recentOk = false;
  let galleryOk = false;
  let space4Ok: boolean | null = opts.depositToSpace4 ? false : null;

  try {
    await pushRecentProject(
      sealedProject,
      opts.recentNamespace,
      opts.recentMax
    );
    recentOk = true;
  } catch (err) {
    console.warn("[projectStorage] recent FIFO save failed", err);
  }

  try {
    const uploaded = await uploadScaProjectToGallery({ project: sealedProject });
    galleryOk = Boolean(uploaded?.id);
  } catch (err) {
    console.warn("[projectStorage] gallery sca upload failed", err);
  }

  if (opts.depositToSpace4) {
    try {
      const { depositProjectToSpace4 } = await import("@/lib/space4Client");
      const deposited = await depositProjectToSpace4({
        project: sealedProject,
        source: "print-unified-editor-download",
        thumbBlob: opts.space4ThumbBlob ?? opts.imageBlob,
      });
      space4Ok = Boolean(deposited?.id);
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
  let recentOk = false;
  let galleryOk = false;
  try {
    await pushRecentProject(
      opts.project,
      opts.recentNamespace,
      opts.recentMax
    );
    recentOk = true;
  } catch (err) {
    console.warn("[projectStorage] recent FIFO save failed", err);
  }
  try {
    const uploaded = await uploadScaProjectToGallery({ project: opts.project });
    galleryOk = Boolean(uploaded?.id);
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

      const cloudOk =
        galleryOk && (space4Ok === null || space4Ok === true);
      const anyCloudOk = galleryOk || space4Ok === true;

      if (cloudOk && recentOk) {
        if (downloadOpts.successMessage) {
          showToast(downloadOpts.successMessage, "success");
        }
        return { recentOk: true as const, galleryOk, space4Ok };
      }

      if (cloudOk && !recentOk) {
        showToast(
          downloadOpts.successMessage
            ? `${downloadOpts.successMessage} (브라우저 최근 목록만 용량 부족으로 생략됨)`
            : "클라우드·템플릿 창고 저장은 완료됐습니다. 브라우저 최근 목록만 용량 부족으로 생략됐습니다.",
          "success"
        );
        return { recentOk: false as const, galleryOk, space4Ok };
      }

      if (anyCloudOk) {
        showToast(
          "일부 클라우드 저장만 반영됐습니다. 최근 목록·갤러리·템플릿 창고 상태를 확인해 주세요.",
          "info"
        );
        return { recentOk, galleryOk, space4Ok };
      }

      if (!recentOk) {
        showToast(
          "기기 파일은 저장됐지만 클라우드 동기화에 실패했습니다. 네트워크와 브라우저 저장 공간을 확인해 주세요.",
          "error"
        );
      } else {
        showToast(
          "기기·최근 목록은 저장됐지만 갤러리·템플릿 창고 동기화에 실패했습니다.",
          "error"
        );
      }
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
      if (!recentOk && !galleryOk) {
        showToast("갤러리 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", "error");
        return { ok: false as const };
      }
      if (galleryOk && !recentOk) {
        showToast(
          "내 갤러리에 저장됐습니다. 브라우저 최근 목록만 용량 부족으로 생략됐습니다.",
          "success"
        );
        return { ok: true as const, partial: true as const };
      }
      if (!galleryOk && recentOk) {
        showToast(
          "최근 목록에는 반영됐지만 내 갤러리 클라우드 저장에 실패했습니다.",
          "info"
        );
        return { ok: true as const, partial: true as const };
      }
      return { ok: true as const, partial: false as const };
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
