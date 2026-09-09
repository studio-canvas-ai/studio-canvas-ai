"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import ShortsHookFrameGrid from "@/components/ShortsHookFrameGrid";
import ShortsProjectToolbar from "@/components/ShortsProjectToolbar";
import ShortsVideoUpload from "@/components/ShortsVideoUpload";
import { extractShortsHookFrames } from "@/lib/shortsExtractClient";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import {
  sessionFromShortsProject,
  stashShortsProjectForStudio,
  type ShortsStudioProjectV1,
} from "@/lib/shortsProjectFile";
import { useShortsProjectStore } from "@/lib/shortsProjectStore";
import {
  saveShortsStudioSession,
  SHORTS_STUDIO_PATH,
} from "@/lib/shortsStudioSession";
import type { ShortsUploadPhase, ShortsVideoAsset } from "@/lib/shortsVideo";
import { isMobileGalleryVideoClient } from "@/lib/shortsClientPreview";

/**
 * ShortsThumbnailWorkspace — 영상/썸네일 스튜디오 (Screen 12).
 *
 * ---------------------------------------------------------------------------
 * PHASE MAP:
 * 1) ✅ Entry / routing
 * 2) ✅ 스마트폰 갤러리·PC 영상 업로드 → Cloudflare R2 (presigned PUT)
 * 3) ✅ AI 훅 프레임 자동 추출 (/api/shorts/extract-hooks)
 * 4) ✅ 하이브리드 듀얼 스튜디오 직행 (/shorts/studio full-page + session handoff)
 * ---------------------------------------------------------------------------
 */
export default function ShortsThumbnailWorkspace() {
  const { t } = useI18n();
  const router = useRouter();

  const [asset, setAsset] = useState<ShortsVideoAsset | null>(null);
  const [phase, setPhase] = useState<ShortsUploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const lastProgressRef = useRef(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hooks, setHooks] = useState<ShortsHookFrame[]>([]);
  const [selectedHook, setSelectedHook] = useState<ShortsHookFrame | null>(
    null
  );
  const [projectBusy, setProjectBusy] = useState(false);
  const navigatingRef = useRef(false);

  const handleAssetChange = useCallback((next: ShortsVideoAsset | null) => {
    setAsset(next);
    setHooks([]);
    setSelectedHook(null);
    if (next) {
      lastProgressRef.current = -1;
      setUploadProgress(0);
    }
  }, []);

  const handleUploadProgress = useCallback((pct: number) => {
    const step = isMobileGalleryVideoClient() ? 1 : 2;
    if (
      pct === 0 ||
      pct === 1 ||
      pct === 2 ||
      pct === 100 ||
      pct - lastProgressRef.current >= step ||
      lastProgressRef.current < 0
    ) {
      lastProgressRef.current = pct;
      setUploadProgress(pct);
    }
  }, []);

  const onStartHookExtract = useCallback(
    async (previewVideo?: HTMLVideoElement | null) => {
      if (!asset) return;
      setPhase("extracting");
      setErrorMessage(null);
      setHooks([]);
      setSelectedHook(null);
      try {
        const result = await extractShortsHookFrames(asset, { previewVideo });
        setHooks(result.hooks);
        setPhase("hooks_ready");
      } catch (err) {
        const raw = err instanceof Error ? err.message : "extract_failed";
        setPhase("ready");
        setErrorMessage(
          raw.includes("auth") ? t.shorts.errorAuth : t.shorts.errorExtract
        );
      }
    },
    [asset, t.shorts.errorAuth, t.shorts.errorExtract]
  );

  const onSelectHook = useCallback((frame: ShortsHookFrame) => {
    setSelectedHook(frame);
  }, []);

  const goToStudioWithHook = useCallback(
    (frame: ShortsHookFrame) => {
      if (!asset) return;
      void useShortsProjectStore.getState().hydrateFromAsset(asset);
      saveShortsStudioSession({
        videoId: asset.videoId,
        fileName: asset.fileName,
        sizeBytes: asset.sizeBytes,
        contentType: asset.contentType,
        storageKey: asset.storageKey,
        playbackUrl: asset.playbackUrl,
        videoUrl: asset.playbackUrl || asset.previewUrl || null,
        videoFileName: asset.fileName,
        storage: asset.storage,
        hook: frame,
      });
      router.push(SHORTS_STUDIO_PATH);
    },
    [asset, router]
  );

  const onManualFrameCaptured = useCallback(
    (frame: ShortsHookFrame) => {
      setHooks((prev) => {
        const rest = prev.filter((h) => !h.id.startsWith("manual_"));
        return [frame, ...rest];
      });
      setSelectedHook(frame);
      setPhase("hooks_ready");
      goToStudioWithHook(frame);
    },
    [goToStudioWithHook]
  );

  const onContinueToStudio = useCallback(() => {
    if (!asset || !selectedHook) return;
    goToStudioWithHook(selectedHook);
  }, [asset, goToStudioWithHook, selectedHook]);

  /** Load recent / .sca project → restore session + open Screen 13. */
  const onLoadShortsProject = useCallback(
    async (project: ShortsStudioProjectV1) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setProjectBusy(true);
      setErrorMessage(null);
      try {
        const nextSession = sessionFromShortsProject(project);
        saveShortsStudioSession(nextSession);
        stashShortsProjectForStudio(project);

        const videoUrl =
          project.media.videoUrl || project.media.playbackUrl || null;
        if (project.media.videoId || videoUrl) {
          await useShortsProjectStore.getState().hydrateFromAsset({
            videoId: project.media.videoId || nextSession.videoId,
            fileName:
              project.media.videoFileName ||
              project.media.fileName ||
              "shorts.mp4",
            sizeBytes: project.media.sizeBytes,
            contentType: project.media.contentType || "video/mp4",
            previewUrl: videoUrl || "",
            storageKey: project.media.storageKey,
            playbackUrl: project.media.playbackUrl || videoUrl,
            storage: project.media.storage || "local",
          });
        }

        if (project.edit.bgm.bgmUrl || project.edit.bgm.bgmName) {
          useShortsProjectStore.getState().setBgm({
            bgmUrl: project.edit.bgm.bgmUrl,
            bgmName: project.edit.bgm.bgmName,
            bgmVolume: project.edit.bgm.bgmVolume,
          });
        }

        router.push(SHORTS_STUDIO_PATH);
      } catch (err) {
        console.error("[shorts] load project from screen 12", err);
        setErrorMessage(t.shorts.projectLoadError);
        navigatingRef.current = false;
        setProjectBusy(false);
      }
    },
    [router, t.shorts.projectLoadError]
  );

  return (
    <section
      id="shorts-thumbnail"
      className="relative mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-12 lg:px-8"
      aria-labelledby="shorts-thumbnail-title"
    >
      <div className="ambient-glow -top-20 left-1/4 h-64 w-64 bg-glow-emerald/15" />
      <div className="ambient-glow top-1/3 -right-16 h-56 w-56 bg-glow-purple/10" />

      <div className="relative space-y-4 sm:space-y-8">
        <header className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/90 backdrop-blur-sm">
                <Clapperboard
                  className="h-3.5 w-3.5 text-glow-emerald"
                  aria-hidden
                />
                <span>{t.shorts.eyebrow}</span>
              </div>
              <h1
                id="shorts-thumbnail-title"
                className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl"
              >
                {t.shorts.title}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
                {t.shorts.subtitle}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1.5 sm:items-end">
              <ShortsProjectToolbar
                busy={projectBusy || phase === "extracting"}
                onLoadProject={onLoadShortsProject}
              />
              <p className="max-w-[16rem] text-center text-[10px] leading-snug text-white/80 sm:text-right">
                {t.shorts.projectRestoreHint}
              </p>
            </div>
          </div>
        </header>

        <ShortsVideoUpload
          asset={asset}
          phase={phase}
          uploadProgress={uploadProgress}
          errorMessage={errorMessage}
          onAssetChange={handleAssetChange}
          onPhaseChange={setPhase}
          onProgressChange={handleUploadProgress}
          onError={setErrorMessage}
          onStartHookExtract={(previewVideo) => {
            void onStartHookExtract(previewVideo);
          }}
          onManualFrameCaptured={onManualFrameCaptured}
        />

        {(phase === "hooks_ready" || hooks.length > 0) && (
          <ShortsHookFrameGrid
            hooks={hooks}
            selectedId={selectedHook?.id ?? null}
            onSelect={onSelectHook}
            onContinueToStudio={onContinueToStudio}
          />
        )}
      </div>
    </section>
  );
}
