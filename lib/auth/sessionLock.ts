/**
 * Single-device session lock for signed-in members (server).
 * Privileged admin emails skip claim/check entirely.
 */

import { getToken } from "next-auth/jwt";
import {
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import { isAdminEmail } from "@/lib/adminAuth";
import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { UserRecord } from "@/lib/db/types";
import { isSessionLockExemptEmail as isExemptClient } from "@/lib/auth/sessionLockShared";

export {
  SESSION_LOCK_STORAGE_KEY,
  SESSION_LOCK_EVENT,
  SESSION_LOCK_REVOKED_MESSAGE,
} from "@/lib/auth/sessionLockShared";

export function isSessionLockExemptEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return isExemptClient(email) || isAdminEmail(email.trim());
}

export async function supabaseUserIdFromRequest(
  req: Request
): Promise<string | null> {
  try {
    const token = await getToken({
      req,
      secret: requireAuthSecret(),
      secureCookie: useSecureAuthCookies(),
      cookieName: authSessionCookieName(),
    });
    if (typeof token?.supabaseUserId === "string" && token.supabaseUserId.trim()) {
      return token.supabaseUserId.trim();
    }
    if (
      typeof token?.providerAccountId === "string" &&
      /^[0-9a-f-]{36}$/i.test(token.providerAccountId)
    ) {
      return token.providerAccountId;
    }
    if (typeof token?.uid === "string" && /^[0-9a-f-]{36}$/i.test(token.uid)) {
      return token.uid;
    }
    if (typeof token?.sub === "string" && /^[0-9a-f-]{36}$/i.test(token.sub)) {
      return token.sub;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function resolveProfileId(opts: {
  user: UserRecord;
  supabaseUserId: string | null;
}): Promise<string | null> {
  const admin = createSupabaseServiceClient();
  if (!admin) return opts.supabaseUserId;

  if (opts.supabaseUserId && /^[0-9a-f-]{36}$/i.test(opts.supabaseUserId)) {
    return opts.supabaseUserId;
  }

  const email = (opts.user.email || "").trim().toLowerCase();
  if (!email) return null;

  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" ? id : null;
}

export async function claimActiveSession(opts: {
  user: UserRecord;
  supabaseUserId: string | null;
  sessionId: string;
}): Promise<{ ok: true; exempt: boolean } | { ok: false; error: string }> {
  const sessionId = opts.sessionId.trim();
  if (!sessionId || sessionId.length < 8) {
    return { ok: false, error: "invalid_session_id" };
  }

  if (
    isPrivilegedAdminEmail(opts.user.email) ||
    isAdminEmail((opts.user.email || "").trim())
  ) {
    return { ok: true, exempt: true };
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    // Soft-fail when service role is missing — do not lock users out of the app.
    return { ok: true, exempt: false };
  }

  const profileId = await resolveProfileId(opts);
  if (!profileId) {
    return { ok: false, error: "profile_not_found" };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({
      active_session_id: sessionId,
      active_session_at: now,
    })
    .eq("id", profileId);

  if (error) {
    console.warn("[sessionLock] claim skipped:", error.message);
    return { ok: false, error: error.message };
  }

  // Best-effort mirror into auth metadata (ignored if admin API unavailable).
  try {
    await admin.auth.admin.updateUserById(profileId, {
      user_metadata: {
        active_session_id: sessionId,
        active_session_at: now,
      },
    });
  } catch {
    /* optional */
  }

  return { ok: true, exempt: false };
}

export async function checkActiveSession(opts: {
  user: UserRecord;
  supabaseUserId: string | null;
  sessionId: string;
}): Promise<{
  ok: true;
  valid: boolean;
  exempt: boolean;
}> {
  if (
    isPrivilegedAdminEmail(opts.user.email) ||
    isAdminEmail((opts.user.email || "").trim())
  ) {
    return { ok: true, valid: true, exempt: true };
  }

  const sessionId = opts.sessionId.trim();
  if (!sessionId) {
    return { ok: true, valid: false, exempt: false };
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    return { ok: true, valid: true, exempt: false };
  }

  const profileId = await resolveProfileId(opts);
  if (!profileId) {
    return { ok: true, valid: true, exempt: false };
  }

  const { data, error } = await admin
    .from("profiles")
    .select("active_session_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.warn("[sessionLock] check skipped:", error.message);
    return { ok: true, valid: true, exempt: false };
  }

  const current = (data as { active_session_id?: string | null } | null)
    ?.active_session_id;
  if (!current) {
    // No claim yet — treat as valid so the client can claim.
    return { ok: true, valid: true, exempt: false };
  }

  return {
    ok: true,
    valid: current === sessionId,
    exempt: false,
  };
}
