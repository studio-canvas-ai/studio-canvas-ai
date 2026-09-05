import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveAppUser } from "@/lib/resolveAppUser";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import { collectUserStorageAliases } from "@/lib/studioStore/userAliases";
import { restoreOwnStudioStore } from "@/lib/studioStore/selfRestore";

export const runtime = "nodejs";
export const maxDuration = 60;

const DENIAL_STATUS: Record<string, number> = {
  healthy_data_exists: 409,
  credits_intact: 409,
  quota_or_days_intact: 409,
  no_backup: 404,
  snapshot_empty: 404,
};

async function supabaseUserIdFrom(req: Request): Promise<string | null> {
  try {
    const token = await getToken({
      req,
      secret: requireAuthSecret(),
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    return typeof token?.supabaseUserId === "string"
      ? token.supabaseUserId
      : typeof token?.providerAccountId === "string" &&
          /^[0-9a-f-]{36}$/i.test(token.providerAccountId)
        ? token.providerAccountId
        : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/studio-store/restore-self
 * Emergency self-restore of empty studio files. Never restores FHD/4K
 * remaining quota or subscription period end from backup.
 */
export async function POST(req: Request) {
  const resolved = await resolveAppUser(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error },
      { status: resolved.status }
    );
  }

  try {
    const aliases = await collectUserStorageAliases(req, resolved.user);
    const result = await restoreOwnStudioStore({
      user: resolved.user,
      aliases,
      supabaseUserId: await supabaseUserIdFrom(req),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: DENIAL_STATUS[result.error] ?? 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      snapshotId: result.snapshotId,
      current: result.current,
      credits: result.credits,
      creditsRestored: false,
      quotaRestored: false,
      periodRestored: false,
    });
  } catch (err) {
    console.error("[api/studio-store/restore-self]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "restore_failed" },
      { status: 500 }
    );
  }
}
