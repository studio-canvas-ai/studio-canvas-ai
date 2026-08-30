"use client";

/**
 * Screen 26 — "내 갤러리 저장" toggle popover (same interaction as 최근 파일 불러오기).
 * Light high-contrast panel: list stored .sca + primary save action.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageDown, Images } from "lucide-react";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import { getPlanStorageLimits } from "@/lib/planStorageLimits";
import {
  fetchScaGalleryProjects,
  type ScaGalleryProjectMeta,
} from "@/lib/scaGalleryProjects";

type Props = {
  onSave: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  requireSubscription?: () => boolean;
};

const MENU_Z = 9999;
const MENU_MIN_W = 280;
const VIEWPORT_PAD = 8;

export default function ScaGallerySaveButton({
  onSave,
  disabled = false,
  busy = false,
  className = "",
  requireSubscription,
}: Props) {
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const { planId, billingInterval } = useCredits();
  const planMax = getPlanStorageLimits(planId, billingInterval).worksGallery;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ScaGalleryProjectMeta[]>([]);
  const [serverMax, setServerMax] = useState(planMax);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const max = Math.max(planMax, serverMax);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchScaGalleryProjects();
      setProjects(data.projects);
      setServerMax(data.max);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPortalReady(true);
    void refresh();
  }, [refresh]);

  const updateCoords = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(
      Math.max(MENU_MIN_W, rect.width),
      window.innerWidth - VIEWPORT_PAD * 2
    );
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const estimatedH = Math.min(320, 96 + projects.length * 48);
    const openUp = spaceBelow < estimatedH && spaceAbove > spaceBelow;
    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, window.innerWidth - VIEWPORT_PAD - width);
    }
    left = Math.max(VIEWPORT_PAD, left);
    setCoords({
      top: openUp ? 0 : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - (rect.top - 6) : 0,
      left,
      width,
      openUp,
    });
  }, [projects.length]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSave = async () => {
    if (requireSubscription && !requireSubscription()) return;
    await onSave();
    await refresh();
  };

  const menu =
    portalReady && open && coords
      ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            aria-label={cs.saveGalleryDrawerTitle}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-2xl backdrop-blur-xl"
            style={{
              position: "fixed",
              zIndex: MENU_Z,
              left: coords.left,
              width: coords.width,
              maxHeight: "min(320px, calc(100vh - 16px))",
              overflowY: "auto",
              ...(coords.openUp
                ? { bottom: coords.bottom, top: "auto" as const }
                : { top: coords.top }),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                {cs.saveGalleryDrawerTitle}
              </p>
              <p className="text-[10px] text-slate-600">
                {fillCanvas(cs.saveGalleryDrawerHint, { max })}
              </p>
            </div>
            <div className="border-b border-slate-200 p-2">
              <button
                type="button"
                role="menuitem"
                disabled={disabled || busy}
                onClick={() => void handleSave()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-900 transition hover:bg-indigo-100 disabled:opacity-40"
              >
                <ImageDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {busy ? cs.saveGalleryBusy : cs.saveGalleryAction}
              </button>
            </div>
            {loading ? (
              <p className="px-3 py-3 text-center text-[11px] text-slate-600">
                {cs.loadFromGalleryBusy}
              </p>
            ) : projects.length === 0 ? (
              <p className="px-3 py-3 text-[11px] leading-relaxed text-slate-600">
                {fillCanvas(cs.saveGalleryEmpty, { max })}
              </p>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  className="flex w-full items-center gap-2 px-3 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    {p.thumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbSrc}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Images className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-slate-900">
                      {p.label}
                    </span>
                    <span className="block text-[10px] text-slate-600">
                      {p.mode === "agent"
                        ? cs.recentModePrint
                        : cs.recentModeTemplate}{" "}
                      · .sca
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (requireSubscription && !requireSubscription()) return;
          setOpen((v) => !v);
        }}
        title={fillCanvas(cs.saveGalleryDrawerHint, { max })}
        aria-label={cs.saveGalleryAction}
        className={
          className ||
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2 text-[10px] font-semibold leading-none text-indigo-800 transition hover:bg-indigo-100 disabled:opacity-40"
        }
      >
        <ImageDown className="h-3 w-3 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">
          {busy
            ? cs.saveGalleryBusy
            : fillCanvas(cs.saveGalleryLoad, {
                count: projects.length,
                max,
              })}
        </span>
      </button>
      {menu}
    </>
  );
}
