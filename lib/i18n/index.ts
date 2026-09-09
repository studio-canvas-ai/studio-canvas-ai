import type { Locale, Translations } from "./types";
import { LOCALES } from "./types";
import { applyChromeOverlay } from "./chrome";
import en from "./locales/en";
import kr from "./locales/kr";
import es from "./locales/es";
import zh from "./locales/zh";
import ja from "./locales/ja";
import fr from "./locales/fr";
import de from "./locales/de";
import it from "./locales/it";
import vi from "./locales/vi";
import hi from "./locales/hi";

export * from "./types";
export { fillCanvas } from "./canvasStudio";

export const translations: Record<Locale, Translations> = {
  en,
  kr,
  es,
  zh,
  ja,
  fr,
  de,
  it,
  vi,
  hi,
};

export function isValidLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Resolve UI copy for a locale.
 * Unknown codes fall back to English. Non-en/kr packs also receive chrome
 * overlays (nav/hero/footer/credits) so the language selector visibly switches.
 */
export function getTranslations(locale: Locale): Translations {
  const base = translations[locale] ?? translations.en;
  return applyChromeOverlay(locale, base);
}

/** Detect locale from browser Accept-Language header */
export function detectFromAcceptLanguage(acceptLanguage: string): Locale {
  const lower = acceptLanguage.toLowerCase();
  if (lower.includes("ko")) return "kr";
  if (lower.includes("ja")) return "ja";
  if (lower.includes("zh")) return "zh";
  if (lower.includes("es")) return "es";
  if (lower.includes("fr")) return "fr";
  if (lower.includes("de")) return "de";
  if (lower.includes("it")) return "it";
  if (lower.includes("vi")) return "vi";
  if (lower.includes("hi")) return "hi";
  return "en";
}

/** Geo + browser auto-detection. Default product language is Korean. */
export function detectLocale(
  country: string,
  acceptLanguage: string,
  userOverride?: string
): Locale {
  // Sticky cookie / explicit override always wins (including first middleware pass).
  if (userOverride && isValidLocale(userOverride)) return userOverride;

  const countryUpper = (country || "").toUpperCase();
  if (countryUpper === "KR") return "kr";

  const browserLocale = detectFromAcceptLanguage(acceptLanguage);
  if (browserLocale && isValidLocale(browserLocale) && browserLocale !== "en") {
    return browserLocale;
  }

  // Product default: Korean (Incognito / missing geo / English browser chrome).
  return "kr";
}

export function getHtmlLang(locale: Locale): string {
  const map: Record<Locale, string> = {
    en: "en",
    kr: "ko",
    es: "es",
    zh: "zh",
    ja: "ja",
    fr: "fr",
    de: "de",
    it: "it",
    vi: "vi",
    hi: "hi",
  };
  return map[locale];
}
