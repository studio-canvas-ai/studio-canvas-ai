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
  DECO_CATALOG_2,
  DECO_CATEGORIES,
  DECO_CATEGORIES_2,
  DECO_CATEGORY_LABELS,
  decoItemsForCategory,
  type DecoCategoryId,
} from "@/lib/printWizardDecoCatalog";
import {
  LIGHT_SECTION_TITLE_TRIGGER,
  LIGHT_SECTION_TITLE_TRIGGER_OPEN,
} from "@/lib/printUnifiedLightTheme";

export type DecoToolCatalogDropdownProps = {
  onPick: (decoId: string) => void;
  tone?: StudioPickerTone;
};

type CatalogPanelProps = {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  categories: DecoCategoryId[];
  totalCount: number;
  tone: StudioPickerTone;
  onPick: (decoId: string) => void;
};

function CatalogPanel({
  open,
  onClose,
  triggerRef,
  categories,
  totalCount,
  tone,
  onPick,
}: CatalogPanelProps) {
  const menuStyle = useFixedBelowMenu(open, triggerRef, 288);
  const isLight = tone === "light";

  return (
    <PortalMenu
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      style={menuStyle}
      tone={tone}
      className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain p-2"
    >
      <div className="flex flex-col gap-2.5">
        {categories.map((category) => (
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
                    onClose();
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
        총 {totalCount}종 · 클릭하면 캔버스에 추가됩니다
      </p>
    </PortalMenu>
  );
}

/**
 * Screen 26 — dual deco catalogs at 50:50.
 * Catalog 1 = existing basics; Catalog 2 = practical print assets (no emoji).
 * Independent open flags with mutual exclusivity on open.
 */
export default function DecoToolCatalogDropdown({
  onPick,
  tone = "dark",
}: DecoToolCatalogDropdownProps) {
  const trigger1Ref = useRef<HTMLButtonElement>(null);
  const trigger2Ref = useRef<HTMLButtonElement>(null);
  const [isOpen1, setIsOpen1] = useState(false);
  const [isOpen2, setIsOpen2] = useState(false);
  const isLight = tone === "light";

  const toggle1 = () => {
    setIsOpen1((prev) => {
      const next = !prev;
      if (next) setIsOpen2(false);
      return next;
    });
  };

  const toggle2 = () => {
    setIsOpen2((prev) => {
      const next = !prev;
      if (next) setIsOpen1(false);
      return next;
    });
  };

  const btnClass = (open: boolean) =>
    `flex h-9 w-full min-w-0 items-center gap-1 rounded-lg border px-1.5 text-[10px] font-semibold leading-tight transition sm:px-2 sm:text-[11px] ${
      isLight
        ? open
          ? LIGHT_SECTION_TITLE_TRIGGER_OPEN
          : LIGHT_SECTION_TITLE_TRIGGER
        : "border-white/10 bg-black/40 text-white/85 hover:border-white/25 hover:bg-white/5"
    }`;

  return (
    <div className="relative z-10 grid w-full min-w-0 grid-cols-2 gap-1.5">
      <div className="relative min-w-0">
        <button
          ref={trigger1Ref}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen1}
          onClick={toggle1}
          className={btnClass(isOpen1)}
        >
          <span className="min-w-0 flex-1 truncate text-left [word-break:keep-all]">
            데코도구 카탈로그 1
          </span>
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition ${isOpen1 ? "rotate-180" : ""} ${
              isLight ? "text-slate-800" : "text-white/45"
            }`}
            aria-hidden
          />
        </button>
        <CatalogPanel
          open={isOpen1}
          onClose={() => setIsOpen1(false)}
          triggerRef={trigger1Ref}
          categories={DECO_CATEGORIES}
          totalCount={DECO_CATALOG.length}
          tone={tone}
          onPick={onPick}
        />
      </div>

      <div className="relative min-w-0">
        <button
          ref={trigger2Ref}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen2}
          onClick={toggle2}
          className={btnClass(isOpen2)}
        >
          <span className="min-w-0 flex-1 truncate text-left [word-break:keep-all]">
            데코도구 카탈로그 2
          </span>
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition ${isOpen2 ? "rotate-180" : ""} ${
              isLight ? "text-slate-800" : "text-white/45"
            }`}
            aria-hidden
          />
        </button>
        <CatalogPanel
          open={isOpen2}
          onClose={() => setIsOpen2(false)}
          triggerRef={trigger2Ref}
          categories={DECO_CATEGORIES_2}
          totalCount={DECO_CATALOG_2.length}
          tone={tone}
          onPick={onPick}
        />
      </div>
    </div>
  );
}
