import { NextResponse, type NextRequest } from "next/server";
import {
  fetchNaverOidcUserinfo,
  normalizeNaverAuthorization,
} from "@/lib/supabase/naver-userinfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Userinfo proxy for Supabase Custom OAuth (`custom:naver`).
 *
 * Supabase Auth (GoTrue) calls this with Authorization: Bearer <naver_access_token>.
 * We call https://openapi.naver.com/v1/nid/me and flatten
 * `{ resultcode, response: { id, email, ... } }` → `{ sub, email, ... }`.
 *
 * Dashboard → Authentication → Providers → Custom (naver) → Manual OAuth2:
 *   Userinfo URL = https://www.studio-canvas-ai.com/api/auth/naver/userinfo
 *   Scopes = profile  (do NOT include openid)
 * Prefer Edge Function URL if Vercel Deployment Protection is enabled
 * (see supabase/functions/naver-userinfo).
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function GET(request: NextRequest) {
  // Prefer standard header; allow access_token query as a debug fallback.
  const headerAuth =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  const queryToken = request.nextUrl.searchParams.get("access_token");
  const authorization =
    normalizeNaverAuthorization(headerAuth) ??
    normalizeNaverAuthorization(queryToken ? `Bearer ${queryToken}` : null);

  if (!authorization) {
    return NextResponse.json(
      { error: "Missing Authorization header (expected: Bearer <naver_access_token>)" },
      { status: 401 }
    );
  }

  try {
    const result = await fetchNaverOidcUserinfo(authorization);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Explicit JSON body — top-level email/sub for GoTrue Claims unmarshal.
    return NextResponse.json(result.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Naver userinfo proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
