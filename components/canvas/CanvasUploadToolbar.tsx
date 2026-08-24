"use client";

/**
 * Shared canvas toolbar (single-line):
 * [최근 ?�일 불러?�기 (5??] [??��] [?�본?�로?? [배경?�거?�로??
 * Used by Template Studio and Print Smart Form.
 *
 * Recent-files menu renders as a fixed overlay (portal) so parent
 * overflow / canvas stacking cannot clip or cover it.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  Eraser,
  ImagePlus,
  Trash2,
  Upload,
} from "lucide-react";
import { useFeedback } from "@/components/FeedbackProvider";
import { useI18n } from "@/components/I18nProvider";
import { fillCanvas } from "@/lib/i18n";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import {
  addPhotoLayerFromFile,
  type PhotoKind,
} from "@/lib/canvas/addPhotoLayer";
import {
  isAllowedPrintPhotoFile,
  PRINT_PHOTO_ACCEPT,
  PRINT_PHOTO_FORMAT_HINT,
} from "@/lib/printWizardPhotoLayers";
import type { StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import {
  getRecentProject,
  listRecentProjects,
  RECENT_PROJECTS_CHANGED_EVENT,
  RECENT_PROJECTS_MAX,
  type RecentProjectNamespace,
  type RecentProjectMeta,
} from "@/lib/canvas/recentProjects";
import { recoverStudioStores } from "@/lib/studioStore/clientRecovery";

export type CanvasUploadToolbarProps = {
  className?: string;
  dense?: boolean;
  nowrap?: boolean;
  onLayersChanged?: () => void;
  onDeleteObject?: (id: string, type: string) => void;
  onInstallFile?: (file: File, mode: PhotoKind) => Promise<void>;
  /** Restore a recent sealed .sca project into the active editor. */
  onLoadRecentProject?: (project: StudioCanvasProjectV1) => void | Promise<void>;
  /** Return false to block premium-only actions (opens caller modal). */
  requireSubscription?: () => boolean;
  disabled?: boolean;
  /** `delete-only` = trash only; `no-upload` = recent + delete (photo wizard). */
  actions?: "full" | "delete-only" | "no-upload";
  /** When set, ??�� targets this overlay object instead of the canvas store. */
  extraDeletable?: { id: string; type: string } | null;
  showFormatHint?: boolean;
  recentNamespace?: RecentProjectNamespace;
  /** Larger padding / type for photo wizard header after uploads moved away. */
  roomy?: boolean;
};

type MenuCoords = {
  /** Distance from viewport top when opening downward; unused when openUp. */
  top: number;
  /** Distance from viewport bottom when opening upward; unused when !openUp. */
  bottom: number;
  left: number;
  width: number;
  openUp: boolean;
};

const MENU_Z = 9999;
const MENU_MIN_W = 280;
const MENU_MAX_W = 360;
const VIEWPORT_PAD = 8;

export default function CanvasUploadToolbar({
  className = "",
  dense = false,
  nowrap = true,
  onLayersChanged,
  onDeleteObject,
  onInstallFile,
  onLoadRecentProject,
  requireSubscription,
  disabled = false,
  actions = "full",
  extraDeletable = null,
  showFormatHint = true,
  recentNamespace = "shared",
  roomy = false,
}: CanvasUploadToolbarProps) {
  const { showToast } = useFeedback();
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const originalInputRef = useRef<HTMLInputElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"original" | "cutout" | "recent" | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<RecentProjectMeta[]>([]);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const selectedId = useCanvasStore((s) => s.selectedId);
  const selected = useCanvasStore(
    (s) => s.objects.find((o) => o.id === s.selectedId) ?? null
  );
  const canDelete = extraDeletable
    ? true
    : Boolean(selected && !selected.locked && selected.type !== "background");

  const showRecent = actions === "full" || actions === "no-upload";
  const showUploads = actions === "full";

  const btn = roomy
    ? "inline-flex w-max min-w-max shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold leading-none whitespace-nowrap transition disabled:opacity-40"
    : dense
      ? "inline-flex w-max min-w-max shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none whitespace-nowrap transition disabled:opacity-40"
      : "inline-flex w-max min-w-max shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-none whitespace-nowrap transition disabled:opacity-40";
  const iconCls = roomy
    ? "h-4 w-4 shrink-0"
    : dense
      ? "h-3 w-3 shrink-0"
      : "h-3.5 w-3.5 shrink-0";

  const refreshRecent = async () => {
    try {
      setRecent(await listRecentProjects(recentNamespace));
    } catch {
      setRecent([]);
    }
  };

  useEffect(() => {
    setPortalReady(true);
  }, [recentNamespace]);

  useEffect(() => {
    void recoverStudioStores().then(() => {
      void refreshRecent();
    });
    void refreshRecent();
    const onChanged = () => {
      void refreshRecent();
    };
    window.addEventListener(RECENT_PROJECTS_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onChanged);
    return () => {
      window.removeEventListener(RECENT_PROJECTS_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, [recentNamespace]);

  useEffect(() => {
    if (!menuOpen) return;
    void refreshRecent();
  }, [menuOpen]);

  const updateMenuCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(
      MENU_MAX_W,
      Math.max(MENU_MIN_W, rect.width, 280)
    );
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const estimatedH = Math.min(320, 48 + recent.length * 48);
    const openUp =
      spaceBelow < estimatedH && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_PAD) {
      left = Math.max(
        VIEWPORT_PAD,
        window.innerWidth - VIEWPORT_PAD - width
      );
    }
    left = Math.max(VIEWPORT_PAD, left);

    setMenuCoords({
      top: openUp ? 0 : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - (rect.top - 6) : 0,
      left,
      width,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuCoords(null);
      return;
    }
    updateMenuCoords();
    const onReposition = () => updateMenuCoords();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reposition when open / list size changes
  }, [menuOpen, recent.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    // Defer so the opening click does not immediately close.
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const deleteSelected = () => {
    if (extraDeletable) {
      onDeleteObject?.(extraDeletable.id, extraDeletable.type);
      onLayersChanged?.();
      showToast("?�택??객체�???��?�습?�다.", "success");
      return;
    }
    const store = useCanvasStore.getState();
    const id = store.selectedId;
    if (!id) {
      showToast("??��??객체�??�택??주세??", "info");
      return;
    }
    const obj = store.objects.find((o) => o.id === id);
    if (!obj || obj.locked || obj.type === "background") {
      showToast("??객체????��?????�습?�다.", "info");
      return;
    }
    onDeleteObject?.(obj.id, obj.type);
    store.removeObject(id);
    onLayersChanged?.();
    showToast("?�택??객체�???��?�습?�다.", "success");
  };

  const pick = (mode: "original" | "cutout", file: File | null) => {
    if (!file) return;
    if (!isAllowedPrintPhotoFile(file)) {
      showToast("JPG, PNG, WebP ?��?지�??�로?�할 ???�습?�다.", "info");
      if (originalInputRef.current) originalInputRef.current.value = "";
      if (cutoutInputRef.current) cutoutInputRef.current.value = "";
      return;
    }
    void (async () => {
      setBusy(mode);
      try {
        if (onInstallFile) {
          await onInstallFile(file, mode);
        } else {
          await addPhotoLayerFromFile(file, {
            mode,
            replaceMain: true,
            maxFraction: 1,
          });
        }
        onLayersChanged?.();
        showToast(
          mode === "cutout"
            ? "배경 ?�거 ?��?지�?중앙???�착?�습?�다."
            : "?�본 ?��?지�?중앙???�착?�습?�다.",
          "success"
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "?�진 ?�로?�에 ?�패?�습?�다.",
          "error"
        );
      } finally {
        setBusy(null);
        if (originalInputRef.current) originalInputRef.current.value = "";
        if (cutoutInputRef.current) cutoutInputRef.current.value = "";
      }
    })();
  };

  const loadRecent = (id: string) => {
    if (requireSubscription && !requireSubscription()) return;
    if (!onLoadRecentProject) {
      showToast("???�면?�서??최근 ?�일 복원??지?�하지 ?�습?�다.", "info");
      return;
    }
    void (async () => {
      setBusy("recent");
      try {
        const project = await getRecentProject(id, recentNamespace);
        if (!project) {
          showToast("최근 ?�일??찾을 ???�습?�다.", "error");
          return;
        }
        await onLoadRecentProject(project);
        setMenuOpen(false);
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "최근 ?�일 불러?�기???�패?�습?�다.",
          "error"
        );
      } finally {
        setBusy(null);
      }
    })();
  };

  const recentMenu =
    portalReady && menuOpen && menuCoords
      ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            aria-label={cs.recentDrawerTitle}
            className="overflow-hidden rounded-xl border border-white/15 bg-[#12161f]/98 py-1 shadow-2xl backdrop-blur-xl"
            style={{
              position: "fixed",
              zIndex: MENU_Z,
              left: menuCoords.left,
              width: menuCoords.width,
              maxHeight: "min(320px, calc(100vh - 16px))",
              overflowY: "auto",
              ...(menuCoords.openUp
                ? { bottom: menuCoords.bottom, top: "auto" as const }
                : { top: menuCoords.top }),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
                {cs.recentDrawerTitle}
              </p>
              <p className="text-[10px] text-white/40">
                {fillCanvas(cs.recentDrawerHint, { max: RECENT_PROJECTS_MAX })}
              </p>
            </div>
            {recent.length === 0 ? (
              <p className="px-3 py-3 text-[11px] leading-relaxed text-white/45">
                {fillCanvas(cs.recentEmpty, { max: RECENT_PROJECTS_MAX })}
              </p>
            ) : (
              recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => loadRecent(item.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/40">
                    {item.thumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbSrc}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5 text-white/40" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-white/85">
                      {item.label}
                    </span>
                    <span className="block text-[10px] text-white/40">
                      {item.mode === "agent" ? cs.recentModePrint : cs.recentModeTemplate} · .sca
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`relative flex w-max min-w-max items-center gap-1 ${
        nowrap ? "flex-nowrap" : "flex-wrap"
      } ${className}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showRecent ? (
      <div className="relative shrink-0">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || Boolean(busy)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            if (requireSubscription && !requireSubscription()) return;
            setMenuOpen((v) => !v);
          }}
          className={`${btn} border-amber-400/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20`}
          title={fillCanvas(cs.recentDrawerHint, { max: RECENT_PROJECTS_MAX })}
        >
          <Clock3 className={iconCls} />
          <span className="whitespace-nowrap">
            {busy === "recent"
              ? cs.recentLoadBusy
              : fillCanvas(cs.recentLoad, {
                  count: recent.length,
                  max: RECENT_PROJECTS_MAX,
                })}
          </span>
        </button>
        {recentMenu}
      </div>
      ) : null}

      <button
        type="button"
        disabled={disabled || !canDelete || Boolean(busy)}
        onClick={deleteSelected}
        className={`${btn} border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20`}
        title={cs.delete}
      >
        <Trash2 className={iconCls} />
        {cs.delete}
      </button>
      {showUploads ? (
      <>
      <button
        type="button"
        disabled={disabled || Boolean(busy)}
        onClick={() => originalInputRef.current?.click()}
        className={`${btn} border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
        title={cs.uploadOriginal}
      >
        <Upload className={iconCls} />
        <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
          <span>
            {busy === "original" ? cs.uploadOriginalBusy : cs.uploadOriginal}
          </span>
          {showFormatHint && busy !== "original" ? (
            <span className="text-[8px] font-semibold tracking-tight text-pink-400">
              {PRINT_PHOTO_FORMAT_HINT}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled || Boolean(busy)}
        onClick={() => cutoutInputRef.current?.click()}
        className={`${btn} border-indigo-400/35 bg-indigo-500/10 px-2.5 pr-3 text-indigo-100 hover:bg-indigo-500/20`}
        title={cs.uploadCutout}
      >
        {busy === "cutout" ? (
          <Eraser className={iconCls} />
        ) : (
          <ImagePlus className={iconCls} />
        )}
        <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
          <span>
            {busy === "cutout" ? cs.uploadCutoutBusy : cs.uploadCutout}
          </span>
          {showFormatHint && busy !== "cutout" ? (
            <span className="text-[8px] font-semibold tracking-tight text-pink-400">
              {PRINT_PHOTO_FORMAT_HINT}
            </span>
          ) : null}
        </span>
      </button>
      <input
        ref={originalInputRef}
        type="file"
        accept={PRINT_PHOTO_ACCEPT}
        className="hidden"
        disabled={Boolean(busy)}
        onChange={(e) => pick("original", e.target.files?.[0] ?? null)}
      />
      <input
        ref={cutoutInputRef}
        type="file"
        accept={PRINT_PHOTO_ACCEPT}
        className="hidden"
        disabled={Boolean(busy)}
        onChange={(e) => pick("cutout", e.target.files?.[0] ?? null)}
      />
      </>
      ) : null}
      <span className="sr-only">{selectedId || "none"}</span>
    </div>
  );
}
