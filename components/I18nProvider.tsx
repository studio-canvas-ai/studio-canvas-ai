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
  LOCALE_STORAGE_KEY,
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

function readStoredLocale(): Locale | null {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && isValidLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

function lockDocumentLanguage(locale: Locale) {
  const html = document.documentElement;
  html.lang = getHtmlLang(locale);
  html.setAttribute("translate", "no");
  html.classList.add("notranslate");
  if (document.body) {
    document.body.setAttribute("translate", "no");
    document.body.classList.add("notranslate");
  }
}

/**
 * Resolve client locale without fighting the server/middleware cookie.
 * Cookie wins → localStorage → server initial → Accept-Language (never TZ override).
 */
function resolveClientLocale(initialLocale: Locale): Locale {
  const cookieLocale = getCookie(LOCALE_COOKIE);
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale;

  const stored = readStoredLocale();
  if (stored) return stored;

  if (initialLocale && isValidLocale(initialLocale)) return initialLocale;

  return detectFromAcceptLanguage(
    typeof navigator !== "undefined" ? navigator.language || "en" : "en"
  );
}

type I18nProviderProps = {
  children: ReactNode;
  /** Server-resolved locale from cookie / middleware (avoids EN→KR flash). */
  initialLocale?: Locale;
};

export function I18nProvider({
  children,
  initialLocale = "en",
}: I18nProviderProps) {
  const boot = isValidLocale(initialLocale) ? initialLocale : "en";
  const [locale, setLocaleState] = useState<Locale>(boot);
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    const resolved = resolveClientLocale(boot);
    setLocaleState(resolved);
    setCookie(LOCALE_COOKIE, resolved);
    writeStoredLocale(resolved);
    lockDocumentLanguage(resolved);
    setIsReady(true);
  }, [boot]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setCookie(LOCALE_COOKIE, newLocale);
    setCookie(`${LOCALE_COOKIE}-manual`, "true");
    writeStoredLocale(newLocale);
    lockDocumentLanguage(newLocale);
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
