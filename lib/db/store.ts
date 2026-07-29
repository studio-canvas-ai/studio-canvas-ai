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
};

let memory: DbSnapshot | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function dataPath() {
  const dir = process.env.DATA_DIR || join(process.cwd(), ".data");
  return { dir, file: join(dir, "db.json") };
}

function loadFromDisk(): DbSnapshot {
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
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function persist(snapshot: DbSnapshot) {
  const { dir, file } = dataPath();
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  renameSync(tmp, file);
}

/** Process-local DB with atomic JSON persistence (local / single-node). */
export function getDb(): DbSnapshot {
  if (!memory) memory = loadFromDisk();
  return memory;
}

export async function withDbLock<T>(fn: (db: DbSnapshot) => T | Promise<T>): Promise<T> {
  let result!: T;
  writeQueue = writeQueue.then(async () => {
    const db = getDb();
    result = await fn(db);
    persist(db);
  });
  await writeQueue;
  return result;
}

export function identityKey(provider: string, providerAccountId: string) {
  return `${provider}:${providerAccountId}`;
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
