import type { PlanId } from "@/lib/faceProfiles";
import {
  createR2Client,
  deleteR2Object,
  getR2Config,
  getR2Object,
  listR2Keys,
  putR2Object,
} from "@/lib/r2";
import { computeExpiresAt, type RetentionContext } from "@/lib/retentionPolicy";

/** HD originals idle TTL — protects lunch/outage gaps; ghosts purged after this. */
export const ORIGINAL_IDLE_TTL_MS = 24 * 60 * 60 * 1000;

export type StorageManifest = {
  id: string;
  createdAt: number;
  /** Gallery / thumbnail retention (plan-based). */
  expiresAt: number | null;
  /**
   * When the HD original may be purged after idle time.
   * Extended on download/access so active edit sessions are never cut mid-work.
   */
  originalExpiresAt?: number;
  /** Last successful HD original access (download). */
  lastAccessedAt?: number;
  planAtCreation: PlanId;
  thumbnailKey: string;
  originalKey: string;
  originalDeleted?: boolean;
};

const META_PREFIX = "meta/";
const THUMB_PREFIX = "thumbs/";
const ORIGINAL_PREFIX = "originals/";

function metaKey(id: string) {
  return `${META_PREFIX}${id}.json`;
}

export function thumbKeyFor(id: string) {
  return `${THUMB_PREFIX}${id}.webp`;
}

export function originalKeyFor(id: string, ext = "jpg") {
  return `${ORIGINAL_PREFIX}${id}.${ext}`;
}

export function computeOriginalExpiresAt(
  fromMs = Date.now(),
  ttlMs = ORIGINAL_IDLE_TTL_MS
): number {
  return fromMs + ttlMs;
}

/** Deadline used by purge + download gate. */
export function resolveOriginalExpiry(manifest: StorageManifest): number | null {
  if (manifest.originalDeleted) return null;
  if (typeof manifest.originalExpiresAt === "number") {
    return manifest.originalExpiresAt;
  }
  // Legacy manifests: keep plan gallery expiry for originals until first access
  // rewrites originalExpiresAt under the 24h idle policy.
  if (manifest.expiresAt != null) return manifest.expiresAt;
  return computeOriginalExpiresAt(manifest.createdAt);
}

export async function saveStorageManifest(manifest: StorageManifest): Promise<void> {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  await putR2Object(
    client,
    config.bucketName,
    metaKey(manifest.id),
    Buffer.from(JSON.stringify(manifest)),
    "application/json"
  );
}

export async function loadStorageManifest(id: string): Promise<StorageManifest | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, metaKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8")) as StorageManifest;
  } catch {
    return null;
  }
}

/**
 * Bump last activity so an in-progress edit session keeps its HD original
 * for another full idle window (24h from now).
 */
export async function touchOriginalAccess(
  id: string,
  now = Date.now()
): Promise<StorageManifest | null> {
  const manifest = await loadStorageManifest(id);
  if (!manifest || manifest.originalDeleted) return manifest;
  const next: StorageManifest = {
    ...manifest,
    lastAccessedAt: now,
    originalExpiresAt: computeOriginalExpiresAt(now),
  };
  await saveStorageManifest(next);
  return next;
}

export function buildManifest(
  id: string,
  planAtCreation: PlanId,
  ctx: RetentionContext,
  thumbnailKey: string,
  originalKey: string
): StorageManifest {
  const createdAt = Date.now();
  return {
    id,
    createdAt,
    expiresAt: computeExpiresAt(createdAt, { ...ctx, planId: planAtCreation }),
    originalExpiresAt: computeOriginalExpiresAt(createdAt),
    lastAccessedAt: createdAt,
    planAtCreation,
    thumbnailKey,
    originalKey,
  };
}

/**
 * Nightly cron: delete HD originals that have been idle past originalExpiresAt.
 * Thumbnails / meta stay for gallery retention (expiresAt).
 */
export async function purgeExpiredOriginals(now = Date.now()): Promise<{
  scanned: number;
  deleted: number;
}> {
  const config = getR2Config();
  if (!config) return { scanned: 0, deleted: 0 };

  const client = createR2Client(config);
  const keys = await listR2Keys(client, config.bucketName, META_PREFIX);
  let deleted = 0;

  for (const key of keys) {
    const raw = await getR2Object(client, config.bucketName, key);
    if (!raw) continue;
    let manifest: StorageManifest;
    try {
      manifest = JSON.parse(raw.toString("utf8")) as StorageManifest;
    } catch {
      continue;
    }
    if (manifest.originalDeleted) continue;

    const deadline = resolveOriginalExpiry(manifest);
    if (deadline == null || deadline > now) continue;

    await deleteR2Object(client, config.bucketName, manifest.originalKey);
    manifest.originalDeleted = true;
    await putR2Object(
      client,
      config.bucketName,
      key,
      Buffer.from(JSON.stringify(manifest)),
      "application/json"
    );
    deleted += 1;
  }

  return { scanned: keys.length, deleted };
}
