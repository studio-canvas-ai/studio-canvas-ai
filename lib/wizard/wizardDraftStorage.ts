/**
 * Parameterized wizard draft FIFO (localStorage).
 */
import type { PrintWizardState } from "@/lib/printWizardTypes";

export type WizardDraftMeta = {
  id: string;
  savedAt: number;
  label: string;
};

type DraftEntry = {
  id: string;
  meta: WizardDraftMeta;
  state: PrintWizardState;
};

export type WizardDraftStorageConfig = {
  draftsKey: string;
  changedEvent: string;
  maxDrafts?: number;
  labelPrefix?: string;
};

export type WizardDraftStorage = {
  saveDraft: (state: PrintWizardState) => WizardDraftMeta;
  listDrafts: () => WizardDraftMeta[];
  loadDraft: (id: string) => PrintWizardState | null;
  deleteDraft: (id: string) => void;
  changedEvent: string;
};

function formatLabel(
  state: PrintWizardState,
  savedAt: number,
  prefix: string
): string {
  const when = new Date(savedAt);
  const stamp = `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  const title =
    state.inputs?.title?.trim() ||
    state.inputs?.organizer?.trim() ||
    state.mainPrompt?.trim().slice(0, 20) ||
    "";
  if (title) return `${title.slice(0, 22)} · ${stamp}`;
  return `${prefix} · ${stamp}`;
}

export function createWizardDraftStorage(
  config: WizardDraftStorageConfig
): WizardDraftStorage {
  const max = config.maxDrafts ?? 10;
  const prefix = config.labelPrefix ?? "초안";

  function readDrafts(): DraftEntry[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(config.draftsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return (parsed as DraftEntry[]).slice(0, max);
    } catch {
      return [];
    }
  }

  function writeDrafts(entries: DraftEntry[]): void {
    if (typeof localStorage === "undefined") return;
    const trimmed = entries.slice(0, max);
    try {
      localStorage.setItem(config.draftsKey, JSON.stringify(trimmed));
    } catch {
      const shrunk = trimmed.slice(0, Math.max(1, trimmed.length - 2));
      try {
        localStorage.setItem(config.draftsKey, JSON.stringify(shrunk));
      } catch {
        /* give up */
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(config.changedEvent));
    }
  }

  return {
    changedEvent: config.changedEvent,
    saveDraft(state: PrintWizardState): WizardDraftMeta {
      const id = `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const savedAt = Date.now();
      const meta: WizardDraftMeta = {
        id,
        savedAt,
        label: formatLabel(state, savedAt, prefix),
      };
      const prev = readDrafts();
      const next: DraftEntry[] = [{ id, meta, state }, ...prev].slice(0, max);
      writeDrafts(next);
      return meta;
    },
    listDrafts(): WizardDraftMeta[] {
      return readDrafts().map((e) => e.meta);
    },
    loadDraft(id: string): PrintWizardState | null {
      const hit = readDrafts().find((e) => e.id === id);
      return hit?.state ?? null;
    },
    deleteDraft(id: string): void {
      writeDrafts(readDrafts().filter((e) => e.id !== id));
    },
  };
}
