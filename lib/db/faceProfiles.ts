import { getDb, withDbLock } from "@/lib/db/store";
import type { FaceProfileRecord } from "@/lib/db/types";
import { normalizeGeneralPhotoWebp } from "@/lib/imagePipeline";
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
  profiles: FaceProfileRecord[];
};

function manifestKey(userId: string) {
  return `faces/${userId}/manifest.json`;
}

function photoObjectKey(userId: string, profileId: string, index: number) {
  return `faces/${userId}/${profileId}/${index}.webp`;
}

async function saveR2Manifest(userId: string, profiles: FaceProfileRecord[]) {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: UserManifest = {
    userId,
    updatedAt: Date.now(),
    profiles,
  };
  await putR2Object(
    client,
    config.bucketName,
    manifestKey(userId),
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

/** null = missing; [] = empty vault */
async function loadR2Manifest(userId: string): Promise<FaceProfileRecord[] | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, manifestKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as UserManifest;
    if (!Array.isArray(parsed.profiles)) return [];
    return parsed.profiles.filter(
      (p) =>
        typeof p?.id === "string" &&
        typeof p?.name === "string" &&
        Array.isArray(p.photoUrls) &&
        p.userId === userId &&
        p.photoUrls.length > 0
    );
  } catch {
    return null;
  }
}

function sortProfiles(profiles: FaceProfileRecord[]) {
  return [...profiles].sort((a, b) => a.slot - b.slot || b.updatedAt - a.updatedAt);
}

async function uploadDataUrlToR2(
  userId: string,
  profileId: string,
  index: number,
  imageUrl: string
): Promise<string> {
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
    return imageUrl;
  }
  if (!imageUrl.startsWith("data:") || !isR2Configured()) {
    return imageUrl;
  }

  const comma = imageUrl.indexOf(",");
  if (comma < 0) return imageUrl;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageUrl.slice(comma + 1), "base64");
  } catch {
    return imageUrl;
  }
  if (buffer.length < 32) return imageUrl;

  try {
    buffer = await normalizeGeneralPhotoWebp(buffer);
  } catch {
    /* keep raw */
  }

  const config = getR2Config()!;
  const client = createR2Client(config);
  const key = photoObjectKey(userId, profileId, index);
  await putR2Object(client, config.bucketName, key, buffer, "image/webp");
  return publicObjectUrl(config, key);
}

export async function listUserFaceProfiles(
  userId: string
): Promise<FaceProfileRecord[]> {
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest(userId);
    if (fromR2 !== null) {
      await withDbLock((db) => {
        db.faceProfiles[userId] = fromR2;
      });
      return sortProfiles(fromR2);
    }
  }
  return sortProfiles(getDb().faceProfiles[userId] ?? []);
}

export async function upsertUserFaceProfile(
  userId: string,
  input: {
    id: string;
    name: string;
    slot: number;
    photoUrls: string[];
    createdAt?: number;
    updatedAt?: number;
  }
): Promise<FaceProfileRecord> {
  const existing = await listUserFaceProfiles(userId);
  const now = Date.now();
  const durableUrls: string[] = [];
  for (let i = 0; i < input.photoUrls.length && i < 12; i++) {
    durableUrls.push(
      await uploadDataUrlToR2(userId, input.id, i, input.photoUrls[i])
    );
  }
  if (durableUrls.length < 1) {
    throw new Error("photo_required");
  }

  const record: FaceProfileRecord = {
    id: input.id,
    userId,
    name: input.name.trim().slice(0, 80) || "Model",
    slot: Math.max(1, Math.round(input.slot) || existing.length + 1),
    photoUrls: durableUrls,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  const profiles = [
    record,
    ...existing.filter((p) => p.id !== record.id),
  ].map((p, idx) => ({ ...p, slot: p.id === record.id ? record.slot : p.slot || idx + 1 }));

  await withDbLock((db) => {
    db.faceProfiles[userId] = profiles;
  });
  await saveR2Manifest(userId, profiles);
  return record;
}

async function deleteProfilePhotosFromR2(
  userId: string,
  profile: FaceProfileRecord
) {
  if (!isR2Configured()) return;
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const maxIndex = Math.max(12, (profile.photoUrls?.length ?? 0) + 2);
  for (let i = 0; i < maxIndex; i++) {
    try {
      await deleteR2Object(
        client,
        config.bucketName,
        photoObjectKey(userId, profile.id, i)
      );
    } catch {
      /* best-effort cleanup */
    }
  }
}

export async function deleteUserFaceProfile(
  userId: string,
  profileId: string
): Promise<boolean> {
  const existing = await listUserFaceProfiles(userId);
  const target = existing.find((p) => p.id === profileId);
  if (!target) return false;

  await deleteProfilePhotosFromR2(userId, target);

  const profiles = existing.filter((p) => p.id !== profileId);
  await withDbLock((db) => {
    db.faceProfiles[userId] = profiles;
  });
  await saveR2Manifest(userId, profiles);
  return true;
}

export async function replaceUserFaceProfiles(
  userId: string,
  profiles: Array<{
    id: string;
    name: string;
    slot: number;
    photoUrls: string[];
    createdAt?: number;
    updatedAt?: number;
  }>
): Promise<FaceProfileRecord[]> {
  const out: FaceProfileRecord[] = [];
  for (const p of profiles) {
    out.push(await upsertUserFaceProfile(userId, p));
  }
  // upsert already saved; re-list for canonical order
  return listUserFaceProfiles(userId);
}
