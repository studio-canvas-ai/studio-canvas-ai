import type { Provider } from "@supabase/supabase-js";
import type { AuthProviderId } from "@/lib/db/types";
import {
  isSupabaseConfigured,
  getSupabaseConfigError,
  getAuthSiteOrigin,
  getSupabaseAuthCallbackUrl,
  CANONICAL_SUPABASE_AUTH_CALLBACK_URL,
  SUPABASE_AUTH_SITE_ORIGINS,
} from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatOAuthError } from "@/lib/supabase/oauthErrors";
import { APP_HOME_PATH } from "@/lib/appRoutes";

export type SocialOAuthId =
  | "google"
  | "microsoft"
  | "facebook"
  | "instagram"
  | "kakao"
  | "naver";

const AUTH_NEXT_KEY = "sca_auth_next";

/**
 * Map our UI provider ids → Supabase Auth OAuth provider names.
 * Meta (Facebook + Instagram) uses the built-in `facebook` provider.
 * Microsoft / Naver use Custom OAuth in the dashboard.
 * Kakao uses the built-in `kakao` provider (not `custom:kakao`).
 */
const TO_SUPABASE: Record<SocialOAuthId, Provider | `custom:${string}`> = {
  google: "google",
  facebook: "facebook",
  // Instagram Login is served by Meta via the same Facebook OAuth app/provider.
  instagram: "facebook",
  kakao: "kakao",
  microsoft: "custom:microsoft",
  naver: "custom:naver",
};

/** Supabase app_metadata.provider → our AuthProviderId for local user rows. */
export function mapSupabaseProviderToAuthId(
  supabaseProvider: string | undefined
): AuthProviderId {
  const p = (supabaseProvider || "").toLowerCase();
  if (p.includes("naver")) return "naver";
  if (p.includes("kakao")) return "kakao";
  if (p.includes("instagram")) return "instagram";
  if (p === "azure" || p.includes("microsoft")) return "microsoft";
  switch (p) {
    case "google":
      return "google";
    case "facebook":
      return "facebook";
    case "email":
      return "credentials";
    case "custom:microsoft":
    case "microsoft":
    case "azure":
      return "microsoft";
    case "custom:instagram":
    case "instagram":
      return "instagram";
    case "custom:naver":
    case "naver":
      return "naver";
    default:
      return "google";
  }
}

type MetaBag = Record<string, unknown>;

function str(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function pickIdentity(
  identities: Array<{ provider?: string; identity_data?: MetaBag | null }> | null | undefined,
  needle: string
) {
  const list = identities ?? [];
  return (
    list.find((i) => (i.provider || "").toLowerCase().includes(needle)) ||
    list[0]
  );
}

/** Safe in-app path for post-login redirect (blocks open redirects). */
export function safeAuthNextPath(nextPath: string, fallback = APP_HOME_PATH): string {
  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) return nextPath;
  return fallback;
}

/**
 * App callback URL for Supabase `redirectTo`.
 * Always uses the current browser origin so localhost / www / vercel.app
 * each round-trip on the same host (PKCE cookies stay valid).
 * Must match Supabase Redirect URL allow-list:
 *   ${origin}/**  for each of SUPABASE_AUTH_SITE_ORIGINS
 */
export function buildAuthCallbackRedirectTo(nextPath = APP_HOME_PATH): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin.replace(/\/$/, "")
      : getAuthSiteOrigin();
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeAuthNextPath(nextPath));
  return url.toString();
}

/**
 * Normalize Supabase Auth user → app fields.
 * Custom Naver / Kakao / Facebook claims often land in user_metadata /
 * identities[].identity_data rather than only top-level user.email.
 */
export function extractSupabaseOAuthProfile(user: {
  id: string;
  email?: string | null;
  app_metadata?: MetaBag | null;
  user_metadata?: MetaBag | null;
  identities?: Array<{
    provider?: string;
    identity_data?: MetaBag | null;
  }> | null;
}): {
  provider: AuthProviderId;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  image: string | null;
  naverSub: string | null;
  kakaoSub: string | null;
  facebookSub: string | null;
} {
  const meta = (user.user_metadata ?? {}) as MetaBag;
  const appProvider = str(user.app_metadata?.provider)?.toLowerCase() || "";
  const identity =
    (appProvider.includes("facebook")
      ? pickIdentity(user.identities, "facebook")
      : null) ||
    (appProvider.includes("kakao")
      ? pickIdentity(user.identities, "kakao")
      : null) ||
    (appProvider.includes("naver")
      ? pickIdentity(user.identities, "naver")
      : null) ||
    pickIdentity(user.identities, appProvider) ||
    pickIdentity(user.identities, "");

  const idData = (identity?.identity_data ?? {}) as MetaBag;
  // Kakao sometimes nests profile under kakao_account / properties.
  const kakaoAccount = (idData.kakao_account ?? meta.kakao_account ?? {}) as MetaBag;
  const kakaoProps = (idData.properties ?? meta.properties ?? {}) as MetaBag;
  const kakaoProfile = (kakaoAccount.profile ?? {}) as MetaBag;

  const provider = mapSupabaseProviderToAuthId(
    str(user.app_metadata?.provider) || str(identity?.provider) || undefined
  );

  const providerSub =
    str(meta.sub) ||
    str(meta.provider_id) ||
    str(idData.sub) ||
    str(idData.id) ||
    str(idData.user_id) ||
    str(kakaoAccount.id) ||
    null;

  // Treat built-in + custom:kakao the same for synthetic email / profile fields.
  const isKakao =
    provider === "kakao" ||
    appProvider.includes("kakao") ||
    String(identity?.provider || "")
      .toLowerCase()
      .includes("kakao");

  const naverSub = provider === "naver" ? providerSub : null;
  const kakaoSub = isKakao ? providerSub : null;
  const facebookSub = provider === "facebook" ? providerSub : null;

  const email =
    str(user.email) ||
    str(meta.email) ||
    str(idData.email) ||
    str(kakaoAccount.email) ||
    // Stable synthetic address when provider email consent was not granted.
    (provider === "naver" && naverSub ? `${naverSub}@users.naver.id` : null) ||
    (provider === "naver" ? `${user.id}@users.naver.id` : null) ||
    (isKakao && kakaoSub ? `${kakaoSub}@users.kakao.id` : null) ||
    (isKakao ? `${user.id}@users.kakao.id` : null) ||
    (provider === "facebook" && facebookSub
      ? `${facebookSub}@users.facebook.id`
      : null) ||
    (provider === "facebook" ? `${user.id}@users.facebook.id` : null);

  const name =
    str(meta.full_name) ||
    str(meta.name) ||
    str(meta.nickname) ||
    str(meta.preferred_username) ||
    str(idData.name) ||
    str(idData.nickname) ||
    str(kakaoProps.nickname) ||
    str(kakaoProfile.nickname) ||
    null;

  const image =
    str(meta.avatar_url) ||
    str(meta.picture) ||
    str(idData.picture) ||
    str(idData.profile_image) ||
    str(idData.avatar_url) ||
    str(kakaoProps.profile_image) ||
    str(kakaoProps.thumbnail_image) ||
    str(kakaoProfile.profile_image_url) ||
    str(kakaoProfile.thumbnail_image_url) ||
    null;

  return {
    provider,
    // Always key local users by Supabase auth user id (stable UUID).
    providerAccountId: user.id,
    email,
    name,
    image,
    naverSub,
    kakaoSub,
    facebookSub,
  };
}

/** Providers treated as available whenever Supabase env is present. */
export const SUPABASE_SOCIAL_PROVIDERS: SocialOAuthId[] = [
  "google",
  "microsoft",
  "facebook",
  "instagram",
  "kakao",
  "naver",
];

export function saveAuthNextPath(nextPath: string): void {
  try {
    const safe = safeAuthNextPath(nextPath);
    sessionStorage.setItem(AUTH_NEXT_KEY, safe);
  } catch {
    /* ignore */
  }
}

export function peekAuthNextPath(fallback = APP_HOME_PATH): string {
  try {
    const raw = sessionStorage.getItem(AUTH_NEXT_KEY);
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function consumeAuthNextPath(fallback = APP_HOME_PATH): string {
  try {
    const raw = sessionStorage.getItem(AUTH_NEXT_KEY);
    sessionStorage.removeItem(AUTH_NEXT_KEY);
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Meta unified OAuth (Facebook Login) via Supabase.
 * Instagram UI entry points also call this — Meta handles both through `provider: 'facebook'`.
 *
 * Meta Valid OAuth Redirect URI (provider → Supabase, not the site):
 *   CANONICAL_SUPABASE_AUTH_CALLBACK_URL (…/auth/v1/callback)
 * App redirectTo (Supabase → site): /auth/callback?next=…
 * App ID: 1527934262363418
 *
 * Do NOT pass `scopes: "email"` unless Meta Use cases already includes email.
 * Missing email → synthetic `@users.facebook.id` in extractSupabaseOAuthProfile.
 */
export async function signInWithFacebook(
  nextPath = APP_HOME_PATH
): Promise<{ data: unknown; error: Error | null }> {
  try {
    if (!isSupabaseConfigured()) {
      const err = new Error(
        getSupabaseConfigError() ||
          "Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
      );
      console.error("Meta/Facebook login error:", err.message);
      return { data: null, error: err };
    }

    const next = safeAuthNextPath(nextPath);
    saveAuthNextPath(next);

    const { ensureSupabaseAuthStorageReady } = await import(
      "@/lib/supabase/authStorage"
    );
    ensureSupabaseAuthStorageReady();

    const supabase = createSupabaseBrowserClient();
    const redirectTo = buildAuthCallbackRedirectTo(next);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      console.error("Meta/Facebook login error:", error.message);
      return {
        data,
        error: new Error(
          error.message ||
            "Meta sign-in failed. Check Facebook provider settings in Supabase and Meta."
        ),
      };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Meta/Facebook login error:", message);
    return { data: null, error: new Error(message) };
  }
}

/** Alias: Instagram button uses the same Meta Facebook OAuth provider. */
export const signInWithInstagram = signInWithFacebook;

/**
 * Start Supabase OAuth for a UI social id.
 * Instagram is routed to Meta `facebook` (see TO_SUPABASE).
 */
export async function signInWithSupabaseOAuth(
  provider: SocialOAuthId,
  nextPath: string
): Promise<{ error: Error | null }> {
  if (provider === "facebook" || provider === "instagram") {
    const { error } = await signInWithFacebook(nextPath);
    return { error };
  }
  if (provider === "kakao") {
    const { error } = await signInWithKakao(nextPath);
    return { error };
  }
  if (provider === "naver") {
    const { error } = await signInWithNaver(nextPath);
    return { error };
  }
  if (provider === "microsoft") {
    const { error } = await signInWithMicrosoft(nextPath);
    return { error };
  }
  if (provider === "google") {
    const { error } = await signInWithGoogle(nextPath);
    return { error };
  }

  if (!isSupabaseConfigured()) {
    return {
      error: new Error(
        getSupabaseConfigError() ||
          "Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
      ),
    };
  }

  saveAuthNextPath(nextPath);

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: TO_SUPABASE[provider] as Provider,
    options: { redirectTo: buildAuthCallbackRedirectTo(nextPath) },
  });

  return { error: error ? new Error(error.message) : null };
}

/**
 * Supabase built-in Google OAuth (primary login — not NextAuth).
 *
 * Dashboard checklist:
 *   1) Google Cloud → Authorized redirect URI =
 *        getSupabaseAuthCallbackUrl()  e.g. https://<ref>.supabase.co/auth/v1/callback
 *   2) Google Cloud → JS origins = SUPABASE_AUTH_SITE_ORIGINS
 *   3) Supabase → Providers → Google = Client ID + Secret
 *   4) Supabase → Redirect URLs include each origin/**
 *
 * App flow: signInWithOAuth → /auth/callback?code → /auth/bridge → app session
 */
export async function signInWithGoogle(
  nextPath = APP_HOME_PATH
): Promise<{ data: unknown; error: Error | null }> {
  try {
    if (!isSupabaseConfigured()) {
      const err = new Error(
        getSupabaseConfigError() ||
          "Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
      );
      console.error("Google login error:", err.message);
      return { data: null, error: err };
    }

    const next = safeAuthNextPath(nextPath);
    saveAuthNextPath(next);

    // Ensure foreign project auth keys cannot poison PKCE before redirect.
    const { ensureSupabaseAuthStorageReady } = await import(
      "@/lib/supabase/authStorage"
    );
    ensureSupabaseAuthStorageReady();

    const redirectTo = buildAuthCallbackRedirectTo(next);
    const supabaseCallback = getSupabaseAuthCallbackUrl();

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email profile",
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          // Force account chooser so users can pick a live Google account
          // instead of a previously sticky / deleted YouTube channel session.
          prompt: "select_account",
        },
      },
    });

    if (error) {
      const message = formatOAuthError(error.message);
      console.error("Google login error:", message, {
        redirectTo,
        supabaseCallback,
        allowedSiteOrigins: SUPABASE_AUTH_SITE_ORIGINS,
      });
      return { data, error: new Error(message) };
    }

    if (!data?.url) {
      return {
        data,
        error: new Error("Google OAuth URL missing from Supabase response."),
      };
    }

    window.location.assign(data.url);
    return { data, error: null };
  } catch (err) {
    const message = formatOAuthError(
      err instanceof Error ? err.message : String(err)
    );
    console.error("Google login error:", message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Supabase Custom OAuth for Microsoft (`custom:microsoft`).
 *
 * Dashboard endpoints must use the `common` tenant (not a fixed directory ID),
 * or AADSTS70016 occurs for accounts outside that tenant:
 *   authorize/token: .../common/oauth2/v2.0/...
 *   issuer: .../common/v2.0
 *   jwks: .../common/discovery/v2.0/keys
 * Azure app Redirect URI must be Supabase's callback (not the site origin):
 *   CANONICAL_SUPABASE_AUTH_CALLBACK_URL
 * App `redirectTo` is the site origin; middleware forwards `?code=` → /auth/callback.
 */
export async function signInWithMicrosoft(
  nextPath = APP_HOME_PATH
): Promise<{ data: unknown; error: Error | null }> {
  try {
    if (!isSupabaseConfigured()) {
      const err = new Error(
        getSupabaseConfigError() ||
          "Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
      );
      console.error("마이크로소프트 로그인 오류:", err.message);
      return { data: null, error: err };
    }

    const next = safeAuthNextPath(nextPath);
    saveAuthNextPath(next);

    const { ensureSupabaseAuthStorageReady } = await import(
      "@/lib/supabase/authStorage"
    );
    ensureSupabaseAuthStorageReady();

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "custom:microsoft" as Provider,
      options: {
        redirectTo: buildAuthCallbackRedirectTo(next),
        scopes: "openid profile email offline_access",
      },
    });

    if (error) {
      console.error("마이크로소프트 로그인 오류:", error.message);
      return { data, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("예기치 못한 오류가 발생했습니다:", err);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Supabase built-in Kakao OAuth (`provider: "kakao"`).
 *
 * Do **not** use `custom:kakao` — that path is not configured / fails in this project.
 * Use the dashboard **Kakao** provider (REST API key + Client Secret).
 *
 * Kakao Redirect URI (must match IdP dashboard + env project):
 *   CANONICAL_SUPABASE_AUTH_CALLBACK_URL
 *   (= getSupabaseAuthCallbackUrl() when NEXT_PUBLIC_SUPABASE_URL is correct)
 *
 * KOE006 = Kakao redirect_uri mismatch → wrong/empty NEXT_PUBLIC_SUPABASE_URL
 *   or Kakao console missing the canonical callback above.
 * KOE205 (personal / non-Biz Kakao apps): `account_email` is unavailable.
 * We set `queryParams.scope` to only `profile_nickname,profile_image` so the
 * authorize URL does not request `account_email`.
 * Enable Supabase Kakao → **Allow users without an email**.
 * App bridge synthesizes `{kakaoId}@users.kakao.id` when email is missing.
 */
export async function signInWithKakao(
  nextPath = APP_HOME_PATH
): Promise<{ data: unknown; error: Error | null }> {
  try {
    if (!isSupabaseConfigured()) {
      const err = new Error(
        getSupabaseConfigError() ||
          "Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
      );
      console.error("카카오 로그인 에러:", err.message);
      return { data: null, error: err };
    }

    const next = safeAuthNextPath(nextPath);
    saveAuthNextPath(next);

    // Drop leftover PKCE/session keys from retired test projects before OAuth.
    const { ensureSupabaseAuthStorageReady } = await import(
      "@/lib/supabase/authStorage"
    );
    ensureSupabaseAuthStorageReady();

    const supabase = createSupabaseBrowserClient();
    const idpCallback =
      getSupabaseAuthCallbackUrl() || CANONICAL_SUPABASE_AUTH_CALLBACK_URL;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: buildAuthCallbackRedirectTo(next),
        // Personal Kakao apps: never request account_email (KOE205).
        // Pass scope via queryParams so Kakao authorize receives nickname/image only.
        queryParams: {
          scope: "profile_nickname,profile_image",
        },
      },
    });

    if (error) {
      const message = formatOAuthError(error.message);
      console.error("카카오 로그인 에러:", message, { idpCallback });
      return { data, error: new Error(message) };
    }

    return { data, error: null };
  } catch (err) {
    const message = formatOAuthError(
      err instanceof Error ? err.message : String(err)
    );
    console.error("카카오 로그인 에러:", message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Supabase custom OAuth provider for Naver.
 *
 * Dashboard must use Manual config with Userinfo URL pointing at our proxy
 * (`/api/auth/naver/userinfo`) — Naver nests email under `response.email`.
 * Scopes must be `profile` only (not `openid`), or Supabase skips userinfo.
 */
export async function signInWithNaver(
  nextPath = APP_HOME_PATH
): Promise<{ data: unknown; error: Error | null }> {
  try {
    if (!isSupabaseConfigured()) {
      const err = new Error(
        getSupabaseConfigError() ||
          "Supabase is not configured (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)."
      );
      console.error("로그인 에러:", err.message);
      return { data: null, error: err };
    }

    const next = safeAuthNextPath(nextPath);
    saveAuthNextPath(next);

    const { ensureSupabaseAuthStorageReady } = await import(
      "@/lib/supabase/authStorage"
    );
    ensureSupabaseAuthStorageReady();

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "custom:naver",
      options: {
        redirectTo: buildAuthCallbackRedirectTo(next),
        // Avoid `openid` so Auth uses the (proxied) userinfo endpoint.
        scopes: "profile",
      },
    });

    if (error) {
      console.error("로그인 에러:", error.message);
      return { data, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("로그인 에러:", message);
    return { data: null, error: new Error(message) };
  }
}
