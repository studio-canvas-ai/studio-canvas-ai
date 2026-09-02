"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Camera,
  Clapperboard,
  Loader2,
  Smartphone,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { captureCurrentVideoFrame, captureQuickPosterFromBlob } from "@/lib/shortsCaptureFrames";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import {
  uploadShortsVideoFile,
  logR2UploadDetailError,
  formatShortsUploadErrorForDisplay,
} from "@/lib/shortsUploadClient";
import { extractShortsHookFrames } from "@/lib/shortsExtractClient";
import {
  generateClientVideoPreview,
  isMobileGalleryVideoClient,
} from "@/lib/shortsClientPreview";
import {
  requestPreviewTranscode,
  requestQuickPoster,
} from "@/lib/shortsQuickPosterClient";
import { useShortsProjectStore } from "@/lib/shortsProjectStore";
import { persistShortsVideoBlob } from "@/lib/shortsVideoIdb";
import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  SHORTS_VIDEO_ACCEPT,
  createOptimisticShortsVideoAsset,
  formatBytes,
  type ShortsUploadPhase,
  type ShortsVideoAsset,
} from "@/lib/shortsVideo";
import { saveAuthNextPath } from "@/lib/supabase/oauth";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";

/** WASM transcode only for small clips — 57MB HEVC OOMs on phones. */
const CLIENT_WASM_MAX_BYTES = 15 * 1024 * 1024;

type Props = {
  asset: ShortsVideoAsset | null;
  phase: ShortsUploadPhase;
  uploadProgress: number;
  errorMessage: string | null;
  onAssetChange: (asset: ShortsVideoAsset | null) => void;
  onPhaseChange: (phase: ShortsUploadPhase) => void;
  onProgressChange: (pct: number) => void;
  onError: (message: string | null) => void;
  onStartHookExtract: (previewVideo?: HTMLVideoElement | null) => void;
  /** Manual still from the preview player → Screen 13 thumbnail. */
  onManualFrameCaptured?: (frame: ShortsHookFrame) => void | Promise<void>;
};

/**
 * Phase-2 Shorts video dropzone + R2 upload + preview.
 * Next: wire onStartHookExtract → AI hook-frame API (phase 3).
 */
export default function ShortsVideoUpload({
  asset,
  phase,
  uploadProgress,
  errorMessage,
  onAssetChange,
  onPhaseChange,
  onProgressChange,
  onError,
  onStartHookExtract,
  onManualFrameCaptured,
}: Props) {
  const { t, locale } = useI18n();
  const { isAuthenticated, openAuthModal, signOutUser } = useCredits();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localFileRef = useRef<File | null>(null);
  const previewRecoverAttemptRef = useRef(0);
  const backgroundUploadRef = useRef<AbortController | null>(null);
  const clientPreviewRef = useRef<AbortController | null>(null);
  const clientBlobUrlsRef = useRef<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [videoPlayError, setVideoPlayError] = useState(false);
  const [serverPosterUrl, setServerPosterUrl] = useState<string | null>(null);
  const [serverPosterLoading, setServerPosterLoading] = useState(false);
  const [clientPreviewLoading, setClientPreviewLoading] = useState(false);
  const [clientPreviewPct, setClientPreviewPct] = useState(0);
  const videoPlayErrorRef = useRef(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const cloudSyncing =
    Boolean(asset) &&
    uploadProgress < 100 &&
    phase !== "error" &&
    !cloudSyncError;

  useEffect(() => {
    if (!asset) {
      setVideoSrc(null);
      setVideoPlayError(false);
      return;
    }
    if (isMobileGalleryVideoClient()) return;
    setVideoPlayError(false);
    setVideoSrc(asset.previewUrl || asset.playbackUrl || null);
  }, [asset?.videoId, asset?.previewUrl, asset?.playbackUrl]);

  const revokeClientPreviewBlobs = useCallback(() => {
    for (const url of clientBlobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    clientBlobUrlsRef.current = [];
  }, []);

  const startQuickPreview = useCallback((file: File, previewBlobUrl?: string | null) => {
    clientPreviewRef.current?.abort();
    const ac = new AbortController();
    clientPreviewRef.current = ac;
    setClientPreviewLoading(true);
    setClientPreviewPct(0);
    setServerPosterUrl(null);
    setVideoPlayError(false);
    videoPlayErrorRef.current = false;

    let posterReady = false;
    const markPosterReady = (url: string) => {
      posterReady = true;
      setServerPosterUrl(url);
      setClientPreviewLoading(false);
      setVideoPlayError(false);
      videoPlayErrorRef.current = false;
    };

    const finishLoading = () => {
      if (!ac.signal.aborted && !posterReady) {
        setClientPreviewLoading(false);
      }
    };

    if (previewBlobUrl) {
      void captureQuickPosterFromBlob(previewBlobUrl, { signal: ac.signal })
        .then((posterUrl) => {
          if (ac.signal.aborted || !posterUrl || posterReady) return;
          markPosterReady(posterUrl);
        })
        .catch(() => undefined);
    }

    void requestQuickPoster(file, { signal: ac.signal })
      .then((posterUrl) => {
        if (ac.signal.aborted || !posterUrl || posterReady) return;
        markPosterReady(posterUrl);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        console.warn("[shorts] quick poster failed", err);
      })
      .finally(finishLoading);

    if (file.size <= CLIENT_WASM_MAX_BYTES) {
      void generateClientVideoPreview(file, {
        signal: ac.signal,
        onProgress: ({ ratio }) => setClientPreviewPct(ratio),
      })
        .then(({ posterUrl, playableUrl }) => {
          if (ac.signal.aborted) return;
          if (posterUrl && !posterReady) {
            clientBlobUrlsRef.current.push(posterUrl);
            markPosterReady(posterUrl);
          }
          if (playableUrl) {
            clientBlobUrlsRef.current.push(playableUrl);
            setVideoSrc(playableUrl);
            setVideoPlayError(false);
            videoPlayErrorRef.current = false;
          }
        })
        .catch((err) => {
          if (ac.signal.aborted) return;
          console.warn("[shorts] wasm preview failed", err);
        })
        .finally(finishLoading);
    }
  }, []);

  const recoverVideoPreview = useCallback(async () => {
    const file = localFileRef.current;
    if (!file || !asset) return;
    if (previewRecoverAttemptRef.current >= 1) {
      startQuickPreview(file);
      return;
    }
    previewRecoverAttemptRef.current += 1;
    startQuickPreview(file);
  }, [asset, startQuickPreview]);

  const startBackgroundUpload = useCallback(
    (file: File, localAsset: ShortsVideoAsset, ac: AbortController) => {
      void uploadShortsVideoFile(file, {
        signal: ac.signal,
        videoId: localAsset.videoId,
        previewUrl: localAsset.previewUrl,
        onProgress: onProgressChange,
      })
        .then(async (cloud) => {
          if (ac.signal.aborted) return;
          onAssetChange({
            ...cloud,
            previewUrl: localAsset.previewUrl,
          });
          onProgressChange(100);
          setCloudSyncError(null);

          if (cloud.storage === "r2" && cloud.storageKey) {
            setServerPosterLoading(true);
            try {
              let gotPlayable = false;

              if (isMobileGalleryVideoClient()) {
                const tx = await requestPreviewTranscode({
                  videoId: cloud.videoId,
                  key: cloud.storageKey,
                });
                if (tx.playbackUrl) {
                  gotPlayable = true;
                  setVideoSrc(tx.playbackUrl);
                  setVideoPlayError(false);
                  videoPlayErrorRef.current = false;
                }
                if (tx.posterDataUrl) {
                  setServerPosterUrl((prev) => prev ?? tx.posterDataUrl);
                }
              }

              if (!gotPlayable) {
                const result = await extractShortsHookFrames({
                  ...cloud,
                  previewUrl: localAsset.previewUrl,
                });
                const poster = result.hooks[0]?.imageUrl;
                if (poster) {
                  setServerPosterUrl((prev) => prev ?? poster);
                  setVideoPlayError(false);
                  videoPlayErrorRef.current = false;
                }
              }
            } catch (posterErr) {
              console.warn("[shorts/upload] server preview failed", posterErr);
            } finally {
              setServerPosterLoading(false);
            }
          }
        })
        .catch((err) => {
          if (ac.signal.aborted) return;
          logR2UploadDetailError(err, { phase: "shorts_background_upload" });
          setCloudSyncError(formatShortsUploadErrorForDisplay(err));
        });
    },
    [onAssetChange, onProgressChange]
  );

  const retryCloudSync = useCallback(() => {
    const file = localFileRef.current;
    if (!asset || !file) return;
    backgroundUploadRef.current?.abort();
    const ac = new AbortController();
    backgroundUploadRef.current = ac;
    setCloudSyncError(null);
    onProgressChange(0);
    startBackgroundUpload(file, asset, ac);
  }, [asset, onProgressChange, startBackgroundUpload]);
  const busy = phase === "extracting" || capturing;

  useEffect(() => {
    return () => {
      if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    };
    // Only revoke on unmount of current asset identity — handled in clear/replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAsset = useCallback(() => {
    backgroundUploadRef.current?.abort();
    backgroundUploadRef.current = null;
    clientPreviewRef.current?.abort();
    clientPreviewRef.current = null;
    revokeClientPreviewBlobs();
    localFileRef.current = null;
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    void useShortsProjectStore.getState().clearProject();
    onAssetChange(null);
    onPhaseChange("idle");
    onProgressChange(0);
    onError(null);
    setCloudSyncError(null);
    setVideoPlayError(false);
    videoPlayErrorRef.current = false;
    setServerPosterUrl(null);
    setServerPosterLoading(false);
    setVideoSrc(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [asset, onAssetChange, onPhaseChange, onProgressChange, onError, revokeClientPreviewBlobs]);

  const processFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file || busy) return;

      if (!isAuthenticated) {
        saveAuthNextPath(SHORTS_THUMBNAIL_PATH);
        openAuthModal({ clearPending: true });
        onError(t.shorts.errorAuth);
        return;
      }

      const optimistic = createOptimisticShortsVideoAsset(file);
      if (!optimistic.ok) {
        onPhaseChange("error");
        onError(
          optimistic.error === "file_too_large"
            ? t.shorts.errorTooLarge.replace(
                "{max}",
                formatBytes(optimistic.maxBytes ?? DEFAULT_SHORTS_MAX_VIDEO_BYTES, locale)
              )
            : t.shorts.errorType
        );
        return;
      }

      backgroundUploadRef.current?.abort();
      const ac = new AbortController();
      backgroundUploadRef.current = ac;

      onError(null);
      setCloudSyncError(null);
      setVideoPlayError(false);
      videoPlayErrorRef.current = false;
      setServerPosterUrl(null);
      setClientPreviewLoading(false);
      setClientPreviewPct(0);
      revokeClientPreviewBlobs();
      onProgressChange(0);

      if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
      const localAsset = optimistic.asset;
      localFileRef.current = file;
      previewRecoverAttemptRef.current = 0;
      onAssetChange(localAsset);
      onPhaseChange("ready");

      if (isMobileGalleryVideoClient()) {
        setVideoSrc(null);
        setVideoPlayError(false);
        videoPlayErrorRef.current = false;
        startQuickPreview(file, localAsset.previewUrl);
        window.setTimeout(() => {
          if (!ac.signal.aborted) {
            startBackgroundUpload(file, localAsset, ac);
          }
        }, 1800);
      } else {
        setVideoSrc(localAsset.previewUrl);
        startBackgroundUpload(file, localAsset, ac);
      }

      void persistShortsVideoBlob(localAsset.videoId, file, {
        fileName: localAsset.fileName,
        contentType: localAsset.contentType,
      }).catch((persistErr) => {
        console.warn("[shorts/upload] idb persist", persistErr);
      });
      void useShortsProjectStore.getState().hydrateFromAsset(localAsset, file);
    },
    [
      asset,
      busy,
      isAuthenticated,
      locale,
      onAssetChange,
      onError,
      onPhaseChange,
      onProgressChange,
      openAuthModal,
      startBackgroundUpload,
      startQuickPreview,
      t.shorts.errorAuth,
      t.shorts.errorTooLarge,
      t.shorts.errorType,
    ]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    void processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    void processFile(file);
  };

  const captureManualFrame = useCallback(async () => {
    if (!asset || !onManualFrameCaptured || capturing) return;
    const video = videoRef.current;
    setCapturing(true);
    onError(null);
    try {
      if (video && videoSrc && !videoPlayError) {
        const { blob, timestampSec } = await captureCurrentVideoFrame(video);
        const imageUrl = URL.createObjectURL(blob);
        const frame: ShortsHookFrame = {
          id: `manual_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          index: 0,
          timestampSec,
          score: 1,
          imageUrl,
          storageKey: null,
        };
        await onManualFrameCaptured(frame);
        return;
      }

      if (serverPosterUrl) {
        const frame: ShortsHookFrame = {
          id: `manual_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          index: 0,
          timestampSec: 0,
          score: 1,
          imageUrl: serverPosterUrl,
          storageKey: null,
        };
        await onManualFrameCaptured(frame);
        return;
      }

      onError(t.shorts.manualCaptureError);
    } catch (err) {
      console.error("[shorts] manual capture", err);
      onError(t.shorts.manualCaptureError);
    } finally {
      setCapturing(false);
    }
  }, [
    asset,
    capturing,
    onError,
    onManualFrameCaptured,
    serverPosterUrl,
    t.shorts.manualCaptureError,
    videoPlayError,
    videoSrc,
  ]);

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={SHORTS_VIDEO_ACCEPT}
        capture={undefined}
        className="sr-only"
        disabled={busy}
        onChange={onInputChange}
      />

      {!asset && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => !busy && inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
          className={`glass-card relative cursor-pointer overflow-hidden rounded-2xl border border-dashed px-5 py-10 text-center transition sm:px-8 sm:py-14 ${
            dragOver
              ? "border-glow-emerald/60 bg-glow-emerald/5"
              : "border-white/15 hover:border-white/30"
          } ${busy ? "pointer-events-none opacity-70" : ""}`}
          aria-label={t.shorts.pickVideo}
        >
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              <Smartphone className="h-7 w-7 text-glow-violet" aria-hidden />
            </div>
            <p className="text-sm font-medium text-white/85 sm:text-base">
              {t.shorts.pickVideo}
            </p>
            <p className="text-xs leading-relaxed text-white/85 sm:text-sm">
              {t.shorts.dropHint}
            </p>
            <span className="btn-primary pointer-events-none inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Upload className="h-4 w-4" aria-hidden />
              {t.shorts.pickVideoCta}
            </span>
            <p className="text-[11px] text-white/75">
              {t.shorts.sizeHint.replace(
                "{max}",
                formatBytes(DEFAULT_SHORTS_MAX_VIDEO_BYTES, locale)
              )}
            </p>
          </div>
        </div>
      )}

      {asset && (
        <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-glow-emerald"
                  aria-hidden
                />
                <span className="truncate">{asset.fileName}</span>
              </div>
              <p className="text-xs text-white/85">
                {formatBytes(asset.sizeBytes, locale)}
                {" · "}
                {asset.contentType}
                {" · "}
                {cloudSyncing
                  ? t.shorts.cloudSyncing
                  : asset.storage === "local"
                    ? t.shorts.storageEditingLocal
                    : asset.storage === "r2"
                      ? t.shorts.storageR2
                      : t.shorts.storageLocal}
              </p>
            </div>
            <button
              type="button"
              onClick={clearAsset}
              disabled={busy}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/5 hover:text-white"
              aria-label={t.shorts.clearVideo}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
              {videoSrc && !videoPlayError ? (
                <video
                  ref={videoRef}
                  key={`${asset.videoId}_${videoSrc}`}
                  src={videoSrc}
                  crossOrigin={
                    videoSrc.startsWith("blob:") ? undefined : "anonymous"
                  }
                  controls
                  playsInline
                  preload="auto"
                  className="mx-auto max-h-[min(60vh,420px)] w-full bg-black object-contain"
                  onLoadedData={() => setVideoPlayError(false)}
                  onError={() => {
                    setVideoPlayError(true);
                    videoPlayErrorRef.current = true;
                    const file = localFileRef.current;
                    if (file && !clientPreviewLoading) {
                      startQuickPreview(file, asset.previewUrl);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    void captureManualFrame();
                  }}
                  title={t.shorts.manualCaptureHint}
                />
              ) : serverPosterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={serverPosterUrl}
                  alt=""
                  className="mx-auto max-h-[min(60vh,420px)] w-full bg-black object-contain"
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    void captureManualFrame();
                  }}
                  title={t.shorts.manualCaptureHint}
                />
              ) : (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-4 py-10 text-center sm:min-h-[280px]">
                  <Clapperboard className="h-10 w-10 text-white/40" aria-hidden />
                  <p className="text-sm font-medium text-white/85">
                    {clientPreviewLoading
                      ? t.shorts.clientPreviewPreparing
                      : cloudSyncing
                        ? t.shorts.cloudSyncing
                        : t.shorts.clientPreviewPreparing}
                  </p>
                </div>
              )}
              {(clientPreviewLoading || (!serverPosterUrl && !videoSrc && cloudSyncing)) &&
                !serverPosterUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden />
                  <p className="px-4 text-center text-[11px] text-white/85">
                    {`${t.shorts.clientPreviewPreparing} ${clientPreviewPct > 0 ? `· ${clientPreviewPct}%` : ""}`}
                  </p>
                </div>
              )}
              {serverPosterLoading && serverPosterUrl && !videoSrc && (
                <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/70 px-2 py-1.5 text-center text-[10px] text-white/85">
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />
                  {t.shorts.serverPosterLoading}
                </div>
              )}
              {serverPosterLoading && !serverPosterUrl && !clientPreviewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden />
                  <p className="px-4 text-center text-[11px] text-white/85">
                    {t.shorts.serverPosterLoading}
                  </p>
                </div>
              )}
            </div>
            {videoPlayError &&
            !serverPosterUrl &&
            !videoSrc &&
            !clientPreviewLoading &&
            !serverPosterLoading &&
            !(cloudSyncing && uploadProgress < 100) ? (
              <p className="text-center text-[11px] text-amber-200/90">
                {t.shorts.videoPreviewError}
              </p>
            ) : null}
            <p className="text-center text-[11px] text-white/80">
              {t.shorts.manualCaptureHint}
            </p>
          </div>

          {cloudSyncing && (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-glow-emerald transition-[width] duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-[11px] text-white/80">
                {t.shorts.cloudSyncing} · {uploadProgress}%
              </p>
            </div>
          )}

          {cloudSyncError && (
            <div
              className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
              role="status"
            >
              {cloudSyncError}
              <p className="mt-1 text-[11px] text-amber-100/80">
                {t.shorts.cloudSyncFailed}
              </p>
              <button
                type="button"
                onClick={retryCloudSync}
                className="mt-2 rounded-lg border border-amber-300/40 px-3 py-1.5 text-[11px] font-medium text-amber-50 hover:bg-amber-500/20"
              >
                {t.shorts.cloudSyncRetry}
              </button>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy || !onManualFrameCaptured}
              onClick={() => void captureManualFrame()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-60"
            >
              {capturing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-5 w-5" aria-hidden />
              )}
              <span>
                {capturing
                  ? t.shorts.manualCapturing
                  : t.shorts.manualCaptureCta}
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStartHookExtract(videoRef.current)}
              className="btn-primary flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:text-base disabled:opacity-60"
            >
              {phase === "extracting" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-5 w-5" aria-hidden />
              )}
              <span className="whitespace-pre-line text-center leading-tight">
                {phase === "extracting"
                  ? t.shorts.extracting
                  : phase === "hooks_ready"
                    ? t.shorts.reExtract
                    : t.shorts.startHookExtract}
              </span>
            </button>
          </div>

          {phase === "extracting" && (
            <p className="text-center text-xs text-white/85">
              {t.shorts.extractPending}
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <div
          className="whitespace-pre-wrap break-words rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-left text-xs text-red-200 sm:text-sm"
          role="alert"
        >
          <p>{errorMessage}</p>
          {errorMessage.includes("로그인") ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  saveAuthNextPath(SHORTS_THUMBNAIL_PATH);
                  openAuthModal({ clearPending: true });
                }}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/20"
              >
                다시 로그인
              </button>
              <button
                type="button"
                onClick={() => void signOutUser().then(() => onError(null))}
                className="rounded-lg border border-red-400/40 px-3 py-1.5 text-[11px] font-medium text-red-100 hover:bg-red-500/20"
              >
                로그아웃
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
