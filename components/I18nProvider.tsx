"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type Locale,
  type Translations,
  LOCALE_COOKIE,
  getTranslations,
  isValidLocale,
  detectFromAcceptLanguage,
  getHtmlLang,
} from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function detectClientLocale(): Locale {
  const cookieLocale = getCookie(LOCALE_COOKIE);
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale;

  // Client-side geo hint via timezone (Korea = Asia/Seoul)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Seoul") return "kr";
  } catch {
    // ignore
  }

  return detectFromAcceptLanguage(navigator.language || "en");
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const detected = detectClientLocale();
    setLocaleState(detected);
    document.documentElement.lang = getHtmlLang(detected);
    setIsReady(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setCookie(LOCALE_COOKIE, newLocale);
    setCookie(`${LOCALE_COOKIE}-manual`, "true");
    document.documentElement.lang = getHtmlLang(newLocale);
  }, []);

  const t = getTranslations(locale);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale, isReady }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
