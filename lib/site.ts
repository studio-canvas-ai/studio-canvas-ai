/**
 * Canonical public site origin for Studio Canvas AI.
 * Use for metadata, sitemap, OAuth/payment absolute URLs.
 */
export const PRODUCTION_SITE_URL = "https://www.studio-canvas-ai.com";

const LOCAL_DEV_URL = "http://localhost:3000";

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

/**
 * Resolve the absolute site origin.
 * Priority: NEXT_PUBLIC_SITE_URL → AUTH_URL → NEXTAUTH_URL →
 * production canonical (on Vercel production) → VERCEL_URL → localhost.
 *
 * Do not use this for browser `/api/*` calls — use relative paths via `apiFetchJson`
 * so apex↔www redirects cannot break POSTs.
 */
export function getSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  return LOCAL_DEV_URL;
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
