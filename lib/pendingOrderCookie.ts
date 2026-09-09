import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { BillingInterval } from "@/lib/data";
import type { Locale } from "@/lib/i18n/types";
import type { PaymentOrder, PaymentProviderId } from "@/lib/db/types";
import { getDb, withDbLock } from "@/lib/db/store";
import { resolveCheckoutRegion } from "@/lib/paymentRouting";

/** Survives Vercel isolate hops so confirm can restore a pending order. */
export const PENDING_ORDER_COOKIE = "sca_pending_order_v1";
const MAX_AGE_SEC = 60 * 60 * 6;

export type PendingOrderPayload = {
  orderId: string;
  userId: string;
  kind: "subscription" | "credit_pack";
  planId?: string;
  billingInterval?: BillingInterval;
  packId?: string;
  locale: Locale;
  amountKrw: number;
  amountUsd: number;
  credits: number;
  createdAt: number;
};

function secret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.PROMO_CODE_SECRET ||
    "dev-only-pending-order-secret-change-me"
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

function providerForLocale(locale: Locale): PaymentProviderId {
  return resolveCheckoutRegion(locale) === "domestic" ? "portone" : "stripe";
}

export function encodePendingOrderCookie(payload: PendingOrderPayload): string {
  const body = JSON.stringify(payload);
  return `${Buffer.from(body, "utf8").toString("base64url")}.${sign(body)}`;
}

export function decodePendingOrderCookie(
  raw: string | undefined | null
): PendingOrderPayload | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!sig || !safeEqual(sign(body), sig)) return null;
  try {
    const parsed = JSON.parse(body) as PendingOrderPayload;
    if (!parsed?.orderId || !parsed?.userId) return null;
    if (Date.now() - (parsed.createdAt || 0) > MAX_AGE_SEC * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writePendingOrderCookie(
  payload: PendingOrderPayload
): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(PENDING_ORDER_COOKIE, encodePendingOrderCookie(payload), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SEC,
    });
  } catch {
    /* outside request */
  }
}

export async function clearPendingOrderCookie(): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(PENDING_ORDER_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  } catch {
    /* ignore */
  }
}

export async function readPendingOrderCookie(
  expectedUserId?: string | null
): Promise<PendingOrderPayload | null> {
  try {
    const jar = await cookies();
    const parsed = decodePendingOrderCookie(
      jar.get(PENDING_ORDER_COOKIE)?.value
    );
    if (!parsed) return null;
    if (expectedUserId && parsed.userId !== expectedUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Load order from memory, or rebuild from the signed pending-order cookie. */
export async function resolvePaymentOrderForUser(
  orderId: string,
  userId: string
): Promise<PaymentOrder | null> {
  const existing = getDb().orders[orderId];
  if (existing && existing.userId === userId) return existing;

  const pending = await readPendingOrderCookie(userId);
  if (!pending || pending.orderId !== orderId) return null;

  return withDbLock((db) => {
    const current = db.orders[orderId];
    if (current && current.userId === userId) return current;

    const restored: PaymentOrder = {
      id: pending.orderId,
      userId: pending.userId,
      provider: providerForLocale(pending.locale),
      kind: pending.kind,
      planId: pending.planId as PaymentOrder["planId"],
      billingInterval: pending.billingInterval,
      packId: pending.packId as PaymentOrder["packId"],
      locale: pending.locale,
      currency: pending.locale === "kr" ? "KRW" : "USD",
      amountUsd: pending.amountUsd,
      amountKrw: pending.amountKrw,
      credits: pending.credits,
      status: "pending",
      vatIncluded: true,
      createdAt: pending.createdAt,
    };
    db.orders[orderId] = restored;
    return restored;
  });
}
