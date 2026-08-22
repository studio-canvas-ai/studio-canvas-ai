"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Film, Smartphone, Type } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import ShortsVideoUpload from "@/components/ShortsVideoUpload";
import ShortsHookFrameGrid from "@/components/ShortsHookFrameGrid";
import { extractShortsHookFrames } from "@/lib/shortsExtractClient";
import type { ShortsHookFrame } from "@/lib/shortsHookShared";
import type { ShortsUploadPhase, ShortsVideoAsset } from "@/lib/shortsVideo";
import {
  saveShortsStudioSession,
  SHORTS_STUDIO_PATH,
} from "@/lib/shortsStudioSession";
import { useShortsProjectStore } from "@/lib/shortsProjectStore";

/**
 * ShortsThumbnailWorkspace — 영상/썸네일 스튜디오.
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hooks, setHooks] = useState<ShortsHookFrame[]>([]);
  const [selectedHook, setSelectedHook] = useState<ShortsHookFrame | null>(
    null
  );

  const handleAssetChange = useCallback((next: ShortsVideoAsset | null) => {
    setAsset(next);
    setHooks([]);
    setSelectedHook(null);
  }, []);

  const onStartHookExtract = useCallback(async () => {
    if (!asset) return;
    setPhase("extracting");
    setErrorMessage(null);
    setHooks([]);
    setSelectedHook(null);
    try {
      const result = await extractShortsHookFrames(asset);
      setHooks(result.hooks);
      setPhase("hooks_ready");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "extract_failed";
      setPhase("ready");
      setErrorMessage(
        raw.includes("auth")
          ? t.shorts.errorAuth
          : t.shorts.errorExtract
      );
    }
  }, [asset, t.shorts.errorAuth, t.shorts.errorExtract]);

  const onSelectHook = useCallback((frame: ShortsHookFrame) => {
    setSelectedHook(frame);
  }, []);

  const onContinueToStudio = useCallback(() => {
    if (!asset || !selectedHook) return;
    // Keep video URL + filename in global store across /shorts → /studio.
    void useShortsProjectStore.getState().hydrateFromAsset(asset);
    saveShortsStudioSession({
      videoId: asset.videoId,
      fileName: asset.fileName,
      sizeBytes: asset.sizeBytes,
      contentType: asset.contentType,
      storageKey: asset.storageKey,
      playbackUrl: asset.playbackUrl,
      /** Alias for studio mix — prefer R2 playback, else local preview blob URL. */
      videoUrl: asset.playbackUrl || asset.previewUrl || null,
      videoFileName: asset.fileName,
      storage: asset.storage,
      hook: selectedHook,
    });
    router.push(SHORTS_STUDIO_PATH);
  }, [asset, selectedHook, router]);

  return (
    <section
      id="shorts-thumbnail"
      className="relative mx-auto max-w-5xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8"
      aria-labelledby="shorts-thumbnail-title"
    >
      <div className="ambient-glow -top-20 left-1/4 h-64 w-64 bg-glow-emerald/15" />
      <div className="ambient-glow top-1/3 -right-16 h-56 w-56 bg-glow-purple/10" />

      <div className="relative space-y-8">
        <header className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 backdrop-blur-sm">
            <Clapperboard className="h-3.5 w-3.5 text-glow-emerald" aria-hidden />
            <span>{t.shorts.eyebrow}</span>
          </div>
          <h1
            id="shorts-thumbnail-title"
            className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl"
          >
            {t.shorts.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
            {t.shorts.subtitle}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <PlaceholderCard
            icon={Smartphone}
            title={t.shorts.stepUploadTitle}
            body={t.shorts.stepUploadDesc}
            active={Boolean(asset) || phase === "uploading"}
          />
          <PlaceholderCard
            icon={Film}
            title={t.shorts.stepFramesTitle}
            body={t.shorts.stepFramesDesc}
            active={
              phase === "extracting" ||
              phase === "hooks_ready" ||
              hooks.length > 0
            }
          />
          <PlaceholderCard
            icon={Type}
            title={t.shorts.stepEditTitle}
            body={t.shorts.stepEditDesc}
            active={Boolean(selectedHook)}
          />
        </div>

        <ShortsVideoUpload
          asset={asset}
          phase={phase}
          uploadProgress={uploadProgress}
          errorMessage={errorMessage}
          onAssetChange={handleAssetChange}
          onPhaseChange={setPhase}
          onProgressChange={setUploadProgress}
          onError={setErrorMessage}
          onStartHookExtract={() => {
            void onStartHookExtract();
          }}
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

function PlaceholderCard({
  icon: Icon,
  title,
  body,
  active,
}: {
  icon: typeof Smartphone;
  title: string;
  body: string;
  active?: boolean;
}) {
  return (
    <div
      className={`glass-card flex flex-col gap-2 rounded-xl border px-4 py-5 transition ${
        active
          ? "border-glow-emerald/40 bg-glow-emerald/5"
          : "border-white/10"
      }`}
    >
      <Icon className="h-5 w-5 text-glow-emerald" aria-hidden />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-xs leading-relaxed text-white/45">{body}</p>
    </div>
  );
}
