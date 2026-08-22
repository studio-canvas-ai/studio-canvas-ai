/**
 * Persist original Shorts video blobs in IndexedDB so studio can mix
 * without re-upload when playbackUrl is missing (local mode / blob URLs).
 */

const DB_NAME = "sca_shorts_video_v1";
const STORE = "videos";
const DB_VERSION = 1;

export type ShortsStoredVideo = {
  videoId: string;
  fileName: string;
  contentType: string;
  blob: Blob;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb_unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "videoId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb_open_failed"));
  });
}

export async function persistShortsVideoBlob(
  videoId: string,
  file: Blob,
  meta: { fileName: string; contentType: string }
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb_write_failed"));
    tx.objectStore(STORE).put({
      videoId,
      fileName: meta.fileName,
      contentType: meta.contentType,
      blob: file,
      savedAt: Date.now(),
    } satisfies ShortsStoredVideo);
  });
  db.close();
}

export async function loadShortsVideoBlob(
  videoId: string
): Promise<ShortsStoredVideo | null> {
  try {
    const db = await openDb();
    const row = await new Promise<ShortsStoredVideo | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(videoId);
      req.onsuccess = () => resolve((req.result as ShortsStoredVideo) ?? null);
      req.onerror = () => reject(req.error ?? new Error("idb_read_failed"));
    });
    db.close();
    return row;
  } catch {
    return null;
  }
}

export async function deleteShortsVideoBlob(videoId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb_delete_failed"));
      tx.objectStore(STORE).delete(videoId);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
