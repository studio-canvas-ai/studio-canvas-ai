/** Cookie set by middleware from Vercel/CF geo headers (locale defaulting only). */
export const GEO_COUNTRY_COOKIE = "sca_geo_country";

/** Korean UI locale is the sole switch for domestic pricing / PG. */
export function isDomesticLocale(locale: string): boolean {
  return locale === "kr";
}

/**
 * Domestic market follows the active UI language only.
 * Geo may still set the *default* locale in middleware, but after the user
 * picks a language, currency / plan set / payment provider must not fight it.
 */
export function isDomesticMarket(
  locale: string,
  _countryCode?: string | null
): boolean {
  return isDomesticLocale(locale);
}

export function readGeoCountryFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${GEO_COUNTRY_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
