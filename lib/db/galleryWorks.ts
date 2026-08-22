import { getDb, withDbLock } from "@/lib/db/store";
import type { GalleryWorkRecord } from "@/lib/db/types";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  publicObjectUrl,
  putR2Object,
} from "@/lib/r2";

type UserManifest = {
  userId: string;
  updatedAt: number;
  works: GalleryWorkRecord[];
};

function manifestKey(userId: string) {
  return `works/${userId}/manifest.json`;
}

function workObjectKey(userId: string, workId: string) {
  return `works/${userId}/${workId}.webp`;
}

async function saveR2Manifest(userId: string, works: GalleryWorkRecord[]) {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: UserManifest = {
    userId,
    updatedAt: Date.now(),
    works,
  };
  await putR2Object(
    client,
    config.bucketName,
    manifestKey(userId),
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

/** null = missing manifest; [] = empty gallery */
async function loadR2Manifest(userId: string): Promise<GalleryWorkRecord[] | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, manifestKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as UserManifest;
    if (!Array.isArray(parsed.works)) return [];
    return parsed.works.filter(
      (w) =>
        typeof w?.id === "string" &&
        typeof w?.imageUrl === "string" &&
        w.userId === userId &&
        (w.imageUrl.startsWith("http") || w.imageUrl.startsWith("data:"))
    );
  } catch {
    return null;
  }
}

function notExpired(item: GalleryWorkRecord, now = Date.now()) {
  if (item.expiresAt == null) return true;
  return item.expiresAt > now;
}

function sortWorks(works: GalleryWorkRecord[]) {
  return [...works]
    .filter((w) => notExpired(w))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Upload data-URL / fetch remote into R2 so logout-safe CDN URLs are stored. */
export async function ensureRemoteImageUrl(
  userId: string,
  workId: string,
  imageUrl: string
): Promise<string> {
  if (!isR2Configured()) return imageUrl;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
    return imageUrl;
  }

  const config = getR2Config()!;
  const client = createR2Client(config);
  let buffer: Buffer | null = null;

  if (imageUrl.startsWith("data:")) {
    const comma = imageUrl.indexOf(",");
    if (comma < 0) return imageUrl;
    const b64 = imageUrl.slice(comma + 1);
    try {
      buffer = Buffer.from(b64, "base64");
    } catch {
      return imageUrl;
    }
  } else {
    return imageUrl;
  }

  if (!buffer || buffer.length < 32) return imageUrl;

  // Normalize via sharp when available.
  try {
    const { normalizeGeneralPhotoWebp } = await import("@/lib/imagePipeline");
    buffer = await normalizeGeneralPhotoWebp(buffer);
  } catch {
    /* keep raw bytes */
  }

  const key = workObjectKey(userId, workId);
  await putR2Object(client, config.bucketName, key, buffer, "image/webp");
  return publicObjectUrl(config, key);
}

export async function listUserGalleryWorks(
  userId: string
): Promise<GalleryWorkRecord[]> {
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest(userId);
    if (fromR2 !== null) {
      await withDbLock((db) => {
        db.galleryWorks[userId] = fromR2;
      });
      return sortWorks(fromR2);
    }
  }

  const mem = getDb().galleryWorks[userId] ?? [];
  return sortWorks(mem);
}

export async function upsertUserGalleryWork(
  userId: string,
  item: Omit<GalleryWorkRecord, "userId"> & { userId?: string }
): Promise<GalleryWorkRecord> {
  const existing = await listUserGalleryWorks(userId);

  let imageUrl = item.imageUrl;
  let thumbnailUrl = item.thumbnailUrl ?? item.imageUrl;
  try {
    imageUrl = await ensureRemoteImageUrl(userId, item.id, imageUrl);
    if (thumbnailUrl.startsWith("data:")) {
      thumbnailUrl = await ensureRemoteImageUrl(
        userId,
        `${item.id}-thumb`,
        thumbnailUrl
      );
    } else if (!thumbnailUrl.startsWith("http")) {
      thumbnailUrl = imageUrl;
    }
  } catch (err) {
    console.warn("[galleryWorks] ensureRemoteImageUrl failed", err);
  }

  const record: GalleryWorkRecord = {
    ...item,
    userId,
    imageUrl,
    thumbnailUrl,
  };

  const works = [record, ...existing.filter((w) => w.id !== record.id)].slice(
    0,
    200
  );
  await withDbLock((db) => {
    db.galleryWorks[userId] = works;
  });
  await saveR2Manifest(userId, works);
  return record;
}

export async function deleteUserGalleryWork(
  userId: string,
  workId: string
): Promise<boolean> {
  const existing = await listUserGalleryWorks(userId);
  if (!existing.some((w) => w.id === workId)) return false;

  const works = existing.filter((w) => w.id !== workId);
  await withDbLock((db) => {
    db.galleryWorks[userId] = works;
  });
  await saveR2Manifest(userId, works);
  return true;
}
