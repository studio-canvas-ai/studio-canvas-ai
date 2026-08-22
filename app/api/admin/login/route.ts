import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  adminCookieOptions,
  createAdminSessionToken,
  validateAdminCredentials,
} from "@/lib/adminAuth";

export const runtime = "nodejs";

/**
 * Dedicated admin portal login.
 * Sets HTTP-only `sca_admin_session` cookie (not the public Auth.js user session).
 */
export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    email = String(body.email || "");
    password = String(body.password || "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = validateAdminCredentials(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const token = createAdminSessionToken(result.email);
  const response = NextResponse.json({
    ok: true,
    user: { email: result.email },
  });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    token,
    adminCookieOptions(ADMIN_SESSION_MAX_AGE)
  );
  return response;
}
