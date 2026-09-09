/**
 * Client-safe session-lock helpers (no Node/crypto).
 */

import { isPrivilegedAdminEmail } from "@/lib/unlimitedAccount";

export const SESSION_LOCK_STORAGE_KEY = "sca_active_session_id";
export const SESSION_LOCK_EVENT = "sca:session-lock-revoked";

/** Client-visible copy when another device claims the account. */
export const SESSION_LOCK_REVOKED_MESSAGE =
  "다른 기기에서 로그인되어 현재 세션이 종료되었습니다. 다시 로그인해 주세요.";

/**
 * Privileged admin / QA emails skip single-session enforcement.
 * Uses the hardcoded allow-list (and optional ADMIN_EMAILS via server check).
 */
export function isSessionLockExemptEmail(
  email: string | null | undefined
): boolean {
  return isPrivilegedAdminEmail(email);
}
