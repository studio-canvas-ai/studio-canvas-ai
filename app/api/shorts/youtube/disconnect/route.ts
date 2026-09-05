import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import { clearYoutubeTokens } from "@/lib/youtube/tokenStore";

export const runtime = "nodejs";

/**
 * POST /api/shorts/youtube/disconnect
 */
export async function POST(req: Request) {
  try {
    const resolved = await resolveAppUser(req);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, code: "auth" },
        { status: resolved.status }
      );
    }
    await clearYoutubeTokens();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[shorts/youtube/disconnect]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
