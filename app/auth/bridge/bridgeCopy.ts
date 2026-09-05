import { LOCALE_COOKIE } from "@/lib/i18n/types";

export type BridgeLocale = "kr" | "en";

const COPY = {
  kr: {
    loading: "로그인 중입니다. 잠시만 기다려주세요...",
    failed: "로그인에 실패했습니다",
    redirecting: "이동 중…",
    continue: "계속하기",
  },
  en: {
    loading: "Signing in, please wait...",
    failed: "Sign-in failed",
    redirecting: "Redirecting…",
    continue: "Continue",
  },
} as const;

export type BridgeCopy = {
  loading: string;
  failed: string;
  redirecting: string;
  continue: string;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Site locale cookie → browser language → English. Only ko vs en for bridge UI. */
export function detectBridgeLocale(): BridgeLocale {
  try {
    if (readCookie(LOCALE_COOKIE) === "kr") return "kr";
  } catch {
    /* ignore */
  }

  try {
    const lang = (
      typeof navigator !== "undefined" ? navigator.language : ""
    ).toLowerCase();
    if (lang.startsWith("ko")) return "kr";
  } catch {
    /* ignore */
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Seoul") return "kr";
  } catch {
    /* ignore */
  }

  return "en";
}

export function getBridgeCopy(
  locale: BridgeLocale = detectBridgeLocale()
): BridgeCopy {
  return COPY[locale];
}
