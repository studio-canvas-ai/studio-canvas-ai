import { FREE_CREDITS, REGENERATE_CREDIT_COST } from "@/lib/data";
import { getDb, identityKey, newId, stableUserId, withDbLock } from "@/lib/db/store";
import type {
  AuthProviderId,
  CreditLedgerEntry,
  PlanId,
  UserRecord,
} from "@/lib/db/types";
import {
  consumeOrderCreditBuckets,
  parseConsumptionsMeta,
  restoreOrderCreditBuckets,
  serializeConsumptionsMeta,
} from "@/lib/payments/orderCredits";

export async function findOrCreateOAuthUser(input: {
  provider: AuthProviderId;
  providerAccountId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<{ user: UserRecord; isNew: boolean }> {
  return withDbLock((db) => {
    const key = identityKey(input.provider, input.providerAccountId);
    const id = stableUserId(input.provider, input.providerAccountId);
    const existingId = db.identities[key] ?? (db.users[id] ? id : undefined);
    if (existingId && db.users[existingId]) {
      const user = db.users[existingId];
      user.email = input.email ?? user.email;
      user.name = input.name ?? user.name;
      user.image = input.image ?? user.image;
      user.updatedAt = Date.now();
      db.identities[key] = existingId;
      return { user, isNew: false };
    }

    const now = Date.now();
    const user: UserRecord = {
      id,
      email: input.email ?? null,
      name: input.name ?? null,
      image: input.image ?? null,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      credits: FREE_CREDITS,
      maxCredits: FREE_CREDITS,
      planId: "free",
      createdAt: now,
      updatedAt: now,
      signupBonusGranted: true,
    };
    db.users[id] = user;
    db.identities[key] = id;
    db.ledger.push({
      id: newId("ldg"),
      userId: id,
      delta: FREE_CREDITS,
      balanceAfter: FREE_CREDITS,
      reason: "signup_bonus",
      meta: { provider: input.provider },
      createdAt: now,
    });
    return { user, isNew: true };
  });
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  return getDb().users[userId] ?? null;
}

export type DebitResult =
  | { ok: true; user: UserRecord; entry: CreditLedgerEntry }
  | { ok: false; reason: "not_found" | "insufficient"; credits?: number };

export async function debitCredits(params: {
  userId: string;
  amount: number;
  reason: CreditLedgerEntry["reason"];
  meta?: CreditLedgerEntry["meta"];
}): Promise<DebitResult> {
  const amount = Math.round(params.amount * 10) / 10;
  if (amount <= 0) {
    const user = await getUserById(params.userId);
    if (!user) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      user,
      entry: {
        id: newId("ldg"),
        userId: params.userId,
        delta: 0,
        balanceAfter: user.credits,
        reason: params.reason,
        meta: params.meta,
        createdAt: Date.now(),
      },
    };
  }

  return withDbLock((db) => {
    const user = db.users[params.userId];
    if (!user) return { ok: false, reason: "not_found" };
    if (user.credits + 1e-9 < amount) {
      return { ok: false, reason: "insufficient", credits: user.credits };
    }
    user.credits = Math.round((user.credits - amount) * 10) / 10;
    user.updatedAt = Date.now();
    const consumptions = consumeOrderCreditBuckets(db, user.id, amount);
    const entry: CreditLedgerEntry = {
      id: newId("ldg"),
      userId: user.id,
      delta: -amount,
      balanceAfter: user.credits,
      reason: params.reason,
      meta: {
        ...params.meta,
        ...(consumptions.length
          ? { orderConsumptions: serializeConsumptionsMeta(consumptions) }
          : {}),
      },
      createdAt: Date.now(),
    };
    db.ledger.push(entry);
    return { ok: true, user, entry };
  });
}

export async function creditUser(params: {
  userId: string;
  amount: number;
  reason: CreditLedgerEntry["reason"];
  meta?: CreditLedgerEntry["meta"];
  setPlanId?: PlanId;
  setMaxCredits?: number;
  /** When restoring a failed generation, pass the debit entry meta to refill order buckets. */
  restoreFromDebitMeta?: CreditLedgerEntry["meta"];
}): Promise<UserRecord | null> {
  const amount = Math.round(params.amount * 10) / 10;
  return withDbLock((db) => {
    const user = db.users[params.userId];
    if (!user) return null;
    user.credits = Math.round((user.credits + amount) * 10) / 10;
    if (params.setMaxCredits != null) {
      user.maxCredits = Math.max(user.maxCredits, params.setMaxCredits);
    } else {
      user.maxCredits = Math.max(user.maxCredits, user.credits);
    }
    if (params.setPlanId) user.planId = params.setPlanId;
    user.updatedAt = Date.now();

    if (params.reason === "refund" || params.reason === "system_error_restore") {
      const fromMeta = parseConsumptionsMeta(params.restoreFromDebitMeta ?? params.meta);
      if (fromMeta.length) {
        restoreOrderCreditBuckets(db, fromMeta);
      }
    }

    db.ledger.push({
      id: newId("ldg"),
      userId: user.id,
      delta: amount,
      balanceAfter: user.credits,
      reason: params.reason,
      meta: params.meta,
      createdAt: Date.now(),
    });
    return user;
  });
}

export function regenerateCost() {
  return REGENERATE_CREDIT_COST;
}
