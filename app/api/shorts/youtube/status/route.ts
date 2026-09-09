import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { isYoutubeApiConfigured } from "@/lib/youtube/config";
import { getYoutubeConnectionStatus } from "@/lib/youtube/oauth";

export const runtime = "nodejs";

/**
 * GET /api/shorts/youtube/status
 */
export async function GET(req: Request) {
  try {
    if (!isYoutubeApiConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        connected: false,
        channelTitle: null,
      });
    }

    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }

    const status = await getYoutubeConnectionStatus(resolved.user.id);
    return NextResponse.json({
      ok: true,
      configured: true,
      connected: status.connected,
      channelTitle: status.channelTitle,
    });
  } catch (err) {
    console.error("[shorts/youtube/status]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
