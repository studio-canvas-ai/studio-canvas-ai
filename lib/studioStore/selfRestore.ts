/**
 * Logged-in member self-restore. Emergency only: empty studio store AND
 * remaining FHD/4K quota or remaining subscription days is 0.
 * Restores files/vaults only — never copies quota or period end from backup
 * (blocks save-scumming of remaining times / remaining days).
 */

import { getUserById } from "@/lib/db/credits";
import { hydrateUserPlanUsage } from "@/lib/db/planUsage";
import { withDbLock } from "@/lib/db/store";
import type { UserRecord } from "@/lib/db/types";
import { writeQuotaCookie } from "@/lib/quotaCookie";
import {
  formatSubscriptionEndDate,
  remainingSubscriptionDays,
} from "@/lib/subscriptionPeriod";
import {
  studioBundleIsEmpty,
  studioCountsNonEmpty,
} from "@/lib/studioStore/persistKeys";
import { loadMergedCloudBundle, saveStudioStoreBundle } from "@/lib/studioStore/serverStore";
import {
  getStudioStoreSnapshot,
  listStudioStoreSnapshots,
} from "@/lib/studioStore/snapshots";
import { summarizeStudioBundle, type StudioStoreSummary } from "@/lib/studioStore/summarize";
import type { StudioStoreBundle } from "@/lib/studioStore/types";

export type SelfRestoreDenial =
  | "healthy_data_exists"
  | "credits_intact"
  | "quota_or_days_intact"
  | "no_backup"
  | "snapshot_empty";

export type SelfRestoreResult =
  | {
      ok: true;
      snapshotId: string;
      current: StudioStoreSummary;
      credits: number;
      creditsRestored: false;
      quotaRestored: false;
      periodRestored: false;
    }
  | { ok: false; error: SelfRestoreDenial };

type LockedEntitlements = {
  credits: number;
  maxCredits: number;
  fhdRemaining: number;
  uhd4kRemaining: number;
  quotaPeriodStart: number | undefined;
  currentPeriodStart: number | undefined;
  currentPeriodEnd: number | undefined;
  planId: UserRecord["planId"];
  billingInterval: UserRecord["billingInterval"];
};

function snapshotEntitlements(user: UserRecord): LockedEntitlements {
  return {
    credits: typeof user.credits === "number" ? user.credits : 0,
    maxCredits: typeof user.maxCredits === "number" ? user.maxCredits : 0,
    fhdRemaining: Math.max(0, user.fhdRemaining ?? 0),
    uhd4kRemaining: Math.max(0, user.uhd4kRemaining ?? 0),
    quotaPeriodStart: user.quotaPeriodStart,
    currentPeriodStart: user.currentPeriodStart,
    currentPeriodEnd: user.currentPeriodEnd,
    planId: user.planId,
    billingInterval: user.billingInterval,
  };
}

function applyLockedEntitlements(
  user: UserRecord,
  locked: LockedEntitlements
): void {
  user.credits = locked.credits;
  user.maxCredits = locked.maxCredits;
  user.fhdRemaining = locked.fhdRemaining;
  user.uhd4kRemaining = locked.uhd4kRemaining;
  user.quotaPeriodStart = locked.quotaPeriodStart;
  user.currentPeriodStart = locked.currentPeriodStart;
  user.currentPeriodEnd = locked.currentPeriodEnd;
  user.planId = locked.planId;
  user.billingInterval = locked.billingInterval;
}

/** Snapshot payloads may grow; never apply quota / period fields from them. */
function filesOnlyBundle(payload: StudioStoreBundle): StudioStoreBundle {
  return {
    recentShared: Array.isArray(payload.recentShared) ? payload.recentShared : [],
    recentPhoto: Array.isArray(payload.recentPhoto) ? payload.recentPhoto : [],
    uploadVault: Array.isArray(payload.uploadVault) ? payload.uploadVault : [],
    trainedVault: Array.isArray(payload.trainedVault) ? payload.trainedVault : [],
    activeTrainedId:
      typeof payload.activeTrainedId === "string" ? payload.activeTrainedId : null,
  };
}

function remainingTimes(user: UserRecord): number {
  return (
    Math.max(0, user.fhdRemaining ?? 0) + Math.max(0, user.uhd4kRemaining ?? 0)
  );
}

function remainingDays(user: UserRecord): number {
  const end = formatSubscriptionEndDate(user.currentPeriodEnd ?? null);
  if (!end) return 0;
  return Math.max(0, remainingSubscriptionDays(end));
}

export async function restoreOwnStudioStore(opts: {
  user: UserRecord;
  aliases: string[];
  supabaseUserId?: string | null;
}): Promise<SelfRestoreResult> {
  const aliases = [...new Set([opts.user.id, ...opts.aliases])].filter(Boolean);
  const cloud = await loadMergedCloudBundle(aliases);

  if (!studioBundleIsEmpty(cloud.bundle)) {
    return { ok: false, error: "healthy_data_exists" };
  }

  const live = (await getUserById(opts.user.id)) ?? opts.user;
  const user = await hydrateUserPlanUsage(live);
  const locked = snapshotEntitlements(user);

  const timesLeft = remainingTimes(user);
  const daysLeft = remainingDays(user);
  if (timesLeft > 0 && daysLeft > 0) {
    return { ok: false, error: "quota_or_days_intact" };
  }

  const snaps = await listStudioStoreSnapshots(aliases);
  const latest =
    snaps.find((s) => studioCountsNonEmpty(s.counts) && s.reason !== "pre_restore") ||
    snaps.find((s) => studioCountsNonEmpty(s.counts));
  if (!latest) {
    return { ok: false, error: "no_backup" };
  }

  const snap = await getStudioStoreSnapshot(latest.id);
  if (!snap || studioBundleIsEmpty(snap.payload)) {
    return { ok: false, error: "snapshot_empty" };
  }

  const ownerOk =
    aliases.includes(snap.app_user_id) ||
    (snap.user_id ? aliases.includes(snap.user_id) : false);
  if (!ownerOk) {
    return { ok: false, error: "no_backup" };
  }

  const durable = await saveStudioStoreBundle({
    canonicalUserId: opts.user.id,
    supabaseUserId: opts.supabaseUserId ?? snap.user_id,
    bundle: filesOnlyBundle(snap.payload),
    mode: "replace",
    skipSnapshot: true,
  });

  const lockedUser = await withDbLock((db) => {
    const row = db.users[opts.user.id];
    if (!row) return null;
    applyLockedEntitlements(row, locked);
    row.updatedAt = Date.now();
    return row;
  });
  if (lockedUser) {
    await writeQuotaCookie({
      userId: lockedUser.id,
      fhdRemaining: locked.fhdRemaining,
      uhd4kRemaining: locked.uhd4kRemaining,
      quotaPeriodStart:
        locked.quotaPeriodStart ?? locked.currentPeriodStart ?? 0,
      updatedAt: Date.now(),
    });
  }

  return {
    ok: true,
    snapshotId: snap.id,
    current: summarizeStudioBundle(durable),
    credits: locked.credits,
    creditsRestored: false,
    quotaRestored: false,
    periodRestored: false,
  };
}
