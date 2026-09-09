import { NextResponse } from "next/server";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  claimActiveSession,
  checkActiveSession,
  supabaseUserIdFromRequest,
} from "@/lib/auth/sessionLock";

export const runtime = "nodejs";

/** GET — validate this browser session against the account's latest claim. */
export async function GET(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error, valid: false },
      { status: resolved.status, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") || "").trim();
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "missing_session_id", valid: false },
      { status: 400 }
    );
  }

  const supabaseUserId = await supabaseUserIdFromRequest(req);
  const result = await checkActiveSession({
    user: resolved.user,
    supabaseUserId,
    sessionId,
  });

  return NextResponse.json(
    {
      ok: true,
      valid: result.valid,
      exempt: result.exempt,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/** POST — claim this browser as the sole active session (kicks older devices). */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error },
      { status: resolved.status }
    );
  }

  let body: { sessionId?: string } = {};
  try {
    body = (await req.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "missing_session_id" },
      { status: 400 }
    );
  }

  const supabaseUserId = await supabaseUserIdFromRequest(req);
  const result = await claimActiveSession({
    user: resolved.user,
    supabaseUserId,
    sessionId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, exempt: result.exempt });
}
