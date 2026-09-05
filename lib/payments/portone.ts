/**
 * PortOne V2 (browser + REST) — domestic PG (KCP / KG Inicis V2).
 *
 * - One-time: `PortOne.requestPayment` (prepaid passes, credit packs)
 * - Recurring: `PortOne.requestIssueBillingKey` + REST `/payments/{id}/billing-key`
 */

/** PortOne store ID (console). Env overrides; hardcoded for company testing. */
export const PORTONE_DEFAULT_STORE_ID =
  "store-20ba37af-2fd1-452b-8e02-32eb52d9f961";

/** KG Inicis V2 test/payment channel (PortOne console). */
export const PORTONE_DEFAULT_CHANNEL_KEY =
  "channel-key-2a6f2d7d-26d7-41d1-a5e6-2ecf3359d5a3";

/** @deprecated Use PORTONE_DEFAULT_CHANNEL_KEY */
export const PORTONE_DANAL_TEST_CHANNEL_KEY = PORTONE_DEFAULT_CHANNEL_KEY;

/** Previous Danal channel — not usable with PortOne V2 requestPayment. */
const OBSOLETE_DANAL_CHANNEL_KEY =
  "channel-key-69b54a4d-d875-4b20-84e0-2f27f7629134";

/** Fallback customer fields when session is incomplete (KG Inicis V2 PC). */
export const PORTONE_FALLBACK_CUSTOMER_EMAIL = "test@example.com";
export const PORTONE_FALLBACK_CUSTOMER_NAME = "Studio Canvas User";
export const PORTONE_FALLBACK_CUSTOMER_PHONE = "010-0000-1234";

function isUsablePortoneChannelKey(
  value: string | null | undefined
): value is string {
  const key = value?.trim() ?? "";
  return key.startsWith("channel-key-") && key !== OBSOLETE_DANAL_CHANNEL_KEY;
}

export function getPortoneChannelKey(): string {
  if (typeof process !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim();
    if (isUsablePortoneChannelKey(fromEnv)) {
      return fromEnv;
    }
  }
  return PORTONE_DEFAULT_CHANNEL_KEY;
}

/**
 * KCP 정기과금(빌링키) 전용 채널만 반환합니다.
 * 단건(Inicis) 채널로 조용히 대체하지 않습니다.
 */
export function getConfiguredPortoneBillingChannelKey(): string {
  if (typeof process === "undefined") return "";
  const publicKey = process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY?.trim();
  if (isUsablePortoneChannelKey(publicKey)) return publicKey;
  const serverKey = process.env.PORTONE_BILLING_CHANNEL_KEY?.trim();
  if (isUsablePortoneChannelKey(serverKey)) return serverKey;
  return "";
}

/** @see getConfiguredPortoneBillingChannelKey — empty when billing env is unset */
export function getPortoneBillingChannelKey(): string {
  return getConfiguredPortoneBillingChannelKey();
}

/**
 * Billing-key 발급에 쓸 채널. env 값이 있으면 항상 우선하고,
 * 단건 CHANNEL_KEY로 떨어지지 않습니다.
 */
export function resolvePortoneBillingChannelKey(
  explicit?: string | null
): string {
  const fromEnv = getConfiguredPortoneBillingChannelKey();
  if (fromEnv) return fromEnv;
  const fromInput = explicit?.trim() ?? "";
  const oneTime = getPortoneChannelKey();
  if (isUsablePortoneChannelKey(fromInput) && fromInput !== oneTime) {
    return fromInput;
  }
  throw new Error("portone_billing_channel_missing");
}

/** Always returns a usable storeId (valid env → hardcoded console ID). */
export function getPortoneStoreId(): string {
  if (typeof process !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim();
    if (fromEnv && fromEnv.startsWith("store-") && fromEnv.length > 20) {
      return fromEnv;
    }
  }
  return PORTONE_DEFAULT_STORE_ID;
}

export type PortOneCustomer = {
  customerName?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  customerPhone?: string | null;
};

export type PortOneBrowserPaymentInput = PortOneCustomer & {
  storeId?: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  redirectUrl: string;
  channelKey?: string;
};

export type PortOneBrowserPaymentResult = {
  paymentId?: string;
  transactionType?: string;
  txId?: string;
  code?: string;
  message?: string;
  pgCode?: string;
  pgMessage?: string;
};

export type PortOneBillingKeyInput = PortOneCustomer & {
  storeId?: string;
  channelKey?: string;
  issueId: string;
  issueName: string;
  redirectUrl?: string;
};

export type PortOneBillingKeyResult = {
  billingKey?: string;
  issueId?: string;
  code?: string;
  message?: string;
  pgCode?: string;
  pgMessage?: string;
};

function resolveStoreAndChannel(input: {
  storeId?: string;
  channelKey?: string;
}) {
  const storeId = (input.storeId?.trim() || getPortoneStoreId()).trim();
  const channelKey = (
    input.channelKey?.trim() || getPortoneChannelKey()
  ).trim();
  return { storeId, channelKey };
}

function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveCustomerEmail(email?: string | null): string {
  return isValidEmail(email) ? email.trim() : PORTONE_FALLBACK_CUSTOMER_EMAIL;
}

function resolveCustomerName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed || PORTONE_FALLBACK_CUSTOMER_NAME;
}

/**
 * Normalize KR mobile numbers to `010-XXXX-XXXX` when possible.
 * Falls back to PortOne's sample test phone for KG Inicis PC.
 */
export function resolveCustomerPhone(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith("01")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length >= 9 && digits.length <= 11) {
    return digits;
  }
  return PORTONE_FALLBACK_CUSTOMER_PHONE;
}

function resolveCustomerId(
  customerId: string | null | undefined,
  paymentId: string
): string {
  const trimmed = customerId?.trim();
  if (trimmed) {
    // PortOne customerId should be a simple merchant-side identifier.
    return trimmed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || paymentId;
  }
  return `guest_${paymentId}`.slice(0, 64);
}

/**
 * One-time card checkout for domestic plans (monthly + prepaid).
 * PortOne V2 / KG Inicis requestPayment shape with required customer fields.
 */
export async function requestPortOnePayment(
  input: PortOneBrowserPaymentInput
): Promise<PortOneBrowserPaymentResult | undefined> {
  const PortOne = await import("@portone/browser-sdk/v2");
  const { storeId, channelKey } = resolveStoreAndChannel(input);

  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error("PortOne totalAmount must be a positive KRW integer");
  }

  // KG Inicis V2 (PC): fullName + email + phoneNumber are required.
  // SDK field names: customerId / fullName / email / phoneNumber.
  const customer = {
    customerId: resolveCustomerId(input.customerId, input.paymentId),
    fullName: resolveCustomerName(input.customerName),
    email: resolveCustomerEmail(input.customerEmail),
    phoneNumber: resolveCustomerPhone(input.customerPhone),
  };

  const response = await PortOne.requestPayment({
    storeId,
    channelKey,
    paymentId: input.paymentId,
    orderName: input.orderName,
    totalAmount: Math.round(input.totalAmount),
    currency: "CURRENCY_KRW",
    payMethod: "CARD",
    redirectUrl: input.redirectUrl,
    customer,
  });

  return response as PortOneBrowserPaymentResult | undefined;
}

/**
 * KCP 정기과금 — 빌링키 발급 결제창 (PortOne requestIssueBillingKey).
 * 월간 구독(Starter/Standard/Pro) 국내 결제 시 사용합니다.
 */
export async function requestPortOneBillingKey(
  input: PortOneBillingKeyInput
): Promise<PortOneBillingKeyResult | undefined> {
  const PortOne = await import("@portone/browser-sdk/v2");
  const storeId = (input.storeId?.trim() || getPortoneStoreId()).trim();
  const channelKey = resolvePortoneBillingChannelKey(input.channelKey);

  const customer = {
    customerId: resolveCustomerId(input.customerId, input.issueId),
    fullName: resolveCustomerName(input.customerName),
    email: resolveCustomerEmail(input.customerEmail),
    phoneNumber: resolveCustomerPhone(input.customerPhone),
  };

  const response = await PortOne.requestIssueBillingKey({
    storeId,
    channelKey,
    billingKeyMethod: "CARD",
    issueId: input.issueId,
    issueName: input.issueName,
    ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
    offerPeriod: { interval: "1m" },
    customer,
  });

  return response as PortOneBillingKeyResult | undefined;
}

/** Server-side: charge stored billing key (KCP recurring 1st + renewal). */
export async function chargePortOneBillingKey(input: {
  paymentId: string;
  billingKey: string;
  orderName: string;
  totalAmount: number;
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}): Promise<{
  status?: string;
  id?: string;
  amount?: { total?: number };
}> {
  const secret = process.env.PORTONE_API_SECRET?.trim();
  if (!secret) throw new Error("portone_secret_missing");

  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error("PortOne totalAmount must be a positive KRW integer");
  }

  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(input.paymentId)}/billing-key`,
    {
      method: "POST",
      headers: {
        Authorization: `PortOne ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment: {
          billingKey: input.billingKey,
          orderName: input.orderName,
          customer: {
            id: resolveCustomerId(input.customerId, input.paymentId),
            name: { full: resolveCustomerName(input.customerName) },
            phoneNumber: resolveCustomerPhone(input.customerPhone),
            email: resolveCustomerEmail(input.customerEmail),
          },
          amount: { total: Math.round(input.totalAmount) },
          currency: "KRW",
        },
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PortOne billing-key charge failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    status?: string;
    id?: string;
    amount?: { total?: number };
    payment?: {
      status?: string;
      id?: string;
      amount?: { total?: number };
    };
  };

  const payment = data.payment ?? data;
  return {
    status: payment.status,
    id: payment.id,
    amount: payment.amount,
  };
}

/** Server-side payment lookup (PortOne V2 REST). */
export async function fetchPortOnePayment(paymentId: string): Promise<{
  status?: string;
  id?: string;
  amount?: { total?: number };
} | null> {
  const secret = process.env.PORTONE_API_SECRET?.trim();
  if (!secret) return null;

  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${secret}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PortOne payment lookup failed (${res.status}): ${text}`);
  }
  return (await res.json()) as {
    status?: string;
    id?: string;
    amount?: { total?: number };
  };
}
