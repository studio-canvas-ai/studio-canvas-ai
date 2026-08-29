"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  PortalMenu,
  useFixedBelowMenu,
  type StudioPickerTone,
} from "@/components/StudioStylePickers";
import { DecoCatalogThumb } from "@/components/print-wizard/DecoShapeSvg";
import {
  DECO_CATALOG,
  DECO_CATEGORIES,
  DECO_CATEGORY_LABELS,
  decoItemsForCategory,
} from "@/lib/printWizardDecoCatalog";

export type DecoToolCatalogDropdownProps = {
  label?: string;
  onPick: (decoId: string) => void;
  tone?: StudioPickerTone;
};

export default function DecoToolCatalogDropdown({
  label = "데코도구 카탈로그",
  onPick,
  tone = "dark",
}: DecoToolCatalogDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const menuStyle = useFixedBelowMenu(open, triggerRef, 288);
  const isLight = tone === "light";

  return (
    <div className="relative z-10 w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
          isLight
            ? "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            : "border-white/10 bg-black/40 text-white/85 hover:border-white/25 hover:bg-white/5"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition ${
            open ? "rotate-180" : ""
          } ${isLight ? "text-slate-900" : "text-white/45"}`}
          aria-hidden
        />
      </button>
      <PortalMenu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        style={menuStyle}
        tone={tone}
        className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain p-2"
      >
        <div className="flex flex-col gap-2.5">
          {DECO_CATEGORIES.map((category) => (
            <section key={category}>
              <h4
                className={`mb-1 px-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  isLight ? "text-slate-900" : "text-white/40"
                }`}
              >
                {DECO_CATEGORY_LABELS[category]}
              </h4>
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-7">
                {decoItemsForCategory(category).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => {
                      onPick(item.id);
                      setOpen(false);
                    }}
                    className={`flex aspect-square items-center justify-center rounded-md border bg-white/90 p-1 transition hover:border-emerald-400/60 hover:ring-1 hover:ring-emerald-400/40 ${
                      isLight ? "border-slate-200" : "border-white/10"
                    }`}
                  >
                    <DecoCatalogThumb category={item.category} variant={item.variant} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p
          className={`mt-2 border-t px-1 pt-2 text-[9px] font-medium ${
            isLight
              ? "border-slate-200 text-slate-900"
              : "border-white/10 text-white/35"
          }`}
        >
          총 {DECO_CATALOG.length}종 · 클릭하면 캔버스에 추가됩니다
        </p>
      </PortalMenu>
    </div>
  );
}
