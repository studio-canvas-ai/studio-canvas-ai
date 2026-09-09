/** Map provider/Supabase OAuth error strings into clearer UI messages. */
export function formatOAuthError(raw: string): string {
  const t = raw.trim();
  if (!t) return "oauth_error";
  const lower = t.toLowerCase();

  if (
    lower.includes("account_blocked") ||
    lower.includes("hercd@hanmail.net")
  ) {
    return (
      "이 계정(hercd@hanmail.net)은 로그인이 영구 차단되었습니다. " +
      "네이버에서 scd777 등 다른 아이디로 다시 로그인해 주세요. " +
      "(지금 브라우저에 남아 있는 네이버 세션이 hercd 한메일일 수 있습니다.)"
    );
  }
  if (lower.includes("oauth_intent_missing") || lower.includes("oauth_intent_expired")) {
    return "로그인 세션이 끊어졌습니다. 네이버로 계속하기를 다시 눌러 주세요.";
  }
  if (lower.includes("stale_session_reused") || lower.includes("provider_mismatch")) {
    return "이전 계정 세션이 남아 로그인에 실패했습니다. 다시 소셜 로그인을 시도해 주세요.";
  }

  if (lower.includes("access_denied") || lower.includes("user_cancelled")) {
    return "Sign-in was cancelled.";
  }
  if (
    lower.includes("koe205") ||
    (lower.includes("account_email") &&
      (lower.includes("동의") || lower.includes("scope") || lower.includes("설정하지")))
  ) {
    return (
      "카카오 로그인 동의 항목 오류(KOE205): account_email이 앱에 없습니다. " +
      "카카오 개발자 콘솔에서 account_email 동의 항목을 활성화하거나(비즈/개인 사업자 등록), " +
      "Supabase → Providers → Kakao에서 Allow users without an email을 켠 뒤 다시 시도해 주세요. " +
      "(앱은 provider: \"kakao\" 사용 — custom:kakao 아님)"
    );
  }
  if (
    lower.includes("redirect_uri") ||
    lower.includes("redirect uri") ||
    lower.includes("redirect_uri_mismatch")
  ) {
    return (
      "OAuth redirect URI mismatch. IdP console must allow " +
      "https://<project-ref>.supabase.co/auth/v1/callback, and Supabase Redirect URLs " +
      "must include this site origin (e.g. https://www.studio-canvas-ai.com/**)."
    );
  }
  if (lower.includes("invalid_client") || lower.includes("unauthorized_client")) {
    return "OAuth client is invalid. Check Client ID/Secret in Supabase → Providers.";
  }
  if (lower.includes("missing_code")) {
    return "OAuth code missing. Complete sign-in, or check Supabase Redirect URL allow-list.";
  }
  if (lower.includes("email") && (lower.includes("missing") || lower.includes("unable"))) {
    return "Email was not provided by the identity provider. Enable Allow users without an email in Supabase, or use the Kakao/Naver userinfo proxy (synthetic @users.*.id).";
  }
  if (lower.includes("pkce") || lower.includes("code verifier")) {
    return "OAuth session cookies missing (PKCE). Start and finish login on the same host (www vs apex).";
  }
  return t.length > 280 ? `${t.slice(0, 277)}...` : t;
}

export const AUTH_ERROR_STORAGE_KEY = "sca_auth_error";

export function stashAuthErrorForModal(detail: string): void {
  try {
    sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, detail);
  } catch {
    /* ignore */
  }
}

export function consumeStashedAuthError(): string | null {
  try {
    const raw = sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}
