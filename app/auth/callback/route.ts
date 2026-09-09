import { NextResponse, type NextRequest } from "next/server";
import { exchangeSupabaseCode } from "@/lib/supabase/exchange";
import { formatOAuthError } from "@/lib/supabase/oauthErrors";
import { appPathWithAuthError } from "@/lib/appRoutes";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Supabase OAuth / magic-link callback.
 * Exchanges the PKCE code (cookies set on the redirect), then /auth/bridge
 * mints the NextAuth session.
 *
 * Expected return shapes:
 * - Success: /auth/callback?code=…&next=/  (landing home by default)
 * - Error:   /auth/callback?error=…&error_description=…
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const oauthError =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("error_code");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}${appPathWithAuthError(formatOAuthError(oauthError))}`
    );
  }

  if (!code) {
    // Hash-based tokens are not used with PKCE; missing code usually means
    // a bad redirect allow-list or the user landed here without completing OAuth.
    return NextResponse.redirect(
      `${origin}${appPathWithAuthError(formatOAuthError("missing_code"))}`
    );
  }

  const bridgeUrl = new URL("/auth/bridge", origin);
  bridgeUrl.searchParams.set("next", next);
  const redirect = NextResponse.redirect(bridgeUrl);

  try {
    const { error } = await exchangeSupabaseCode(request, code, redirect);
    if (error) {
      return NextResponse.redirect(
        `${origin}${appPathWithAuthError(formatOAuthError(error))}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "code_exchange_failed";
    console.error("[auth/callback] exchange failed:", message);
    return NextResponse.redirect(
      `${origin}${appPathWithAuthError(formatOAuthError(message))}`
    );
  }

  return redirect;
}
