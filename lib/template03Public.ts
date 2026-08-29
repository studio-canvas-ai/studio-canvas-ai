/**
 * Template 03 — public warehouse templates promoted from Template 04 (Space 4).
 * PII is masked at promote time. Readable by all clients; write is admin-only.
 */

import type { PrintFormatId, PrintPageCount } from "@/lib/printWizardTypes";
import type { TextLayer } from "@/lib/thumbnailStyles";
import { getDb, withDbLock } from "@/lib/db/store";
import {
  createR2Client,
  getR2Config,
  getR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";

export type Template03PublicRecord = {
  id: string;
  title: string;
  subtitle: string;
  formatId: PrintFormatId;
  pageCount: PrintPageCount;
  thumbClass: string;
  textLayersByPage: TextLayer[][];
  backgroundUrl?: string | null;
  thumbSrc?: string | null;
  maskedNote?: string;
  promotedFromSpace4Id?: string;
  createdAt: number;
};

type Template03Manifest = {
  updatedAt: number;
  items: Template03PublicRecord[];
};

const R2_MANIFEST_KEY = "template03/public/manifest.json";

declare global {
  // eslint-disable-next-line no-var
  var __scaTemplate03Memory: Template03PublicRecord[] | undefined;
}

function mem(): Template03PublicRecord[] {
  if (!globalThis.__scaTemplate03Memory) {
    globalThis.__scaTemplate03Memory = [];
  }
  return globalThis.__scaTemplate03Memory;
}

async function loadR2Manifest(): Promise<Template03PublicRecord[] | null> {
  const config = getR2Config();
  if (!config) return null;
  const client = createR2Client(config);
  const raw = await getR2Object(client, config.bucketName, R2_MANIFEST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as Template03Manifest;
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (p) =>
        typeof p?.id === "string" &&
        Array.isArray(p?.textLayersByPage) &&
        typeof p?.createdAt === "number"
    );
  } catch {
    return [];
  }
}

async function saveR2Manifest(items: Template03PublicRecord[]) {
  const config = getR2Config();
  if (!config) return;
  const client = createR2Client(config);
  const body: Template03Manifest = { updatedAt: Date.now(), items };
  await putR2Object(
    client,
    config.bucketName,
    R2_MANIFEST_KEY,
    Buffer.from(JSON.stringify(body)),
    "application/json"
  );
}

function sortItems(items: Template03PublicRecord[]) {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export async function upsertTemplate03Public(
  record: Template03PublicRecord
): Promise<Template03PublicRecord> {
  return withDbLock(async () => {
    let items = mem();
    if (isR2Configured()) {
      const fromR2 = await loadR2Manifest();
      if (fromR2) items = fromR2;
    }
    const next = sortItems([
      record,
      ...items.filter((x) => x.id !== record.id),
    ]);
    globalThis.__scaTemplate03Memory = next;
    try {
      const db = getDb() as { template03Public?: Template03PublicRecord[] };
      db.template03Public = next;
    } catch {
      /* ignore */
    }
    if (isR2Configured()) {
      await saveR2Manifest(next);
    }
    return record;
  });
}

export async function listTemplate03Public(
  limit = 200
): Promise<Template03PublicRecord[]> {
  let items = mem();
  if (isR2Configured()) {
    const fromR2 = await loadR2Manifest();
    if (fromR2) {
      items = fromR2;
      globalThis.__scaTemplate03Memory = fromR2;
    }
  }
  return sortItems(items).slice(0, Math.max(1, Math.min(500, limit)));
}
