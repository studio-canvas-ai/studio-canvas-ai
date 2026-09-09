/**
 * Server durable store for recent files + photo vaults.
 * Primary: Supabase public.studio_user_stores
 * Fallback: R2 studio-store/{userId}/{kind}.json
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  listR2Keys,
  putR2Object,
} from "@/lib/r2";
import type { PhotoVaultItem } from "@/lib/photoVaultStorage";
import { persistImageToDurableUrl } from "@/lib/studioStore/durableImages";
import { mergeRecentEntries, mergeVaultItems } from "@/lib/studioStore/merge";
import {
  studioBundleIsEmpty,
} from "@/lib/studioStore/persistKeys";
import { insertStudioStoreSnapshot } from "@/lib/studioStore/snapshots";
import type {
  RecentDrawerEntry,
  StudioStoreBundle,
  StudioStoreKind,
} from "@/lib/studioStore/types";

type StoreRow = {
  user_id: string | null;
  app_user_id: string | null;
  kind: StudioStoreKind;
  payload: unknown;
  updated_at?: string;
};

function isKind(v: unknown): v is StudioStoreKind {
  return (
    v === "recent_shared" ||
    v === "recent_photo" ||
    v === "upload_vault" ||
    v === "trained_vault"
  );
}

function r2Key(userId: string, kind: StudioStoreKind) {
  return `studio-store/${userId}/${kind}.json`;
}

async function loadR2Kind(
  userId: string,
  kind: StudioStoreKind
): Promise<unknown | null> {
  if (!isR2Configured()) return null;
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, r2Key(userId, kind));
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

async function saveR2Kind(
  userId: string,
  kind: StudioStoreKind,
  payload: unknown
): Promise<void> {
  if (!isR2Configured()) return;
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  await putR2Object(
    client,
    config.bucketName,
    r2Key(userId, kind),
    Buffer.from(JSON.stringify({ userId, kind, updatedAt: Date.now(), payload })),
    "application/json"
  );
}

export async function listStudioStoreR2ManifestKeys(
  aliases: string[]
): Promise<string[]> {
  if (!isR2Configured()) return [];
  const config = getR2Config();
  if (!config) return [];
  const client = createR2Client(config);
  const aliasSet = new Set(aliases);
  const found: string[] = [];
  try {
    const keys = await listR2Keys(client, config.bucketName, "studio-store/");
    for (const key of keys) {
      const parts = key.split("/");
      const userFolder = parts[1];
      if (userFolder && aliasSet.has(userFolder) && key.endsWith(".json")) {
        found.push(key);
      }
    }
  } catch (err) {
    console.warn("[studioStore] R2 list failed", err);
  }
  return found;
}

function parseRecentPayload(raw: unknown): RecentDrawerEntry[] {
  if (!raw || typeof raw !== "object") return [];
  const payload =
    Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { payload?: unknown }).payload)
        ? ((raw as { payload: unknown[] }).payload)
        : [];
  const out: RecentDrawerEntry[] = [];
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.meta || !r.project) continue;
    out.push(row as RecentDrawerEntry);
  }
  return out;
}

function parseVaultPayload(raw: unknown): PhotoVaultItem[] {
  if (!raw || typeof raw !== "object") return [];
  const payload =
    Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { payload?: unknown }).payload)
        ? ((raw as { payload: unknown[] }).payload)
        : Array.isArray((raw as { items?: unknown }).items)
          ? ((raw as { items: unknown[] }).items)
          : [];
  const out: PhotoVaultItem[] = [];
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.src !== "string") continue;
    if (!r.src.trim()) continue;
    out.push({
      id: r.id,
      src: r.src.trim(),
      label:
        typeof r.label === "string" && r.label.trim() ? r.label.trim() : "사진",
      photoKind: r.photoKind === "cutout" ? "cutout" : "original",
      createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
      sourceUploadId:
        typeof r.sourceUploadId === "string" ? r.sourceUploadId : undefined,
    });
  }
  return out;
}

export async function loadStudioStoresFromSupabase(
  aliases: string[]
): Promise<{ bundle: Partial<StudioStoreBundle>; rowCount: number }> {
  const admin = createSupabaseServiceClient();
  if (!admin || !aliases.length) {
    return { bundle: {}, rowCount: 0 };
  }

  const uuids = aliases.filter((a) => /^[0-9a-f-]{36}$/i.test(a));
  const [byApp, byUid] = await Promise.all([
    admin
      .from("studio_user_stores")
      .select("user_id, app_user_id, kind, payload, updated_at")
      .in("app_user_id", aliases),
    uuids.length
      ? admin
          .from("studio_user_stores")
          .select("user_id, app_user_id, kind, payload, updated_at")
          .in("user_id", uuids)
      : Promise.resolve({ data: [] as StoreRow[], error: null }),
  ]);

  if (byApp.error) {
    console.warn("[studioStore] supabase app_user_id load skipped:", byApp.error.message);
  }
  if (byUid && "error" in byUid && byUid.error) {
    console.warn("[studioStore] supabase user_id load skipped:", byUid.error.message);
  }

  const rows = [
    ...((byApp.data ?? []) as StoreRow[]),
    ...((byUid.data ?? []) as StoreRow[]),
  ];
  const bundle: Partial<StudioStoreBundle> = {};
  for (const row of rows) {
    if (!isKind(row.kind)) continue;
    if (row.kind === "recent_shared") {
      bundle.recentShared = [
        ...(bundle.recentShared ?? []),
        ...parseRecentPayload(row.payload),
      ];
    } else if (row.kind === "recent_photo") {
      bundle.recentPhoto = [
        ...(bundle.recentPhoto ?? []),
        ...parseRecentPayload(row.payload),
      ];
    } else if (row.kind === "upload_vault") {
      bundle.uploadVault = [
        ...(bundle.uploadVault ?? []),
        ...parseVaultPayload(row.payload),
      ];
    } else if (row.kind === "trained_vault") {
      bundle.trainedVault = [
        ...(bundle.trainedVault ?? []),
        ...parseVaultPayload(row.payload),
      ];
    }
  }
  return { bundle, rowCount: rows.length };
}

export async function loadStudioStoresFromR2(
  aliases: string[]
): Promise<{ bundle: Partial<StudioStoreBundle>; keys: string[] }> {
  const bundle: Partial<StudioStoreBundle> = {};
  const keys = await listStudioStoreR2ManifestKeys(aliases);
  for (const alias of aliases) {
    const shared = parseRecentPayload(await loadR2Kind(alias, "recent_shared"));
    const photo = parseRecentPayload(await loadR2Kind(alias, "recent_photo"));
    const upload = parseVaultPayload(await loadR2Kind(alias, "upload_vault"));
    const trained = parseVaultPayload(await loadR2Kind(alias, "trained_vault"));
    if (shared.length) {
      bundle.recentShared = [...(bundle.recentShared ?? []), ...shared];
    }
    if (photo.length) {
      bundle.recentPhoto = [...(bundle.recentPhoto ?? []), ...photo];
    }
    if (upload.length) {
      bundle.uploadVault = [...(bundle.uploadVault ?? []), ...upload];
    }
    if (trained.length) {
      bundle.trainedVault = [...(bundle.trainedVault ?? []), ...trained];
    }
  }
  return { bundle, keys };
}

async function durableVault(
  userId: string,
  folder: string,
  items: PhotoVaultItem[]
): Promise<PhotoVaultItem[]> {
  const out: PhotoVaultItem[] = [];
  for (const item of items.slice(0, 10)) {
    try {
      const src = await persistImageToDurableUrl(
        userId,
        folder,
        item.id,
        item.src
      );
      out.push({ ...item, src });
    } catch (err) {
      console.warn("[studioStore] vault image persist failed", item.id, err);
      out.push(item);
    }
  }
  return out;
}

async function durableRecent(
  userId: string,
  folder: string,
  entries: RecentDrawerEntry[]
): Promise<RecentDrawerEntry[]> {
  const out: RecentDrawerEntry[] = [];
  for (const entry of entries.slice(0, 10)) {
    const lookbook = entry.project.lookbook;
    if (!lookbook) {
      out.push(entry);
      continue;
    }
    try {
      const uploadVault = await durableVault(
        userId,
        `${folder}/lookbook-upload`,
        lookbook.uploadVault
      );
      const trainedVault = await durableVault(
        userId,
        `${folder}/lookbook-trained`,
        lookbook.trainedVault
      );
      out.push({
        ...entry,
        project: {
          ...entry.project,
          lookbook: { ...lookbook, uploadVault, trainedVault },
        },
      });
    } catch {
      out.push(entry);
    }
  }
  return out;
}

export async function loadMergedCloudBundle(aliases: string[]): Promise<{
  bundle: StudioStoreBundle;
  supabaseRows: number;
  r2Keys: string[];
}> {
  const [fromSb, fromR2] = await Promise.all([
    loadStudioStoresFromSupabase(aliases),
    loadStudioStoresFromR2(aliases),
  ]);
  return {
    bundle: {
      recentShared: mergeRecentEntries(
        fromSb.bundle.recentShared ?? [],
        fromR2.bundle.recentShared ?? []
      ),
      recentPhoto: mergeRecentEntries(
        fromSb.bundle.recentPhoto ?? [],
        fromR2.bundle.recentPhoto ?? []
      ),
      uploadVault: mergeVaultItems(
        fromSb.bundle.uploadVault ?? [],
        fromR2.bundle.uploadVault ?? []
      ),
      trainedVault: mergeVaultItems(
        fromSb.bundle.trainedVault ?? [],
        fromR2.bundle.trainedVault ?? []
      ),
      activeTrainedId:
        fromSb.bundle.activeTrainedId || fromR2.bundle.activeTrainedId || null,
    },
    supabaseRows: fromSb.rowCount,
    r2Keys: fromR2.keys,
  };
}

function coalesceIncoming(
  incoming: StudioStoreBundle,
  existing: StudioStoreBundle
): StudioStoreBundle {
  return {
    recentShared:
      incoming.recentShared.length > 0
        ? mergeRecentEntries(incoming.recentShared, existing.recentShared)
        : existing.recentShared,
    recentPhoto:
      incoming.recentPhoto.length > 0
        ? mergeRecentEntries(incoming.recentPhoto, existing.recentPhoto)
        : existing.recentPhoto,
    uploadVault:
      incoming.uploadVault.length > 0
        ? mergeVaultItems(incoming.uploadVault, existing.uploadVault)
        : existing.uploadVault,
    trainedVault:
      incoming.trainedVault.length > 0
        ? mergeVaultItems(incoming.trainedVault, existing.trainedVault)
        : existing.trainedVault,
    activeTrainedId:
      incoming.activeTrainedId || existing.activeTrainedId || null,
  };
}

export async function saveStudioStoreBundle(opts: {
  canonicalUserId: string;
  supabaseUserId?: string | null;
  bundle: StudioStoreBundle;
  /** merge = default client sync (never empty-wipe). replace = admin restore. */
  mode?: "merge" | "replace";
  snapshotReason?: "autosave" | "admin_restore" | "pre_restore";
  skipSnapshot?: boolean;
}): Promise<StudioStoreBundle> {
  const userId = opts.canonicalUserId;
  const mode = opts.mode ?? "merge";
  const aliases = [
    ...new Set(
      [userId, opts.supabaseUserId].filter(
        (v): v is string => typeof v === "string" && v.trim().length > 0
      )
    ),
  ];
  const cloud = await loadMergedCloudBundle(aliases);
  const existing = cloud.bundle;

  if (mode === "merge" && studioBundleIsEmpty(opts.bundle) && !studioBundleIsEmpty(existing)) {
    return existing;
  }

  const combined: StudioStoreBundle =
    mode === "replace" ? opts.bundle : coalesceIncoming(opts.bundle, existing);

  if (mode === "merge" && studioBundleIsEmpty(combined) && !studioBundleIsEmpty(existing)) {
    return existing;
  }

  const durable: StudioStoreBundle = {
    recentShared: await durableRecent(
      userId,
      "recent-shared",
      combined.recentShared
    ),
    recentPhoto: await durableRecent(userId, "recent-photo", combined.recentPhoto),
    uploadVault: await durableVault(userId, "upload-vault", combined.uploadVault),
    trainedVault: await durableVault(
      userId,
      "trained-vault",
      combined.trainedVault
    ),
    activeTrainedId: combined.activeTrainedId,
  };

  const writes: Promise<void>[] = [];
  const persistKind = (kind: StudioStoreKind, nonempty: boolean, payload: unknown) => {
    if (nonempty || mode === "replace") {
      writes.push(saveR2Kind(userId, kind, payload));
    }
  };
  persistKind("recent_shared", durable.recentShared.length > 0, durable.recentShared);
  persistKind("recent_photo", durable.recentPhoto.length > 0, durable.recentPhoto);
  persistKind("upload_vault", durable.uploadVault.length > 0, durable.uploadVault);
  persistKind("trained_vault", durable.trainedVault.length > 0, {
    items: durable.trainedVault,
    activeTrainedId: durable.activeTrainedId,
  });
  await Promise.all(writes);

  const admin = createSupabaseServiceClient();
  if (admin) {
    const uuid =
      opts.supabaseUserId && /^[0-9a-f-]{36}$/i.test(opts.supabaseUserId)
        ? opts.supabaseUserId
        : /^[0-9a-f-]{36}$/i.test(userId)
          ? userId
          : null;

    const rows: Array<{
      user_id: string | null;
      app_user_id: string;
      kind: StudioStoreKind;
      payload: unknown;
      updated_at: string;
    }> = [
      {
        user_id: uuid,
        app_user_id: userId,
        kind: "recent_shared" as const,
        payload: durable.recentShared,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: uuid,
        app_user_id: userId,
        kind: "recent_photo" as const,
        payload: durable.recentPhoto,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: uuid,
        app_user_id: userId,
        kind: "upload_vault" as const,
        payload: durable.uploadVault,
        updated_at: new Date().toISOString(),
      },
      {
        user_id: uuid,
        app_user_id: userId,
        kind: "trained_vault" as const,
        payload: {
          items: durable.trainedVault,
          activeTrainedId: durable.activeTrainedId,
        },
        updated_at: new Date().toISOString(),
      },
    ].filter((row) => {
      if (mode === "replace") return true;
      if (row.kind === "trained_vault") {
        const payload = row.payload as { items?: unknown[] };
        return Array.isArray(payload.items) && payload.items.length > 0;
      }
      return Array.isArray(row.payload) && row.payload.length > 0;
    });

    for (const row of rows) {
      try {
        const match = uuid
          ? await admin
              .from("studio_user_stores")
              .select("id")
              .eq("kind", row.kind)
              .or(`user_id.eq.${uuid},app_user_id.eq.${userId}`)
              .maybeSingle()
          : await admin
              .from("studio_user_stores")
              .select("id")
              .eq("kind", row.kind)
              .eq("app_user_id", userId)
              .maybeSingle();

        const existingId = (match.data as { id?: string } | null)?.id;
        if (existingId) {
          const { error } = await admin
            .from("studio_user_stores")
            .update({
              user_id: uuid,
              app_user_id: userId,
              payload: row.payload,
              updated_at: row.updated_at,
            })
            .eq("id", existingId);
          if (error) {
            console.warn("[studioStore] supabase update skipped:", error.message);
          }
        } else {
          const { error } = await admin.from("studio_user_stores").insert(row);
          if (error) {
            console.warn("[studioStore] supabase insert skipped:", error.message);
          }
        }
      } catch (err) {
        console.warn("[studioStore] supabase save skipped", err);
      }
    }
  }

  if (!opts.skipSnapshot && !studioBundleIsEmpty(durable)) {
    await insertStudioStoreSnapshot({
      canonicalUserId: userId,
      supabaseUserId: opts.supabaseUserId,
      bundle: durable,
      reason: opts.snapshotReason ?? (mode === "replace" ? "admin_restore" : "autosave"),
    });
  }

  return durable;
}
