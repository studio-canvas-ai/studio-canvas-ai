"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import {
  addPageTextLayerAfter,
  ensurePageZoneLayers,
  layerZone,
  PAGE_ZONE_LABELS,
  PAGE_ZONE_ORDER,
  type SemanticZone,
} from "@/lib/printWizardTextLayers";
import type { TextLayer } from "@/lib/thumbnailStyles";

export type PageLayerEditorProps = {
  page: number;
  layers: TextLayer[];
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
  onLayerTextChange: (layerId: string, text: string) => void;
  onAddAfter: (nextLayers: TextLayer[]) => void;
  onDelete: (layerId: string) => void;
};

function AutoGrowTextarea({
  value,
  active,
  autoFocus = false,
  onChange,
  onFocus,
}: {
  value: string;
  active: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(40, el.scrollHeight)}px`;
  }, [value]);

  useLayoutEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
  }, [autoFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") e.stopPropagation();
  };

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`w-full resize-none overflow-hidden rounded-lg border bg-[#0B0F19] px-2.5 py-1.5 text-sm leading-relaxed text-slate-100 outline-none focus:border-slate-500 focus:ring-2 focus:ring-indigo-500/20 ${
        active
          ? "border-indigo-400/50 ring-2 ring-indigo-500/20"
          : "border-slate-700"
      }`}
    />
  );
}

function mergeIncomingKeepOrder(
  prev: TextLayer[],
  incoming: TextLayer[]
): TextLayer[] {
  if (prev.length === 0) return incoming;
  const byId = new Map(incoming.map((layer) => [layer.id, layer]));
  const prevIds = new Set(prev.map((layer) => layer.id));
  const next = prev.map((row) => byId.get(row.id) ?? row);
  incoming.forEach((layer, index) => {
    if (prevIds.has(layer.id)) return;
    let insertAt = next.length;
    for (let i = index - 1; i >= 0; i--) {
      const neighbor = next.findIndex((row) => row.id === incoming[i]?.id);
      if (neighbor >= 0) {
        insertAt = neighbor + 1;
        break;
      }
    }
    next.splice(insertAt, 0, layer);
  });
  return next;
}

function normalizeRows(layers: TextLayer[], pageIndex: number): TextLayer[] {
  return pageIndex === 0 ? ensurePageZoneLayers(layers, pageIndex) : layers;
}

export default function PageLayerEditor({
  page,
  layers,
  activeLayerId = null,
  onActiveLayerChange,
  onLayerTextChange,
  onAddAfter,
  onDelete,
}: PageLayerEditorProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const pageIndex = Math.max(0, page - 1);
  const isCoverPage = page === 1;
  const [rows, setRows] = useState<TextLayer[]>(() =>
    normalizeRows(layers, pageIndex)
  );
  const [focusId, setFocusId] = useState<string | null>(null);
  const pageRef = useRef(page);

  useEffect(() => {
    const incoming = normalizeRows(layers, pageIndex);
    if (pageRef.current !== page) {
      pageRef.current = page;
      setFocusId(null);
      setRows(incoming);
      return;
    }
    setRows((prev) =>
      normalizeRows(mergeIncomingKeepOrder(prev, incoming), pageIndex)
    );
  }, [page, pageIndex, layers]);

  const commit = (next: TextLayer[], focusAdded = false) => {
    const normalized = normalizeRows(next, pageIndex);
    if (focusAdded) {
      const prevIds = new Set(rows.map((layer) => layer.id));
      const added = normalized.find((layer) => !prevIds.has(layer.id));
      if (added) {
        setFocusId(added.id);
        onActiveLayerChange?.(added.id);
      }
    }
    setRows(normalized);
    onAddAfter(normalized);
  };

  const renderRow = (
    layer: TextLayer,
    labelIndex: number,
    canDelete: boolean
  ) => {
    const active = activeLayerId === layer.id;
    const rowIndex = rows.findIndex((item) => item.id === layer.id);
    return (
      <div
        key={layer.id}
        data-layer-id={layer.id}
        className={`rounded-xl border p-2 ${
          active
            ? "border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-400/40"
            : focusId === layer.id
              ? "border-indigo-400/40 bg-indigo-500/5"
              : "border-slate-800 bg-[#0B0F19]/80"
        }`}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-400">
            {fillCanvas(cs.layerN, { n: labelIndex + 1 })}
          </span>
          <button
            type="button"
            title={cs.addPageLayer}
            aria-label={cs.addPageLayer}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              commit(addPageTextLayerAfter(rows, pageIndex, rowIndex), true);
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-[#121824] text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden />
          </button>
          <button
            type="button"
            title={cs.delete}
            aria-label={cs.delete}
            disabled={!canDelete}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!canDelete) return;
              const next = rows.filter((item) => item.id !== layer.id);
              setRows(normalizeRows(next, pageIndex));
              onDelete(layer.id);
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-[#121824] text-slate-300 transition hover:border-rose-500/50 hover:bg-rose-950/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:bg-[#121824] disabled:hover:text-slate-300"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <AutoGrowTextarea
          value={layer.text}
          active={active || focusId === layer.id}
          autoFocus={focusId === layer.id}
          onFocus={() => onActiveLayerChange?.(layer.id)}
          onChange={(text) => {
            const nextText = text.replace(
              /^\s*(상단문구:|중간문구:|하단문구:)\s*/,
              ""
            );
            setRows((prev) =>
              prev.map((item) =>
                item.id === layer.id ? { ...item, text: nextText } : item
              )
            );
            onLayerTextChange(layer.id, nextText);
          }}
        />
      </div>
    );
  };

  if (!isCoverPage) {
    return (
      <div className="flex min-h-0 flex-col gap-2">
        {rows.map((layer, index) =>
          renderRow(layer, index, rows.length > 1)
        )}
      </div>
    );
  }

  const layersInZone = (zone: SemanticZone) =>
    rows.filter((layer) => layerZone(layer) === zone);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {PAGE_ZONE_ORDER.map((zone) => {
        const zoneLayers = layersInZone(zone);
        return (
          <section key={zone} className="flex flex-col gap-2">
            <h3 className="px-0.5 text-[13px] font-bold tracking-tight text-slate-100">
              {PAGE_ZONE_LABELS[zone]}
            </h3>
            {zoneLayers.map((layer, zoneIndex) =>
              renderRow(layer, zoneIndex, zoneLayers.length > 1)
            )}
          </section>
        );
      })}
    </div>
  );
}
