"use client";

import Image from "next/image";
import { useI18n } from "@/components/I18nProvider";

/** High-res AI design poster shown in the hero dual showcase (left card). */
const HERO_DESIGN_TEMPLATE = {
  src: "/hero/ai-design-template.jpg",
  width: 724,
  height: 1024,
} as const;

/** High-res shorts / thumbnail phone screen (right card, 9:16). */
const HERO_PHONE_TEMPLATE = {
  src: "/hero/shorts-phone-template.jpg",
  width: 576,
  height: 1024,
} as const;

/**
 * Landing hero right visual — Shorts thumbnail + A4 print poster dual mock.
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
        {/* A4 print poster — back-left (high-res source, full-bleed) */}
        <div
          className="hero-dual__card absolute left-[2%] top-[6%] z-[1] w-[58%] origin-bottom rotate-[-7deg] animate-float"
          style={{ animationDuration: "7s", animationDelay: "0.15s" }}
        >
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_22px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/40">
            <div className="relative aspect-[724/1024] w-full bg-white">
              <Image
                src={HERO_DESIGN_TEMPLATE.src}
                alt={h.ctaDesignGenerator}
                width={HERO_DESIGN_TEMPLATE.width}
                height={HERO_DESIGN_TEMPLATE.height}
                priority
                quality={100}
                unoptimized
                sizes="(max-width: 640px) 52vw, (max-width: 1280px) 280px, 320px"
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
                draggable={false}
              />
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold tracking-tight text-white/80 [word-break:keep-all] sm:text-[11px]">
            {h.ctaDesignGeneratorLine1} · {h.ctaDesignGeneratorLine2}
          </p>
        </div>

        {/* Shorts / thumbnail phone — front-right (high-res source, full-bleed) */}
        <div
          className="hero-dual__card absolute bottom-[2%] right-[0%] z-[2] w-[48%] origin-bottom rotate-[6deg] animate-float"
          style={{ animationDuration: "6s" }}
        >
          <div className="overflow-hidden rounded-[1.35rem] border border-white/20 bg-[#0b1220] p-1.5 shadow-[0_28px_60px_rgba(0,0,0,0.5)] ring-1 ring-emerald-400/25">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.05rem] bg-black">
              <Image
                src={HERO_PHONE_TEMPLATE.src}
                alt={h.ctaVideoThumbnail}
                width={HERO_PHONE_TEMPLATE.width}
                height={HERO_PHONE_TEMPLATE.height}
                priority
                quality={100}
                unoptimized
                sizes="(max-width: 640px) 45vw, (max-width: 1280px) 240px, 280px"
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
                draggable={false}
              />
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
