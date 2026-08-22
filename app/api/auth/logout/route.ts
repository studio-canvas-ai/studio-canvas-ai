import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieOptions,
  authCallbackUrlCookieName,
  authCsrfCookieName,
  authSessionCookieName,
} from "@/lib/authCookies";

export const runtime = "nodejs";

/**
 * Clears Auth.js, Supabase, locale, and other host cookies seen on the request.
 * Pair with client-side Supabase signOut() + storage purge.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const cleared = { ...authCookieOptions(0), maxAge: 0 };
  response.cookies.set(authSessionCookieName(), "", cleared);
  response.cookies.set(authCsrfCookieName(), "", cleared);
  response.cookies.set(authCallbackUrlCookieName(), "", {
    ...cleared,
    httpOnly: false,
  });

  for (const cookie of request.cookies.getAll()) {
    response.cookies.set(cookie.name, "", {
      ...cleared,
      httpOnly: false,
    });
  }
  return response;
}
