import { encode } from "next-auth/jwt";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { findOrCreateOAuthUser } from "@/lib/db/credits";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { extractSupabaseOAuthProfile } from "@/lib/supabase/oauth";
import {
  getTermsAgreedWithAccessToken,
  upsertProfileWithAccessToken,
} from "@/lib/supabase/profile";
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
  needsTermsConsent: boolean;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
};

/**
 * Validate a Supabase access token and mint an Auth.js JWT session cookie value.
 * Local app user + admin-visible registration happen only after terms consent.
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
  const termsAgreed = await getTermsAgreedWithAccessToken(accessToken, user.id);

  const cookieName = authSessionCookieName();
  const secret = requireAuthSecret();

  if (!termsAgreed) {
    // Provisional session — no local DB row / admin listing until consent.
    const token = await encode({
      token: {
        name: profile.name,
        email: profile.email,
        picture: profile.image,
        sub: user.id,
        uid: user.id,
        supabaseUserId: user.id,
        authProvider: profile.provider,
        providerAccountId: profile.providerAccountId,
        termsAgreed: false,
        credits: 0,
        planId: "free",
      },
      secret,
      salt: cookieName,
      maxAge: AUTH_SESSION_MAX_AGE,
    });

    return {
      cookieName,
      token,
      cookieOptions: authCookieOptions(AUTH_SESSION_MAX_AGE),
      needsTermsConsent: true,
      user: {
        id: user.id,
        email: profile.email,
        name: profile.name,
        image: profile.image,
      },
    };
  }

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
    await upsertProfileWithAccessToken(accessToken, {
      id: user.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.image,
      appUserId: dbUser.id,
    });
  } catch {
    /* profile sync must never block login */
  }

  const token = await encode({
    token: {
      name: dbUser.name,
      email: dbUser.email,
      picture: dbUser.image,
      sub: dbUser.id,
      uid: dbUser.id,
      supabaseUserId: user.id,
      authProvider: profile.provider,
      providerAccountId: profile.providerAccountId,
      termsAgreed: true,
      credits: dbUser.credits,
      planId: dbUser.planId,
      currentPeriodEnd: dbUser.currentPeriodEnd ?? null,
      planCachedAt: Date.now(),
    },
    secret,
    salt: cookieName,
    maxAge: AUTH_SESSION_MAX_AGE,
  });

  return {
    cookieName,
    token,
    cookieOptions: authCookieOptions(AUTH_SESSION_MAX_AGE),
    needsTermsConsent: false,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
    },
  };
}
