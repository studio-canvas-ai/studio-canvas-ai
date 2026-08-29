"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { PRINT_UNIFIED_EDITOR_PATH } from "@/lib/printUnifiedEditor";
import {
  BASE_A4_TEMPLATE_CARDS,
  TEMPLATE_01_CARDS,
  TEMPLATE_WAREHOUSE_OPEN_EVENT,
  applyWarehouseTemplate,
  buildTemplate01WarehouseList,
  cloneTemplate01Card,
  cloneTemplatePages,
  isBuiltinTemplate01Id,
  loadCustomTemplate01Cards,
  nextTemplate01CardId,
  saveCustomTemplate01Cards,
  saveRemovedTemplate01Ids,
  template01CardToWarehouse,
  type Template01Card,
  type WarehouseTabId,
  type WarehouseTemplate,
} from "@/lib/templateWarehouse";
import type { Template03PublicRecord } from "@/lib/template03Public";
import {
  fetchSpace4VaultMeta,
  openSpace4InEditorForReview,
  type Space4VaultMeta,
} from "@/lib/space4Client";
import Template01GridCard from "@/components/template-warehouse/Template01GridCard";
import Template04QueueCard from "@/components/template-warehouse/Template04QueueCard";

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
const GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5";

function publicRecordToWarehouse(
  item: Template03PublicRecord
): WarehouseTemplate {
  return {
    id: item.id,
    tab: "public",
    title: item.title,
    subtitle: item.subtitle,
    formatId: item.formatId,
    pageCount: item.pageCount,
    thumbClass: item.thumbClass || "bg-slate-800",
    textLayersByPage: cloneTemplatePages(item.textLayersByPage, false),
    backgroundUrl: item.backgroundUrl ?? item.thumbSrc ?? null,
    maskedNote: item.maskedNote,
  };
}

/**
 * Template Warehouse modal — opened from Navbar [템플릿창고].
 * Template 01–04 share a 5-col A4 grid; Template 04 shows admin FIFO queue.
 */
export default function TemplateWarehouseModal() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { isAdmin } = useCredits();
  const { showToast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WarehouseTabId>("single");
  const [mounted, setMounted] = useState(false);
  const [template01Cards, setTemplate01Cards] =
    useState<Template01Card[]>(TEMPLATE_01_CARDS);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [publicTemplates, setPublicTemplates] = useState<
    Template03PublicRecord[]
  >([]);
  const [space4Items, setSpace4Items] = useState<Space4VaultMeta[]>([]);
  const [space4Loading, setSpace4Loading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const removeTimers = useRef<Map<number, number>>(new Map());

  const baseFallbackCards = BASE_A4_TEMPLATE_CARDS;

  useEffect(() => {
    setMounted(true);
    setTemplate01Cards(buildTemplate01WarehouseList());
    return () => {
      removeTimers.current.forEach((timer) => window.clearTimeout(timer));
      removeTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: WarehouseTabId }>).detail;
      const nextTab = detail?.tab;
      setTab(
        nextTab === "single" ||
          nextTab === "double" ||
          nextTab === "public" ||
          nextTab === "space4"
          ? nextTab
          : "single"
      );
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

  const refreshPublic = useCallback(async () => {
    try {
      const res = await fetch("/api/template-warehouse/public?limit=200", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Template03PublicRecord[] };
      setPublicTemplates(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshSpace4 = useCallback(async () => {
    if (!isAdmin) {
      setSpace4Items([]);
      return;
    }
    setSpace4Loading(true);
    try {
      const items = await fetchSpace4VaultMeta(500);
      setSpace4Items(items);
    } finally {
      setSpace4Loading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return;
    if (tab === "public") void refreshPublic();
    if (tab === "space4") void refreshSpace4();
  }, [open, tab, refreshPublic, refreshSpace4]);

  if (!mounted || !open) return null;

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

  const onOpenInEditor = async (item: Space4VaultMeta) => {
    if (!isAdmin || openingId) return;
    setOpeningId(item.id);
    const result = await openSpace4InEditorForReview(item);
    setOpeningId(null);
    if (!result.ok) {
      showToast("에디터에서 작업물을 여는 데 실패했습니다.", "error");
      return;
    }
    showToast("Screen 26 에디터에서 검수·수정을 진행해 주세요.", "success");
    setOpen(false);
    if (!pathname.startsWith(PRINT_UNIFIED_EDITOR_PATH)) {
      router.push(PRINT_UNIFIED_EDITOR_PATH);
    }
  };

  const renderBaseGrid = (
    cards: Template01Card[],
    tabId: Exclude<WarehouseTabId, "space4">,
    canManage: boolean
  ) => (
    <ul className={GRID_CLASS}>
      {cards.map((card) => (
        <Template01GridCard
          key={`${tabId}-${card.id}`}
          card={card}
          canManage={canManage}
          removing={tabId === "single" ? removingIds.has(card.id) : false}
          onPick={() =>
            pickTemplate(template01CardToWarehouse(card, tabId))
          }
          onDuplicate={() => duplicateTemplate01Card(card)}
          onRemove={() => removeTemplate01Card(card.id)}
        />
      ))}
    </ul>
  );

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
        className="relative z-[1] flex max-h-[min(92vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-600/60 bg-[#121824] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
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
              onClick={() => setTab(item.id)}
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth p-3 sm:p-4">
          {tab === "single" ? (
            template01Cards.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/45">
                표시할 템플릿이 없습니다. 휴지통으로 모두 삭제되었습니다.
              </p>
            ) : (
              renderBaseGrid(template01Cards, "single", isAdmin)
            )
          ) : null}

          {tab === "double" ? (
            <>
              <p className="mb-2 text-[11px] text-white/45">
                Template 02 · 기본 A4 템플릿 (Template 01과 동일 베이스)
              </p>
              {renderBaseGrid(baseFallbackCards, "double", false)}
            </>
          ) : null}

          {tab === "public" ? (
            <div className="space-y-4">
              {publicTemplates.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-emerald-200/80">
                    관리자 승인 공개 템플릿
                  </p>
                  <ul className={GRID_CLASS}>
                    {publicTemplates.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() =>
                            pickTemplate(publicRecordToWarehouse(item))
                          }
                          className="flex w-full flex-col overflow-hidden rounded-xl border border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.08] to-black/25 text-left shadow-sm transition hover:border-emerald-400/55"
                        >
                          <div
                            className="relative w-full overflow-hidden bg-slate-900"
                            style={{ aspectRatio: String(210 / 297) }}
                            aria-hidden
                          >
                            {item.thumbSrc || item.backgroundUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.thumbSrc || item.backgroundUrl || ""}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div
                                className={`h-full w-full ${item.thumbClass}`}
                              />
                            )}
                          </div>
                          <div className="space-y-0.5 border-t border-white/8 px-2 py-1.5">
                            <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">
                              {item.title}
                            </p>
                            <p className="truncate text-[9px] text-white/45">
                              {item.subtitle}
                            </p>
                            {item.maskedNote ? (
                              <p className="truncate text-[9px] text-amber-200/70">
                                {item.maskedNote}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="mb-2 text-[11px] text-white/45">
                  기본 A4 템플릿 (공통 베이스)
                </p>
                {renderBaseGrid(baseFallbackCards, "public", false)}
              </div>
            </div>
          ) : null}

          {tab === "space4" ? (
            <div className="space-y-4">
              {isAdmin ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-amber-200/85">
                    유저 다운로드 적재함 · 최대 500 · FIFO (관리자)
                    {space4Loading ? " · 불러오는 중…" : ` · ${space4Items.length}건`}
                  </p>
                  {space4Items.length === 0 && !space4Loading ? (
                    <p className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-4 text-center text-[12px] text-white/45">
                      아직 적재된 다운로드 작업물이 없습니다. 유저가 Screen 26에서
                      다운로드하면 여기에 자동 저장됩니다.
                    </p>
                  ) : (
                    <ul className={GRID_CLASS}>
                      {space4Items.map((item) => (
                        <Template04QueueCard
                          key={item.id}
                          item={item}
                          opening={openingId === item.id}
                          onOpenInEditor={() => void onOpenInEditor(item)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-white/50">
                  Template 04 적재함은 관리자 전용입니다. 아래는 공통 기본 A4
                  템플릿입니다.
                </p>
              )}
              <div>
                <p className="mb-2 text-[11px] text-white/45">
                  기본 A4 템플릿 (공통 베이스)
                </p>
                {renderBaseGrid(baseFallbackCards, "single", false)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
