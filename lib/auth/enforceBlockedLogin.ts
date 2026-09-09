import { NextResponse, type NextRequest } from "next/server";
import {
  authCallbackUrlCookieName,
  authCookieOptions,
  authCsrfCookieName,
  authSessionCookieName,
} from "@/lib/authCookies";
import { isAuthCookieName } from "@/lib/auth/clearAuthStorage";
import {
  BLOCKED_LOGIN_ERROR_CODE,
  blockedLoginMessage,
  isBlockedLoginEmail,
} from "@/lib/auth/blockedAccounts";

/** Expire Auth.js + Supabase auth cookies on an existing response. */
export function clearAuthCookiesOnResponse(
  response: NextResponse,
  request?: NextRequest
): NextResponse {
  const cleared = { ...authCookieOptions(0), maxAge: 0 };
  response.cookies.set(authSessionCookieName(), "", cleared);
  response.cookies.set(authCsrfCookieName(), "", cleared);
  response.cookies.set(authCallbackUrlCookieName(), "", {
    ...cleared,
    httpOnly: false,
  });

  if (request) {
    for (const cookie of request.cookies.getAll()) {
      if (!isAuthCookieName(cookie.name)) continue;
      response.cookies.set(cookie.name, "", {
        ...cleared,
        httpOnly: false,
      });
    }
  }

  return response;
}

export function blockedLoginJsonResponse(
  request?: NextRequest,
  status = 403
): NextResponse {
  const response = NextResponse.json(
    {
      ok: false,
      authenticated: false,
      blockedLogin: true,
      code: BLOCKED_LOGIN_ERROR_CODE,
      error: blockedLoginMessage("kr"),
    },
    { status }
  );
  return clearAuthCookiesOnResponse(response, request);
}

export function assertEmailNotBlocked(
  email: string | null | undefined
): void {
  if (isBlockedLoginEmail(email)) {
    throw new Error(
      `${BLOCKED_LOGIN_ERROR_CODE}: ${blockedLoginMessage("kr")}`
    );
  }
}
