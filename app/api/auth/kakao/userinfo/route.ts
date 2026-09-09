import { NextResponse, type NextRequest } from "next/server";
import {
  fetchKakaoOidcUserinfo,
  normalizeKakaoAuthorization,
} from "@/lib/supabase/kakao-userinfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Userinfo proxy for Supabase Custom OAuth (`custom:kakao`).
 *
 * Avoids built-in Kakao provider KOE205 (hardcoded `account_email` scope).
 * Flattens `/v2/user/me` → `{ sub, email, name, picture, … }`.
 *
 * Dashboard → Authentication → Providers → Custom (identifier: `kakao`):
 *   Authorization = https://kauth.kakao.com/oauth/authorize
 *   Token         = https://kauth.kakao.com/oauth/token
 *   Userinfo URL  = https://www.studio-canvas-ai.com/api/auth/kakao/userinfo
 *   Scopes        = profile_nickname profile_image
 *                   (no account_email, no openid)
 * Prefer Edge Function if Vercel Deployment Protection is on
 * (see supabase/functions/kakao-userinfo).
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
  const headerAuth =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  const queryToken = request.nextUrl.searchParams.get("access_token");
  const authorization =
    normalizeKakaoAuthorization(headerAuth) ??
    normalizeKakaoAuthorization(queryToken ? `Bearer ${queryToken}` : null);

  if (!authorization) {
    return NextResponse.json(
      { error: "Missing Authorization header (expected: Bearer <kakao_access_token>)" },
      { status: 401 }
    );
  }

  try {
    const result = await fetchKakaoOidcUserinfo(authorization);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

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
    console.error("Kakao userinfo proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
