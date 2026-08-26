"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Camera,
  Loader2,
  Smartphone,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { captureCurrentVideoFrame } from "@/lib/shortsCaptureFrames";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import { uploadShortsVideoFile } from "@/lib/shortsUploadClient";
import { useShortsProjectStore } from "@/lib/shortsProjectStore";
import { persistShortsVideoBlob } from "@/lib/shortsVideoIdb";
import {
  DEFAULT_SHORTS_MAX_VIDEO_BYTES,
  SHORTS_VIDEO_ACCEPT,
  formatBytes,
  type ShortsUploadPhase,
  type ShortsVideoAsset,
} from "@/lib/shortsVideo";
import { saveAuthNextPath } from "@/lib/supabase/oauth";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";

type Props = {
  asset: ShortsVideoAsset | null;
  phase: ShortsUploadPhase;
  uploadProgress: number;
  errorMessage: string | null;
  onAssetChange: (asset: ShortsVideoAsset | null) => void;
  onPhaseChange: (phase: ShortsUploadPhase) => void;
  onProgressChange: (pct: number) => void;
  onError: (message: string | null) => void;
  onStartHookExtract: () => void;
  /** Manual still from the preview player → Screen 13 thumbnail. */
  onManualFrameCaptured?: (frame: ShortsHookFrame) => void | Promise<void>;
};

function mapUploadError(code: string, t: ReturnType<typeof useI18n>["t"]): string {
  switch (code) {
    case "authentication required":
    case "terms_required":
      return t.shorts.errorAuth;
    case "file_too_large":
      return t.shorts.errorTooLarge.replace(
        "{max}",
        formatBytes(DEFAULT_SHORTS_MAX_VIDEO_BYTES)
      );
    case "unsupported_type":
    case "empty_file":
      return t.shorts.errorType;
    case "rate_limited":
      return t.shorts.errorRateLimit;
    default:
      if (code.includes("r2_put") || code.includes("CORS")) {
        return t.shorts.errorR2;
      }
      return t.shorts.errorGeneric;
  }
}

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
  const { isAuthenticated, openAuthModal } = useCredits();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const busy = phase === "uploading" || phase === "extracting" || capturing;

  useEffect(() => {
    return () => {
      if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    };
    // Only revoke on unmount of current asset identity — handled in clear/replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAsset = useCallback(() => {
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    void useShortsProjectStore.getState().clearProject();
    onAssetChange(null);
    onPhaseChange("idle");
    onProgressChange(0);
    onError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [asset, onAssetChange, onPhaseChange, onProgressChange, onError]);

  const processFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file || busy) return;

      if (!isAuthenticated) {
        saveAuthNextPath(SHORTS_THUMBNAIL_PATH);
        openAuthModal({ clearPending: true });
        onError(t.shorts.errorAuth);
        return;
      }

      onError(null);
      onPhaseChange("uploading");
      onProgressChange(0);

      try {
        const next = await uploadShortsVideoFile(file, {
          onProgress: onProgressChange,
        });
        try {
          await persistShortsVideoBlob(next.videoId, file, {
            fileName: next.fileName,
            contentType: next.contentType,
          });
          await useShortsProjectStore.getState().hydrateFromAsset(next, file);
        } catch (persistErr) {
          console.warn("[shorts/upload] persist for studio mix", persistErr);
        }
        if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
        onAssetChange(next);
        onPhaseChange("ready");
        onProgressChange(100);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "upload_failed";
        onPhaseChange("error");
        onError(mapUploadError(raw, t));
      }
    },
    [
      asset,
      busy,
      isAuthenticated,
      onAssetChange,
      onError,
      onPhaseChange,
      onProgressChange,
      openAuthModal,
      t,
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
    if (!video) {
      onError(t.shorts.manualCaptureError);
      return;
    }
    setCapturing(true);
    onError(null);
    try {
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
    t.shorts.manualCaptureError,
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
              {phase === "uploading" ? (
                <Loader2
                  className="h-7 w-7 animate-spin text-glow-emerald"
                  aria-hidden
                />
              ) : (
                <Smartphone className="h-7 w-7 text-glow-violet" aria-hidden />
              )}
            </div>
            <p className="text-sm font-medium text-white/85 sm:text-base">
              {phase === "uploading"
                ? t.shorts.uploading
                : t.shorts.pickVideo}
            </p>
            <p className="text-xs leading-relaxed text-white/45 sm:text-sm">
              {t.shorts.dropHint}
            </p>
            <span className="btn-primary pointer-events-none inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Upload className="h-4 w-4" aria-hidden />
              {t.shorts.pickVideoCta}
            </span>
            <p className="text-[11px] text-white/35">
              {t.shorts.sizeHint.replace(
                "{max}",
                formatBytes(DEFAULT_SHORTS_MAX_VIDEO_BYTES, locale)
              )}
            </p>
          </div>

          {phase === "uploading" && (
            <div className="absolute inset-x-6 bottom-5 sm:inset-x-10">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-glow-emerald transition-[width] duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-center text-[11px] text-white/50">
                {uploadProgress}%
              </p>
            </div>
          )}
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
              <p className="text-xs text-white/45">
                {formatBytes(asset.sizeBytes, locale)}
                {" · "}
                {asset.contentType}
                {" · "}
                {asset.storage === "r2"
                  ? t.shorts.storageR2
                  : t.shorts.storageLocal}
              </p>
            </div>
            <button
              type="button"
              onClick={clearAsset}
              disabled={busy}
              className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
              aria-label={t.shorts.clearVideo}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
              <video
                ref={videoRef}
                key={asset.previewUrl || asset.playbackUrl || asset.videoId}
                src={asset.previewUrl || asset.playbackUrl || undefined}
                crossOrigin={
                  (asset.previewUrl || asset.playbackUrl || "").startsWith(
                    "blob:"
                  )
                    ? undefined
                    : "anonymous"
                }
                controls
                playsInline
                preload="metadata"
                className="mx-auto max-h-[min(60vh,420px)] w-full bg-black object-contain"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  void captureManualFrame();
                }}
                title={t.shorts.manualCaptureHint}
              />
            </div>
            <p className="text-center text-[11px] text-white/40">
              {t.shorts.manualCaptureHint}
            </p>
          </div>

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
              onClick={onStartHookExtract}
              className="btn-primary flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:text-base disabled:opacity-60"
            >
              {phase === "extracting" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-5 w-5" aria-hidden />
              )}
              <span>
                {phase === "extracting"
                  ? t.shorts.extracting
                  : phase === "hooks_ready"
                    ? t.shorts.reExtract
                    : t.shorts.startHookExtract}
              </span>
            </button>
          </div>

          {phase === "extracting" && (
            <p className="text-center text-xs text-white/45">
              {t.shorts.extractPending}
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <p
          className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-xs text-red-200 sm:text-sm"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
