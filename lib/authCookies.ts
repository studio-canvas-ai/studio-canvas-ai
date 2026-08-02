/**
 * Auth.js cookie names/options.
 * Avoid `__Host-` CSRF cookies — they are rejected when Secure/Path/Domain
 * constraints are not met (common behind custom domains / www).
 */

export const AUTH_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function useSecureAuthCookies(): boolean {
  const site =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  if (site.startsWith("https://")) return true;
  if (site.startsWith("http://localhost") || site.startsWith("http://127.0.0.1")) {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

export function authSessionCookieName(): string {
  return useSecureAuthCookies()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export function authCsrfCookieName(): string {
  return useSecureAuthCookies()
    ? "__Secure-authjs.csrf-token"
    : "authjs.csrf-token";
}

export function authCallbackUrlCookieName(): string {
  return useSecureAuthCookies()
    ? "__Secure-authjs.callback-url"
    : "authjs.callback-url";
}

export function authCookieOptions(maxAge = AUTH_SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureAuthCookies(),
    // Host-only (no Domain) so www and apex do not share mismatched cookies.
    maxAge,
  };
}

/** NextAuth `cookies` config — keeps CSRF/session cookies compatible with our domain. */
export function authJsCookiesConfig() {
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureAuthCookies(),
  };
  return {
    sessionToken: {
      name: authSessionCookieName(),
      options: base,
    },
    callbackUrl: {
      name: authCallbackUrlCookieName(),
      options: { ...base, httpOnly: false },
    },
    csrfToken: {
      name: authCsrfCookieName(),
      options: base,
    },
  };
}
