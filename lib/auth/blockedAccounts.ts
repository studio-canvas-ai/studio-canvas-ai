/**
 * Hard-blocked login emails — never mint or keep an app session for these.
 * Client-safe (no Node APIs).
 */

export const BLOCKED_LOGIN_EMAILS = ["hercd@hanmail.net"] as const;

export const BLOCKED_LOGIN_ERROR_CODE = "account_blocked";

export function normalizeLoginEmail(
  email: string | null | undefined
): string | null {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export function isBlockedLoginEmail(
  email: string | null | undefined
): boolean {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) return false;
  return (BLOCKED_LOGIN_EMAILS as readonly string[]).includes(normalized);
}

export function blockedLoginMessage(localeHint?: string | null): string {
  const kr =
    !localeHint ||
    localeHint === "kr" ||
    localeHint.startsWith("ko");
  return kr
    ? "이 계정(hercd@hanmail.net)은 로그인이 영구 차단되었습니다. 다른 계정으로 로그인해 주세요."
    : "This account (hercd@hanmail.net) is permanently blocked from signing in. Please use a different account.";
}
