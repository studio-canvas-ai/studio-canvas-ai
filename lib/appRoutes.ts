/**
 * Canonical app routes — SCREEN-001 home is the default landing everywhere.
 */

/** SCREEN-001 — marketing home / default post-auth landing */
export const APP_HOME_PATH = "/" as const;

export function appPathWithAuthError(code: string): string {
  return `${APP_HOME_PATH}?authError=${encodeURIComponent(code)}`;
}

export function appPathWithPaymentStatus(
  status: "success" | "fail",
  orderId: string
): string {
  return `${APP_HOME_PATH}?payment=${status}&orderId=${encodeURIComponent(orderId)}`;
}

/** Normalize pathname for tab active checks (trailing slash, empty). */
export function normalizeAppTabPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}
