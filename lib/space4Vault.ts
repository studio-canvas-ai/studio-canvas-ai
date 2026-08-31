/**
 * Space 4 — admin-only sealed .sca vault (operator backroom).
 * Deposits come from user downloads; listing requires admin session.
 *
 * Durability: each sealed record is its own R2 object; the vault index
 * stores metadata only. Process memory is a cache — never the source of
 * truth on serverless (Vercel), where it does not survive cold starts.
 */

import { getDb, isServerlessReadOnlyFs, withDbLock } from "@/lib/db/store";
import {
  createR2Client,
  deleteR2Object,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
  type R2Config,
} from "@/lib/r2";
import { normalizeSpace4ThumbSrc } from "@/lib/space4Thumb";

export const SPACE4_VAULT_MAX = 500;

export type Space4VaultRecord = {
  id: string;
  userId: string;
  label: string;
  mode: "utility" | "agent";
  sealedContent: string;
  createdAt: number;
  source?: string;
  thumbSrc?: string | null;
};

export type Space4VaultMeta = Omit<Space4VaultRecord, "sealedContent">;

type Space4Index = {
  updatedAt: number;
  items: Space4VaultMeta[];
};

/** Legacy monolithic blob (all sealed payloads in one JSON). Migrated on read. */
const R2_LEGACY_MANIFEST_KEY = "space4/vault/manifest.json";
const R2_INDEX_KEY = "space4/vault/index.json";
const R2_ITEM_PREFIX = "space4/items/";

declare global {
  // eslint-disable-next-line no-var
  var __scaSpace4MetaMemory: Space4VaultMeta[] | undefined;
}

function metaMem(): Space4VaultMeta[] {
  if (!globalThis.__scaSpace4MetaMemory) {
    globalThis.__scaSpace4MetaMemory = [];
  }
  return globalThis.__scaSpace4MetaMemory;
}

function itemKey(id: string) {
  return `${R2_ITEM_PREFIX}${id}.json`;
}

function sortMeta(items: Space4VaultMeta[]) {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

function toMeta(row: Space4VaultRecord): Space4VaultMeta {
  const { sealedContent: _s, ...meta } = row;
  return meta;
}

function isValidRecord(p: unknown): p is Space4VaultRecord {
  if (!p || typeof p !== "object") return false;
  const row = p as Space4VaultRecord;
  return (
    typeof row.id === "string" &&
    typeof row.userId === "string" &&
    typeof row.sealedContent === "string" &&
    row.sealedContent.includes("SCAENC1")
  );
}

function isValidMeta(p: unknown): p is Space4VaultMeta {
  if (!p || typeof p !== "object") return false;
  const row = p as Space4VaultMeta;
  return (
    typeof row.id === "string" &&
    typeof row.userId === "string" &&
    typeof row.createdAt === "number"
  );
}

function assertDurableStoreAvailable() {
  if (isServerlessReadOnlyFs() && !isR2Configured()) {
    throw new Error("r2_required");
  }
}

async function putJson(config: R2Config, key: string, value: unknown) {
  const client = createR2Client(config);
  await putR2Object(
    client,
    config.bucketName,
    key,
    Buffer.from(JSON.stringify(value)),
    "application/json"
  );
}

async function getJson<T>(config: R2Config, key: string): Promise<T | null> {
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8")) as T;
  } catch {
    return null;
  }
}

async function saveItemObject(config: R2Config, record: Space4VaultRecord) {
  await putJson(config, itemKey(record.id), record);
}

async function loadItemObject(
  config: R2Config,
  id: string
): Promise<Space4VaultRecord | null> {
  const parsed = await getJson<unknown>(config, itemKey(id));
  return isValidRecord(parsed) ? parsed : null;
}

async function deleteItemObject(config: R2Config, id: string) {
  const client = createR2Client(config);
  try {
    await deleteR2Object(client, config.bucketName, itemKey(id));
  } catch {
    /* ignore missing */
  }
}

async function saveIndex(config: R2Config, items: Space4VaultMeta[]) {
  const body: Space4Index = {
    updatedAt: Date.now(),
    items: sortMeta(items).slice(0, SPACE4_VAULT_MAX),
  };
  await putJson(config, R2_INDEX_KEY, body);
}

/** Migrate legacy all-in-one manifest → per-item objects + meta index. */
async function migrateLegacyManifest(
  config: R2Config
): Promise<Space4VaultMeta[] | null> {
  const legacy = await getJson<{ items?: unknown[] }>(
    config,
    R2_LEGACY_MANIFEST_KEY
  );
  if (!legacy || !Array.isArray(legacy.items)) return null;
  const records = legacy.items.filter(isValidRecord);
  if (records.length === 0) {
    await saveIndex(config, []);
    return [];
  }
  const sorted = [...records]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, SPACE4_VAULT_MAX);
  for (const row of sorted) {
    await saveItemObject(config, row);
  }
  const metas = sorted.map(toMeta);
  await saveIndex(config, metas);
  return metas;
}

async function loadDurableIndex(): Promise<Space4VaultMeta[] | null> {
  const config = getR2Config();
  if (!config) return null;

  const index = await getJson<Space4Index>(config, R2_INDEX_KEY);
  if (index && Array.isArray(index.items)) {
    return sortMeta(index.items.filter(isValidMeta)).slice(0, SPACE4_VAULT_MAX);
  }

  const migrated = await migrateLegacyManifest(config);
  if (migrated) return migrated;
  return [];
}

function mirrorDb(items: Space4VaultMeta[]) {
  globalThis.__scaSpace4MetaMemory = items;
  try {
    const db = getDb() as { space4VaultMeta?: Space4VaultMeta[] };
    db.space4VaultMeta = items;
  } catch {
    /* ignore */
  }
}

function applyFifoMeta(
  items: Space4VaultMeta[],
  record: Space4VaultMeta,
  perUserMax: number | null
): Space4VaultMeta[] {
  let next = sortMeta([record, ...items.filter((x) => x.id !== record.id)]);
  if (perUserMax != null) {
    let keptForUser = 0;
    next = next.filter((row) => {
      if (row.userId !== record.userId) return true;
      keptForUser += 1;
      return keptForUser <= perUserMax;
    });
  }
  return next.slice(0, SPACE4_VAULT_MAX);
}

export async function depositSpace4Record(
  input: Omit<Space4VaultRecord, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
    /** Per-user FIFO cap (plan scaCloud). Global vault still capped at SPACE4_VAULT_MAX. */
    perUserMax?: number;
  }
): Promise<Space4VaultRecord> {
  assertDurableStoreAvailable();

  const sealed = String(input.sealedContent ?? "").trim();
  if (!sealed.includes("SCAENC1")) {
    throw new Error("sealedContent_required");
  }
  const record: Space4VaultRecord = {
    id:
      input.id?.trim() ||
      `space4_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    label: (input.label || "Space4 적재").slice(0, 120),
    mode: input.mode === "utility" ? "utility" : "agent",
    sealedContent: sealed,
    createdAt: input.createdAt ?? Date.now(),
    source: input.source ?? "print-unified-editor",
    thumbSrc: normalizeSpace4ThumbSrc(input.thumbSrc) ?? null,
  };

  const perUserMax =
    typeof input.perUserMax === "number" && Number.isFinite(input.perUserMax)
      ? Math.max(1, Math.floor(input.perUserMax))
      : null;

  return withDbLock(async () => {
    let items = metaMem();
    if (isR2Configured()) {
      const fromR2 = await loadDurableIndex();
      if (fromR2) items = fromR2;
    }

    const next = applyFifoMeta(items, toMeta(record), perUserMax);
    const dropped = items.filter((old) => !next.some((n) => n.id === old.id));

    const config = getR2Config();
    if (config) {
      // Persist sealed object first so a crashed index write still leaves data.
      await saveItemObject(config, record);
      for (const gone of dropped) {
        await deleteItemObject(config, gone.id);
      }
      await saveIndex(config, next);
    }

    mirrorDb(next);
    return record;
  });
}

export async function listSpace4Records(
  limit = 50
): Promise<Space4VaultMeta[]> {
  let items = metaMem();
  if (isR2Configured()) {
    const fromR2 = await loadDurableIndex();
    if (fromR2) {
      items = fromR2;
      mirrorDb(fromR2);
    }
  }
  return sortMeta(items).slice(
    0,
    Math.max(1, Math.min(SPACE4_VAULT_MAX, limit))
  );
}

/** Admin — full vault row including sealed .sca payload. */
export async function getSpace4Record(
  id: string
): Promise<Space4VaultRecord | null> {
  const key = id.trim();
  if (!key) return null;

  const config = getR2Config();
  if (config) {
    const fromItem = await loadItemObject(config, key);
    if (fromItem) return fromItem;
  }

  return null;
}

/** Admin — remove one vault entry (e.g. after promote → Template 03). */
export async function removeSpace4Record(id: string): Promise<boolean> {
  const key = id.trim();
  if (!key) return false;
  return withDbLock(async () => {
    let items = metaMem();
    if (isR2Configured()) {
      const fromR2 = await loadDurableIndex();
      if (fromR2) items = fromR2;
    }
    const next = items.filter((x) => x.id !== key);
    if (next.length === items.length) return false;

    const config = getR2Config();
    if (config) {
      await deleteItemObject(config, key);
      await saveIndex(config, next);
    }

    mirrorDb(next);
    return true;
  });
}
