"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, Plus } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import LanguageSelector from "@/components/LanguageSelector";

export default function Navbar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { setShowAuthModal, setShowTopUpModal, credits, isAuthenticated } = useCredits();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/generate", label: t.nav.creator },
    { href: "/styles", label: t.nav.styles },
    { href: "/gallery", label: t.nav.gallery },
    { href: "/pricing", label: t.nav.pricing },
    { href: "/support", label: t.nav.support },
    { href: "/profile", label: t.nav.profile },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const openTrial = () => {
    setMobileOpen(false);
    setShowAuthModal(true);
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-navy/80 backdrop-blur-2xl"
          : "bg-transparent"
      }`}
    >
      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group relative z-50 flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald shadow-glow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg leading-tight font-semibold tracking-tight">
              Studio Canvas
            </span>
            <span className="text-[10px] tracking-[0.2em] text-white/40 uppercase">AI Studio</span>
          </div>
        </Link>

        <div className="relative z-50 hidden items-center gap-5 lg:flex xl:gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative z-50 whitespace-nowrap text-sm transition-colors duration-300 ${
                isActive(link.href)
                  ? "font-medium text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="relative z-50 flex shrink-0 items-center gap-2 md:gap-3">
          <LanguageSelector />

          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100">
              ⚡ {credits}
            </span>
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="inline-flex items-center gap-0.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/30 hover:text-white"
            >
              <Plus className="h-3 w-3" />
              {t.nav.topup}
            </button>
          </div>

          <button
            type="button"
            onClick={openTrial}
            className="btn-secondary hidden whitespace-nowrap px-4 py-2.5 text-sm md:inline-flex"
          >
            {isAuthenticated ? t.nav.profile : t.nav.login}
          </button>
          <button
            type="button"
            onClick={openTrial}
            className="btn-primary hidden whitespace-nowrap px-4 py-2.5 text-sm md:inline-flex"
          >
            {t.nav.trial}
          </button>

          <button
            type="button"
            className="rounded-lg p-2 text-white/70 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={t.nav.menu}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="relative z-50 border-t border-white/[0.06] bg-navy/95 backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-4 py-3 text-sm transition-colors hover:bg-white/5 hover:text-white ${
                  isActive(link.href) ? "bg-white/5 text-white" : "text-white/70"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setShowTopUpModal(true);
              }}
              className="rounded-lg px-4 py-3 text-left text-sm text-amber-200"
            >
              ⚡ {credits} · {t.nav.topup}
            </button>
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
