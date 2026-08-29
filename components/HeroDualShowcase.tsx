"use client";

import { Clapperboard, FileText, Play } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Landing hero right visual — Shorts/Reels thumbnail + A4 print poster dual mock.
 * Pure UI chrome (no selfie before/after).
 */
export default function HeroDualShowcase() {
  const { t } = useI18n();
  const h = t.hero;

  return (
    <div
      className="hero-dual relative mx-auto w-full max-w-[min(100%,440px)] xl:max-w-[min(100%,500px)]"
      aria-label={`${h.ctaVideoThumbnail} · ${h.ctaDesignGenerator}`}
    >
      {/* Soft stage glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[8%] rounded-[2rem] bg-[radial-gradient(ellipse_at_40%_40%,rgba(52,211,153,0.22),transparent_55%),radial-gradient(ellipse_at_75%_65%,rgba(56,189,248,0.2),transparent_50%)] blur-2xl"
      />

      <div className="relative mx-auto aspect-[5/6] w-full max-h-[min(56svh,520px)]">
        {/* A4 print poster — back-left */}
        <div
          className="hero-dual__card absolute left-[2%] top-[6%] z-[1] w-[58%] origin-bottom rotate-[-7deg] animate-float"
          style={{ animationDuration: "7s", animationDelay: "0.15s" }}
        >
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_22px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/40">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-sky-700">
                <FileText className="h-3 w-3" aria-hidden />
                A4
              </span>
              <span className="truncate text-[9px] font-semibold text-slate-500">
                {h.ctaDesignGeneratorLine1}
              </span>
            </div>
            <div className="relative aspect-[210/297] bg-gradient-to-br from-sky-50 via-white to-slate-100 p-3 sm:p-3.5">
              <div className="absolute inset-x-3 top-3 h-[38%] overflow-hidden rounded-md bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 sm:inset-x-3.5 sm:top-3.5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                <div className="absolute bottom-2 left-2 right-2 space-y-1">
                  <div className="h-1.5 w-3/4 rounded-full bg-white/90" />
                  <div className="h-1 w-1/2 rounded-full bg-white/55" />
                </div>
              </div>
              <div className="absolute inset-x-3 bottom-3 top-[46%] flex flex-col gap-1.5 sm:inset-x-3.5 sm:bottom-3.5">
                <div className="h-2 w-[88%] rounded-full bg-slate-800/90" />
                <div className="h-1.5 w-[70%] rounded-full bg-slate-500/70" />
                <div className="mt-1 space-y-1">
                  <div className="h-1 w-full rounded-full bg-slate-300/90" />
                  <div className="h-1 w-[92%] rounded-full bg-slate-300/80" />
                  <div className="h-1 w-[78%] rounded-full bg-slate-300/70" />
                </div>
                <div className="mt-auto flex gap-1.5 pt-1">
                  <div className="h-6 flex-1 rounded-md bg-sky-500/90" />
                  <div className="h-6 w-10 rounded-md bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold tracking-tight text-white/80 [word-break:keep-all] sm:text-[11px]">
            {h.ctaDesignGeneratorLine1} · {h.ctaDesignGeneratorLine2}
          </p>
        </div>

        {/* Shorts / Reels thumbnail phone — front-right */}
        <div
          className="hero-dual__card absolute bottom-[2%] right-[0%] z-[2] w-[48%] origin-bottom rotate-[6deg] animate-float"
          style={{ animationDuration: "6s" }}
        >
          <div className="overflow-hidden rounded-[1.35rem] border border-white/20 bg-[#0b1220] p-1.5 shadow-[0_28px_60px_rgba(0,0,0,0.5)] ring-1 ring-emerald-400/25">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[1.05rem] bg-gradient-to-b from-emerald-500/30 via-teal-700/40 to-slate-950">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(52,211,153,0.45),transparent_60%)]" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2.5 pt-2.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[8px] font-bold text-emerald-200 backdrop-blur-sm">
                  <Clapperboard className="h-2.5 w-2.5" aria-hidden />
                  9:16
                </span>
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black text-white">
                  LIVE
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/35 shadow-lg backdrop-blur-sm">
                  <Play className="h-5 w-5 fill-white text-white" aria-hidden />
                </span>
              </div>
              <div className="absolute inset-x-2.5 bottom-2.5 space-y-1.5">
                <div className="rounded-md bg-black/55 px-2 py-1.5 backdrop-blur-md">
                  <p className="text-[10px] font-black leading-tight text-white [word-break:keep-all]">
                    {h.ctaVideoThumbnailLine2}
                  </p>
                  <p className="mt-0.5 text-[8px] font-semibold text-emerald-200/90">
                    {h.ctaVideoThumbnailLine1}
                  </p>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-[62%] rounded-full bg-emerald-400" />
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold tracking-tight text-white/80 [word-break:keep-all] sm:text-[11px]">
            {h.ctaVideoThumbnailLine1} · {h.ctaVideoThumbnailLine2}
          </p>
        </div>

        {/* Status chip */}
        <div className="absolute right-[4%] top-[2%] z-[3]">
          <div className="glass-card flex items-center gap-1.5 px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-glow-emerald" />
            <span className="text-[10px] text-white/70">{h.renderComplete}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
