/**
 * Client + server safe privilege checks for designated admin/test accounts.
 * Keep this free of Node-only APIs so UI components can import it.
 *
 * Credits: finite 999 + auto-refill at 0 (see lib/db/credits.ts).
 * Profile slots: still treated as expanded for these accounts.
 */

/** Admin / QA accounts (Naver + Google + Hanmail). */
export const PRIVILEGED_ADMIN_EMAILS = [
  "scd77777@naver.com",
  "studiocanvas.cs@gmail.com",
  "hercd@hanmail.net",
  "scd777@naver.com",
] as const;

/** @deprecated Prefer PRIVILEGED_ADMIN_EMAILS — kept for existing imports. */
export const UNLIMITED_ACCOUNT_EMAILS = PRIVILEGED_ADMIN_EMAILS;

/** Starting / refill balance for privileged admin accounts (not Infinity). */
export const ADMIN_TEST_CREDITS = 999;

/** Practical upper bound for profile slots when privileged. */
export const UNLIMITED_PROFILE_SLOTS = 999;

export function isPrivilegedAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (PRIVILEGED_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

/** Alias used across the app for the same allow-list. */
export function isUnlimitedAccountEmail(
  email: string | null | undefined
): boolean {
  return isPrivilegedAdminEmail(email);
}

/**
 * Infinite credit bypass is disabled — admins use a normal 999 wallet
 * with auto-refill only when the balance hits 0 (for spend-flow testing).
 * Debits always apply for generate / train / regenerate / downloads.
 */
export function hasUnlimitedCredits(
  _email: string | null | undefined
): boolean {
  return false;
}

export function hasUnlimitedProfileSlots(
  email: string | null | undefined
): boolean {
  return isPrivilegedAdminEmail(email);
}

/** Returns ADMIN_TEST_CREDITS for privileged admins; otherwise null (caller uses FREE_CREDITS). */
export function adminTestCreditsOrNull(
  email: string | null | undefined
): number | null {
  return isPrivilegedAdminEmail(email) ? ADMIN_TEST_CREDITS : null;
}
