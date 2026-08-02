import type { Provider } from "@supabase/supabase-js";
import type { AuthProviderId } from "@/lib/db/types";
import { isSupabaseConfigured, getSupabaseConfigError } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
 * Microsoft is configured as Custom OAuth (`custom:microsoft`) in the dashboard.
 * Instagram / Naver are also custom providers.
 */
const TO_SUPABASE: Record<SocialOAuthId, Provider | `custom:${string}`> = {
  google: "google",
  facebook: "facebook",
  kakao: "kakao",
  microsoft: "custom:microsoft",
  instagram: "custom:instagram",
  naver: "custom:naver",
};

/** Supabase app_metadata.provider → our AuthProviderId for local user rows. */
export function mapSupabaseProviderToAuthId(
  supabaseProvider: string | undefined
): AuthProviderId {
  const p = (supabaseProvider || "").toLowerCase();
  if (p.includes("naver")) return "naver";
  if (p.includes("instagram")) return "instagram";
  if (p === "azure" || p.includes("microsoft")) return "microsoft";
  switch (p) {
    case "google":
      return "google";
    case "facebook":
      return "facebook";
    case "kakao":
      return "kakao";
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

/**
 * Normalize Supabase Auth user → app fields.
 * Custom Naver / Kakao claims often land in user_metadata / identities[].identity_data
 * (sub, email, name, picture) rather than only top-level user.email.
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
} {
  const meta = (user.user_metadata ?? {}) as MetaBag;
  const appProvider = str(user.app_metadata?.provider)?.toLowerCase() || "";
  const identity =
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
    str(idData.sub) ||
    str(idData.id) ||
    str(meta.provider_id) ||
    str(kakaoAccount.id) ||
    null;

  const naverSub = provider === "naver" ? providerSub : null;
  const kakaoSub = provider === "kakao" ? providerSub : null;

  const email =
    str(user.email) ||
    str(meta.email) ||
    str(idData.email) ||
    str(kakaoAccount.email) ||
    // Stable synthetic address when provider email consent was not granted.
    (provider === "naver" && naverSub ? `${naverSub}@users.naver.id` : null) ||
    (provider === "naver" ? `${user.id}@users.naver.id` : null) ||
    (provider === "kakao" && kakaoSub ? `${kakaoSub}@users.kakao.id` : null) ||
    (provider === "kakao" ? `${user.id}@users.kakao.id` : null);

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
    const safe =
      nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/generate";
    sessionStorage.setItem(AUTH_NEXT_KEY, safe);
  } catch {
    /* ignore */
  }
}

export function consumeAuthNextPath(fallback = "/generate"): string {
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
 * Start Supabase OAuth.
 * - API host comes only from NEXT_PUBLIC_SUPABASE_URL (never hardcoded).
 * - redirectTo is the app origin (e.g. https://www.studio-canvas-ai.com).
 *   Google itself must redirect to:
 *   https://<project-ref>.supabase.co/auth/v1/callback
 *   (configured in Google Cloud + Supabase Google provider — not in this call).
 */
export async function signInWithSupabaseOAuth(
  provider: SocialOAuthId,
  nextPath: string
): Promise<{ error: Error | null }> {
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
  // Prefer live browser origin so www vs apex matches the page the user opened.
  const redirectTo = window.location.origin;

  const options: {
    redirectTo: string;
    queryParams?: Record<string, string>;
  } = { redirectTo };

  if (provider === "google") {
    options.queryParams = { access_type: "offline", prompt: "consent" };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: TO_SUPABASE[provider] as Provider,
    options,
  });

  return { error: error ? new Error(error.message) : null };
}

/**
 * Supabase Custom OAuth for Microsoft (`custom:microsoft`).
 *
 * Azure app Redirect URI must be Supabase's callback (not the site origin):
 *   https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback
 * App `redirectTo` is the site origin; middleware forwards `?code=` → /auth/callback.
 */
export async function signInWithMicrosoft(
  nextPath = "/generate"
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

    saveAuthNextPath(nextPath);

    const supabase = createSupabaseBrowserClient();
    const redirectTo =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://www.studio-canvas-ai.com";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "custom:microsoft" as Provider,
      options: {
        redirectTo,
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
 * Supabase built-in Kakao OAuth.
 *
 * Dashboard: Authentication → Providers → Kakao (Client ID = REST API key,
 * Client Secret = Kakao Client Secret). Kakao Redirect URI must be:
 *   https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback
 * Enable "Allow users without an email" if account_email consent is unavailable.
 */
export async function signInWithKakao(
  nextPath = "/generate"
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

    saveAuthNextPath(nextPath);

    const supabase = createSupabaseBrowserClient();
    // Prefer live browser origin (www vs apex, localhost) so PKCE cookies match.
    // Production: https://www.studio-canvas-ai.com — middleware forwards ?code= → /auth/callback.
    const redirectTo =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://www.studio-canvas-ai.com";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("카카오 로그인 에러:", error.message);
      return { data, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
  nextPath = "/generate"
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

    saveAuthNextPath(nextPath);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "custom:naver",
      options: {
        redirectTo: window.location.origin,
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
