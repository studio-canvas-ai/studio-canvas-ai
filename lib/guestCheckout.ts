import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { ensureUserRecord } from "@/lib/db/credits";
import type { UserRecord } from "@/lib/db/types";
import { useSecureAuthCookies } from "@/lib/authCookies";

/** Stable guest wallet cookie for KCP / PG checkout without login. */
export const GUEST_CHECKOUT_COOKIE = "sca_guest_checkout_v1";
const GUEST_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

function newGuestUserId(): string {
  const raw = randomBytes(16).toString("hex");
  return `guest_${raw}`;
}

function sanitizeGuestId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^guest_[a-zA-Z0-9_-]{8,80}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Read or mint a guest checkout user id (cookie-backed).
 * Used so PortOne / Stripe orders can attach to a wallet without OAuth.
 */
export async function getOrCreateGuestUserId(): Promise<string> {
  const jar = await cookies();
  const existing = sanitizeGuestId(jar.get(GUEST_CHECKOUT_COOKIE)?.value);
  if (existing) return existing;

  const userId = newGuestUserId();
  jar.set(GUEST_CHECKOUT_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureAuthCookies(),
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_SEC,
  });
  return userId;
}

export async function ensureGuestCheckoutUser(): Promise<UserRecord> {
  const userId = await getOrCreateGuestUserId();
  const suffix = createHash("sha256").update(userId).digest("hex").slice(0, 10);
  return ensureUserRecord({
    userId,
    email: `guest-${suffix}@checkout.studio-canvas-ai.local`,
    name: "Guest Checkout",
    provider: "guest",
    providerAccountId: userId,
  });
}
