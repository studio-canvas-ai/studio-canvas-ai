"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Images } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { HERO_BEFORE_IMAGE, HERO_AFTER_IMAGE } from "@/lib/data";
import ImageComparisonSlider from "@/components/ImageComparisonSlider";
import { saveAuthNextPath } from "@/lib/supabase/oauth";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";
import { PRINT_SMART_FORM_PATH } from "@/lib/printSmartForm";
import { AI_PHOTO_GENERATOR_PATH } from "@/lib/aiPhotoGenerator";

const GALLERY_REGISTER_PATH = "/gallery/my?tab=photos";

/** Shared size for the three hero action CTAs (equal width/height via grid). */
const HERO_CTA =
  "box-border flex h-full min-h-[3rem] w-full items-center justify-center gap-1.5 px-2.5 py-2.5 text-center text-sm font-semibold sm:min-h-[3.5rem] sm:gap-2 sm:px-4 sm:py-3.5 sm:text-base";

/** Primary start CTA — larger type, no leading icon, never truncate label. */
const HERO_CTA_START =
  "box-border flex h-full min-h-[3rem] w-full items-center justify-center gap-1.5 px-2 py-2.5 text-center text-sm font-bold sm:min-h-[3.5rem] sm:gap-2 sm:px-3 sm:py-3.5 sm:text-lg";

/** Light-green accent for Shorts / thumbnail middle CTA. */
const HERO_CTA_SHORTS =
  "box-border flex h-full min-h-[3rem] w-full flex-col items-center justify-center gap-0 rounded-xl border border-emerald-400/55 bg-emerald-300 px-1.5 py-1.5 text-center shadow-[0_4px_18px_rgba(52,211,153,0.35)] transition-all duration-300 hover:border-emerald-400/70 hover:bg-emerald-200 sm:min-h-[3.5rem] sm:px-2 sm:py-2";

/** Two-line secondary CTA (AI Template Studio) — matches Shorts vertical stack. */
const HERO_CTA_TEMPLATE =
  "box-border flex h-full min-h-[3rem] w-full flex-col items-center justify-center gap-0 px-1.5 py-1.5 text-center sm:min-h-[3.5rem] sm:px-2 sm:py-2";

export default function HeroSection() {
  const { t } = useI18n();
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useCredits();

  const stats = [
    { value: "50K+", label: t.hero.statPortraits },
    { value: "12+", label: t.hero.statStyles },
    { value: "4.9", label: t.hero.statRating },
  ];

  const goRegisterPhotos = () => {
    if (isAuthenticated) {
      router.push(GALLERY_REGISTER_PATH);
      return;
    }
    saveAuthNextPath(GALLERY_REGISTER_PATH);
    openAuthModal({ clearPending: true });
  };

  return (
    <section
      id="hero"
      data-hero-shell="stable"
      className="relative min-h-[100svh] overflow-x-hidden pt-14 pb-8 md:min-h-screen md:pt-[4.5rem] md:pb-10 lg:pt-[4.75rem]"
    >
      <div className="ambient-glow -top-32 -left-32 h-96 w-96 bg-glow-purple/20" />
      <div className="ambient-glow top-1/3 -right-32 h-80 w-80 bg-glow-emerald/15" />
      <div className="ambient-glow bottom-0 left-1/3 h-64 w-64 bg-glow-purple/10" />

      <div className="relative mx-auto w-full max-w-[1600px] px-6 sm:px-8 lg:px-10 xl:px-12">
        {/*
          items-start (not center): tall Before/After must not vertically
          push the left CTA stack below the first viewport.
        */}
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8 xl:gap-10">
          <div className="animate-slide-up space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs text-white/60 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-glow-purple" />
              <span className="truncate">{t.hero.badge}</span>
            </div>

            <h1 className="font-display text-[clamp(1.45rem,3.6vw,2.85rem)] leading-[1.18] font-bold tracking-tight [word-break:keep-all]">
              <span className="gradient-text block">{t.hero.titleLine1}</span>
              <span className="gradient-text block">{t.hero.titleLine2}</span>
              <span className="gradient-text block whitespace-nowrap">
                {t.hero.titleLine3}
              </span>
            </h1>

            <div className="w-full max-w-xl space-y-2.5 sm:space-y-3">
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:gap-4">
                <p className="font-display min-w-0 text-[clamp(0.95rem,2.2vw,1.4rem)] leading-snug font-bold tracking-tight [word-break:keep-all]">
                  <span className="gradient-text">{t.hero.galleryRegisterPrompt}</span>
                </p>
                <button
                  type="button"
                  onClick={goRegisterPhotos}
                  className="btn-primary group shrink-0 px-4 py-2.5 text-sm font-semibold sm:px-7 sm:py-3.5 sm:text-base"
                >
                  <Images className="h-5 w-5 shrink-0" />
                  <span>{t.hero.ctaRegisterPhotos}</span>
                  <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              <p className="text-sm leading-relaxed text-white/50 sm:text-base">
                {t.hero.description}
              </p>

              {/* 2×2 from xs so four CTAs stay above the fold on short phones */}
              <div className="grid w-full grid-cols-2 gap-2 pt-0.5 sm:gap-3 lg:grid-cols-4">
                <a href="/generate?fresh=1" className={`btn-primary group ${HERO_CTA_START}`}>
                  <span className="whitespace-nowrap [word-break:keep-all]">
                    {t.hero.ctaStart}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5" />
                </a>
                <Link
                  href={SHORTS_THUMBNAIL_PATH}
                  className={`group ${HERO_CTA_SHORTS}`}
                  aria-label={t.hero.ctaVideoThumbnail}
                >
                  <span className="text-sm leading-[1.05] font-bold tracking-tight text-black whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaVideoThumbnailLine1}
                  </span>
                  <span className="text-sm leading-[1.05] font-bold tracking-tight text-pink-600 whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaVideoThumbnailLine2}
                  </span>
                </Link>
                <a href="/styles" className={`btn-secondary group ${HERO_CTA}`}>
                  <span className="min-w-0 whitespace-nowrap [word-break:keep-all]">
                    {t.hero.ctaExplore}
                  </span>
                </a>
                <Link
                  href="/template-studio"
                  className={`btn-secondary group ${HERO_CTA_TEMPLATE}`}
                  aria-label={t.hero.ctaTemplateStudio}
                >
                  <span className="text-sm leading-[1.05] font-semibold tracking-tight text-white whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaTemplateStudioLine1}
                  </span>
                  <span className="text-sm leading-[1.05] font-semibold tracking-tight text-white/90 whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaTemplateStudioLine2}
                  </span>
                </Link>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <div className="hidden lg:col-span-2 lg:block" aria-hidden />
                <Link
                  href={AI_PHOTO_GENERATOR_PATH}
                  className={`btn-primary group ${HERO_CTA_TEMPLATE}`}
                  aria-label={t.hero.ctaPhotoGenerator}
                >
                  <span className="text-sm leading-[1.05] font-bold tracking-tight text-white whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaPhotoGeneratorLine1}
                  </span>
                  <span className="text-sm leading-[1.05] font-bold tracking-tight text-white/95 whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaPhotoGeneratorLine2}
                  </span>
                </Link>
                <Link
                  href={PRINT_SMART_FORM_PATH}
                  className={`btn-primary group ${HERO_CTA_TEMPLATE}`}
                  aria-label={t.hero.ctaPrintSmartForm}
                >
                  <span className="text-sm leading-[1.05] font-bold tracking-tight text-white whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaPrintSmartFormLine1}
                  </span>
                  <span className="text-sm leading-[1.05] font-bold tracking-tight text-white/95 whitespace-nowrap [word-break:keep-all] sm:text-lg sm:leading-[1.05]">
                    {t.hero.ctaPrintSmartFormLine2}
                  </span>
                </Link>
              </div>
            </div>

            {/* Stats are secondary — hide on short viewports so CTAs stay first-screen */}
            <div className="flex flex-wrap items-center gap-6 pt-1 sm:gap-8 sm:pt-2 [@media(max-height:760px)]:hidden">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-[4.5rem]">
                  <div className="text-xl font-bold text-white sm:text-2xl">{stat.value}</div>
                  <div className="text-xs leading-snug text-white/40">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-in flex justify-center lg:justify-end lg:pt-1">
            <div
              className="hero-compare animate-float w-full max-w-[min(100%,420px)] xl:max-w-[min(100%,480px)]"
              style={{ animationDuration: "6s" }}
            >
              <ImageComparisonSlider
                beforeSrc={HERO_BEFORE_IMAGE}
                afterSrc={HERO_AFTER_IMAGE}
                beforeLabel={t.hero.before}
                afterLabel={t.hero.after}
                ariaLabel={`${t.hero.before} / ${t.hero.after}`}
                frameClassName="hero-compare__frame"
                statusChip={
                  <div className="glass-card flex items-center gap-1.5 px-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-glow-emerald" />
                    <span className="text-[10px] text-white/70">
                      {t.hero.renderComplete}
                    </span>
                  </div>
                }
              />
              <div className="mt-2 flex justify-start sm:mt-3">
                <div className="glass-card px-3 py-2">
                  <div className="text-[10px] text-white/50">
                    {t.hero.styleLabel}
                  </div>
                  <div className="text-xs font-medium text-glow-violet">
                    {t.hero.styleCinematic}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
