/**
 * Checkout access policy.
 *
 * Plan checkout requires a logged-in member so paid credits always land on
 * the same account the user sees in the navbar.
 */

const ENV_RAW = process.env.ALLOW_GUEST_CHECKOUT?.trim().toLowerCase();

/** Guest checkout OFF — payments must attach to a real session user. */
const DEFAULT_ALLOW_GUEST_CHECKOUT = false;

/**
 * Whether unauthenticated users may open plan checkout / PG payment.
 * Env override: ALLOW_GUEST_CHECKOUT=true|false
 */
export function isGuestCheckoutAllowed(): boolean {
  if (ENV_RAW === "false" || ENV_RAW === "0" || ENV_RAW === "off") return false;
  if (ENV_RAW === "true" || ENV_RAW === "1" || ENV_RAW === "on") return true;
  return DEFAULT_ALLOW_GUEST_CHECKOUT;
}

/** Browser-safe mirror via NEXT_PUBLIC_ (optional). Falls back to server default. */
export function isGuestCheckoutAllowedClient(): boolean {
  const pub = process.env.NEXT_PUBLIC_ALLOW_GUEST_CHECKOUT?.trim().toLowerCase();
  if (pub === "false" || pub === "0" || pub === "off") return false;
  if (pub === "true" || pub === "1" || pub === "on") return true;
  return DEFAULT_ALLOW_GUEST_CHECKOUT;
}

/**
 * NHN KCP 정기과금(빌링키) UI + 결제 플로우.
 * `false`로 두면 요금제 모달이 단건 결제로만 동작합니다.
 */
export const KCP_RECURRING_ENABLED = true;
