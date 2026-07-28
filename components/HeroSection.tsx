"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Sparkles, Camera } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { HERO_BEFORE_IMAGE, HERO_AFTER_IMAGE } from "@/lib/data";

export default function HeroSection() {
  const { t } = useI18n();
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const showcaseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDragging) return;
    const interval = setInterval(() => {
      setSliderPos((prev) => {
        const next = prev + (prev < 50 ? 0.3 : -0.3);
        if (next >= 70) return 70;
        if (next <= 30) return 30;
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isDragging]);

  const handleSliderMove = useCallback((clientX: number) => {
    const rect = showcaseRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(85, Math.max(15, x)));
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleSliderMove(e.clientX);
    const onUp = () => setIsDragging(false);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, handleSliderMove]);

  const stats = [
    { value: "50K+", label: t.hero.statPortraits },
    { value: "12+", label: t.hero.statStyles },
    { value: "4.9", label: t.hero.statRating },
  ];

  const beforeOpacity = 1 - sliderPos / 100;
  const afterOpacity = sliderPos / 100;

  return (
    <section id="hero" className="relative min-h-screen overflow-hidden pt-24">
      <div className="ambient-glow -top-32 -left-32 h-96 w-96 bg-glow-purple/20" />
      <div className="ambient-glow top-1/3 -right-32 h-80 w-80 bg-glow-emerald/15" />
      <div className="ambient-glow bottom-0 left-1/3 h-64 w-64 bg-glow-purple/10" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="animate-slide-up space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-glow-purple" />
              <span className="truncate">{t.hero.badge}</span>
            </div>

            <h1 className="font-display text-[clamp(1.75rem,4.5vw,3.25rem)] leading-[1.2] font-bold tracking-tight">
              <span className="gradient-text block">{t.hero.title}</span>
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-white/50 sm:text-lg">
              {t.hero.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <a href="#creator" className="btn-primary group min-w-0 px-5 py-3 text-sm sm:px-6">
                <Camera className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.hero.ctaStart}</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#styles" className="btn-secondary min-w-0 px-5 py-3 text-sm sm:px-6">
                <span className="truncate">{t.hero.ctaExplore}</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-4 sm:gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-[4.5rem]">
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs leading-snug text-white/40">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Before / After showcase — single unified portrait images */}
          <div className="animate-fade-in flex justify-center lg:justify-end">
            <div
              ref={showcaseRef}
              className="animate-float w-full max-w-[440px]"
              style={{ animationDuration: "6s" }}
            >
              <div className="relative w-full">
                <div className="glass-card absolute top-0 left-0 z-30 px-3 py-2">
                  <div className="text-[10px] text-white/50">{t.hero.styleLabel}</div>
                  <div className="text-xs font-medium text-glow-violet">{t.hero.styleCinematic}</div>
                </div>

                {/* After — single photorealistic beach portrait */}
                <div
                  className="glass-card relative mt-8 aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-glow transition-opacity duration-300"
                  style={{ opacity: 0.55 + afterOpacity * 0.45 }}
                >
                  <img
                    src={HERO_AFTER_IMAGE}
                    alt=""
                    className="h-full w-full object-cover object-[center_28%]"
                    draggable={false}
                  />
                  <div className="absolute top-3 right-3 rounded-md bg-gradient-to-r from-glow-purple/90 to-glow-emerald/90 px-2.5 py-1 text-[10px] font-semibold text-white sm:text-xs">
                    {t.hero.after}
                  </div>
                  <div className="absolute right-3 bottom-3 left-3 flex justify-end">
                    <div className="glass-card flex items-center gap-1.5 px-2.5 py-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-glow-emerald" />
                      <span className="text-[10px] text-white/70">{t.hero.renderComplete}</span>
                    </div>
                  </div>
                </div>

                {/* Before — same model, matched upper-body framing */}
                <div
                  className="absolute top-14 left-0 z-20 w-[40%] transition-opacity duration-300"
                  style={{ opacity: 0.55 + beforeOpacity * 0.45 }}
                >
                  <div className="glass-card relative aspect-[4/5] w-full overflow-hidden rounded-xl shadow-glass ring-1 ring-white/10">
                    <img
                      src={HERO_BEFORE_IMAGE}
                      alt=""
                      className="h-full w-full object-cover object-[center_28%]"
                      draggable={false}
                    />
                    <div className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/85 sm:text-xs">
                      {t.hero.before}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-5 h-6 w-full">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-white/30 to-glow-emerald/70 transition-all duration-150"
                    style={{ width: `${sliderPos}%` }}
                  />
                </div>
                <div
                  className="absolute top-1/2 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white/40 bg-navy shadow-glow-sm"
                  style={{ left: `${sliderPos}%` }}
                  onMouseDown={() => setIsDragging(true)}
                  onTouchStart={() => setIsDragging(true)}
                >
                  <div className="flex gap-px">
                    <div className="h-2.5 w-px rounded bg-white/60" />
                    <div className="h-2.5 w-px rounded bg-white/60" />
                  </div>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  onTouchStart={() => setIsDragging(true)}
                  onTouchEnd={() => setIsDragging(false)}
                  className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                  aria-label="Compare before and after"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
