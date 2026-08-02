import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, detectLocale, isValidLocale } from "@/lib/i18n";
import { GEO_COUNTRY_COOKIE } from "@/lib/market";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

function withPathnameHeader(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sca-pathname", pathname);
  return requestHeaders;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Auth routes: no Supabase refresh (avoids hanging SSR/hydration).
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/auth/")) {
    return NextResponse.next({
      request: { headers: withPathnameHeader(request, pathname) },
    });
  }

  // Supabase OAuth returns `?code=` to Site URL (origin). Forward to PKCE handler.
  if (
    searchParams.has("code") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/api/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

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
