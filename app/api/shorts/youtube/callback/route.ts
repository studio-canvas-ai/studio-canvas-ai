import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  exchangeYoutubeCode,
  parseYoutubeOAuthState,
} from "@/lib/youtube/oauth";

export const runtime = "nodejs";

function siteOrigin(req: Request): string {
  const fromEnv = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/**
 * GET /api/shorts/youtube/callback
 * OAuth redirect handler — stores refresh token cookie, returns to studio.
 */
export async function GET(req: Request) {
  const origin = siteOrigin(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const state = parseYoutubeOAuthState(stateRaw);
  const returnTo = state?.returnTo || "/shorts/studio";

  const fail = (codeName: string) =>
    NextResponse.redirect(
      `${origin}${returnTo}${returnTo.includes("?") ? "&" : "?"}yt=error&ytCode=${encodeURIComponent(codeName)}`
    );

  if (oauthError) {
    return fail(oauthError);
  }
  if (!code || !state) {
    return fail("invalid_callback");
  }

  try {
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return fail("auth");
    }
    if (resolved.user.id !== state.uid) {
      return fail("user_mismatch");
    }

    await exchangeYoutubeCode({
      code,
      userId: resolved.user.id,
      reqUrl: req.url,
    });

    return NextResponse.redirect(
      `${origin}${returnTo}${returnTo.includes("?") ? "&" : "?"}yt=connected`
    );
  } catch (err) {
    console.error("[shorts/youtube/callback]", err);
    const msg = err instanceof Error ? err.message : "callback_failed";
    return fail(msg);
  }
}
