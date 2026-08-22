/**
 * Shared guards for the mandatory terms-consent gate.
 * Kept free of Next/Supabase imports so middleware and clients share one source of truth.
 */

const DEFAULT_AFTER_CONSENT = "/";

/** Collapse trailing slashes (except root) so `/terms-consent/` matches exemptions. */
export function normalizeAppPathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Safe in-app destination after login / consent.
 * Blocks open redirects and destinations that would re-enter the auth/consent loop.
 */
export function safePostConsentPath(
  raw: string | null | undefined,
  fallback = DEFAULT_AFTER_CONSENT
): string {
  if (!raw || typeof raw !== "string") return fallback;

  let path = raw.trim();
  try {
    // Absolute URLs: never follow a foreign host (open-redirect).
    if (path.startsWith("https://") || path.startsWith("http://")) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  if (!path.startsWith("/") || path.startsWith("//")) return fallback;

  const pathnameOnly = normalizeAppPathname(path.split(/[?#]/)[0] || "/");

  if (
    pathnameOnly === "/terms-consent" ||
    pathnameOnly.startsWith("/api/") ||
    pathnameOnly === "/api" ||
    pathnameOnly.startsWith("/auth/") ||
    pathnameOnly === "/auth"
  ) {
    return fallback;
  }

  return path;
}

/** Routes allowed while JWT has termsAgreed === false. */
export function isTermsConsentExempt(pathname: string): boolean {
  const p = normalizeAppPathname(pathname);

  if (p === "/api" || p.startsWith("/api/")) return true;
  if (p === "/auth" || p.startsWith("/auth/")) return true;
  if (p === "/terms-consent") return true;
  if (p === "/terms" || p === "/privacy") return true;
  if (p === "/admin" || p.startsWith("/admin/")) return true;
  return false;
}

/** Build /terms-consent?next=… without nesting consent URLs. */
export function buildTermsConsentUrl(nextPath: string): string {
  const next = safePostConsentPath(nextPath);
  return `/terms-consent?next=${encodeURIComponent(next)}`;
}
