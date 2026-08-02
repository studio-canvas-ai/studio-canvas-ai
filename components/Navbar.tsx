"use client";

import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import LanguageSelector from "@/components/LanguageSelector";
import { isDomesticMarket, readGeoCountryFromDocument } from "@/lib/market";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Sparkles, Plus } from "lucide-react";

export default function Navbar() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const {
    openAuthModal,
    setShowTopUpModal,
    setShowPromoModal,
    credits,
    isAuthenticated,
    promoWallet,
  } = useCredits();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [geoCountry, setGeoCountry] = useState<string | null>(null);

  useEffect(() => {
    setGeoCountry(readGeoCountryFromDocument());
  }, []);
  const showCreditTopUp = !isDomesticMarket(locale, geoCountry);

  // "Styles" leads into wizard STEP 1 (concept gallery); there is no separate "Create" entry.
  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/generate", label: t.nav.styles },
    { href: "/gallery/my", label: t.nav.myGallery },
    { href: "/pricing", label: t.nav.pricing },
    { href: "/support", label: t.nav.support },
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
    openAuthModal({ clearPending: true });
  };

  const openAccount = () => {
    setMobileOpen(false);
    if (isAuthenticated) router.push("/profile");
    else openAuthModal({ clearPending: true });
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
      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group relative z-50 flex shrink-0 items-center gap-2.5 sm:gap-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald shadow-glow-sm sm:h-9 sm:w-9">
            <Sparkles className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight whitespace-nowrap text-white sm:text-lg">
            Studio Canvas AI
          </span>
        </Link>

        <div className="relative z-50 hidden min-w-0 flex-1 items-center justify-center gap-3 xl:flex xl:gap-5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative z-50 shrink-0 whitespace-nowrap text-sm transition-colors duration-300 ${
                isActive(link.href)
                  ? "font-semibold text-white"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="relative z-50 flex shrink-0 items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setShowPromoModal(true)}
            className="whitespace-nowrap text-[10px] text-zinc-300 underline-offset-4 transition-colors hover:text-white hover:underline sm:text-[11px]"
          >
            {t.nav.promoCode}
          </button>
          <div className="hidden lg:block xl:hidden">
            <div className="flex items-center gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap text-sm ${
                    isActive(link.href)
                      ? "font-semibold text-white"
                      : "text-zinc-300 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <LanguageSelector />

          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100">
              {promoWallet ? t.nav.promoBalance : "⚡"} {credits}
            </span>
            {showCreditTopUp && (
              <button
                type="button"
                onClick={() => setShowTopUpModal(true)}
                className="inline-flex items-center gap-0.5 rounded-full border border-white/35 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/60 hover:text-white"
              >
                <Plus className="h-3 w-3" />
                {t.nav.topup}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openAccount}
            className="btn-secondary hidden whitespace-nowrap px-4 py-2.5 text-sm md:inline-flex"
          >
            {isAuthenticated ? t.nav.myPage : t.nav.login}
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
                  isActive(link.href) ? "bg-white/5 font-semibold text-white" : "text-zinc-300"
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
                setShowPromoModal(true);
              }}
              className="rounded-lg px-4 py-3 text-left text-sm text-zinc-300"
            >
              {t.nav.promoCode}
            </button>
            {showCreditTopUp && (
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
            )}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
              <button type="button" onClick={openAccount} className="btn-secondary w-full text-sm">
                {isAuthenticated ? t.nav.myPage : t.nav.login}
              </button>
              {!isAuthenticated && (
                <button type="button" onClick={openTrial} className="btn-primary w-full text-sm">
                  {t.nav.trial}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
