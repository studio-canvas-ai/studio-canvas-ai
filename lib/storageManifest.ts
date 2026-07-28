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

export type StorageManifest = {
  id: string;
  createdAt: number;
  expiresAt: number | null;
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
    planAtCreation,
    thumbnailKey,
    originalKey,
  };
}

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
    if (manifest.expiresAt == null || manifest.expiresAt > now) continue;

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
