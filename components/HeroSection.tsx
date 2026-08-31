"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Images } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import HeroDualShowcase from "@/components/HeroDualShowcase";
import { saveAuthNextPath } from "@/lib/supabase/oauth";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";
import { PRINT_SMART_FORM_PATH } from "@/lib/printSmartForm";
import { AI_PHOTO_GENERATOR_PATH } from "@/lib/aiPhotoGenerator";
import { PRINT_UNIFIED_EDITOR_PATH } from "@/lib/printUnifiedEditor";

const GALLERY_REGISTER_PATH = "/gallery/my?tab=photos";

const HERO_PRIMARY =
  "box-border flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-4 py-4 text-center transition-all duration-300 sm:min-h-[5.5rem] sm:px-6 sm:py-5";

const HERO_SECONDARY =
  "box-border flex min-h-[2.75rem] w-full flex-col items-center justify-center gap-0 rounded-xl border px-1.5 py-1.5 text-center text-[11px] sm:min-h-[3.25rem] sm:px-2.5 sm:py-2 sm:text-sm";

export default function HeroSection() {
  const { t } = useI18n();
  const router = useRouter();
  const { isAuthenticated, isAdmin, openAuthModal } = useCredits();

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
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8 xl:gap-10">
          <div className="animate-slide-up space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs text-white/60 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-glow-purple" />
              <span className="truncate">{t.hero.badge}</span>
            </div>

            <h1 className="font-display text-[clamp(1.55rem,4vw,3rem)] leading-[1.2] font-bold tracking-tight [word-break:keep-all]">
              <span className="gradient-text block">{t.hero.titleLine1}</span>
              {t.hero.titleLine2 ? (
                <span className="gradient-text block">{t.hero.titleLine2}</span>
              ) : null}
              {t.hero.titleLine3 ? (
                <span className="gradient-text block">{t.hero.titleLine3}</span>
              ) : null}
            </h1>

            <p className="max-w-2xl text-lg font-medium leading-snug text-white sm:text-2xl sm:leading-snug md:text-[1.85rem] md:leading-[1.35]">
              {t.hero.description}
            </p>

            {/* Primary product CTAs — two oversized buttons */}
            <div className="grid w-full grid-cols-1 gap-3 pt-1 sm:grid-cols-2 sm:gap-4">
              <Link
                href={PRINT_UNIFIED_EDITOR_PATH}
                className={`${HERO_PRIMARY} border-2 border-sky-300/70 bg-gradient-to-br from-sky-500 to-blue-600 shadow-[0_10px_36px_rgba(56,189,248,0.45)] hover:from-sky-400 hover:to-blue-500 hover:shadow-[0_14px_44px_rgba(56,189,248,0.55)]`}
                aria-label={t.hero.ctaDesignGenerator}
              >
                <span className="text-lg font-black tracking-tight text-white sm:text-xl md:text-2xl [word-break:keep-all]">
                  {t.hero.ctaDesignGeneratorLine1}
                </span>
                <span className="text-lg font-black tracking-tight text-sky-50 sm:text-xl md:text-2xl [word-break:keep-all]">
                  {t.hero.ctaDesignGeneratorLine2}
                </span>
              </Link>
              <Link
                href={SHORTS_THUMBNAIL_PATH}
                className={`${HERO_PRIMARY} border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_10px_36px_rgba(52,211,153,0.45)] hover:from-emerald-300 hover:to-teal-400 hover:shadow-[0_14px_44px_rgba(52,211,153,0.55)]`}
                aria-label={t.hero.ctaVideoThumbnail}
              >
                <span className="text-lg font-black tracking-tight text-black sm:text-xl md:text-2xl [word-break:keep-all]">
                  {t.hero.ctaVideoThumbnailLine1}
                </span>
                <span className="text-lg font-black tracking-tight text-pink-700 sm:text-xl md:text-2xl [word-break:keep-all]">
                  {t.hero.ctaVideoThumbnailLine2}
                </span>
              </Link>
            </div>

            {isAdmin ? (
              <div className="space-y-2 border-t border-white/10 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                  {t.hero.labComingSoon}
                </p>
                <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2.5">
                  <a
                    href="/generate?fresh=1"
                    className={`btn-secondary group ${HERO_SECONDARY} border-white/15`}
                  >
                    <span className="whitespace-nowrap font-semibold [word-break:keep-all]">
                      {t.hero.ctaStart}
                    </span>
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 opacity-70" />
                  </a>
                  <a
                    href="/styles"
                    className={`btn-secondary group ${HERO_SECONDARY} border-white/15`}
                  >
                    <span className="whitespace-nowrap font-semibold [word-break:keep-all]">
                      {t.hero.ctaExplore}
                    </span>
                  </a>
                  <Link
                    href="/template-studio"
                    className={`btn-secondary group ${HERO_SECONDARY} border-white/15`}
                    aria-label={t.hero.ctaTemplateStudio}
                  >
                    <span className="text-[11px] font-semibold leading-tight text-white [word-break:keep-all] sm:text-sm">
                      {t.hero.ctaTemplateStudioLine1}
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-white/85 [word-break:keep-all] sm:text-sm">
                      {t.hero.ctaTemplateStudioLine2}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={goRegisterPhotos}
                    className={`btn-secondary group ${HERO_SECONDARY} border-white/15`}
                  >
                    <Images className="mb-0.5 h-3.5 w-3.5 opacity-80" />
                    <span className="text-[10px] font-semibold leading-tight [word-break:keep-all] sm:text-xs">
                      {t.hero.ctaRegisterPhotos}
                    </span>
                  </button>
                  <Link
                    href={AI_PHOTO_GENERATOR_PATH}
                    className={`btn-secondary group ${HERO_SECONDARY} border-white/15`}
                    aria-label={t.hero.ctaPhotoGenerator}
                  >
                    <span className="text-[11px] font-semibold leading-tight [word-break:keep-all] sm:text-sm">
                      {t.hero.ctaPhotoGeneratorLine1}
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-white/85 [word-break:keep-all] sm:text-sm">
                      {t.hero.ctaPhotoGeneratorLine2}
                    </span>
                  </Link>
                  <Link
                    href={PRINT_SMART_FORM_PATH}
                    className={`btn-secondary group ${HERO_SECONDARY} border-white/15`}
                    aria-label={t.hero.ctaPrintSmartForm}
                  >
                    <span className="text-[11px] font-semibold leading-tight [word-break:keep-all] sm:text-sm">
                      {t.hero.ctaPrintSmartFormLine1}
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-white/85 [word-break:keep-all] sm:text-sm">
                      {t.hero.ctaPrintSmartFormLine2}
                    </span>
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-6 pt-1 sm:gap-8 sm:pt-2 [@media(max-height:760px)]:hidden">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-[4.5rem]">
                  <div className="text-xl font-bold text-white sm:text-2xl">
                    {stat.value}
                  </div>
                  <div className="text-xs leading-snug text-white/40">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-in flex justify-center lg:justify-end lg:pt-1">
            <HeroDualShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}
