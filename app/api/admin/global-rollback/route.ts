import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { rollbackAllStudioStoresTo } from "@/lib/studioStore/globalRollback";
import { GLOBAL_ROLLBACK_CONFIRM } from "@/lib/studioStore/rollbackConfirm";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { targetTimestamp, confirm: "ROLLBACK" }
 * Restores every user whose snapshot exists at or before the timestamp
 * to that user's latest snapshot as of that instant.
 */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    targetTimestamp?: string;
    target_timestamp?: string;
    confirm?: string;
  };

  if ((body.confirm || "").trim() !== GLOBAL_ROLLBACK_CONFIRM) {
    return NextResponse.json(
      { error: "confirm_required", expected: GLOBAL_ROLLBACK_CONFIRM },
      { status: 400 }
    );
  }

  const raw = (body.targetTimestamp || body.target_timestamp || "").trim();
  const target = new Date(raw);
  if (!raw || Number.isNaN(target.getTime())) {
    return NextResponse.json({ error: "invalid_timestamp" }, { status: 400 });
  }
  if (target.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: "timestamp_in_future" }, { status: 400 });
  }

  try {
    const result = await rollbackAllStudioStoresTo(target);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/global-rollback]", err);
    const message = err instanceof Error ? err.message : "rollback_failed";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
