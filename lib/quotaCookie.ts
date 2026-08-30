import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/** Signed FHD/4K remaining cookie so Vercel isolates keep quota after cold start. */
export const QUOTA_COOKIE_NAME = "sca_quota_v1";
const MAX_AGE_SEC = 60 * 60 * 24 * 180;

function secret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.PROMO_CODE_SECRET ||
    "dev-only-quota-secret-change-me"
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

export type QuotaCookiePayload = {
  userId: string;
  fhdRemaining: number;
  uhd4kRemaining: number;
  quotaPeriodStart: number;
  quotaPeriodEnd?: number | null;
  updatedAt: number;
  /** 1 = legacy FHD/4K; 2 = credit pool. Omitted on old cookies → 1. */
  schemaVersion?: number;
};

export function encodeQuotaCookie(payload: QuotaCookiePayload): string {
  const periodEnd =
    payload.quotaPeriodEnd != null && Number.isFinite(payload.quotaPeriodEnd)
      ? Math.floor(payload.quotaPeriodEnd)
      : "";
  const schemaVersion = Math.max(1, Math.floor(payload.schemaVersion ?? 1));
  const body = [
    payload.userId,
    Math.max(0, Math.floor(payload.fhdRemaining)),
    Math.max(0, Math.floor(payload.uhd4kRemaining)),
    payload.quotaPeriodStart,
    payload.updatedAt,
    periodEnd,
    schemaVersion,
  ].join("|");
  return `${body}.${sign(body)}`;
}

export function decodeQuotaCookie(
  raw: string | undefined | null
): QuotaCookiePayload | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!sig || !safeEqual(sign(body), sig)) return null;
  const parts = body.split("|");
  const [userId, fhdRaw, uhdRaw, periodRaw, updatedAtRaw, periodEndRaw, schemaRaw] =
    parts;
  if (!userId) return null;
  const fhdRemaining = Number(fhdRaw);
  const uhd4kRemaining = Number(uhdRaw);
  const quotaPeriodStart = Number(periodRaw);
  const updatedAt = Number(updatedAtRaw);
  const quotaPeriodEnd =
    periodEndRaw != null && periodEndRaw !== "" ? Number(periodEndRaw) : undefined;
  const schemaVersion =
    schemaRaw != null && schemaRaw !== "" ? Number(schemaRaw) : 1;
  if (
    !Number.isFinite(fhdRemaining) ||
    !Number.isFinite(uhd4kRemaining) ||
    !Number.isFinite(quotaPeriodStart) ||
    !Number.isFinite(updatedAt)
  ) {
    return null;
  }
  return {
    userId,
    fhdRemaining: Math.max(0, Math.floor(fhdRemaining)),
    uhd4kRemaining: Math.max(0, Math.floor(uhd4kRemaining)),
    quotaPeriodStart,
    ...(Number.isFinite(quotaPeriodEnd) ? { quotaPeriodEnd } : {}),
    updatedAt,
    schemaVersion: Number.isFinite(schemaVersion)
      ? Math.max(1, Math.floor(schemaVersion))
      : 1,
  };
}

export async function readQuotaCookie(
  expectedUserId?: string | null
): Promise<QuotaCookiePayload | null> {
  try {
    const jar = await cookies();
    const parsed = decodeQuotaCookie(jar.get(QUOTA_COOKIE_NAME)?.value);
    if (!parsed) return null;
    if (expectedUserId && parsed.userId !== expectedUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeQuotaCookie(
  payload: QuotaCookiePayload
): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(QUOTA_COOKIE_NAME, encodeQuotaCookie(payload), {
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
