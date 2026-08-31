"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  buildStudioProject,
  readProjectFile,
  type StudioCanvasProjectV1,
} from "@/lib/canvas/projectFile";
import { createLayer, type TextLayer } from "@/lib/thumbnailStyles";
import { dispatchScaGalleryVault } from "@/lib/scaGalleryVaultUi";
import { isShareAbortError, shareWithFallback } from "@/lib/webShare";
import type { PrintCustomSize } from "@/lib/printWizardTypes";
import { useExportGate } from "@/lib/useExportGate";
import { useDownloadQuota } from "@/lib/useDownloadQuota";
import { projectStorageErrorMessage } from "@/lib/projectStorage";
import { useProjectStorage } from "@/lib/canvas/useProjectStorage";
import type { RecentProjectNamespace } from "@/lib/canvas/recentProjects";
import type { PhotoLookbookSnapshot } from "@/lib/photoLookbookProject";

type ShareModalState = {
  open: boolean;
  loading: boolean;
  previewUrl: string | null;
  file: File | null;
  error: string | null;
};

export type PrintWizardShareModalProps = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  previewUrl: string | null;
  title: string;
  description: string;
  /** Unique image URL when available; otherwise a short placeholder hint. */
  linkUrl: string;
  projectLabel?: string;
  sharing: boolean;
  copyBusy?: boolean;
  onNativeShare: () => void;
  onCopyLink: () => void;
  onDownloadImage: () => void;
};

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
  const [shareBusy, setShareBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const sharePrepGenRef = useRef(0);
  const [shareState, setShareState] = useState<ShareModalState>({
    open: false,
    loading: false,
    previewUrl: null,
    file: null,
    error: null,
  });
  /** Cached unique image URL for the current share modal session. */
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const isPhoto = recentNamespace === "screen_010";
  const depositSpace4 = depositToSpace4;

  const closeSharePreview = useCallback(() => {
    setSharedImageUrl(null);
    setCopyBusy(false);
    setShareState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        open: false,
        loading: false,
        previewUrl: null,
        file: null,
        error: null,
      };
    });
  }, []);

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
        deferCloudSync: true,
        deviceSavedMessage:
          quality === "ultra"
            ? "초고해상도 완성본·.sca를 기기에 저장했습니다. 클라우드 백업을 진행 중입니다."
            : quality === "high"
              ? "고화질 완성본·.sca를 기기에 저장했습니다. 클라우드 백업을 진행 중입니다."
              : "일반화질 완성본·.sca를 기기에 저장했습니다. 클라우드 백업을 진행 중입니다.",
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

  const openSharePreview = useCallback(() => {
    if (!requireSubscription()) return;
    dispatchScaGalleryVault({ action: "close" });
    setSharedImageUrl(null);
    setCopyBusy(false);
    setShareState((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        open: true,
        loading: true,
        previewUrl: null,
        file: null,
        error: null,
      };
    });
  }, [requireSubscription]);

  const uploadShareImage = useCallback(async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file, file.name || `share-${Date.now()}.png`);
    const res = await fetch("/api/share/image", { method: "POST", body: fd });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      url?: string;
      message?: string;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok || !data.url) {
      throw new Error(data?.message || data?.error || "upload_failed");
    }
    return data.url;
  }, []);

  useEffect(() => {
    if (!shareState.open || !shareState.loading) return;
    const gen = ++sharePrepGenRef.current;
    let cancelled = false;

    void (async () => {
      try {
        let blob: Blob | null = null;
        if (resolveExportImage) {
          try {
            blob = await resolveExportImage("high");
          } catch (err) {
            if (
              err instanceof Error &&
              (err.message === "nothing_to_export" || err.message === "no_page_selected")
            ) {
              blob = null;
            } else {
              throw err;
            }
          }
        }
        if (!blob) {
          if (!activeBg) {
            if (cancelled || gen !== sharePrepGenRef.current) return;
            setShareState((prev) => ({
              ...prev,
              loading: false,
              error: isPhoto
                ? "공유할 사진이 없습니다. 캔버스에 이미지를 올려 주세요."
                : "공유할 이미지가 없습니다. AI 배경을 생성하거나 업로드해 주세요.",
            }));
            return;
          }
          const res = await fetch(activeBg, { cache: "no-store" });
          if (!res.ok) throw new Error("fetch_failed");
          blob = await res.blob();
        }
        if (cancelled || gen !== sharePrepGenRef.current) return;
        const previewUrl = URL.createObjectURL(blob);
        const file = new File([blob], "print-smart-form.png", {
          type: blob.type || "image/png",
        });
        setShareState((prev) => ({
          ...prev,
          loading: false,
          previewUrl,
          file,
          error: null,
        }));
      } catch {
        if (cancelled || gen !== sharePrepGenRef.current) return;
        setShareState((prev) => ({
          ...prev,
          loading: false,
          error: "공유 미리보기를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBg, isPhoto, resolveExportImage, shareState.loading, shareState.open]);

  const runNativeShare = useCallback(async () => {
    if (!shareState.file) return;
    setShareBusy(true);
    try {
      let imageUrl = sharedImageUrl;
      if (!imageUrl) {
        try {
          imageUrl = await uploadShareImage(shareState.file);
          setSharedImageUrl(imageUrl);
        } catch {
          imageUrl = null;
        }
      }
      const result = await shareWithFallback({
        title: "AI 1분 인쇄물 뚝딱 생성기",
        text: "Studio Canvas AI에서 만든 인쇄물 미리보기입니다.",
        url: imageUrl || undefined,
        file: shareState.file,
      });
      if (result === "shared") {
        showToast("기기 공유 시트로 이미지를 공유했습니다.", "success");
        closeSharePreview();
      } else if (result === "copied") {
        if (imageUrl) {
          showToast("개별 이미지 고유 링크가 복사되었습니다!", "success");
        } else {
          showToast("공유가 지원되지 않아 대체 텍스트를 복사했습니다.", "info");
        }
      }
    } catch (err) {
      if (isShareAbortError(err)) return;
      showToast("공유에 실패했습니다.", "error");
    } finally {
      setShareBusy(false);
    }
  }, [
    closeSharePreview,
    shareState.file,
    sharedImageUrl,
    showToast,
    uploadShareImage,
  ]);

  const runCopyShareLink = useCallback(async () => {
    if (!shareState.file) {
      showToast("공유할 이미지가 아직 준비되지 않았습니다.", "info");
      return;
    }
    if (copyBusy) return;
    setCopyBusy(true);
    try {
      let imageUrl = sharedImageUrl;
      if (!imageUrl) {
        imageUrl = await uploadShareImage(shareState.file);
        setSharedImageUrl(imageUrl);
      }
      await navigator.clipboard.writeText(imageUrl);
      showToast("개별 이미지 고유 링크가 복사되었습니다!", "success");
    } catch {
      showToast(
        "개별 이미지 링크 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        "error"
      );
    } finally {
      setCopyBusy(false);
    }
  }, [copyBusy, shareState.file, sharedImageUrl, showToast, uploadShareImage]);

  const runDownloadShareImage = useCallback(() => {
    if (!shareState.file) return;
    const objectUrl = URL.createObjectURL(shareState.file);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = shareState.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    showToast("이미지를 저장했습니다.", "success");
  }, [shareState.file, showToast]);

  const shareModalProps: PrintWizardShareModalProps = {
    open: shareState.open,
    onClose: closeSharePreview,
    loading: shareState.loading,
    error: shareState.error,
    previewUrl: shareState.previewUrl,
    title: "AI 1분 인쇄물 뚝딱 생성기",
    description: "Studio Canvas AI에서 만든 인쇄물 미리보기입니다.",
    linkUrl:
      sharedImageUrl ||
      (shareState.loading
        ? "이미지 고유 링크 준비 중…"
        : "링크 복사 시 이 디자인의 고유 이미지 URL이 생성됩니다"),
    projectLabel: titlePreview?.trim() || undefined,
    sharing: shareBusy,
    copyBusy,
    onNativeShare: () => void runNativeShare(),
    onCopyLink: () => void runCopyShareLink(),
    onDownloadImage: runDownloadShareImage,
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
    sharePreview: openSharePreview,
    openSharePreview,
    shareModalProps,
    requireSubscription,
    premiumModal,
    openRecent,
  };
}
