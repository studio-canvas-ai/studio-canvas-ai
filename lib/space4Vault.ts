/**
 * Space 4 — admin-only sealed .sca vault (operator backroom).
 * Deposits come from user downloads; listing requires admin session.
 */

import { getDb, withDbLock } from "@/lib/db/store";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
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

type Space4Manifest = {
  updatedAt: number;
  items: Space4VaultRecord[];
};

const R2_MANIFEST_KEY = "space4/vault/manifest.json";

declare global {
  // eslint-disable-next-line no-var
  var __scaSpace4Memory: Space4VaultRecord[] | undefined;
}

function mem(): Space4VaultRecord[] {
  if (!globalThis.__scaSpace4Memory) {
    globalThis.__scaSpace4Memory = [];
  }
  return globalThis.__scaSpace4Memory;
}

async function loadR2Manifest(): Promise<Space4VaultRecord[] | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, R2_MANIFEST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as Space4Manifest;
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (p) =>
        typeof p?.id === "string" &&
        typeof p?.sealedContent === "string" &&
        p.sealedContent.includes("SCAENC1")
    );
  } catch {
    return [];
  }
}

async function saveR2Manifest(items: Space4VaultRecord[]) {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: Space4Manifest = { updatedAt: Date.now(), items };
  await putR2Object(
    client,
    config.bucketName,
    R2_MANIFEST_KEY,
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

function sortItems(items: Space4VaultRecord[]) {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export async function depositSpace4Record(
  input: Omit<Space4VaultRecord, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
    /** Per-user FIFO cap (plan scaCloud). Global vault still capped at SPACE4_VAULT_MAX. */
    perUserMax?: number;
  }
): Promise<Space4VaultRecord> {
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
    let items = mem();
    if (isR2Configured()) {
      const fromR2 = await loadR2Manifest();
      if (fromR2) items = fromR2;
    }
    let next = sortItems([record, ...items.filter((x) => x.id !== record.id)]);
    if (perUserMax != null) {
      let keptForUser = 0;
      next = next.filter((row) => {
        if (row.userId !== record.userId) return true;
        keptForUser += 1;
        return keptForUser <= perUserMax;
      });
    }
    next = next.slice(0, SPACE4_VAULT_MAX);
    globalThis.__scaSpace4Memory = next;
    // Keep a mirror key on db memory for diagnostics (optional).
    try {
      const db = getDb() as { space4Vault?: Space4VaultRecord[] };
      db.space4Vault = next;
    } catch {
      /* ignore */
    }
    if (isR2Configured()) {
      await saveR2Manifest(next);
    }
    return record;
  });
}

export async function listSpace4Records(
  limit = 50
): Promise<Omit<Space4VaultRecord, "sealedContent">[]> {
  let items = mem();
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest();
    if (fromR2) {
      items = fromR2;
      globalThis.__scaSpace4Memory = fromR2;
    }
  }
  return sortItems(items)
    .slice(0, Math.max(1, Math.min(SPACE4_VAULT_MAX, limit)))
    .map(({ sealedContent: _s, ...meta }) => meta);
}

/** Admin — full vault row including sealed .sca payload. */
export async function getSpace4Record(
  id: string
): Promise<Space4VaultRecord | null> {
  const key = id.trim();
  if (!key) return null;
  let items = mem();
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest();
    if (fromR2) {
      items = fromR2;
      globalThis.__scaSpace4Memory = fromR2;
    }
  }
  return items.find((x) => x.id === key) ?? null;
}

/** Admin — remove one vault entry (e.g. after promote → Template 03). */
export async function removeSpace4Record(id: string): Promise<boolean> {
  const key = id.trim();
  if (!key) return false;
  return withDbLock(async () => {
    let items = mem();
    if (isR2Configured()) {
      const fromR2 = await loadR2Manifest();
      if (fromR2) items = fromR2;
    }
    const next = items.filter((x) => x.id !== key);
    if (next.length === items.length) return false;
    globalThis.__scaSpace4Memory = next;
    try {
      const db = getDb() as { space4Vault?: Space4VaultRecord[] };
      db.space4Vault = next;
    } catch {
      /* ignore */
    }
    if (isR2Configured()) {
      await saveR2Manifest(next);
    }
    return true;
  });
}
