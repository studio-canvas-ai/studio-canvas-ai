"use client";

/**
 * Global interactive canvas store — shared by Template Studio (utility)
 * and Print Agent (agent). Feeds High-DPI / print-ready export.
 */

import { create } from "zustand";
import type {
  CanvasDocumentMeta,
  CanvasExportSnapshot,
  CanvasObject,
} from "@/lib/canvas/types";
import { sortByZIndex } from "@/lib/canvas/types";

export type CanvasStoreState = {
  meta: CanvasDocumentMeta;
  objects: CanvasObject[];
  selectedId: string | null;
  editingTextId: string | null;
  setMeta: (partial: Partial<CanvasDocumentMeta>) => void;
  setObjects: (objects: CanvasObject[]) => void;
  upsertObject: (obj: CanvasObject) => void;
  updateObject: (id: string, patch: Partial<CanvasObject>) => void;
  updateTransform: (
    id: string,
    transform: Partial<
      Pick<
        CanvasObject,
        "x" | "y" | "width" | "height" | "rotation" | "scaleX" | "scaleY"
      >
    >
  ) => void;
  removeObject: (id: string) => void;
  select: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  /** Raise one step above neighbors (legacy alias). */
  bringForward: (id: string) => void;
  /** Lower one step below neighbors (legacy alias). */
  sendBackward: (id: string) => void;
  /** Stack on top of every object. */
  bringToFront: (id: string) => void;
  /** Stack under every object (above locked background if present). */
  sendToBack: (id: string) => void;
  clearSelection: () => void;
  resetDocument: (meta?: Partial<CanvasDocumentMeta>) => void;
  getExportSnapshot: () => CanvasExportSnapshot;
};

const DEFAULT_META: CanvasDocumentMeta = {
  width: 1080,
  height: 1350,
  mode: "utility",
  dpi: 300,
};

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  meta: { ...DEFAULT_META },
  objects: [],
  selectedId: null,
  editingTextId: null,

  setMeta: (partial) =>
    set((s) => ({ meta: { ...s.meta, ...partial } })),

  setObjects: (objects) => set({ objects: sortByZIndex(objects) }),

  upsertObject: (obj) =>
    set((s) => {
      const idx = s.objects.findIndex((o) => o.id === obj.id);
      if (idx < 0) return { objects: sortByZIndex([...s.objects, obj]) };
      const next = s.objects.slice();
      next[idx] = { ...next[idx], ...obj } as CanvasObject;
      return { objects: sortByZIndex(next) };
    }),

  updateObject: (id, patch) =>
    set((s) => ({
      objects: sortByZIndex(
        s.objects.map((o) =>
          o.id === id ? ({ ...o, ...patch } as CanvasObject) : o
        )
      ),
    })),

  updateTransform: (id, transform) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? ({ ...o, ...transform } as CanvasObject) : o
      ),
    })),

  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      editingTextId: s.editingTextId === id ? null : s.editingTextId,
    })),

  select: (id) => set({ selectedId: id, editingTextId: null }),

  setEditingTextId: (id) =>
    set({ editingTextId: id, selectedId: id ?? get().selectedId }),

  bringForward: (id) => get().bringToFront(id),

  sendBackward: (id) => get().sendToBack(id),

  bringToFront: (id) =>
    set((s) => {
      const maxZ = s.objects.reduce((m, o) => Math.max(m, o.zIndex), 0);
      return {
        objects: sortByZIndex(
          s.objects.map((o) =>
            o.id === id ? { ...o, zIndex: maxZ + 1 } : o
          )
        ),
      };
    }),

  sendToBack: (id) =>
    set((s) => {
      const target = s.objects.find((o) => o.id === id);
      if (!target || target.locked || target.type === "background") {
        return s;
      }
      const floor = s.objects
        .filter((o) => o.locked || o.type === "background")
        .reduce((m, o) => Math.max(m, o.zIndex), -1);
      const others = sortByZIndex(
        s.objects.filter(
          (o) =>
            o.id !== id && !o.locked && o.type !== "background"
        )
      );
      return {
        objects: sortByZIndex([
          ...s.objects.filter((o) => o.locked || o.type === "background"),
          { ...target, zIndex: floor + 1 },
          ...others.map((o, i) => ({ ...o, zIndex: floor + 2 + i })),
        ]),
      };
    }),

  clearSelection: () => set({ selectedId: null, editingTextId: null }),

  resetDocument: (meta) =>
    set({
      meta: { ...DEFAULT_META, ...meta },
      objects: [],
      selectedId: null,
      editingTextId: null,
    }),

  getExportSnapshot: () => {
    const s = get();
    return {
      meta: { ...s.meta },
      objects: sortByZIndex(s.objects).map((o) => ({ ...o })),
      selectedId: s.selectedId,
      updatedAt: Date.now(),
    };
  },
}));
