import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { isYoutubeApiConfigured } from "@/lib/youtube/config";
import { buildYoutubeAuthUrl } from "@/lib/youtube/oauth";

export const runtime = "nodejs";

/**
 * GET /api/shorts/youtube/connect?returnTo=/shorts/studio
 * Starts Google OAuth with youtube.upload scope (separate from app login).
 */
export async function GET(req: Request) {
  try {
    if (!isYoutubeApiConfigured()) {
      return NextResponse.json(
        { error: "youtube_oauth_not_configured", code: "oauth_not_configured" },
        { status: 503 }
      );
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }

    const url = new URL(req.url);
    const returnToRaw = url.searchParams.get("returnTo") || "/shorts/studio";
    const returnTo =
      returnToRaw.startsWith("/") && !returnToRaw.startsWith("//")
        ? returnToRaw
        : "/shorts/studio";

    const authUrl = buildYoutubeAuthUrl({
      userId: resolved.user.id,
      returnTo,
      reqUrl: req.url,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[shorts/youtube/connect]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
