import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { LOCALE_COOKIE, detectLocale, isValidLocale } from "@/lib/i18n";
import { GEO_COUNTRY_COOKIE } from "@/lib/market";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import {
  buildTermsConsentUrl,
  isTermsConsentExempt,
  normalizeAppPathname,
  safePostConsentPath,
} from "@/lib/termsConsent";

function withPathnameHeader(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sca-pathname", pathname);
  return requestHeaders;
}

async function redirectIfTermsRequired(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  if (isTermsConsentExempt(pathname)) return null;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const token = await getToken({
      req: request,
      secret,
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    // Only provisional sessions set termsAgreed === false. Missing claim = legacy OK.
    if (!token || token.termsAgreed !== false) return null;

    const next = safePostConsentPath(
      pathname + (request.nextUrl.search ? request.nextUrl.search : "")
    );
    return NextResponse.redirect(
      new URL(buildTermsConsentUrl(next), request.nextUrl.origin)
    );
  } catch {
    return null;
  }
}

async function redirectIfProtectedPathUnauthed(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  const protectedPrefixes = ["/gallery/my", "/profile", "/mypage"];
  if (!protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const token = await getToken({
      req: request,
      secret,
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    if (token?.uid || token?.sub) return null;
  } catch {
    /* fall through to redirect */
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const normalizedPath = normalizeAppPathname(pathname);

  // Auth routes + large chunk uploads: skip Supabase refresh on request body.
  if (
    normalizedPath.startsWith("/api/auth") ||
    normalizedPath.startsWith("/auth/") ||
    normalizedPath.startsWith("/api/shorts/chunk")
  ) {
    return NextResponse.next({
      request: { headers: withPathnameHeader(request, pathname) },
    });
  }

  // Supabase OAuth often returns `?code=` / `?error=` to Site URL (= `/`).
  // Only forward from the root — do NOT steal `/generate?error=…` (NextAuth
  // pages.error) or other app routes, which looked like broken/404 navigation.
  if (
    (normalizedPath === "/" || normalizedPath === "") &&
    (searchParams.has("code") ||
      searchParams.has("error") ||
      searchParams.has("error_description") ||
      searchParams.has("error_code"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const termsRedirect = await redirectIfTermsRequired(request, pathname);
  if (termsRedirect) return termsRedirect;

  const protectedRedirect = await redirectIfProtectedPathUnauthed(
    request,
    normalizedPath
  );
  if (protectedRedirect) return protectedRedirect;

  const requestHeaders = withPathnameHeader(request, pathname);
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    "";

  if (country) {
    response.cookies.set(GEO_COUNTRY_COOKIE, country.toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const userSelected = request.cookies.get(`${LOCALE_COOKIE}-manual`)?.value === "true";

  if (userSelected && existingLocale && isValidLocale(existingLocale)) {
    response.headers.set("x-detected-locale", existingLocale);
    return refreshSupabaseSession(request, response);
  }

  const acceptLanguage = request.headers.get("accept-language") || "";
  const detected = detectLocale(country, acceptLanguage, existingLocale);

  response.cookies.set(LOCALE_COOKIE, detected, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  response.headers.set("x-detected-locale", detected);
  return refreshSupabaseSession(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
