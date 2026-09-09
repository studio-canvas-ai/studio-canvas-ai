/**
 * Wipe any existing Supabase / Auth.js session before starting social OAuth.
 * Prevents sticky sessions (e.g. hercd) from surviving a Naver/Google login attempt.
 */

import type { SocialOAuthId } from "@/lib/supabase/oauth";
import { clearAuthStorageOnly } from "@/lib/auth/clearAuthStorage";

export const OAUTH_INTENT_KEY = "sca_oauth_intent_v1";
const OAUTH_INTENT_COOKIE = "sca_oauth_intent_v1";
const WALLET_COOKIE_NAME = "sca_wallet_v1";

export type OAuthIntent = {
  provider: SocialOAuthId;
  previousUserId: string | null;
  at: number;
};

const PLAN_USAGE_KEYS = ["sca_plan_usage_v2", "sca_plan_usage_v1"] as const;

function expireBrowserCookie(name: string) {
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const variants = [
    `${name}=; Max-Age=0; path=/; SameSite=Lax`,
    `${name}=; expires=${expires}; path=/; SameSite=Lax`,
  ];
  try {
    const host = window.location.hostname;
    if (host.includes(".")) {
      variants.push(
        `${name}=; Max-Age=0; path=/; domain=${host}; SameSite=Lax`,
        `${name}=; expires=${expires}; path=/; domain=${host}; SameSite=Lax`,
        `${name}=; Max-Age=0; path=/; domain=.${host}; SameSite=Lax`
      );
    }
  } catch {
    /* ignore */
  }
  for (const value of variants) {
    try {
      document.cookie = value;
    } catch {
      /* ignore */
    }
  }
}

function writeBrowserCookie(name: string, value: string, maxAgeSec: number) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; path=/; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readBrowserCookie(name: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${name}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function parseIntent(raw: string | null): OAuthIntent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthIntent;
    if (!parsed?.provider || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAccountResidueCaches() {
  try {
    for (const key of PLAN_USAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  try {
    expireBrowserCookie(WALLET_COOKIE_NAME);
  } catch {
    /* ignore */
  }
}

export function writeOAuthIntent(intent: OAuthIntent) {
  const raw = JSON.stringify(intent);
  try {
    sessionStorage.setItem(OAUTH_INTENT_KEY, raw);
  } catch {
    /* ignore */
  }
  // Cookie backup — Edge/Incognito can drop sessionStorage across IdP redirects.
  writeBrowserCookie(OAUTH_INTENT_COOKIE, raw, 60 * 30);
}

export function readOAuthIntent(): OAuthIntent | null {
  const fromSession = parseIntent(
    (() => {
      try {
        return sessionStorage.getItem(OAUTH_INTENT_KEY);
      } catch {
        return null;
      }
    })()
  );
  if (fromSession) return fromSession;
  return parseIntent(readBrowserCookie(OAUTH_INTENT_COOKIE));
}

export function clearOAuthIntent() {
  try {
    sessionStorage.removeItem(OAUTH_INTENT_KEY);
  } catch {
    /* ignore */
  }
  expireBrowserCookie(OAUTH_INTENT_COOKIE);
}

/**
 * Must run before every social OAuth redirect.
 * Returns previous Supabase user id (if any) for bridge stale-session checks.
 */
export async function prepareFreshSocialLogin(
  provider: SocialOAuthId
): Promise<{ previousUserId: string | null }> {
  let previousUserId: string | null = null;

  try {
    const { isSupabaseConfigured } = await import("@/lib/supabase/config");
    if (isSupabaseConfigured()) {
      const { createSupabaseBrowserClient } = await import(
        "@/lib/supabase/client"
      );
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      previousUserId = data.session?.user?.id ?? null;
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch {
    /* continue clearing */
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* ignore */
  }

  try {
    const { signOut } = await import("next-auth/react");
    await signOut({ redirect: false });
  } catch {
    /* ignore */
  }

  clearAuthStorageOnly();
  clearAccountResidueCaches();

  writeOAuthIntent({
    provider,
    previousUserId,
    at: Date.now(),
  });

  return { previousUserId };
}

/** Session user must match the OAuth provider that was just started. */
export function assertOAuthSessionMatchesIntent(
  intent: OAuthIntent | null,
  user: {
    id: string;
    email?: string | null;
    app_metadata?: { provider?: string } | null;
    identities?: Array<{ provider?: string }> | null;
  },
  opts?: { requireIntent?: boolean }
): { ok: true } | { ok: false; reason: string } {
  if (!intent) {
    if (opts?.requireIntent) {
      return {
        ok: false,
        reason:
          "oauth_intent_missing: start login again from the app (session may be stale)",
      };
    }
    return { ok: true };
  }

  // Intent older than 30m is almost certainly a leftover / polluted flow.
  if (Date.now() - intent.at > 30 * 60 * 1000) {
    return {
      ok: false,
      reason: "oauth_intent_expired: please retry social login",
    };
  }

  const needles: Record<SocialOAuthId, string[]> = {
    google: ["google"],
    naver: ["naver"],
    kakao: ["kakao"],
    microsoft: ["microsoft", "azure"],
    facebook: ["facebook"],
    instagram: ["facebook", "instagram"],
  };
  const want = needles[intent.provider] || [intent.provider];
  const hay = [
    user.app_metadata?.provider || "",
    ...(user.identities || []).map((i) => i.provider || ""),
  ]
    .join(" ")
    .toLowerCase();

  const matched = want.some((n) => hay.includes(n));
  if (!matched) {
    // Classic pollution: previous hercd session still present after Naver click.
    if (intent.previousUserId && user.id === intent.previousUserId) {
      return {
        ok: false,
        reason:
          "stale_session_reused: previous account session survived OAuth — please retry login",
      };
    }
    return {
      ok: false,
      reason: `provider_mismatch: expected ${intent.provider}, got ${hay || "unknown"}`,
    };
  }

  return { ok: true };
}
