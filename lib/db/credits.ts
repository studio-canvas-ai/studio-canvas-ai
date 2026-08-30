import { REGENERATE_CREDIT_COST } from "@/lib/data";
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
import {
  isPrivilegedAdminEmail,
} from "@/lib/unlimitedAccount";
import { applyTestAccountSubscription, getTestAccountSetup } from "@/lib/testAccounts";
import { ensurePlanUsage, persistUserPlanUsage } from "@/lib/db/planUsage";
import { writeWalletCookie, readWalletCookie } from "@/lib/walletCookie";

function startingCreditsForEmail(_email: string | null | undefined): number {
  return 0;
}

function normalizeCreditsHint(value: number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(Math.max(0, value) * 10) / 10;
  }
  return null;
}

/** Legacy credit wallets are forced to 0 (gift-card credits ship later). */
function wipeLegacyCredits(user: UserRecord): void {
  user.credits = 0;
  user.maxCredits = 0;
  user.legacyCreditsWiped = true;
}

/** Resolve starting balance — always 0 after the N-times quota cutover. */
function resolveProvisionCredits(
  _email: string | null | undefined,
  _creditsHint?: number | null
): number {
  return 0;
}

function applyPrivilegedAdminWallet(
  _db: ReturnType<typeof getDb>,
  user: UserRecord,
  _reason: "signup_bonus" | "admin_adjust"
): void {
  wipeLegacyCredits(user);
}

function refillPrivilegedAdminIfEmpty(
  _db: ReturnType<typeof getDb>,
  user: UserRecord
): void {
  wipeLegacyCredits(user);
}

/**
 * Adopt a newer signed wallet cookie when another serverless isolate spent/refunded.
 */
export async function reconcileUserWithWalletCookie(
  user: UserRecord
): Promise<UserRecord> {
  const wallet = await readWalletCookie(user.id);
  if (!wallet) return user;
  if (wallet.updatedAt < user.updatedAt) return user;
  if (Math.abs(wallet.credits - user.credits) < 1e-9) return user;

  const current = await withDbLock((db) => {
    const row = db.users[user.id];
    if (!row) return user;
    if (wallet.updatedAt < row.updatedAt) return row;
    row.credits = 0;
    row.maxCredits = 0;
    row.legacyCreditsWiped = true;
    row.updatedAt = Math.max(row.updatedAt, wallet.updatedAt, Date.now());
    return row;
  });
  await writeWalletCookie(current.id, current.credits);
  return current;
}

export async function findOrCreateOAuthUser(input: {
  provider: AuthProviderId;
  providerAccountId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  /** Last known balance (JWT / wallet cookie) for serverless rehydrate. */
  creditsHint?: number | null;
}): Promise<{ user: UserRecord; isNew: boolean }> {
  const id = stableUserId(input.provider, input.providerAccountId);
  const cookieHint = await readWalletCookie(id);
  const provisionHint =
    normalizeCreditsHint(input.creditsHint ?? null) ??
    cookieHint?.credits ??
    null;

  const result = await withDbLock((db) => {
    const key = identityKey(input.provider, input.providerAccountId);
    const existingId = db.identities[key] ?? (db.users[id] ? id : undefined);
    if (existingId && db.users[existingId]) {
      const user = db.users[existingId];
      user.email = input.email ?? user.email;
      user.name = input.name ?? user.name;
      user.image = input.image ?? user.image;
      user.updatedAt = Date.now();
      wipeLegacyCredits(user);
      db.identities[key] = existingId;
      applyTestAccountSubscription(user);
      ensurePlanUsage(user);
      return { user, isNew: false };
    }

    const now = Date.now();
    const startCredits = resolveProvisionCredits(input.email, provisionHint);
    const user: UserRecord = {
      id,
      email: input.email ?? null,
      name: input.name ?? null,
      image: input.image ?? null,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      credits: startCredits,
      maxCredits: Math.max(startCredits, startingCreditsForEmail(input.email)),
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
      delta: startCredits,
      balanceAfter: startCredits,
      reason: "signup_bonus",
      meta: {
        provider: input.provider,
        ...(isPrivilegedAdminEmail(input.email)
          ? { adminTestWallet: true }
          : {}),
        ...(provisionHint != null ? { rehydratedFromHint: true } : {}),
      },
      createdAt: now,
    });
    applyTestAccountSubscription(user);
    ensurePlanUsage(user);
    return { user, isNew: true };
  });
  await writeWalletCookie(result.user.id, result.user.credits);
  return result;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  return getDb().users[userId] ?? null;
}

/**
 * Upsert a local credit-wallet user for a known session id.
 * Needed on Vercel cold starts where the in-memory/JSON store is empty
 * even though the JWT session still carries a valid user id.
 */
export async function ensureUserRecord(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  provider?: AuthProviderId;
  providerAccountId?: string | null;
  credits?: number;
}): Promise<UserRecord> {
  const userId = String(input.userId || "").trim();
  if (!userId) {
    throw new Error("ensureUserRecord requires userId");
  }

  const cookieHint = await readWalletCookie(userId);
  const provisionHint =
    normalizeCreditsHint(input.credits ?? null) ?? cookieHint?.credits ?? null;

  const user = await withDbLock((db) => {
    const existing = db.users[userId];
    if (existing) {
      if (input.email != null && input.email !== "") existing.email = input.email;
      if (input.name != null) existing.name = input.name;
      if (input.image != null) existing.image = input.image;
      existing.updatedAt = Date.now();
      wipeLegacyCredits(existing);
      applyTestAccountSubscription(existing);
      ensurePlanUsage(existing);
      return existing;
    }

    const now = Date.now();
    const provider: AuthProviderId = input.provider ?? "credentials";
    const providerAccountId =
      (input.providerAccountId && String(input.providerAccountId)) ||
      (input.email && String(input.email)) ||
      userId;
    const credits = resolveProvisionCredits(input.email, provisionHint);

    const created: UserRecord = {
      id: userId,
      email: input.email ?? null,
      name: input.name ?? null,
      image: input.image ?? null,
      provider,
      providerAccountId,
      credits,
      maxCredits: Math.max(credits, startingCreditsForEmail(input.email)),
      planId: "free",
      createdAt: now,
      updatedAt: now,
      signupBonusGranted: true,
    };
    db.users[userId] = created;
    db.identities[identityKey(provider, providerAccountId)] = userId;
    db.ledger.push({
      id: newId("ldg"),
      userId,
      delta: credits,
      balanceAfter: credits,
      reason: "signup_bonus",
      meta: {
        autoProvisioned: true,
        provider,
        ...(isPrivilegedAdminEmail(input.email)
          ? { adminTestWallet: true }
          : {}),
        ...(provisionHint != null ? { rehydratedFromHint: true } : {}),
      },
      createdAt: now,
    });
    applyTestAccountSubscription(created);
    ensurePlanUsage(created);
    return created;
  });
  await writeWalletCookie(user.id, user.credits);
  return user;
}

export async function syncTestAccountSubscription(
  user: UserRecord
): Promise<UserRecord> {
  const updated = await withDbLock((db) => {
    const row = db.users[user.id];
    if (!row) return user;
    wipeLegacyCredits(row);
    applyTestAccountSubscription(row);
    ensurePlanUsage(row);
    return row;
  });
  await writeWalletCookie(updated.id, 0);
  // Persist credit pool (cookie + R2 + Supabase) after QA plan seed.
  if (getTestAccountSetup(updated.email)) {
    await persistUserPlanUsage(updated);
  }
  return updated;
}

/** Admin directory listing — newest signups first. */
export async function listUsersForAdmin(): Promise<
  Array<{
    id: string;
    email: string | null;
    name: string | null;
    provider: AuthProviderId;
    planId: PlanId;
    credits: number;
    createdAt: number;
  }>
> {
  const users = Object.values(getDb().users);
  users.sort((a, b) => b.createdAt - a.createdAt);
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    provider: u.provider,
    planId: u.planId,
    credits: u.credits,
    createdAt: u.createdAt,
  }));
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

  // Cold-start safety: session may exist while the memory store was wiped.
  if (!(await getUserById(params.userId))) {
    await ensureUserRecord({ userId: params.userId });
  }

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

  const result = await withDbLock((db) => {
    const user = db.users[params.userId];
    if (!user) return { ok: false as const, reason: "not_found" as const };

    if (user.credits + 1e-9 < amount) {
      const skipLegacy =
        (params.reason === "generate" || params.reason === "regenerate") &&
        user.planId !== "free";
      if (skipLegacy) {
        const entry: CreditLedgerEntry = {
          id: newId("ldg"),
          userId: user.id,
          delta: 0,
          balanceAfter: user.credits,
          reason: params.reason,
          meta: {
            ...params.meta,
            skippedLegacyCredit: true,
          },
          createdAt: Date.now(),
        };
        db.ledger.push(entry);
        return { ok: true as const, user, entry };
      }
      return {
        ok: false as const,
        reason: "insufficient" as const,
        credits: user.credits,
      };
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

    return { ok: true as const, user, entry };
  });

  if (result.ok) {
    await writeWalletCookie(result.user.id, result.user.credits);
  }
  return result;
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
  const user = await withDbLock((db) => {
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
  if (user) {
    await writeWalletCookie(user.id, user.credits);
  }
  return user;
}

export function regenerateCost() {
  return REGENERATE_CREDIT_COST;
}
