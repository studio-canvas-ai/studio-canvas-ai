"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/FeedbackProvider";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  buildStudioProject,
  readProjectFile,
  stashPendingStudioProject,
  type StudioCanvasProjectV1,
} from "@/lib/canvas/projectFile";
import { createLayer } from "@/lib/thumbnailStyles";
import { shareWithFallback } from "@/lib/webShare";
import type { PrintCustomSize } from "@/lib/printWizardTypes";
import { useExportGate } from "@/lib/useExportGate";
import { projectStorageErrorMessage } from "@/lib/projectStorage";
import {
  studioPathForProject,
  useProjectStorage,
} from "@/lib/canvas/useProjectStorage";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import type { PhotoLookbookSnapshot } from "@/lib/photoLookbookProject";

export type UsePrintWizardExportArgs = {
  activeBg: string | null;
  customSize?: PrintCustomSize | null;
  aspect: number;
  titlePreview?: string;
  studioPath?: string;
  pendingProjectKey?: string;
  recentNamespace?: RecentProjectNamespace;
  /** Photo lookbook: build image when bg plate and/or layers exist. */
  resolveExportImage?: (quality: "standard" | "high") => Promise<Blob>;
  /** Embed wizard + vaults into .sca for recent restore. */
  buildLookbookSnapshot?: () => PhotoLookbookSnapshot | null;
};

export function usePrintWizardExport({
  activeBg,
  customSize = null,
  aspect,
  titlePreview = "",
  studioPath,
  pendingProjectKey,
  recentNamespace,
  resolveExportImage,
  buildLookbookSnapshot,
}: UsePrintWizardExportArgs) {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { requireSubscription, premiumModal } = useExportGate();
  const { downloadAndRemember, openRecent } = useProjectStorage({
    studioPath,
    pendingProjectKey,
    recentNamespace,
  });
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isPhoto = recentNamespace === "photo";

  const buildStep2Project = () => {
    const snapshot = useCanvasStore.getState().getExportSnapshot();
    const titleLayer = createLayer({
      text: titlePreview || "",
      pos: "center",
    });
    const lookbook = buildLookbookSnapshot?.() ?? undefined;
    return buildStudioProject({
      mode: "agent",
      subjectUrl: "",
      backgroundUrl: activeBg,
      overlayLayers: [titleLayer],
      aspectRatio: `${aspect}`,
      customPrint: customSize
        ? {
            unit: customSize.unit,
            width: customSize.width,
            height: customSize.height,
          }
        : null,
      naturalSize: {
        w: snapshot.meta.width,
        h: snapshot.meta.height,
      },
      canvas: snapshot,
      lookbook: lookbook || undefined,
    });
  };

  const downloadWithProject = async (quality: "standard" | "high") => {
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      let imageBlob: Blob | null = null;
      if (resolveExportImage) {
        try {
          imageBlob = await resolveExportImage(quality);
        } catch {
          imageBlob = null;
        }
      }
      if (!imageBlob) {
        if (!activeBg) {
          showToast(
            isPhoto
              ? "먼저 학습/등록으로 캔버스에 사진을 올리거나 AI 변형을 완료해 주세요."
              : "먼저 AI 배경을 생성하거나 이미지를 업로드해 주세요.",
            "info"
          );
          return;
        }
        const res = await fetch(activeBg, { cache: "no-store" });
        if (!res.ok) throw new Error("fetch_failed");
        imageBlob = await res.blob();
        if (quality === "standard" && typeof createImageBitmap === "function") {
          try {
            const bmp = await createImageBitmap(imageBlob);
            const canvas = document.createElement("canvas");
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(bmp, 0, 0);
              const jpeg = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
              );
              if (jpeg) imageBlob = jpeg;
            }
          } catch {
            /* keep original blob */
          }
        }
      }
      const project = buildStep2Project();
      const baseName = isPhoto
        ? `lookbook-${quality}`
        : `print-smart-${quality}`;
      await downloadAndRemember({
        imageBlob,
        project,
        baseName,
        imageExt: quality === "high" ? "png" : "jpg",
        successMessage:
          quality === "high"
            ? "고화질 파일 + 수정용 상태파일(.sca)을 저장하고 최근 목록에 등록했습니다."
            : "일반화질 파일 + 수정용 상태파일(.sca)을 저장하고 최근 목록에 등록했습니다.",
      });
    } catch {
      showToast("다운로드에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadProjectFile = async (file: File | null) => {
    if (!file) return;
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      const project = await readProjectFile(file);
      loadProjectFromGallery(project);
    } catch (err) {
      showToast(projectStorageErrorMessage(err), "error");
    } finally {
      setBusy(false);
      if (projectFileInputRef.current) projectFileInputRef.current.value = "";
    }
  };

  const loadProjectFromGallery = (project: StudioCanvasProjectV1) => {
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      const path = studioPathForProject(project);
      stashPendingStudioProject(project, pendingProjectKey);
      showToast("수정파일을 불러왔습니다. 스튜디오로 이동합니다.", "success");
      router.push(studioPath || path);
    } finally {
      setBusy(false);
    }
  };

  const sharePreview = async () => {
    if (!requireSubscription()) return;
    if (!activeBg) {
      showToast("공유할 이미지가 없습니다.", "info");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(activeBg, { cache: "no-store" });
      const blob = await res.blob();
      const file = new File([blob], "print-smart-form.png", {
        type: blob.type || "image/png",
      });
      const result = await shareWithFallback({
        title: "AI 1분 인쇄물 뚝딱 생성기",
        text: "Studio Canvas AI에서 만든 인쇄물 미리보기입니다.",
        file,
      });
      if (result === "shared") {
        showToast("기기 공유 시트로 이미지를 공유했습니다.", "success");
      } else if (result === "copied") {
        showToast("공유가 지원되지 않아 링크/텍스트를 복사했습니다.", "info");
      }
    } catch {
      showToast("공유가 취소되었거나 실패했습니다.", "info");
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    projectFileInputRef,
    downloadWithProject,
    loadProjectFile,
    loadProjectFromGallery,
    sharePreview,
    requireSubscription,
    premiumModal,
    openRecent,
  };
}
