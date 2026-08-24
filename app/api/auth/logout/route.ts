import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieOptions,
  authCallbackUrlCookieName,
  authCsrfCookieName,
  authSessionCookieName,
} from "@/lib/authCookies";
import { isAuthCookieName } from "@/lib/auth/clearAuthStorage";

export const runtime = "nodejs";

/**
 * Clears Auth.js + Supabase session cookies only.
 * Must not expire locale / wallet / studio-unrelated cookies wholesale.
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
    if (!isAuthCookieName(cookie.name)) continue;
    response.cookies.set(cookie.name, "", {
      ...cleared,
      httpOnly: false,
    });
  }
  return response;
}
