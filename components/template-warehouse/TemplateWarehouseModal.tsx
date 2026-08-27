"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { PRINT_UNIFIED_EDITOR_PATH } from "@/lib/printUnifiedEditor";
import {
  TEMPLATE_01_A4_ASPECT,
  TEMPLATE_01_CARDS,
  TEMPLATE_WAREHOUSE_OPEN_EVENT,
  applyWarehouseTemplate,
  isModularTemplate01,
  isNestedTemplate01,
  isStructuredTemplate01,
  loadRemovedTemplate01Ids,
  saveRemovedTemplate01Ids,
  template01CardToWarehouse,
  templatesForTab,
  type Template01Card,
  type WarehouseTabId,
  type WarehouseTemplate,
} from "@/lib/templateWarehouse";

function Template01CardPreview({ card }: { card: Template01Card }) {
  if (isModularTemplate01(card)) {
    const textOf = (type: string) =>
      card.textBlocks.find((b) => b.type === type)?.text ?? "";
    const circles = ["circle-1", "circle-2", "circle-3"].map(textOf);
    const steps = ["step-1", "step-2", "step-3", "step-4"].map(textOf);
    return (
      <div className="flex h-full w-full flex-col gap-1 bg-gradient-to-b from-orange-50 to-slate-200 p-2 sm:gap-1.5 sm:p-2.5">
        <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-orange-700 px-1.5 py-1.5 text-center">
          <p className="line-clamp-2 text-[8px] font-bold leading-tight text-white sm:text-[9px]">
            {textOf("hero-title")}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-orange-600 px-1.5 py-1 text-center">
          <p className="line-clamp-1 text-[7px] font-semibold text-orange-50 sm:text-[8px]">
            {textOf("hero-sub")}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-1">
          {circles.map((label, i) => (
            <div
              key={`c-${i}`}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-full border border-orange-200 bg-orange-100 px-0.5"
            >
              <p className="line-clamp-3 text-center text-[6px] font-semibold leading-tight text-slate-800 sm:text-[7px]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1">
          {["card-l-title", "card-r-title"].map((type) => (
            <div
              key={type}
              className="flex items-center justify-center overflow-hidden rounded border border-orange-200 bg-white px-1 py-1 shadow-sm"
            >
              <p className="line-clamp-4 text-center text-[6px] font-semibold leading-tight text-slate-800 sm:text-[7px]">
                {textOf(type)}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          {steps.map((step, i) => (
            <div
              key={`s-${i}`}
              className={`overflow-hidden rounded px-1 py-0.5 ${
                i % 2 === 0 ? "bg-orange-200/80" : "bg-orange-300/70"
              }`}
            >
              <p className="line-clamp-1 text-[6px] font-medium text-slate-800 sm:text-[7px]">
                {step}
              </p>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-orange-950 px-1.5 py-1 text-center">
          <p className="line-clamp-1 text-[7px] font-semibold text-white/95 sm:text-[8px]">
            {textOf("footer")}
          </p>
        </div>
      </div>
    );
  }

  if (isNestedTemplate01(card)) {
    const [leftBox, rightBox] = card.subBoxes;
    return (
      <div className="flex h-full w-full flex-col gap-1.5 bg-gradient-to-b from-blue-50 to-slate-200 p-2 sm:gap-2 sm:p-2.5">
        <div className="mx-auto flex shrink-0 items-center justify-center rounded-full bg-blue-700 px-2 py-1 text-center">
          <p className="line-clamp-1 text-[8px] font-bold text-white sm:text-[9px]">
            {card.badgeText}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-md bg-blue-900 px-1.5 py-2 text-center">
          <p className="line-clamp-2 text-[9px] font-bold leading-tight text-white sm:text-[10px]">
            {card.mainTitle}
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 sm:gap-1.5">
          {[leftBox, rightBox].map((box, i) =>
            box ? (
              <div
                key={`${card.id}-sub-${i}`}
                className="flex flex-col overflow-hidden rounded-md border border-blue-200 bg-slate-50 shadow-sm"
              >
                <div className="shrink-0 bg-blue-100 px-1 py-1 text-center">
                  <p className="line-clamp-2 text-[7px] font-bold text-blue-900 sm:text-[8px]">
                    {box.title}
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-0.5 p-1">
                  {box.items?.slice(0, 4).map((item) => (
                    <p
                      key={item}
                      className="line-clamp-1 text-[7px] text-slate-700 sm:text-[8px]"
                    >
                      • {item}
                    </p>
                  ))}
                  {box.infoLines?.map((line) => (
                    <p
                      key={line}
                      className="line-clamp-2 text-[7px] leading-tight text-slate-700 sm:text-[8px]"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-md bg-slate-900 px-1.5 py-1.5 text-center">
          <p className="line-clamp-2 text-[8px] font-semibold leading-tight text-white/95 sm:text-[9px]">
            {card.footerText}
          </p>
        </div>
      </div>
    );
  }

  if (isStructuredTemplate01(card)) {
    const cells = [...card.gridTexts];
    while (cells.length < 6) cells.push("");
    return (
      <div className="flex h-full w-full flex-col gap-1.5 bg-gradient-to-b from-teal-50 to-slate-200 p-2 sm:gap-2 sm:p-2.5">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-teal-700 px-1.5 py-2 text-center">
          <p className="line-clamp-2 text-[9px] font-bold leading-tight text-white sm:text-[10px]">
            {card.headerText}
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-1 sm:gap-1.5">
          {cells.slice(0, 6).map((label, i) => (
            <div
              key={`${card.id}-cell-${i}`}
              className="flex items-center justify-center rounded border border-teal-200/80 bg-white px-0.5 py-1 shadow-sm"
            >
              <p className="line-clamp-3 text-center text-[8px] font-semibold leading-tight text-slate-800 sm:text-[9px]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-md bg-teal-900 px-1.5 py-1.5 text-center">
          <p className="line-clamp-2 text-[8px] font-semibold leading-tight text-white/95 sm:text-[9px]">
            {card.footerText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.bg}
        alt=""
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-2.5 sm:p-3">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white drop-shadow sm:text-[12px]">
          {card.text1}
        </p>
        <p className="line-clamp-2 text-[10px] leading-snug text-white/85 drop-shadow sm:text-[11px]">
          {card.text2}
        </p>
      </div>
    </>
  );
}

const TABS: Array<{
  id: WarehouseTabId;
  label: string;
  hint: string;
}> = [
  {
    id: "single",
    label: "Template 01",
    hint: "단면 템플릿",
  },
  {
    id: "double",
    label: "Template 02",
    hint: "양면 · 다페이지",
  },
  {
    id: "public",
    label: "Template 03",
    hint: "공개 템플릿",
  },
  {
    id: "space4",
    label: "Template 04",
    hint: "관리자 전용 / Space 4",
  },
];

/**
 * Template Warehouse modal — opened from Navbar [템플릿창고].
 * Template 01–03 apply to Screen 26 via event; Template 04 routes to /admin.
 */
export default function TemplateWarehouseModal() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WarehouseTabId>("single");
  const [mounted, setMounted] = useState(false);
  const [template01Cards, setTemplate01Cards] =
    useState<Template01Card[]>(TEMPLATE_01_CARDS);

  useEffect(() => {
    setMounted(true);
    const removed = new Set(loadRemovedTemplate01Ids());
    if (removed.size > 0) {
      setTemplate01Cards(
        TEMPLATE_01_CARDS.filter((card) => !removed.has(card.id))
      );
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setTab("single");
      setOpen(true);
    };
    window.addEventListener(TEMPLATE_WAREHOUSE_OPEN_EVENT, onOpen);
    return () =>
      window.removeEventListener(TEMPLATE_WAREHOUSE_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted || !open) return null;

  const list =
    tab === "space4" || tab === "single"
      ? []
      : templatesForTab(tab as Exclude<WarehouseTabId, "space4">);

  const pickTemplate = (template: WarehouseTemplate) => {
    applyWarehouseTemplate(template);
    setOpen(false);
    if (!pathname.startsWith(PRINT_UNIFIED_EDITOR_PATH)) {
      router.push(PRINT_UNIFIED_EDITOR_PATH);
    }
  };

  const removeTemplate01Card = (cardId: number) => {
    setTemplate01Cards((prev) => {
      const next = prev.filter((card) => card.id !== cardId);
      const removed = TEMPLATE_01_CARDS.filter(
        (card) => !next.some((n) => n.id === card.id)
      ).map((card) => card.id);
      saveRemovedTemplate01Ids(removed);
      return next;
    });
  };

  const goSpace4 = () => {
    setOpen(false);
    router.push("/admin");
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="템플릿창고"
        className={`relative z-[1] flex max-h-[min(90vh,820px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-600/60 bg-[#121824] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ${
          tab === "single" ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-white">템플릿창고</h2>
            <p className="mt-0.5 text-[11px] text-white/45">
              참고 템플릿을 선택하면 Screen 26 캔버스에 바로 적용됩니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="모달 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 sm:px-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "space4") {
                  goSpace4();
                  return;
                }
                setTab(item.id);
              }}
              className={`shrink-0 rounded-lg px-3 py-2 text-left transition ${
                tab === item.id
                  ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block text-[12px] font-bold leading-none">
                {item.label}
              </span>
              <span className="mt-1 block text-[10px] leading-none opacity-70">
                {item.hint}
              </span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {tab === "space4" ? null : tab === "single" ? (
            template01Cards.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/45">
                표시할 템플릿이 없습니다. 휴지통으로 모두 삭제되었습니다.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {template01Cards.map((card) => (
                  <li key={card.id} className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTemplate01Card(card.id);
                      }}
                      className="absolute right-2 top-2 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/65 text-white/80 shadow-lg backdrop-blur-sm transition hover:border-rose-400/50 hover:bg-rose-500/90 hover:text-white"
                      aria-label={`${card.title} 삭제`}
                      title="템플릿 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        pickTemplate(template01CardToWarehouse(card))
                      }
                      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/30 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:shadow-[0_12px_40px_rgba(16,185,129,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      <div
                        className="relative w-full overflow-hidden bg-slate-900"
                        style={{ aspectRatio: String(TEMPLATE_01_A4_ASPECT) }}
                        aria-hidden
                      >
                        <Template01CardPreview card={card} />
                      </div>
                      <div className="space-y-1 border-t border-white/8 px-2.5 py-2.5 sm:px-3 sm:py-3">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white sm:text-[14px]">
                          {card.title}
                        </p>
                        <p className="truncate text-[11px] text-white/45">
                          {card.desc}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {list.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => pickTemplate(tpl)}
                    className="group flex w-full gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5 text-left transition hover:border-emerald-400/40 hover:bg-emerald-500/10"
                  >
                    <div
                      className={`h-16 w-12 shrink-0 rounded-md border border-white/10 ${tpl.thumbClass}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-white">
                        {tpl.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-white/45">
                        {tpl.subtitle}
                      </p>
                      {tpl.maskedNote ? (
                        <p className="mt-1 truncate text-[10px] text-amber-200/70">
                          {tpl.maskedNote}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] tabular-nums text-white/35">
                        {tpl.pageCount}면 · {tpl.formatId}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
