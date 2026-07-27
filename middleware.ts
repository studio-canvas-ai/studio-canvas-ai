import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, detectLocale, isValidLocale } from "@/lib/i18n";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const userSelected = request.cookies.get(`${LOCALE_COOKIE}-manual`)?.value === "true";

  // Respect manual user selection
  if (userSelected && existingLocale && isValidLocale(existingLocale)) {
    response.headers.set("x-detected-locale", existingLocale);
    return response;
  }

  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    "";

  const acceptLanguage = request.headers.get("accept-language") || "";
  const detected = detectLocale(country, acceptLanguage, existingLocale);

  response.cookies.set(LOCALE_COOKIE, detected, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  response.headers.set("x-detected-locale", detected);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
