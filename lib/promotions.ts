import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getDb, newId, withDbLock } from "@/lib/db/store";
import type {
  PromotionCode,
  PromotionCreditOption,
  PromotionHistoryEntry,
} from "@/lib/db/types";

export const PROMO_COOKIE_NAME = "sca_promo_wallet";
export const PROMO_EXPIRY_DAYS = 180;
const DAY_MS = 86_400_000;
export const PROMOTION_CREDIT_OPTIONS: PromotionCreditOption[] = [10, 20, 50, 100];

function secret() {
  return (
    process.env.PROMO_CODE_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-only-promo-secret-change-me"
  );
}

function hmac(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function normalizePromotionCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashPromotionCode(code: string) {
  return hmac(`code:${normalizePromotionCode(code)}`);
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const raw = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `SC-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
}

function history(
  promotionId: string,
  type: PromotionHistoryEntry["type"],
  delta: number,
  balanceAfter: number,
  meta?: PromotionHistoryEntry["meta"]
): PromotionHistoryEntry {
  return {
    id: newId("prh"),
    promotionId,
    type,
    delta,
    balanceAfter,
    createdAt: Date.now(),
    meta,
  };
}

export async function bulkCreatePromotionCodes(input: {
  creditAmount: PromotionCreditOption;
  quantity: number;
  createdBy: string;
}) {
  if (!PROMOTION_CREDIT_OPTIONS.includes(input.creditAmount)) {
    throw new Error("Invalid credit option");
  }
  const quantity = Math.max(1, Math.min(500, Math.floor(input.quantity)));
  return withDbLock((db) => {
    const batchId = newId("prb");
    const now = Date.now();
    const expiresAt = now + PROMO_EXPIRY_DAYS * DAY_MS;
    db.promotionBatches[batchId] = {
      id: batchId,
      creditAmount: input.creditAmount,
      quantity,
      createdAt: now,
      createdBy: input.createdBy,
    };

    const plaintextCodes: string[] = [];
    for (let index = 0; index < quantity; index += 1) {
      let code = generateCode();
      let codeHash = hashPromotionCode(code);
      while (Object.values(db.promotionCodes).some((item) => item.codeHash === codeHash)) {
        code = generateCode();
        codeHash = hashPromotionCode(code);
      }
      const id = newId("prm");
      const item: PromotionCode = {
        id,
        batchId,
        codeHash,
        codeSuffix: code.slice(-4),
        initialCredits: input.creditAmount,
        remainingCredits: input.creditAmount,
        issuedAt: now,
        expiresAt,
        isExpired: false,
        useCount: 0,
      };
      db.promotionCodes[id] = item;
      db.promotionHistory.push(history(id, "issued", input.creditAmount, input.creditAmount));
      plaintextCodes.push(code);
    }
    return { batch: db.promotionBatches[batchId], codes: plaintextCodes };
  });
}

function expireIfNeeded(code: PromotionCode, now = Date.now()) {
  if (code.isExpired) return true;
  if (code.remainingCredits <= 0 || code.expiresAt <= now) {
    code.isExpired = true;
    code.expiredAt = now;
    return true;
  }
  return false;
}

export async function activatePromotionCode(rawCode: string) {
  const codeHash = hashPromotionCode(rawCode);
  return withDbLock((db) => {
    const item = Object.values(db.promotionCodes).find((code) => code.codeHash === codeHash);
    if (!item) return { ok: false as const, reason: "invalid" as const };
    if (expireIfNeeded(item)) {
      return { ok: false as const, reason: "expired" as const };
    }
    db.promotionHistory.push(
      history(item.id, "activated", 0, item.remainingCredits)
    );
    return { ok: true as const, promotion: item };
  });
}

export function createPromotionCookieToken(promotionId: string) {
  const payload = Buffer.from(
    JSON.stringify({ id: promotionId, issuedAt: Date.now() }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${hmac(`wallet:${payload}`)}`;
}

export function verifyPromotionCookieToken(token?: string | null): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = hmac(`wallet:${payload}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id?: string;
    };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

export function getPromotionByToken(token?: string | null): PromotionCode | null {
  const id = verifyPromotionCookieToken(token);
  if (!id) return null;
  const code = getDb().promotionCodes[id];
  if (!code || code.isExpired || code.expiresAt <= Date.now() || code.remainingCredits <= 0) {
    return null;
  }
  return code;
}

export async function debitPromotionWallet(input: {
  token?: string | null;
  amount: number;
  mode: "generate" | "regenerate";
}) {
  const promotionId = verifyPromotionCookieToken(input.token);
  if (!promotionId) return { ok: false as const, reason: "invalid" as const };
  const amount = Math.round(input.amount * 10) / 10;
  return withDbLock((db) => {
    const item = db.promotionCodes[promotionId];
    if (!item || expireIfNeeded(item)) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (item.remainingCredits + 1e-9 < amount) {
      return {
        ok: false as const,
        reason: "insufficient" as const,
        credits: item.remainingCredits,
      };
    }
    item.remainingCredits = Math.round((item.remainingCredits - amount) * 10) / 10;
    item.lastUsedAt = Date.now();
    item.useCount += 1;
    db.promotionHistory.push(
      history(item.id, input.mode, -amount, item.remainingCredits)
    );
    if (item.remainingCredits <= 0) {
      item.isExpired = true;
      item.expiredAt = Date.now();
    }
    return {
      ok: true as const,
      promotion: item,
      transactionId: db.promotionHistory.at(-1)!.id,
    };
  });
}

export async function expirePromotionCodes(now = Date.now()) {
  return withDbLock((db) => {
    let expired = 0;
    let forfeitedCredits = 0;
    for (const item of Object.values(db.promotionCodes)) {
      if (item.isExpired || item.expiresAt > now) continue;
      const remaining = item.remainingCredits;
      item.isExpired = true;
      item.expiredAt = now;
      item.remainingCredits = 0;
      expired += 1;
      forfeitedCredits += remaining;
      db.promotionHistory.push(history(item.id, "expired", -remaining, 0));
    }
    return { expired, forfeitedCredits };
  });
}

export function listPromotionAdminData() {
  const db = getDb();
  return {
    codes: Object.values(db.promotionCodes)
      .sort((a, b) => b.issuedAt - a.issuedAt)
      .map(({ codeHash: _codeHash, ...item }) => item),
    batches: Object.values(db.promotionBatches).sort((a, b) => b.createdAt - a.createdAt),
    history: [...db.promotionHistory].sort((a, b) => b.createdAt - a.createdAt).slice(0, 1_000),
  };
}
