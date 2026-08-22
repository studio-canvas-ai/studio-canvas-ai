import { getDb, newId, withDbLock } from "@/lib/db/store";
import type { GeneralPhotoRecord } from "@/lib/db/types";
import {
  createR2Client,
  deleteR2Object,
  getR2Config,
  getR2Object,
  isR2Configured,
  publicObjectUrl,
  putR2Object,
} from "@/lib/r2";

type UserManifest = {
  userId: string;
  updatedAt: number;
  photos: GeneralPhotoRecord[];
};

function manifestKey(userId: string) {
  return `general/${userId}/manifest.json`;
}

export function generalPhotoObjectKey(userId: string, photoId: string) {
  return `general/${userId}/${photoId}.webp`;
}

async function saveR2Manifest(userId: string, photos: GeneralPhotoRecord[]) {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: UserManifest = {
    userId,
    updatedAt: Date.now(),
    photos,
  };
  await putR2Object(
    client,
    config.bucketName,
    manifestKey(userId),
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

/** null = no manifest object; [] = explicit empty list */
async function loadR2Manifest(userId: string): Promise<GeneralPhotoRecord[] | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, manifestKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as UserManifest;
    if (!Array.isArray(parsed.photos)) return [];
    return parsed.photos.filter(
      (p) =>
        typeof p?.id === "string" &&
        typeof p?.imageUrl === "string" &&
        p.userId === userId
    );
  } catch {
    return null;
  }
}

function sortPhotos(photos: GeneralPhotoRecord[]) {
  return [...photos].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Prefer R2 manifest whenever configured so serverless instances do not
 * serve stale in-memory lists after upload/delete on another isolate.
 */
export async function listUserGeneralPhotos(
  userId: string
): Promise<GeneralPhotoRecord[]> {
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest(userId);
    if (fromR2 !== null) {
      await withDbLock((db) => {
        db.generalPhotos[userId] = fromR2;
      });
      return sortPhotos(fromR2);
    }
  }

  const mem = getDb().generalPhotos[userId] ?? [];
  return sortPhotos(mem);
}

export async function getUserGeneralPhoto(
  userId: string,
  photoId: string
): Promise<GeneralPhotoRecord | null> {
  const list = await listUserGeneralPhotos(userId);
  return list.find((p) => p.id === photoId) ?? null;
}

export async function addUserGeneralPhoto(input: {
  userId: string;
  name?: string;
  imageBuffer: Buffer;
}): Promise<GeneralPhotoRecord> {
  // Refresh from R2 first so quota/count matches other isolates.
  const existing = await listUserGeneralPhotos(input.userId);
  const photoId = newId("gp");
  const config = getR2Config();
  let imageUrl: string;
  let storageKey: string | undefined;

  if (config && isR2Configured()) {
    const client = createR2Client(config);
    storageKey = generalPhotoObjectKey(input.userId, photoId);
    await putR2Object(
      client,
      config.bucketName,
      storageKey,
      input.imageBuffer,
      "image/webp"
    );
    imageUrl = publicObjectUrl(config, storageKey);
  } else {
    imageUrl = `data:image/webp;base64,${input.imageBuffer.toString("base64")}`;
  }

  const record: GeneralPhotoRecord = {
    id: photoId,
    userId: input.userId,
    name: input.name,
    imageUrl,
    storageKey,
    createdAt: Date.now(),
  };

  const photos = [record, ...existing.filter((p) => p.id !== record.id)];
  await withDbLock((db) => {
    db.generalPhotos[input.userId] = photos;
  });
  await saveR2Manifest(input.userId, photos);
  return record;
}

export async function deleteUserGeneralPhoto(
  userId: string,
  photoId: string
): Promise<boolean> {
  const existing = await listUserGeneralPhotos(userId);
  const target = existing.find((p) => p.id === photoId);
  if (!target) return false;

  if (target.storageKey && isR2Configured()) {
    const config = getR2Config()!;
    const client = createR2Client(config);
    try {
      await deleteR2Object(client, config.bucketName, target.storageKey);
    } catch {
      /* continue removing manifest entry */
    }
  }

  const photos = existing.filter((p) => p.id !== photoId);
  await withDbLock((db) => {
    db.generalPhotos[userId] = photos;
  });
  await saveR2Manifest(userId, photos);
  return true;
}

export async function getGeneralPhotoDownloadCount(userId: string): Promise<number> {
  return getDb().users[userId]?.generalPhotoDownloadCount ?? 0;
}

export async function incrementGeneralPhotoDownloadCount(
  userId: string
): Promise<number> {
  return withDbLock((db) => {
    const user = db.users[userId];
    if (!user) return 0;
    user.generalPhotoDownloadCount = (user.generalPhotoDownloadCount ?? 0) + 1;
    user.updatedAt = Date.now();
    return user.generalPhotoDownloadCount;
  });
}
