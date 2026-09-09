import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createSessionFromSupabaseAccessToken } from "@/lib/createSupabaseSession";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { assertOAuthSessionMatchesIntent } from "@/lib/auth/prepareOAuthLogin";
import type { SocialOAuthId } from "@/lib/supabase/oauth";

/**
 * Establishes a NextAuth JWT session from a Supabase access token.
 * Avoids client-side `signIn("supabase")` which requires a CSRF double-submit
 * cookie that often goes missing after the OAuth redirect chain.
 */
export async function POST(request: NextRequest) {
  let accessToken = "";
  let expectedProvider: string | null = null;
  let rejectUserId: string | null = null;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        accessToken?: string;
        expectedProvider?: string | null;
        rejectUserId?: string | null;
      };
      accessToken = String(body.accessToken || "").trim();
      expectedProvider =
        typeof body.expectedProvider === "string"
          ? body.expectedProvider.trim().toLowerCase()
          : null;
      rejectUserId =
        typeof body.rejectUserId === "string"
          ? body.rejectUserId.trim()
          : null;
    } else {
      const form = await request.formData();
      accessToken = String(form.get("accessToken") || "").trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Missing accessToken" }, { status: 400 });
  }

  try {
    if (expectedProvider || rejectUserId) {
      const url = getSupabaseUrl();
      const anon = getSupabaseAnonKey();
      if (url && anon) {
        const supabase = createSupabaseAdminClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(accessToken);
        if (error || !user) {
          return NextResponse.json(
            { error: error?.message || "Invalid Supabase access token" },
            { status: 401 }
          );
        }
        if (expectedProvider) {
          const check = assertOAuthSessionMatchesIntent(
            {
              provider: expectedProvider as SocialOAuthId,
              previousUserId: rejectUserId,
              at: Date.now(),
            },
            user
          );
          if (!check.ok) {
            return NextResponse.json({ error: check.reason }, { status: 409 });
          }
        }
      }
    }

    const session = await Promise.race([
      createSessionFromSupabaseAccessToken(accessToken),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Session creation timed out after 12s")),
          12_000
        );
      }),
    ]);
    const response = NextResponse.json({
      ok: true,
      user: session.user,
      needsTermsConsent: session.needsTermsConsent,
    });
    response.cookies.set(session.cookieName, session.token, session.cookieOptions);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bridge failed";
    console.error("[auth/supabase-bridge]", message, err);
    const status =
      message.includes("Invalid Supabase") || message.includes("access token")
        ? 401
        : message.includes("stale_session") || message.includes("provider_mismatch")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
