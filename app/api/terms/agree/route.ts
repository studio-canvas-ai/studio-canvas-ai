import { NextResponse, type NextRequest } from "next/server";
import { encode, getToken } from "next-auth/jwt";
import { findOrCreateOAuthUser } from "@/lib/db/credits";
import type { AuthProviderId } from "@/lib/db/types";
import {
  AUTH_SESSION_MAX_AGE,
  authCookieOptions,
  authSessionCookieName,
  useSecureAuthCookies,
} from "@/lib/authCookies";
import { requireAuthSecret } from "@/lib/authSecret";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractSupabaseOAuthProfile } from "@/lib/supabase/oauth";
import { agreeToTermsWithAccessToken } from "@/lib/supabase/profile";

export const runtime = "nodejs";

type AgreeBody = {
  acceptTerms?: unknown;
  acceptPrivacy?: unknown;
};

/**
 * Finalize registration after required ToS + Privacy checkboxes.
 * Upserts public.profiles.terms_agreed = true and provisions the local app user.
 */
export async function POST(request: NextRequest) {
  let body: AgreeBody;
  try {
    body = (await request.json()) as AgreeBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const acceptTerms = body.acceptTerms === true;
  const acceptPrivacy = body.acceptPrivacy === true;

  if (!acceptTerms || !acceptPrivacy) {
    return NextResponse.json(
      { error: "Required terms must be accepted" },
      { status: 400 }
    );
  }

  let secret: string;
  try {
    secret = requireAuthSecret();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AUTH_SECRET missing" },
      { status: 500 }
    );
  }

  const cookieName = authSessionCookieName();
  const jwt = await getToken({
    req: request,
    secret,
    secureCookie: useSecureAuthCookies(),
    cookieName,
  });

  if (!jwt) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase not configured" },
      { status: 500 }
    );
  }

  // Prefer getUser() (validates with Auth server) over trusting cookie-only getSession().
  const {
    data: { user: sbUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !sbUser) {
    return NextResponse.json(
      { error: "Supabase session expired — please sign in again" },
      { status: 401 }
    );
  }

  const {
    data: { session: sbSession },
  } = await supabase.auth.getSession();

  const accessToken = sbSession?.access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Supabase session expired — please sign in again" },
      { status: 401 }
    );
  }

  const jwtSupabaseId =
    (typeof jwt.supabaseUserId === "string" && jwt.supabaseUserId) ||
    (jwt.termsAgreed === false && typeof jwt.uid === "string" ? jwt.uid : null);

  if (jwtSupabaseId && jwtSupabaseId !== sbUser.id) {
    return NextResponse.json(
      { error: "Session mismatch — please sign in again" },
      { status: 403 }
    );
  }

  const profile = extractSupabaseOAuthProfile(sbUser);

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
    console.error("[api/terms/agree] findOrCreateOAuthUser:", message);
    return NextResponse.json(
      { error: `User provisioning failed: ${message}` },
      { status: 500 }
    );
  }

  const agreed = await agreeToTermsWithAccessToken(accessToken, {
    id: sbUser.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.image,
    appUserId: dbUser.id,
    termsAgreed: true,
  });

  if (!agreed.ok) {
    console.error("[api/terms/agree] profile upsert:", agreed.error);
    return NextResponse.json(
      { error: agreed.error, code: agreed.code },
      { status: 500 }
    );
  }

  const token = await encode({
    token: {
      name: dbUser.name,
      email: dbUser.email,
      picture: dbUser.image,
      sub: dbUser.id,
      uid: dbUser.id,
      supabaseUserId: sbUser.id,
      authProvider: profile.provider as AuthProviderId,
      providerAccountId: profile.providerAccountId,
      termsAgreed: true,
      credits: dbUser.credits,
      planId: dbUser.planId,
    },
    secret,
    salt: cookieName,
    maxAge: AUTH_SESSION_MAX_AGE,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
    },
  });
  response.cookies.set(cookieName, token, authCookieOptions(AUTH_SESSION_MAX_AGE));
  return response;
}
