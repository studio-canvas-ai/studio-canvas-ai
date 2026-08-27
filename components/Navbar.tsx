"use client";

import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import LanguageSelector from "@/components/LanguageSelector";
import BottomTabBar from "@/components/BottomTabBar";
import { isDomesticMarket } from "@/lib/market";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  LogOut,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PRINT_UNIFIED_EDITOR_PATH } from "@/lib/printUnifiedEditor";

const PRIMARY_LINKS = [
  { href: "/", labelKey: "home" as const, authRequired: false },
  { href: "/styles", labelKey: "styles" as const, authRequired: false },
  { href: "/gallery/my", labelKey: "myGallery" as const, authRequired: true },
  { href: "/pricing", labelKey: "pricing" as const, authRequired: false },
  { href: "/mypage", labelKey: "myPage" as const, authRequired: true },
] as const;

const SECONDARY_LINKS = [
  { href: "/support", labelKey: "support" as const, authRequired: false },
] as const;

export type PrintWizardNavbarBack = {
  onClick: () => void;
  ariaLabel?: string;
};

export type NavbarProps = {
  printWizardBack?: PrintWizardNavbarBack;
};

export default function Navbar({ printWizardBack }: NavbarProps = {}) {
  const { t, locale } = useI18n();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const {
    openAuthModal,
    setShowTopUpModal,
    setShowPromoModal,
    credits,
    creditsLabel,
    unlimitedCredits,
    isAuthenticated,
    authUser,
    promoWallet,
    signOutUser,
  } = useCredits();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const showCreditTopUp = !isDomesticMarket(locale);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = profileRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  const openLogin = () => {
    setProfileOpen(false);
    openAuthModal({ clearPending: true });
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setProfileOpen(false);
    try {
      await signOutUser();
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const displayName = authUser?.name || t.nav.myPage;
  const displayEmail = authUser?.email || "";

  const avatarEl = (size: "sm" | "md" = "md") => {
    const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
    const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    if (authUser?.image) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={authUser.image}
          alt={displayName}
          className={`${box} rounded-full object-cover`}
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      <span
        className={`inline-flex ${box} items-center justify-center rounded-full bg-gradient-to-br from-glow-purple/80 to-glow-emerald/80`}
      >
        <UserRound className={`${icon} text-white`} />
      </span>
    );
  };

  const creditBadge = (
    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] tabular-nums text-amber-100 sm:px-2.5 sm:py-1 sm:text-[11px]">
      {promoWallet && !unlimitedCredits ? t.nav.promoBalance : "⚡"}{" "}
      {unlimitedCredits
        ? creditsLabel
        : t.nav.creditsBadge.replace("{n}", String(credits))}
    </span>
  );

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-50 border-b border-white/[0.06] transition-all duration-300 ${
          scrolled
            ? "bg-navy/95 backdrop-blur-2xl"
            : "bg-navy/90 backdrop-blur-xl"
        }`}
      >
        {/* Mobile slim header */}
        <nav className="mx-auto flex h-12 w-full max-w-full items-center justify-between gap-3 px-4 sm:px-6 md:hidden">
          <div className="relative z-10 flex min-w-0 shrink-0 items-center gap-1.5">
            {printWizardBack ? (
              <button
                type="button"
                onClick={printWizardBack.onClick}
                aria-label={printWizardBack.ariaLabel ?? t.canvasStudio.wizardBackToPlanning}
                title={printWizardBack.ariaLabel ?? t.canvasStudio.wizardBackToPlanning}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-glow-purple to-glow-emerald shadow-glow-sm">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-display truncate text-sm font-semibold tracking-tight text-white">
              Studio Canvas
            </span>
            </Link>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPromoModal(true)}
              className="px-1 text-[10px] text-zinc-400 underline-offset-2 hover:text-white hover:underline"
            >
              {t.nav.promoCode}
            </button>
            {creditBadge}
            <LanguageSelector />
            {isAuthenticated ? (
              <Link
                href="/mypage"
                className="rounded-full border border-white/15 p-0.5"
                aria-label={t.nav.myPage}
              >
                {avatarEl("sm")}
              </Link>
            ) : (
              <button
                type="button"
                onClick={openLogin}
                className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-zinc-200"
              >
                {t.nav.login}
              </button>
            )}
          </div>
        </nav>

        {/* Desktop / tablet horizontal nav */}
        <nav className="relative z-50 mx-auto hidden h-14 w-full max-w-full items-center gap-3 px-6 md:flex sm:px-8 lg:h-16 lg:gap-4 lg:px-10 xl:px-12">
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            {printWizardBack ? (
              <button
                type="button"
                onClick={printWizardBack.onClick}
                aria-label={printWizardBack.ariaLabel ?? t.canvasStudio.wizardBackToPlanning}
                title={printWizardBack.ariaLabel ?? t.canvasStudio.wizardBackToPlanning}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5"
            >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-glow-purple to-glow-emerald shadow-glow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-display whitespace-nowrap text-lg font-semibold tracking-tight text-white">
              Studio Canvas AI
            </span>
            </Link>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto lg:gap-2">
            {[...PRIMARY_LINKS, ...SECONDARY_LINKS].map((link) => {
              const locked = link.authRequired && !isAuthenticated;
              if (locked) {
                return (
                  <span
                    key={link.href}
                    role="link"
                    aria-disabled="true"
                    title={t.nav.login}
                    className="shrink-0 cursor-default rounded-full px-2.5 py-1.5 text-sm text-zinc-500/70 select-none lg:px-3"
                  >
                    {t.nav[link.labelKey]}
                  </span>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1.5 text-sm transition-colors lg:px-3 ${
                    isActive(link.href)
                      ? "bg-white/10 font-semibold text-white"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {t.nav[link.labelKey]}
                </Link>
              );
            })}
            {/* TEMP: Screen 26 unified editor test entry — remove when no longer needed */}
            <Link
              href={PRINT_UNIFIED_EDITOR_PATH}
              data-temp-nav="print-unified-editor-test"
              title="Screen 26 통합 에디터 (테스트)"
              className={`shrink-0 rounded-full border px-2.5 py-1.5 text-sm font-semibold transition-colors lg:px-3 ${
                isActive(PRINT_UNIFIED_EDITOR_PATH)
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                  : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100"
              }`}
            >
              새 에디터 테스트
            </Link>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2 lg:gap-3">
            <button
              type="button"
              onClick={() => setShowPromoModal(true)}
              className="hidden whitespace-nowrap text-[11px] text-zinc-400 underline-offset-4 hover:text-white hover:underline xl:inline"
            >
              {t.nav.promoCode}
            </button>
            <LanguageSelector />
            <div className="flex items-center gap-1.5">
              {creditBadge}
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

            {isAuthenticated ? (
              <div className="relative shrink-0" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className="inline-flex max-w-[11rem] items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-2.5 pl-1 text-sm text-white transition hover:border-white/30 hover:bg-white/10"
                >
                  {avatarEl("md")}
                  <span className="hidden max-w-[5.5rem] truncate text-xs font-medium lg:inline xl:max-w-[7rem]">
                    {displayName}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-white/60 transition ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-[60] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-500/40 bg-slate-800/95 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                  >
                    <div className="border-b border-slate-600/50 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-slate-50">
                        {displayName}
                      </p>
                      {displayEmail ? (
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {displayEmail}
                        </p>
                      ) : null}
                    </div>
                    <div className="p-1.5">
                      <Link
                        href="/mypage"
                        role="menuitem"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-100 transition hover:bg-slate-700/80"
                      >
                        <UserRound className="h-4 w-4 text-slate-300" />
                        {t.nav.myPage}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={loggingOut}
                        onClick={() => void handleLogout()}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-500/15 disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" />
                        {loggingOut ? t.mypage.loggingOut : t.mypage.logout}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openLogin}
                  className="btn-secondary whitespace-nowrap px-4 py-2 text-sm"
                >
                  {t.nav.login}
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal({ clearPending: true })}
                  className="btn-primary whitespace-nowrap px-4 py-2 text-sm"
                >
                  {t.nav.trial}
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <BottomTabBar />
    </>
  );
}
