import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/** Signed credit-balance cookie so Vercel isolates share the last known wallet. */
export const WALLET_COOKIE_NAME = "sca_wallet_v1";
const MAX_AGE_SEC = 60 * 60 * 24 * 180;

function secret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.PROMO_CODE_SECRET ||
    "dev-only-wallet-secret-change-me"
  );
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type WalletCookiePayload = {
  userId: string;
  credits: number;
  updatedAt: number;
};

export function encodeWalletCookie(payload: WalletCookiePayload): string {
  const credits = Math.round(Math.max(0, payload.credits) * 10) / 10;
  const body = `${payload.userId}|${credits}|${payload.updatedAt}`;
  return `${body}.${sign(body)}`;
}

export function decodeWalletCookie(
  raw: string | undefined | null
): WalletCookiePayload | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!sig || !safeEqual(sign(body), sig)) return null;
  const [userId, creditsRaw, updatedAtRaw] = body.split("|");
  if (!userId) return null;
  const credits = Number(creditsRaw);
  const updatedAt = Number(updatedAtRaw);
  if (!Number.isFinite(credits) || !Number.isFinite(updatedAt)) return null;
  return {
    userId,
    credits: Math.round(Math.max(0, credits) * 10) / 10,
    updatedAt,
  };
}

export async function readWalletCookie(
  expectedUserId?: string | null
): Promise<WalletCookiePayload | null> {
  try {
    const jar = await cookies();
    const parsed = decodeWalletCookie(jar.get(WALLET_COOKIE_NAME)?.value);
    if (!parsed) return null;
    if (expectedUserId && parsed.userId !== expectedUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWalletCookie(
  userId: string,
  credits: number
): Promise<void> {
  try {
    const jar = await cookies();
    const value = encodeWalletCookie({
      userId,
      credits,
      updatedAt: Date.now(),
    });
    jar.set(WALLET_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SEC,
    });
  } catch {
    /* cookie mutation unavailable outside a request context */
  }
}
