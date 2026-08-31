"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Images,
  LayoutGrid,
  CreditCard,
  UserRound,
  Clapperboard,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";
import { APP_HOME_PATH, normalizeAppTabPath } from "@/lib/appRoutes";

const TAB_ITEMS = [
  { href: APP_HOME_PATH, labelKey: "home" as const, Icon: Home, authRequired: false },
  { href: "/styles", labelKey: "styles" as const, Icon: LayoutGrid, authRequired: false },
  {
    href: SHORTS_THUMBNAIL_PATH,
    labelKey: "videoThumbnail" as const,
    Icon: Clapperboard,
    authRequired: false,
  },
  { href: "/gallery/my", labelKey: "myGallery" as const, Icon: Images, authRequired: true },
  { href: "/pricing", labelKey: "pricing" as const, Icon: CreditCard, authRequired: false },
  { href: "/mypage", labelKey: "myPage" as const, Icon: UserRound, authRequired: true },
];

function isTabActive(pathname: string, href: string) {
  const current = normalizeAppTabPath(pathname);
  const target = normalizeAppTabPath(href);
  if (target === APP_HOME_PATH) return current === APP_HOME_PATH;
  return current === target || current.startsWith(`${target}/`);
}

/** Fixed bottom tab bar — mobile only (hidden from md up). */
export default function BottomTabBar() {
  const { t } = useI18n();
  const pathname = normalizeAppTabPath(usePathname() || APP_HOME_PATH);
  const { isAuthenticated } = useCredits();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname === "/terms-consent"
  ) {
    return null;
  }

  return (
    <nav
      data-bottom-tabs
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-navy/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-2xl md:hidden"
      aria-label={t.nav.menu}
    >
      <ul className="mx-auto flex h-[3.75rem] max-w-lg items-stretch justify-between px-1">
        {TAB_ITEMS.map(({ href, labelKey, Icon, authRequired }) => {
          const locked = authRequired && !isAuthenticated;
          const active = !locked && isTabActive(pathname, href);
          const label = t.nav[labelKey];

          if (locked) {
            return (
              <li key={href} className="flex min-w-0 flex-1">
                <span
                  role="link"
                  aria-disabled="true"
                  title={t.nav.login}
                  className="flex min-w-0 flex-1 cursor-default flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium text-zinc-600 select-none"
                >
                  <Icon
                    className="h-[1.15rem] w-[1.15rem] shrink-0 text-current"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="max-w-full truncate leading-tight">{label}</span>
                </span>
              </li>
            );
          }

          return (
            <li key={href} className="flex min-w-0 flex-1">
              <Link
                href={href}
                className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={`h-[1.15rem] w-[1.15rem] shrink-0 ${
                    active ? "text-glow-emerald" : "text-current"
                  }`}
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span className="max-w-full truncate leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
