"use client";

import { useState, useEffect } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import LanguageSelector from "@/components/LanguageSelector";

export default function Navbar() {
  const { t } = useI18n();
  const { setShowAuthModal } = useCredits();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "#hero", label: t.nav.home },
    { href: "#creator", label: t.nav.creator },
    { href: "#styles", label: t.nav.styles },
    { href: "#gallery", label: t.nav.gallery },
    { href: "#pricing", label: t.nav.pricing },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openTrial = () => {
    setMobileOpen(false);
    setShowAuthModal(true);
  };

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 overflow-visible transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-navy/80 backdrop-blur-2xl"
          : "bg-transparent"
      }`}
    >
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between overflow-visible px-4 py-4 sm:px-6 lg:px-8">
        <a href="#hero" className="group flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald shadow-glow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg leading-tight font-semibold tracking-tight">
              Studio Canvas
            </span>
            <span className="text-[10px] tracking-[0.2em] text-white/40 uppercase">
              AI Studio
            </span>
          </div>
        </a>

        <div className="hidden items-center gap-6 lg:flex xl:gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm text-white/60 transition-colors duration-300 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <LanguageSelector />

          <button
            type="button"
            onClick={openTrial}
            className="btn-secondary hidden whitespace-nowrap px-4 py-2.5 text-sm md:inline-flex"
          >
            {t.nav.login}
          </button>
          <button
            type="button"
            onClick={openTrial}
            className="btn-primary hidden whitespace-nowrap px-4 py-2.5 text-sm md:inline-flex"
          >
            {t.nav.trial}
          </button>

          <button
            className="rounded-lg p-2 text-white/70 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={t.nav.menu}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-navy/95 backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
              <button type="button" onClick={openTrial} className="btn-secondary w-full text-sm">
                {t.nav.login}
              </button>
              <button type="button" onClick={openTrial} className="btn-primary w-full text-sm">
                {t.nav.trial}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
