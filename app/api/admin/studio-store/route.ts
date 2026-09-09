import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { findRegisteredProfileForAdmin } from "@/lib/supabase/profile";
import {
  inspectStudioStoreForAliases,
  restoreStudioStoreForUser,
} from "@/lib/studioStore/adminRestore";

export const runtime = "nodejs";
export const maxDuration = 60;

function aliasesFor(user: {
  id: string;
  supabaseUserId: string;
  appUserId: string | null;
}): string[] {
  return [...new Set([user.id, user.supabaseUserId, user.appUserId].filter(Boolean))] as string[];
}

function userPayload(user: {
  id: string;
  email: string | null;
  name: string | null;
  supabaseUserId: string;
  appUserId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    supabaseUserId: user.supabaseUserId,
    appUserId: user.appUserId,
  };
}

/**
 * GET /api/admin/studio-store?q=email-or-id
 * Inspect cloud recent files / upload vault / trained vault + snapshots.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ error: "query_required" }, { status: 400 });
  }

  try {
    const user = await findRegisteredProfileForAdmin(q);
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    const inspect = await inspectStudioStoreForAliases(aliasesFor(user));
    return NextResponse.json({
      ok: true,
      user: userPayload(user),
      ...inspect,
    });
  } catch (err) {
    console.error("[api/admin/studio-store GET]", err);
    const message = err instanceof Error ? err.message : "inspect_failed";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST { q | userId, snapshotId? }
 * Restore latest non-empty snapshot (or a specific snapshot) into cloud store.
 * The member sees it on next login / app load.
 */
export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    q?: string;
    userId?: string;
    snapshotId?: string;
  };
  const q = (body.q || body.userId || "").trim();
  if (!q) {
    return NextResponse.json({ error: "query_required" }, { status: 400 });
  }

  try {
    const user = await findRegisteredProfileForAdmin(q);
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    const result = await restoreStudioStoreForUser({
      canonicalUserId: user.id,
      supabaseUserId: user.supabaseUserId,
      aliases: aliasesFor(user),
      snapshotId: body.snapshotId?.trim() || null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, user: userPayload(user) },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      user: userPayload(user),
      source: result.source,
      snapshotId: result.snapshotId,
      current: result.current,
    });
  } catch (err) {
    console.error("[api/admin/studio-store POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "restore_failed" },
      { status: 500 }
    );
  }
}
