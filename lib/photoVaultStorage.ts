/**
 * Photo lookbook vaults — isolated from print-smart-form storage.
 * Keys are exact product names requested for the face pipeline.
 */

import { loadJson, saveJson } from "@/lib/storage";
import { idbGetVault, idbPutVault } from "@/lib/studioStore/idbCache";
import { mergeVaultItems } from "@/lib/studioStore/merge";
import { scheduleStudioStoreSync } from "@/lib/studioStore/syncScheduler";

export const PHOTO_UPLOAD_VAULT_KEY = "studio_canvas_upload_vault";
export const PHOTO_TRAINED_VAULT_KEY = "studio_canvas_trained_vault";
/** Active (selected) trained face id for lookbook Face ID payload. */
export const PHOTO_ACTIVE_TRAINED_ID_KEY = "studio_canvas_trained_active_id";

/** Same-tab refresh when uploads change. */
export const PHOTO_UPLOAD_VAULT_CHANGED_EVENT = "sca:photo-upload-vault-changed";
export const PHOTO_TRAINED_VAULT_CHANGED_EVENT =
  "sca:photo-trained-vault-changed";
export const PHOTO_ACTIVE_TRAINED_CHANGED_EVENT =
  "sca:photo-trained-active-changed";

export const PHOTO_VAULT_MAX = 10;

export type PhotoVaultItem = {
  id: string;
  src: string;
  label: string;
  photoKind: "original" | "cutout";
  createdAt: number;
  /** Upload vault id this trained item came from (if any). */
  sourceUploadId?: string;
};

function newVaultId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function readVault(key: string): PhotoVaultItem[] {
  const raw = loadJson<unknown>(key, []);
  if (!Array.isArray(raw)) return [];
  const out: PhotoVaultItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.src !== "string") continue;
    if (!r.src.trim()) continue;
    out.push({
      id: r.id,
      src: r.src.trim(),
      label:
        typeof r.label === "string" && r.label.trim()
          ? r.label.trim()
          : "사진",
      photoKind: r.photoKind === "cutout" ? "cutout" : "original",
      createdAt:
        typeof r.createdAt === "number" ? r.createdAt : Date.now(),
      sourceUploadId:
        typeof r.sourceUploadId === "string" ? r.sourceUploadId : undefined,
    });
  }
  return out.slice(0, PHOTO_VAULT_MAX);
}

function writeVault(
  key: string,
  items: PhotoVaultItem[],
  eventName: string
): void {
  const next = items.slice(0, PHOTO_VAULT_MAX);
  saveJson(key, next);
  const kind = key === PHOTO_TRAINED_VAULT_KEY ? "trained_vault" : "upload_vault";
  void idbPutVault(
    kind,
    next,
    kind === "trained_vault"
      ? { activeTrainedId: getActiveTrainedVaultId() }
      : undefined
  );
  scheduleStudioStoreSync();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

let vaultsHydratedFromIdb = false;
function hydrateVaultsFromIdbOnce(): void {
  if (vaultsHydratedFromIdb || typeof window === "undefined") return;
  vaultsHydratedFromIdb = true;
  void (async () => {
    try {
      const [up, tr] = await Promise.all([
        idbGetVault("upload_vault"),
        idbGetVault("trained_vault"),
      ]);
      const mergedUp = mergeVaultItems(readVault(PHOTO_UPLOAD_VAULT_KEY), up.items);
      const mergedTr = mergeVaultItems(
        readVault(PHOTO_TRAINED_VAULT_KEY),
        tr.items
      );
      if (mergedUp.length > readVault(PHOTO_UPLOAD_VAULT_KEY).length) {
        writeVault(
          PHOTO_UPLOAD_VAULT_KEY,
          mergedUp,
          PHOTO_UPLOAD_VAULT_CHANGED_EVENT
        );
      }
      if (mergedTr.length > readVault(PHOTO_TRAINED_VAULT_KEY).length) {
        writeVault(
          PHOTO_TRAINED_VAULT_KEY,
          mergedTr,
          PHOTO_TRAINED_VAULT_CHANGED_EVENT
        );
      }
      if (tr.activeTrainedId && !getActiveTrainedVaultId()) {
        setActiveTrainedVaultId(tr.activeTrainedId);
      }
    } catch (err) {
      console.warn("[photoVault] idb hydrate failed", err);
    }
  })();
}

export function listUploadVault(): PhotoVaultItem[] {
  hydrateVaultsFromIdbOnce();
  return readVault(PHOTO_UPLOAD_VAULT_KEY);
}

export function listTrainedVault(): PhotoVaultItem[] {
  hydrateVaultsFromIdbOnce();
  return readVault(PHOTO_TRAINED_VAULT_KEY);
}

export function getActiveTrainedVaultId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(PHOTO_ACTIVE_TRAINED_ID_KEY);
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/** Persist which trained face is active for Face ID / lookbook generation. */
export function setActiveTrainedVaultId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!id || !id.trim()) {
      window.localStorage.removeItem(PHOTO_ACTIVE_TRAINED_ID_KEY);
    } else {
      window.localStorage.setItem(PHOTO_ACTIVE_TRAINED_ID_KEY, id.trim());
    }
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new Event(PHOTO_ACTIVE_TRAINED_CHANGED_EVENT));
}

/**
 * Active trained face for lookbook identity — selected id, else newest trained.
 * Never returns canvas-generated subject layers.
 */
export function resolveActiveTrainedFace(): PhotoVaultItem | null {
  const trained = listTrainedVault();
  if (!trained.length) return null;
  const activeId = getActiveTrainedVaultId();
  if (activeId) {
    const hit = trained.find((t) => t.id === activeId);
    if (hit?.src?.trim()) return hit;
  }
  return trained[0] ?? null;
}

export function pushUploadVaultItem(input: {
  src: string;
  label?: string;
  photoKind?: "original" | "cutout";
}): PhotoVaultItem {
  const item: PhotoVaultItem = {
    id: newVaultId("up"),
    src: input.src,
    label: input.label?.trim() || `업로드 ${new Date().toLocaleTimeString()}`,
    photoKind: input.photoKind ?? "original",
    createdAt: Date.now(),
  };
  const next = [item, ...listUploadVault().filter((e) => e.id !== item.id)].slice(
    0,
    PHOTO_VAULT_MAX
  );
  writeVault(PHOTO_UPLOAD_VAULT_KEY, next, PHOTO_UPLOAD_VAULT_CHANGED_EVENT);
  return item;
}

export function pushTrainedVaultItem(input: {
  src: string;
  label?: string;
  photoKind?: "original" | "cutout";
  sourceUploadId?: string;
}): PhotoVaultItem {
  const item: PhotoVaultItem = {
    id: newVaultId("tr"),
    src: input.src,
    label: input.label?.trim() || `학습 ${new Date().toLocaleTimeString()}`,
    photoKind: input.photoKind ?? "original",
    createdAt: Date.now(),
    sourceUploadId: input.sourceUploadId,
  };
  const next = [
    item,
    ...listTrainedVault().filter(
      (e) => e.id !== item.id && e.sourceUploadId !== input.sourceUploadId
    ),
  ].slice(0, PHOTO_VAULT_MAX);
  writeVault(PHOTO_TRAINED_VAULT_KEY, next, PHOTO_TRAINED_VAULT_CHANGED_EVENT);
  setActiveTrainedVaultId(item.id);
  return item;
}

export function clearPhotoVaults(): void {
  writeVault(PHOTO_UPLOAD_VAULT_KEY, [], PHOTO_UPLOAD_VAULT_CHANGED_EVENT);
  writeVault(PHOTO_TRAINED_VAULT_KEY, [], PHOTO_TRAINED_VAULT_CHANGED_EVENT);
}

/** Remove one upload vault item by id. Returns removed item or null. */
export function removeUploadVaultItem(id: string): PhotoVaultItem | null {
  const cur = listUploadVault();
  const removed = cur.find((e) => e.id === id) ?? null;
  if (!removed) return null;
  writeVault(
    PHOTO_UPLOAD_VAULT_KEY,
    cur.filter((e) => e.id !== id),
    PHOTO_UPLOAD_VAULT_CHANGED_EVENT
  );
  return removed;
}

/** Remove one trained vault item by id. Returns removed item or null. */
export function removeTrainedVaultItem(id: string): PhotoVaultItem | null {
  const cur = listTrainedVault();
  const removed = cur.find((e) => e.id === id) ?? null;
  if (!removed) return null;
  writeVault(
    PHOTO_TRAINED_VAULT_KEY,
    cur.filter((e) => e.id !== id),
    PHOTO_TRAINED_VAULT_CHANGED_EVENT
  );
  if (getActiveTrainedVaultId() === id) {
    const next = listTrainedVault()[0];
    setActiveTrainedVaultId(next?.id ?? null);
  }
  return removed;
}

/** Replace entire upload vault (recent-project restore). */
export function replaceUploadVault(items: PhotoVaultItem[]): void {
  writeVault(
    PHOTO_UPLOAD_VAULT_KEY,
    sanitizeVaultItems(items),
    PHOTO_UPLOAD_VAULT_CHANGED_EVENT
  );
}

/** Replace entire trained vault (recent-project restore). */
export function replaceTrainedVault(items: PhotoVaultItem[]): void {
  writeVault(
    PHOTO_TRAINED_VAULT_KEY,
    sanitizeVaultItems(items),
    PHOTO_TRAINED_VAULT_CHANGED_EVENT
  );
}

function sanitizeVaultItems(items: PhotoVaultItem[]): PhotoVaultItem[] {
  if (!Array.isArray(items)) return [];
  const out: PhotoVaultItem[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    if (typeof row.id !== "string" || typeof row.src !== "string") continue;
    if (!row.src.trim()) continue;
    out.push({
      id: row.id,
      src: row.src.trim(),
      label:
        typeof row.label === "string" && row.label.trim()
          ? row.label.trim()
          : "사진",
      photoKind: row.photoKind === "cutout" ? "cutout" : "original",
      createdAt:
        typeof row.createdAt === "number" ? row.createdAt : Date.now(),
      sourceUploadId:
        typeof row.sourceUploadId === "string" ? row.sourceUploadId : undefined,
    });
  }
  return out.slice(0, PHOTO_VAULT_MAX);
}
