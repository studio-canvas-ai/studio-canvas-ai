import { NextResponse, type NextRequest } from "next/server";
import { exchangeSupabaseCode } from "@/lib/supabase/exchange";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/generate";
  return raw;
}

/**
 * Supabase OAuth / magic-link callback.
 * Exchanges the PKCE code (cookies set on the redirect), then /auth/bridge
 * mints the NextAuth session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/generate?authError=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/generate?authError=missing_code`);
  }

  const bridgeUrl = new URL("/auth/bridge", origin);
  bridgeUrl.searchParams.set("next", next);
  const redirect = NextResponse.redirect(bridgeUrl);

  const { error } = await exchangeSupabaseCode(request, code, redirect);
  if (error) {
    return NextResponse.redirect(
      `${origin}/generate?authError=${encodeURIComponent(error)}`
    );
  }

  return redirect;
}
