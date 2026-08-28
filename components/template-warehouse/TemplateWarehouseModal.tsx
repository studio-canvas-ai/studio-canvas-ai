"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCredits } from "@/components/CreditsProvider";
import { PRINT_UNIFIED_EDITOR_PATH } from "@/lib/printUnifiedEditor";
import {
  TEMPLATE_01_CARDS,
  TEMPLATE_WAREHOUSE_OPEN_EVENT,
  applyWarehouseTemplate,
  buildTemplate01WarehouseList,
  cloneTemplate01Card,
  isBuiltinTemplate01Id,
  loadCustomTemplate01Cards,
  nextTemplate01CardId,
  saveCustomTemplate01Cards,
  saveRemovedTemplate01Ids,
  template01CardToWarehouse,
  templatesForTab,
  type Template01Card,
  type WarehouseTabId,
  type WarehouseTemplate,
} from "@/lib/templateWarehouse";
import Template01GridCard from "@/components/template-warehouse/Template01GridCard";

const TABS: Array<{
  id: WarehouseTabId;
  label: string;
  hint: string;
}> = [
  {
    id: "single",
    label: "Template 01",
    hint: "단면 · A4 템플릿",
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

const REMOVE_ANIM_MS = 280;

/**
 * Template Warehouse modal — opened from Navbar [템플릿창고].
 * Template 01–03 apply to Screen 26 via event; Template 04 routes to /admin.
 */
export default function TemplateWarehouseModal() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { isAdmin } = useCredits();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WarehouseTabId>("single");
  const [mounted, setMounted] = useState(false);
  const [template01Cards, setTemplate01Cards] =
    useState<Template01Card[]>(TEMPLATE_01_CARDS);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const removeTimers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    setMounted(true);
    setTemplate01Cards(buildTemplate01WarehouseList());
    return () => {
      removeTimers.current.forEach((timer) => window.clearTimeout(timer));
      removeTimers.current.clear();
    };
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
    if (!isAdmin) return;
    if (removingIds.has(cardId)) return;
    setRemovingIds((prev) => new Set(prev).add(cardId));
    const timer = window.setTimeout(() => {
      setTemplate01Cards((prev) => {
        const next = prev.filter((card) => card.id !== cardId);
        if (isBuiltinTemplate01Id(cardId)) {
          const removed = TEMPLATE_01_CARDS.filter(
            (card) => !next.some((n) => n.id === card.id)
          ).map((card) => card.id);
          saveRemovedTemplate01Ids(removed);
        } else {
          saveCustomTemplate01Cards(
            loadCustomTemplate01Cards().filter((card) => card.id !== cardId)
          );
        }
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      removeTimers.current.delete(cardId);
    }, REMOVE_ANIM_MS);
    removeTimers.current.set(cardId, timer);
  };

  const duplicateTemplate01Card = (card: Template01Card) => {
    if (!isAdmin) return;
    setTemplate01Cards((prev) => {
      const newId = nextTemplate01CardId(prev);
      const copy = cloneTemplate01Card(card, newId);
      const next = [...prev, copy];
      saveCustomTemplate01Cards(
        next.filter((item) => !isBuiltinTemplate01Id(item.id))
      );
      return next;
    });
  };

  const goSpace4 = () => {
    setOpen(false);
    router.push("/admin");
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4">
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
        className={`relative z-[1] flex max-h-[min(92vh,860px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-600/60 bg-[#121824] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ${
          tab === "single" ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-white">템플릿창고</h2>
            <p className="mt-0.5 text-[11px] text-white/45">
              참고 템플릿을 선택하면 Screen 26 캔버스에 바로 적용됩니다 (A4 단면)
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth p-3 sm:p-5">
          {tab === "space4" ? null : tab === "single" ? (
            template01Cards.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/45">
                표시할 템플릿이 없습니다. 휴지통으로 모두 삭제되었습니다.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {template01Cards.map((card) => (
                  <Template01GridCard
                    key={card.id}
                    card={card}
                    canManage={isAdmin}
                    removing={removingIds.has(card.id)}
                    onPick={() =>
                      pickTemplate(template01CardToWarehouse(card))
                    }
                    onDuplicate={() => duplicateTemplate01Card(card)}
                    onRemove={() => removeTemplate01Card(card.id)}
                  />
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
