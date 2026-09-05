import type { UserRecord } from "@/lib/db/types";
import { getPlanUsageLimits } from "@/lib/planQuotas";
import { creditPoolForPlan } from "@/lib/featureCreditCosts";
import { quotaPeriodCompatible } from "@/lib/quotaPeriod";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";

/** Durable per-user download quota (FHD/4K period + free general-photo lifetime). */
export type DurableQuotaSnapshot = {
  userId: string;
  updatedAt: number;
  quotaPeriodStart: number;
  quotaPeriodEnd?: number;
  fhdRemaining: number;
  uhd4kRemaining: number;
  generalPhotoDownloadCount: number;
  /** 1 = legacy FHD/4K; 2 = credit pool in fhdRemaining. */
  schemaVersion?: number;
};

function manifestKey(userId: string) {
  return `quota/${userId}/usage.json`;
}

export async function loadDurableQuota(
  userId: string
): Promise<DurableQuotaSnapshot | null> {
  if (!isR2Configured()) return null;
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, manifestKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as DurableQuotaSnapshot;
    if (parsed?.userId !== userId) return null;
    const fhdRemaining = Number(parsed.fhdRemaining);
    const uhd4kRemaining = Number(parsed.uhd4kRemaining);
    const quotaPeriodStart = Number(parsed.quotaPeriodStart);
    const quotaPeriodEnd =
      parsed.quotaPeriodEnd != null ? Number(parsed.quotaPeriodEnd) : undefined;
    const generalPhotoDownloadCount = Number(parsed.generalPhotoDownloadCount);
    const schemaVersion = Number(parsed.schemaVersion ?? 1);
    if (
      !Number.isFinite(fhdRemaining) ||
      !Number.isFinite(uhd4kRemaining) ||
      !Number.isFinite(quotaPeriodStart)
    ) {
      return null;
    }
    return {
      userId,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      quotaPeriodStart,
      ...(Number.isFinite(quotaPeriodEnd) ? { quotaPeriodEnd } : {}),
      fhdRemaining: Math.max(0, Math.floor(fhdRemaining)),
      uhd4kRemaining: Math.max(0, Math.floor(uhd4kRemaining)),
      generalPhotoDownloadCount: Number.isFinite(generalPhotoDownloadCount)
        ? Math.max(0, Math.floor(generalPhotoDownloadCount))
        : 0,
      schemaVersion: Number.isFinite(schemaVersion)
        ? Math.max(1, Math.floor(schemaVersion))
        : 1,
    };
  } catch {
    return null;
  }
}

export async function saveDurableQuota(user: UserRecord): Promise<void> {
  if (!isR2Configured()) return;
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: DurableQuotaSnapshot = {
    userId: user.id,
    updatedAt: Date.now(),
    quotaPeriodStart: user.quotaPeriodStart ?? user.currentPeriodStart ?? 0,
    ...(typeof user.currentPeriodEnd === "number"
      ? { quotaPeriodEnd: user.currentPeriodEnd }
      : {}),
    fhdRemaining: Math.max(0, user.fhdRemaining ?? 0),
    uhd4kRemaining: Math.max(0, user.uhd4kRemaining ?? 0),
    generalPhotoDownloadCount: Math.max(0, user.generalPhotoDownloadCount ?? 0),
    schemaVersion: Math.max(1, user.quotaSchemaVersion ?? 1),
  };
  await putR2Object(
    client,
    config.bucketName,
    manifestKey(user.id),
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

/**
 * Merge durable quota into the in-memory user row.
 * Period FHD/4K: prefer the lowest remaining for the active billing window.
 * General-photo downloads: lifetime counter — prefer the highest persisted value.
 */
export function applyDurableQuotaToUser(
  user: UserRecord,
  snapshot: DurableQuotaSnapshot | null
): void {
  if (!snapshot || snapshot.userId !== user.id) return;

  const limits = getPlanUsageLimits(user.planId, user.billingInterval ?? "monthly");

  if (
    quotaPeriodCompatible(
      user,
      snapshot.quotaPeriodStart,
      snapshot.quotaPeriodEnd
    )
  ) {
    const pool = creditPoolForPlan(user.planId, user.billingInterval ?? "monthly");
    const snapVer = snapshot.schemaVersion ?? 1;
    // Legacy FHD counters must not overwrite the unified credit pool.
    const applyFhd = !(pool != null && snapVer < 2);

    if (applyFhd) {
      user.fhdRemaining = Math.min(
        limits.fhd,
        user.fhdRemaining ?? limits.fhd,
        Math.max(0, snapshot.fhdRemaining)
      );
    }
    user.uhd4kRemaining = Math.min(
      limits.uhd4k,
      user.uhd4kRemaining ?? limits.uhd4k,
      Math.max(0, snapshot.uhd4kRemaining)
    );
    if (snapVer >= 2) {
      user.quotaSchemaVersion = Math.max(user.quotaSchemaVersion ?? 1, snapVer);
    }
  }

  user.generalPhotoDownloadCount = Math.max(
    user.generalPhotoDownloadCount ?? 0,
    Math.max(0, snapshot.generalPhotoDownloadCount)
  );
}
