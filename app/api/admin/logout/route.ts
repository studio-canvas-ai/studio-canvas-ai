import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  getAdminSession,
} from "@/lib/adminAuth";

export const runtime = "nodejs";

/** Clear the dedicated admin session cookie. */
export async function POST() {
  const session = await getAdminSession();
  const response = NextResponse.json({
    ok: true,
    wasAuthenticated: Boolean(session),
  });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
