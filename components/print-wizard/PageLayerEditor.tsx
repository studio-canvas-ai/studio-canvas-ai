"use client";

import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import type { TextLayer } from "@/lib/thumbnailStyles";

export type PageLayerEditorProps = {
  layers: TextLayer[];
  activeLayerId?: string | null;
  onActiveLayerChange?: (id: string | null) => void;
  onLayerTextChange: (layerId: string, text: string) => void;
  onDuplicate: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onAddLayer: () => void;
};

function AutoGrowTextarea({
  value,
  placeholder,
  active,
  onChange,
  onFocus,
}: {
  value: string;
  placeholder: string;
  active: boolean;
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") e.stopPropagation();
  };

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`w-full resize-none overflow-hidden rounded-lg border bg-[#0B0F19] px-2.5 py-1.5 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-indigo-500/20 ${
        active
          ? "border-indigo-400/50 ring-2 ring-indigo-500/20"
          : "border-slate-700"
      }`}
    />
  );
}

export default function PageLayerEditor({
  layers,
  activeLayerId = null,
  onActiveLayerChange,
  onLayerTextChange,
  onDuplicate,
  onDelete,
  onAddLayer,
}: PageLayerEditorProps) {
  const { t } = useI18n();
  const cs = t.canvasStudio;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-col gap-2">
        {layers.map((layer, index) => {
          const active = activeLayerId === layer.id;
          return (
            <div
              key={layer.id}
              className={`rounded-xl border p-2 ${
                active
                  ? "border-indigo-400/40 bg-indigo-500/5"
                  : "border-slate-800 bg-[#0B0F19]/80"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-400">
                  {fillCanvas(cs.layerN, { n: index + 1 })}
                </span>
                <button
                  type="button"
                  title={cs.duplicate}
                  aria-label={cs.duplicate}
                  onClick={() => onDuplicate(layer.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-[#121824] text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  <CopyPlus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  title={cs.delete}
                  aria-label={cs.delete}
                  onClick={() => onDelete(layer.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-[#121824] text-slate-300 transition hover:border-rose-500/50 hover:bg-rose-950/40 hover:text-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <AutoGrowTextarea
                value={layer.text}
                placeholder={cs.layerPlaceholder}
                active={active}
                onFocus={() => onActiveLayerChange?.(layer.id)}
                onChange={(text) => onLayerTextChange(layer.id, text)}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddLayer}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-600 bg-[#0E1420] px-3 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-white"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {cs.addPageLayer}
      </button>
    </div>
  );
}
