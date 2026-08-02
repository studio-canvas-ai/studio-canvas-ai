import { encode } from "next-auth/jwt";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { findOrCreateOAuthUser } from "@/lib/db/credits";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { extractSupabaseOAuthProfile } from "@/lib/supabase/oauth";
import { requireAuthSecret } from "@/lib/authSecret";
import {
  AUTH_SESSION_MAX_AGE,
  authCookieOptions,
  authSessionCookieName,
} from "@/lib/authCookies";

export type SupabaseBridgeSession = {
  cookieName: string;
  token: string;
  cookieOptions: ReturnType<typeof authCookieOptions>;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
};

/**
 * Validate a Supabase access token and mint an Auth.js JWT session cookie value.
 * Used by /api/auth/supabase-bridge so the OAuth bridge never hits CSRF-protected
 * client `signIn()` callbacks.
 */
export async function createSessionFromSupabaseAccessToken(
  accessToken: string
): Promise<SupabaseBridgeSession> {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseAdminClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    throw new Error(error?.message || "Invalid Supabase access token");
  }

  const profile = extractSupabaseOAuthProfile(user);

  let dbUser;
  try {
    const created = await findOrCreateOAuthUser({
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      image: profile.image,
    });
    dbUser = created.user;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createSupabaseSession] findOrCreateOAuthUser:", message);
    throw new Error(`User provisioning failed: ${message}`);
  }

  try {
    const { upsertProfileWithAccessToken } = await import("@/lib/supabase/profile");
    await upsertProfileWithAccessToken(accessToken, {
      id: user.id,
      email: profile.email,
      fullName: profile.name,
      avatarUrl: profile.image,
      provider: profile.provider,
      appUserId: dbUser.id,
    });
  } catch {
    /* profile sync must never block login */
  }

  const cookieName = authSessionCookieName();
  const secret = requireAuthSecret();
  const token = await encode({
    token: {
      name: dbUser.name,
      email: dbUser.email,
      picture: dbUser.image,
      sub: dbUser.id,
      uid: dbUser.id,
      authProvider: profile.provider,
      credits: dbUser.credits,
      planId: dbUser.planId,
    },
    secret,
    salt: cookieName,
    maxAge: AUTH_SESSION_MAX_AGE,
  });

  return {
    cookieName,
    token,
    cookieOptions: authCookieOptions(AUTH_SESSION_MAX_AGE),
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
    },
  };
}
