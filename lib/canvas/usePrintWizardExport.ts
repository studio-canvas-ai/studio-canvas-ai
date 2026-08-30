"use client";

import { useRef, useState } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  buildStudioProject,
  readProjectFile,
  type StudioCanvasProjectV1,
} from "@/lib/canvas/projectFile";
import { createLayer, type TextLayer } from "@/lib/thumbnailStyles";
import { shareWithFallback } from "@/lib/webShare";
import type { PrintCustomSize } from "@/lib/printWizardTypes";
import { useExportGate } from "@/lib/useExportGate";
import { useDownloadQuota } from "@/lib/useDownloadQuota";
import { projectStorageErrorMessage } from "@/lib/projectStorage";
import { useProjectStorage } from "@/lib/canvas/useProjectStorage";
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
  /** Real text layers for the active page (serialized into .sca). */
  overlayLayers?: TextLayer[];
  /** Photo lookbook / print: build image when bg plate and/or layers exist. */
  resolveExportImage?: (quality: "standard" | "high") => Promise<Blob>;
  /** Embed wizard + vaults into .sca for recent restore. */
  buildLookbookSnapshot?: () => PhotoLookbookSnapshot | null;
  /** Apply recent/.sca on the current wizard canvas (no studio redirect). */
  onApplyRecentProject?: (project: StudioCanvasProjectV1) => void;
  /** Screen 26 — deposit sealed .sca into Space 4 on download. */
  depositToSpace4?: boolean;
};

export function usePrintWizardExport({
  activeBg,
  customSize = null,
  aspect,
  titlePreview = "",
  studioPath,
  pendingProjectKey,
  recentNamespace,
  overlayLayers = [],
  resolveExportImage,
  buildLookbookSnapshot,
  onApplyRecentProject,
  depositToSpace4 = false,
}: UsePrintWizardExportArgs) {
  const { showToast } = useFeedback();
  const { requireSubscription, premiumModal } = useExportGate();
  const { spendForQuality, quotaEmptyMessage } = useDownloadQuota();
  const { downloadAndRemember, saveToGallery: persistToGallery, openRecent } = useProjectStorage({
    studioPath,
    pendingProjectKey,
    recentNamespace,
  });
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isPhoto = recentNamespace === "screen_010";
  const depositSpace4 = depositToSpace4;

  const buildStep2Project = () => {
    const snapshot = useCanvasStore.getState().getExportSnapshot();
    const titleLayer = createLayer({
      text: titlePreview || "",
      pos: "center",
    });
    const layers =
      overlayLayers.length > 0
        ? overlayLayers.map((l) => ({
            ...l,
            ranges: l.ranges?.map((r) => ({ ...r })) ?? [],
          }))
        : [titleLayer];
    const lookbook = buildLookbookSnapshot?.() ?? undefined;
    const project = buildStudioProject({
      mode: "agent",
      subjectUrl: "",
      backgroundUrl: activeBg,
      overlayLayers: layers,
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
    // Prefer lookbook background when activeBg was empty but wizard has plates.
    if (!project.studio.backgroundUrl && project.lookbook?.wizard) {
      const w = project.lookbook.wizard;
      project.studio.backgroundUrl =
        w.backgroundUrl ||
        w.backgroundUrls?.find((u) => typeof u === "string" && u.trim()) ||
        null;
    }
    return project;
  };

  const downloadWithProject = async (
    quality: "standard" | "high" | "ultra"
  ) => {
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      const exportQuality = quality === "standard" ? "standard" : "high";
      // Build the file first — only spend quota after we have a real blob.
      let imageBlob: Blob | null = null;
      if (resolveExportImage) {
        try {
          imageBlob = await resolveExportImage(exportQuality);
        } catch (err) {
          if (
            err instanceof Error &&
            err.message === "nothing_to_export"
          ) {
            showToast(
              isPhoto
                ? "먼저 학습/등록으로 캔버스에 사진을 올리거나 AI 변형을 완료해 주세요."
                : "먼저 AI 배경을 생성하거나 이미지를 업로드해 주세요.",
              "info"
            );
            return;
          }
          showToast("이미지 합성에 실패했습니다.", "error");
          return;
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

      const spent = await spendForQuality(quality);
      if (!spent.ok) {
        showToast(quotaEmptyMessage, "error");
        return;
      }

      const project = buildStep2Project();
      const baseName = isPhoto
        ? `lookbook-${quality}`
        : `print-smart-${quality}`;
      await downloadAndRemember({
        imageBlob,
        project,
        baseName,
        imageExt: quality === "standard" ? "jpg" : "png",
        depositToSpace4: depositSpace4,
        space4ThumbBlob: imageBlob,
        successMessage:
          quality === "ultra"
            ? "초고해상도 완성본을 기기에 저장하고, 수정용 .sca를 최근 파일·내 갤러리·템플릿 창고에 동기화했습니다."
            : quality === "high"
              ? "고화질 완성본을 기기에 저장하고, 수정용 .sca를 최근 파일·내 갤러리·템플릿 창고에 동기화했습니다."
              : "일반화질 완성본을 기기에 저장하고, 수정용 .sca를 최근 파일·내 갤러리·템플릿 창고에 동기화했습니다.",
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
      if (onApplyRecentProject) {
        onApplyRecentProject(project);
        showToast(
          "최근 수정파일을 불러와 편집 상태를 복원했습니다.",
          "success"
        );
        return;
      }
      showToast(
        "이 화면의 캔버스에 바로 적용할 수 없습니다. 다시 시도해 주세요.",
        "info"
      );
    } finally {
      setBusy(false);
    }
  };

  const sharePreview = async () => {
    if (!requireSubscription()) return;
    setBusy(true);
    try {
      let blob: Blob | null = null;
      if (resolveExportImage) {
        try {
          blob = await resolveExportImage("high");
        } catch {
          blob = null;
        }
      }
      if (!blob) {
        if (!activeBg) {
          showToast("공유할 이미지가 없습니다.", "info");
          return;
        }
        const res = await fetch(activeBg, { cache: "no-store" });
        blob = await res.blob();
      }
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

  const saveToGallery = async (options?: { silent?: boolean }) => {
    if (!requireSubscription()) return { ok: false as const };
    setBusy(true);
    try {
      const project = buildStep2Project();
      const result = await persistToGallery(project);
      if (result.ok) {
        if (!options?.silent) {
          showToast(
            isPhoto
              ? "내 갤러리에 저장되었습니다."
              : "내 갤러리에 저장되었습니다. 미니 보기·캔버스 작업 상태가 포함됩니다.",
            "success"
          );
        }
      }
      return result;
    } catch {
      if (!options?.silent) {
        showToast("갤러리 저장에 실패했습니다.", "error");
      }
      return { ok: false as const };
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    projectFileInputRef,
    downloadWithProject,
    saveToGallery,
    buildCurrentProject: buildStep2Project,
    loadProjectFile,
    loadProjectFromGallery,
    sharePreview,
    requireSubscription,
    premiumModal,
    openRecent,
  };
}
