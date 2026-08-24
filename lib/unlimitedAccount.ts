/**
 * Client + server safe privilege checks for designated admin/test accounts.
 * Keep this free of Node-only APIs so UI components can import it.
 *
 * Credits: finite 999 + auto-refill at 0 (see lib/db/credits.ts).
 * Profile slots: still treated as expanded for these accounts.
 */

/** Admin / QA accounts (Naver + Google + Hanmail). */
export const PRIVILEGED_ADMIN_EMAILS = [
  "studiocanvas.cs@gmail.com",
  "agapet1004@gmail.com",
  "scd77777@naver.com",
  "hercd@hanmail.net",
  "scd777@naver.com",
] as const;

/** @deprecated Prefer PRIVILEGED_ADMIN_EMAILS — kept for existing imports. */
export const UNLIMITED_ACCOUNT_EMAILS = PRIVILEGED_ADMIN_EMAILS;

/** Starting / refill balance for privileged admin accounts (disabled — wallet is 0). */
export const ADMIN_TEST_CREDITS = 0;

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
 * Infinite credit bypass is disabled. Wallet stays at 0 until credit vouchers.
 * Generation/download quotas are period N-times, not credits.
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

/** Legacy credit wallet is retired — always 0 until voucher products ship. */
export function adminTestCreditsOrNull(
  _email: string | null | undefined
): number | null {
  return 0;
}
