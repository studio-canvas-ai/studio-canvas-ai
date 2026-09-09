import { NextResponse, type NextRequest } from "next/server";
import {
  getPartnerByAccessToken,
  getPartnerStats,
} from "@/lib/partners/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partner-only dashboard stats.
 * Auth = knowing the slot access_token (path or Authorization Bearer).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token: pathToken } = await context.params;
  const header = request.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const token = (bearer || pathToken || "").trim();

  const partner = await getPartnerByAccessToken(token);
  if (!partner) {
    return NextResponse.json({ error: "invalid_partner_token" }, { status: 401 });
  }
  if (!partner.active) {
    return NextResponse.json({ error: "partner_inactive" }, { status: 403 });
  }

  const stats = await getPartnerStats(partner);
  return NextResponse.json({
    ok: true,
    stats: {
      ...stats,
      partner: {
        id: partner.id,
        code: partner.code,
        email: partner.email,
        channelName: partner.channelName,
        channelUrl: partner.channelUrl,
        active: partner.active,
        // Never expose accessToken back via this endpoint.
      },
    },
  });
}
