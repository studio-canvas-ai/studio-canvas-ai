/** Cookie set by middleware from Vercel/CF geo headers. */
export const GEO_COUNTRY_COOKIE = "sca_geo_country";

/** Korean UI locale is always treated as the domestic market. */
export function isDomesticLocale(locale: string): boolean {
  return locale === "kr";
}

/**
 * Domestic (Korea) market: Korean locale OR KR geo IP.
 * Credit packs are global-only; annual marketing is not shown on KR UI.
 */
export function isDomesticMarket(
  locale: string,
  countryCode?: string | null
): boolean {
  if (isDomesticLocale(locale)) return true;
  return (countryCode ?? "").trim().toUpperCase() === "KR";
}

export function readGeoCountryFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${GEO_COUNTRY_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
