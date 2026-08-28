/**
 * Simulates: download (2000→1999) → Vercel cold start → page refresh hydrate.
 * Run: npx tsx scripts/verify-quota-cold-start.ts
 */
import { getDb, withDbLock } from "../lib/db/store";
import type { UserRecord } from "../lib/db/types";
import { applyTestAccountSubscription } from "../lib/testAccounts";
import {
  mergePlanUsageFromSnapshots,
  persistUserPlanUsage,
  snapshotPlanUsage,
} from "../lib/db/planUsage";
import type { QuotaCookiePayload } from "../lib/quotaCookie";
import type { DurableQuotaSnapshot } from "../lib/db/durableQuota";
import { subscriptionPeriodEndMs } from "../lib/subscriptionPeriod";

process.env.SCA_DB_MEMORY_ONLY = "true";
process.env.AUTH_SECRET = "verify-quota-test-secret";

const USER_ID = "usr_verify_quota_cold_start";
const T1 = Date.UTC(2026, 7, 1);
const T2 = Date.UTC(2026, 7, 28, 6, 30);

function makeUser(periodStart: number): UserRecord {
  const interval = "quarterly" as const;
  return {
    id: USER_ID,
    email: "studiocanvas.cs@gmail.com",
    name: "Quota Verify",
    image: null,
    provider: "google",
    providerAccountId: "verify-quota",
    credits: 0,
    maxCredits: 0,
    planId: "standard",
    billingInterval: interval,
    currentPeriodStart: periodStart,
    currentPeriodEnd: subscriptionPeriodEndMs(periodStart, interval),
    createdAt: periodStart,
    updatedAt: periodStart,
    signupBonusGranted: true,
  };
}

function wipeMemoryDb() {
  const db = getDb();
  db.users = {};
  db.identities = {};
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

async function main() {
  let memoryCookie: QuotaCookiePayload | null = null;
  let memoryDurable: DurableQuotaSnapshot | null = null;

  const cookieIo = {
    read: async (userId: string) =>
      memoryCookie?.userId === userId ? memoryCookie : null,
    write: async (payload: QuotaCookiePayload) => {
      memoryCookie = payload;
    },
  };

  const durableIo = {
    read: async (userId: string) =>
      memoryDurable?.userId === userId ? memoryDurable : null,
    write: async (user: UserRecord) => {
      memoryDurable = {
        userId: user.id,
        updatedAt: Date.now(),
        quotaPeriodStart: user.quotaPeriodStart ?? user.currentPeriodStart ?? 0,
        quotaPeriodEnd: user.currentPeriodEnd,
        fhdRemaining: user.fhdRemaining ?? 0,
        uhd4kRemaining: user.uhd4kRemaining ?? 0,
        generalPhotoDownloadCount: user.generalPhotoDownloadCount ?? 0,
      };
    },
  };

  async function simulatePersist(user: UserRecord) {
    const existingCookie = await cookieIo.read(user.id);
    const existingDurable = await durableIo.read(user.id);
    // Mirror persistUserPlanUsage guard: never write higher remaining than stored.
    let fhd = user.fhdRemaining ?? 0;
    let uhd = user.uhd4kRemaining ?? 0;
    for (const stored of [existingCookie, existingDurable]) {
      if (!stored || stored.userId !== user.id) continue;
      fhd = Math.min(fhd, stored.fhdRemaining);
      uhd = Math.min(uhd, stored.uhd4kRemaining);
    }
    user.fhdRemaining = fhd;
    user.uhd4kRemaining = uhd;
    await cookieIo.write({
      userId: user.id,
      fhdRemaining: fhd,
      uhd4kRemaining: uhd,
      quotaPeriodStart: user.quotaPeriodStart ?? user.currentPeriodStart ?? 0,
      quotaPeriodEnd: user.currentPeriodEnd ?? null,
      updatedAt: Date.now(),
    });
    await durableIo.write(user);
  }

  // --- Step 1: warm instance, user at 2000 ---
  wipeMemoryDb();
  const warmUser = makeUser(T1);
  await withDbLock((db) => {
    db.users[USER_ID] = warmUser;
    mergePlanUsageFromSnapshots(warmUser, null, null);
    return warmUser;
  });
  let usage = snapshotPlanUsage(warmUser);
  assert(usage.fhdRemaining === 2000, `step1 expected 2000, got ${usage.fhdRemaining}`);

  // --- Step 2: download spend → 1999 + persist ---
  await withDbLock((db) => {
    const user = db.users[USER_ID]!;
    user.fhdRemaining = 1999;
    user.quotaPeriodStart = T1;
    return user;
  });
  await simulatePersist(getDb().users[USER_ID]!);
  assert(memoryCookie?.fhdRemaining === 1999, "cookie should store 1999 after download");
  console.log("✓ step2 download persist → cookie 1999");

  // --- Step 3: cold start (memory wiped, new period start T2) ---
  wipeMemoryDb();
  const coldUser = makeUser(T2);
  delete coldUser.fhdRemaining;
  delete coldUser.uhd4kRemaining;
  delete coldUser.quotaPeriodStart;
  delete coldUser.currentPeriodEnd;

  await withDbLock((db) => {
    db.users[USER_ID] = coldUser;
    applyTestAccountSubscription(coldUser, T2);
    return coldUser;
  });

  assert(
    coldUser.fhdRemaining === undefined,
    "test account cold start must not wipe quota fields before hydrate"
  );

  // --- Step 4: hydrate (same as GET /api/account/me) ---
  await withDbLock((db) => {
    const row = db.users[USER_ID]!;
    mergePlanUsageFromSnapshots(row, memoryCookie, memoryDurable);
    return row;
  });
  await simulatePersist(getDb().users[USER_ID]!);

  usage = snapshotPlanUsage(getDb().users[USER_ID]!);
  assert(
    usage.fhdRemaining === 1999,
    `step4 after cold start hydrate expected 1999, got ${usage.fhdRemaining}`
  );
  assert(
    memoryCookie?.fhdRemaining === 1999,
    `cookie must stay 1999 after hydrate, got ${memoryCookie?.fhdRemaining}`
  );
  assert(
    memoryDurable?.fhdRemaining === 1999,
    `R2 snapshot must stay 1999 after hydrate, got ${memoryDurable?.fhdRemaining}`
  );

  console.log("✓ step3 cold start + step4 hydrate → 1999 preserved");

  // --- Step 5: destructive persist guard (2000 must not clobber 1999) ---
  const row = getDb().users[USER_ID]!;
  row.fhdRemaining = 2000;
  await simulatePersist(row);
  assert(
    memoryCookie?.fhdRemaining === 1999,
    `persist guard: cookie must reject 2000 overwrite, got ${memoryCookie?.fhdRemaining}`
  );
  assert(
    row.fhdRemaining === 1999,
    `persist guard: user row must stay 1999, got ${row.fhdRemaining}`
  );
  console.log("✓ step5 persist guard blocks 2000 overwrite");

  console.log("\nAll quota cold-start verification checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
