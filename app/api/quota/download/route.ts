import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  consumeDownloadQuota,
  snapshotPlanUsage,
  type DownloadQuotaKind,
} from "@/lib/db/planUsage";

export const runtime = "nodejs";

/**
 * Decrement period FHD/4K remaining. Admins are not exempt.
 */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  let body: { kind?: string } = {};
  try {
    body = (await req.json()) as { kind?: string };
  } catch {
    body = {};
  }

  const kind: DownloadQuotaKind =
    body.kind === "uhd4k" || body.kind === "4k" ? "uhd4k" : "fhd";

  const result = await consumeDownloadQuota({
    userId: resolved.user.id,
    kind,
  });

  if (!result.ok) {
    const usage = snapshotPlanUsage(resolved.user);
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found", usage }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "insufficient_quota",
        kind,
        remaining: result.remaining,
        usage,
      },
      { status: 402 }
    );
  }

  return NextResponse.json({
    ok: true,
    kind,
    remaining: result.remaining,
    usage: snapshotPlanUsage(result.user),
  });
}
