"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Pause, RefreshCw, Download, Maximize2, Images, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import BrandWatermark from "@/components/BrandWatermark";
import { CANVAS_RESULT_IMAGE } from "@/lib/data";
import { downloadImageFile } from "@/lib/downloadImage";
import {
  listGalleryHistory,
  pushGalleryHistoryAndSync,
  getAccountMeta,
  type GalleryHistoryItem,
} from "@/lib/faceProfiles";
import { retentionContextFromAccount } from "@/lib/retentionPolicy";

type RenderPhase = "idle" | "analyzing" | "generating" | "refining" | "complete";

export default function LivePreviewCanvas() {
  const { t } = useI18n();
  const router = useRouter();
  const { applyBrandWatermark, consumeCredit, setShowCreditModal, credits, planId } =
    useCredits();
  const [isRendering, setIsRendering] = useState(false);
  const [phase, setPhase] = useState<RenderPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [myResults, setMyResults] = useState<GalleryHistoryItem[]>([]);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setMyResults(listGalleryHistory());
  }, []);

  const activeResult =
    myResults.find((item) => item.id === activeResultId) ?? myResults[0] ?? null;
  const hasResults = myResults.length > 0;
  const previewImage = activeResult?.imageUrl ?? CANVAS_RESULT_IMAGE;
  const showActions = hasResults || phase === "complete";

  const phases = useMemo(
    () => [
      { key: "analyzing" as const, label: t.gallery.analyzing, duration: 2000 },
      { key: "generating" as const, label: t.gallery.generating, duration: 3000 },
      { key: "refining" as const, label: t.gallery.refining, duration: 2000 },
      { key: "complete" as const, label: t.gallery.complete, duration: 0 },
    ],
    [t]
  );

  useEffect(() => {
    if (!isRendering) return;

    let currentIdx = 0;
    let elapsed = 0;
    const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);

    setPhase("analyzing");
    setProgress(0);

    const progressInterval = setInterval(() => {
      elapsed += 50;
      setProgress(Math.min(100, (elapsed / totalDuration) * 100));
    }, 50);

    const runPhases = () => {
      if (currentIdx >= phases.length) {
        clearInterval(progressInterval);
        setProgress(100);
        return;
      }

      setPhase(phases[currentIdx].key);
      const duration = phases[currentIdx].duration;

      if (duration > 0) {
        setTimeout(() => {
          currentIdx++;
          runPhases();
        }, duration);
      }
    };

    runPhases();

    return () => clearInterval(progressInterval);
  }, [isRendering, phases]);

  const startRender = () => {
    if (credits <= 0) {
      setShowCreditModal(true);
      return;
    }
    if (!consumeCredit()) return;
    setIsRendering(true);
    setPhase("analyzing");
    setProgress(0);
  };

  const resetRender = () => {
    setIsRendering(false);
    setPhase("idle");
    setProgress(0);
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadImageFile({
        imageUrl: previewImage,
        filename: `studio-canvas-hd-${Date.now()}.png`,
        bakeWatermark: applyBrandWatermark,
        aspectRatio: "9:16",
        exportPreset: "original",
      });
    } catch {
      window.open(previewImage, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToGallery = () => {
    const alreadySaved = myResults.some((item) => item.imageUrl === previewImage);
    if (!alreadySaved) {
      const id = `canvas-${Date.now()}`;
      void pushGalleryHistoryAndSync(
        { id, imageUrl: previewImage, storageId: id, createdAt: Date.now() },
        retentionContextFromAccount(planId, getAccountMeta())
      ).then(() => {
        setMyResults(listGalleryHistory());
        setActiveResultId(id);
      });
    }
    setSavedMsg(true);
  };

  return (
    <section id="gallery" className="section-padding relative">
      <div className="ambient-glow top-0 left-1/4 h-96 w-96 bg-glow-purple/8" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-12 overflow-visible px-1 text-center">
          <span className="inline-block text-sm font-medium tracking-[0.15em] text-glow-purple uppercase">
            {t.gallery.eyebrow}
          </span>
          <h2 className="font-display mt-3 text-3xl font-bold sm:text-4xl">{t.gallery.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">{t.gallery.subtitle}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="glass-card relative aspect-[3/4] overflow-hidden">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(139,92,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.1) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`h-48 w-48 rounded-full transition-all duration-1000 ${
                    isRendering ? "animate-pulse-glow" : ""
                  }`}
                  style={{
                    background:
                      phase === "complete"
                        ? "radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)",
                  }}
                />
              </div>

              {hasResults || phase === "complete" ? (
                <>
                  <img
                    src={previewImage}
                    alt="Generated portrait"
                    className="absolute inset-0 h-full w-full object-cover animate-fade-in"
                    loading="lazy"
                  />
                  <BrandWatermark visible={applyBrandWatermark} />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8">
                  {isRendering ? (
                    <>
                      <div className="relative mb-8 h-28 w-28 sm:h-32 sm:w-32">
                        <div className="absolute inset-0 animate-spin-slow rounded-full border border-glow-purple/20" />
                        <div
                          className="absolute inset-3 animate-spin-slow rounded-full border border-glow-emerald/20"
                          style={{ animationDirection: "reverse", animationDuration: "6s" }}
                        />
                        <div className="absolute inset-6 animate-spin-slow rounded-full border border-white/10" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-white/80 sm:text-2xl">
                            {Math.round(progress)}%
                          </span>
                        </div>
                      </div>

                      <p className="mb-2 text-center text-xs font-medium text-white/70 sm:text-sm">
                        {phases.find((p) => p.key === phase)?.label}
                      </p>

                      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10 sm:w-48">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progress}%`,
                            background: "linear-gradient(90deg, #8B5CF6, #10B981)",
                          }}
                        />
                      </div>

                      <div className="mt-6 flex gap-3">
                        {phases.slice(0, -1).map((p) => (
                          <div
                            key={p.key}
                            className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
                              phase === p.key
                                ? "scale-150 bg-glow-purple"
                                : phases.findIndex((ph) => ph.key === phase) >
                                    phases.findIndex((ph) => ph.key === p.key)
                                  ? "bg-glow-emerald"
                                  : "bg-white/20"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Maximize2 className="h-6 w-6 text-white/30" />
                      </div>
                      <p className="text-xs text-white/40 sm:text-sm">
                        {t.gallery.idleHint1}
                        <br />
                        {t.gallery.idleHint2}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isRendering && phase !== "complete" && (
                <div className="shimmer-bg absolute inset-0" />
              )}

              <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between">
                <div className={`flex gap-2 ${hasResults ? "hidden" : ""}`}>
                  {!isRendering ? (
                    <button
                      onClick={startRender}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  ) : phase === "complete" ? (
                    <button
                      onClick={resetRender}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={resetRender}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {(hasResults || phase === "complete") && (
                  <span className="whitespace-nowrap rounded-lg bg-glow-emerald/20 px-2.5 py-1 text-[10px] font-medium text-glow-emerald backdrop-blur-sm sm:px-3 sm:text-xs">
                    {t.gallery.ready4k}
                  </span>
                )}
              </div>
            </div>

            {showActions && (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-50"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>{isDownloading ? "..." : t.creator.actionDownloadHd}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToGallery}
                  className="btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm"
                >
                  <Images className="h-4 w-4 shrink-0" />
                  <span>{t.creator.actionSaveGallery}</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/generate")}
                  className="btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm"
                >
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span>{t.creator.actionRetryStyle}</span>
                </button>
                {savedMsg && (
                  <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-glow-emerald">
                    {t.creator.savedToGalleryDone}
                    <Link href="/gallery/my" className="underline underline-offset-2">
                      {t.creator.viewMyGallery}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{t.gallery.myResultsTitle}</h3>
              {hasResults && (
                <span className="text-xs text-white/70">
                  {myResults.length} {t.gallery.works}
                </span>
              )}
            </div>

            {hasResults ? (
              <div className="columns-2 gap-3 sm:columns-3">
                {myResults.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setActiveResultId(item.id)}
                    className={`group mb-3 block w-full cursor-pointer break-inside-avoid overflow-hidden rounded-xl border transition-all duration-500 ${
                      activeResult?.id === item.id
                        ? "border-glow-purple/40 shadow-glow-sm"
                        : "border-white/[0.06] hover:border-white/15"
                    }`}
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={item.thumbnailUrl ?? item.imageUrl}
                        alt={t.gallery.myResultsTitle}
                        className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="glass-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                  <Sparkles className="h-6 w-6 text-glow-purple" />
                </div>
                <p className="max-w-sm text-sm text-zinc-200">{t.gallery.myResultsEmpty}</p>
                <Link href="/generate" className="btn-primary px-6 py-2.5 text-sm font-bold">
                  {t.gallery.myResultsCta}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
