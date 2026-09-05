import { createHash } from "crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { DbSnapshot } from "@/lib/db/types";

const EMPTY: DbSnapshot = {
  users: {},
  identities: {},
  ledger: [],
  orders: {},
  processedWebhookEvents: {},
  promotionCodes: {},
  promotionBatches: {},
  promotionHistory: [],
  generalPhotos: {},
  galleryWorks: {},
  scaProjects: {},
  faceProfiles: {},
  supportTickets: [],
};

type GlobalDb = typeof globalThis & {
  __scaDbMemory?: DbSnapshot;
  __scaDbWriteQueue?: Promise<void>;
};

const g = globalThis as GlobalDb;

/** Vercel / Lambda: project filesystem is read-only — never write under cwd. */
export function isServerlessReadOnlyFs(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME != null ||
    process.env.SCA_DB_MEMORY_ONLY === "true"
  );
}

function dataPath() {
  const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
  return { dir, file: join(dir, "db.json") };
}

function loadFromDisk(): DbSnapshot {
  if (isServerlessReadOnlyFs()) {
    return structuredClone(EMPTY);
  }
  try {
    const { file } = dataPath();
    if (!existsSync(file)) return structuredClone(EMPTY);
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as DbSnapshot;
    return {
      users: parsed.users ?? {},
      identities: parsed.identities ?? {},
      ledger: parsed.ledger ?? [],
      orders: Object.fromEntries(
        Object.entries(parsed.orders ?? {}).map(([id, order]) => [
          id,
          {
            ...order,
            currency: order.currency ?? "KRW",
            amountUsd: order.amountUsd ?? 0,
            vatIncluded: order.vatIncluded ?? true,
          },
        ])
      ),
      processedWebhookEvents: parsed.processedWebhookEvents ?? {},
      promotionCodes: parsed.promotionCodes ?? {},
      promotionBatches: parsed.promotionBatches ?? {},
      promotionHistory: parsed.promotionHistory ?? [],
      generalPhotos: parsed.generalPhotos ?? {},
      galleryWorks: parsed.galleryWorks ?? {},
      scaProjects: parsed.scaProjects ?? {},
      faceProfiles: parsed.faceProfiles ?? {},
      supportTickets: Array.isArray(parsed.supportTickets)
        ? parsed.supportTickets
        : [],
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

/**
 * Persist snapshot to disk on local/single-node only.
 * On Vercel this is a no-op (in-memory). Never throws EROFS.
 */
function persist(snapshot: DbSnapshot) {
  if (isServerlessReadOnlyFs()) return;
  try {
    const { dir, file } = dataPath();
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    renameSync(tmp, file);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    // Read-only FS / permission errors: keep serving from memory.
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      console.warn(
        "[db] disk persist skipped (read-only or permission denied); using memory only"
      );
      return;
    }
    console.warn("[db] disk persist failed:", err);
  }
}

/** Process-local DB. Disk persistence only when the filesystem is writable. */
export function getDb(): DbSnapshot {
  if (!g.__scaDbMemory) {
    g.__scaDbMemory = loadFromDisk();
  }
  return g.__scaDbMemory;
}

export async function withDbLock<T>(fn: (db: DbSnapshot) => T | Promise<T>): Promise<T> {
  let result!: T;
  g.__scaDbWriteQueue = (g.__scaDbWriteQueue ?? Promise.resolve()).then(async () => {
    const db = getDb();
    result = await fn(db);
    persist(db);
  });
  await g.__scaDbWriteQueue;
  return result;
}

export function identityKey(provider: string, providerAccountId: string) {
  return `${provider}:${providerAccountId}`;
}

/** Stable user id so cold starts recreate the same row key (memory-only serverless). */
export function stableUserId(provider: string, providerAccountId: string): string {
  const digest = createHash("sha256")
    .update(identityKey(provider, providerAccountId))
    .digest("hex")
    .slice(0, 22);
  return `usr_${digest}`;
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
