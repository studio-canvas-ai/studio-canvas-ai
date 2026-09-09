import type { UserRecord } from "@/lib/db/types";

/** Cookie / R2 snapshot shape for period-aware quota merge. */
export type QuotaSnapshotLike = {
  userId: string;
  fhdRemaining: number;
  uhd4kRemaining: number;
  quotaPeriodStart: number;
  quotaPeriodEnd?: number | null;
  updatedAt?: number;
  schemaVersion?: number;
};

export function pickPreferredQuotaSnapshot(
  cookie: QuotaSnapshotLike | null,
  durable: QuotaSnapshotLike | null
): QuotaSnapshotLike | null {
  if (!cookie && !durable) return null;
  if (!cookie) return durable;
  if (!durable) return cookie;

  const cookieSpent = cookie.fhdRemaining + cookie.uhd4kRemaining;
  const durableSpent = durable.fhdRemaining + durable.uhd4kRemaining;
  if (cookieSpent !== durableSpent) {
    return cookieSpent >= durableSpent ? cookie : durable;
  }
  return (cookie.updatedAt ?? 0) >= (durable.updatedAt ?? 0) ? cookie : durable;
}

/** True when persisted quota belongs to the user's active (or restorable) billing window. */
export function quotaPeriodCompatible(
  user: UserRecord,
  storedPeriodStart: number,
  storedPeriodEnd?: number | null
): boolean {
  if (!Number.isFinite(storedPeriodStart) || storedPeriodStart <= 0) return false;

  const periodStart = user.currentPeriodStart ?? 0;
  const periodEnd = user.currentPeriodEnd ?? null;

  if (storedPeriodStart === periodStart) return true;
  if (user.quotaPeriodStart != null && storedPeriodStart === user.quotaPeriodStart) {
    return true;
  }

  if (
    periodEnd != null &&
    storedPeriodEnd != null &&
    storedPeriodEnd === periodEnd
  ) {
    return true;
  }

  if (
    periodEnd != null &&
    storedPeriodStart >= periodStart &&
    storedPeriodStart <= periodEnd
  ) {
    return true;
  }

  if (
    storedPeriodEnd != null &&
    periodStart > 0 &&
    periodStart >= storedPeriodStart &&
    periodStart <= storedPeriodEnd
  ) {
    return true;
  }

  // Cold start: memory row has no quota yet — accept the signed snapshot.
  if (user.fhdRemaining == null && user.uhd4kRemaining == null) {
    return true;
  }

  return false;
}

/** Realign volatile period-start timestamps from durable/cookie before ensurePlanUsage. */
export function alignUserPeriodFromSnapshot(
  user: UserRecord,
  snapshot: QuotaSnapshotLike | null
): void {
  if (!snapshot || snapshot.userId !== user.id) return;

  const now = Date.now();
  const periodExpired =
    typeof user.currentPeriodEnd === "number" && user.currentPeriodEnd <= now;
  if (periodExpired) return;

  if (
    !quotaPeriodCompatible(user, snapshot.quotaPeriodStart, snapshot.quotaPeriodEnd) &&
    (user.fhdRemaining != null || user.uhd4kRemaining != null)
  ) {
    return;
  }

  if (snapshot.quotaPeriodStart > 0) {
    user.currentPeriodStart = snapshot.quotaPeriodStart;
    user.quotaPeriodStart = snapshot.quotaPeriodStart;
  }
  if (
    snapshot.quotaPeriodEnd != null &&
    snapshot.quotaPeriodEnd > now &&
    (user.currentPeriodEnd == null || user.currentPeriodEnd < snapshot.quotaPeriodEnd)
  ) {
    user.currentPeriodEnd = snapshot.quotaPeriodEnd;
  }
}

export function billingPeriodExpired(user: UserRecord, now = Date.now()): boolean {
  return (
    typeof user.currentPeriodEnd === "number" && user.currentPeriodEnd <= now
  );
}
