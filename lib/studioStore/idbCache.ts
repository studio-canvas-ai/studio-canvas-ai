/**
 * IndexedDB half of the dual cache. Holds full recent-project + vault
 * payloads (including data-URLs) so localStorage quota shrinks cannot
 * permanently drop images.
 */

import type { RecentDrawerEntry, StudioStoreKind } from "@/lib/studioStore/types";
import type { PhotoVaultItem } from "@/lib/photoVaultStorage";

const DB_NAME = "sca_studio_dual_v1";
const DB_VERSION = 1;
const STORE = "bundles";

type BundleRecord = {
  kind: StudioStoreKind;
  updatedAt: number;
  entries?: RecentDrawerEntry[];
  items?: PhotoVaultItem[];
  activeTrainedId?: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("idb_unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("idb_open_failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "kind" });
      }
    };
  });
}

function runStore<T>(
  mode: IDBTransactionMode,
  exec: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = exec(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error || new Error("idb_req_failed"));
        tx.onabort = () => reject(tx.error || new Error("idb_tx_aborted"));
        tx.oncomplete = () => db.close();
      })
  );
}

export async function idbPutRecent(
  kind: "recent_shared" | "recent_photo",
  entries: RecentDrawerEntry[]
): Promise<void> {
  try {
    await runStore("readwrite", (store) =>
      store.put({
        kind,
        updatedAt: Date.now(),
        entries,
      } satisfies BundleRecord)
    );
  } catch (err) {
    console.warn("[studioStore/idb] put recent failed", err);
  }
}

export async function idbGetRecent(
  kind: "recent_shared" | "recent_photo"
): Promise<RecentDrawerEntry[]> {
  try {
    const row = await runStore<BundleRecord | undefined>("readonly", (store) =>
      store.get(kind)
    );
    return Array.isArray(row?.entries) ? row.entries : [];
  } catch {
    return [];
  }
}

export async function idbPutVault(
  kind: "upload_vault" | "trained_vault",
  items: PhotoVaultItem[],
  extra?: { activeTrainedId?: string | null }
): Promise<void> {
  try {
    await runStore("readwrite", (store) =>
      store.put({
        kind,
        updatedAt: Date.now(),
        items,
        activeTrainedId: extra?.activeTrainedId ?? null,
      } satisfies BundleRecord)
    );
  } catch (err) {
    console.warn("[studioStore/idb] put vault failed", err);
  }
}

export async function idbGetVault(
  kind: "upload_vault" | "trained_vault"
): Promise<{ items: PhotoVaultItem[]; activeTrainedId: string | null }> {
  try {
    const row = await runStore<BundleRecord | undefined>("readonly", (store) =>
      store.get(kind)
    );
    return {
      items: Array.isArray(row?.items) ? row.items : [],
      activeTrainedId: row?.activeTrainedId ?? null,
    };
  } catch {
    return { items: [], activeTrainedId: null };
  }
}
