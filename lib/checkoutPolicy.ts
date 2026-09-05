/**
 * Checkout access policy.
 *
 * TEMP (KCP card review): guest checkout is ON so PG windows open without login.
 * When the owner asks to “결제 다시 원상복구” / restore member-only checkout:
 *   1) Set ALLOW_GUEST_CHECKOUT=false (Vercel env + .env.local), OR
 *   2) Flip DEFAULT below to false and redeploy.
 *
 * Touch points gated by `isGuestCheckoutAllowed()`:
 *   - components/CreditsProvider.tsx (requestSubscribe)
 *   - components/PaymentModal.tsx (login gate)
 *   - app/api/payments/create + confirm (resolveAppUser allowGuest)
 *   - lib/guestCheckout.ts (guest wallet cookie)
 */

const ENV_RAW = process.env.ALLOW_GUEST_CHECKOUT?.trim().toLowerCase();

/** Default ON during KCP review; set env to "false" to restore member-only. */
const DEFAULT_ALLOW_GUEST_CHECKOUT = true;

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
