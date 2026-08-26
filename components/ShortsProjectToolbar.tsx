"use client";

/**
 * Screen 13 header: recent Shorts projects (max 5) + load editable .sca/.json.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { FolderOpen, History, Loader2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  SHORTS_RECENT_CHANGED_EVENT,
  SHORTS_RECENT_PROJECTS_MAX,
  getShortsRecentProject,
  listShortsRecentProjects,
  type ShortsRecentProjectMeta,
} from "@/lib/shortsRecentProjects";
import type { ShortsStudioProjectV1 } from "@/lib/shortsProjectFile";
import { readShortsProjectFile } from "@/lib/shortsProjectFile";

const MENU_Z = 200;

type Props = {
  busy?: boolean;
  onLoadProject: (project: ShortsStudioProjectV1) => void | Promise<void>;
};

export default function ShortsProjectToolbar({ busy = false, onLoadProject }: Props) {
  const { t } = useI18n();
  const s = t.shorts;
  const [recent, setRecent] = useState<ShortsRecentProjectMeta[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{
    left: number;
    top: number;
    bottom: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshRecent = useCallback(() => {
    setRecent(listShortsRecentProjects());
  }, []);

  useEffect(() => {
    setPortalReady(true);
    refreshRecent();
    const onChanged = () => refreshRecent();
    window.addEventListener(SHORTS_RECENT_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onChanged);
    return () => {
      window.removeEventListener(SHORTS_RECENT_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, [refreshRecent]);

  useLayoutEffect(() => {
    if (!menuOpen || !btnRef.current) {
      setMenuCoords(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    const width = Math.min(320, Math.max(260, rect.width + 120));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setMenuCoords({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      width,
      openUp,
    });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const loadRecent = (id: string) => {
    void (async () => {
      setError(null);
      setLoadingId(id);
      try {
        const project = getShortsRecentProject(id);
        if (!project) {
          setError(s.projectRecentMissing);
          return;
        }
        await onLoadProject(project);
        setMenuOpen(false);
      } catch (err) {
        console.error("[shorts/recent] load", err);
        setError(s.projectLoadError);
      } finally {
        setLoadingId(null);
      }
    })();
  };

  const onFilePicked = (file: File | null) => {
    if (!file) return;
    void (async () => {
      setError(null);
      setFileBusy(true);
      try {
        const project = await readShortsProjectFile(file);
        await onLoadProject(project);
      } catch (err) {
        console.error("[shorts/project] file load", err);
        const msg =
          err instanceof Error && err.message === "not_shorts_project"
            ? s.projectWrongKind
            : s.projectLoadError;
        setError(msg);
      } finally {
        setFileBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    })();
  };

  const count = recent.length;
  const disabled = busy || fileBusy || Boolean(loadingId);

  const recentMenu =
    portalReady && menuOpen && menuCoords
      ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            aria-label={s.projectRecentTitle}
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80">
                {s.projectRecentTitle}
              </p>
              <p className="text-[10px] text-white/40">
                {s.projectRecentHint.replace(
                  "{max}",
                  String(SHORTS_RECENT_PROJECTS_MAX)
                )}
              </p>
            </div>
            {recent.length === 0 ? (
              <p className="px-3 py-3 text-[11px] leading-relaxed text-white/45">
                {s.projectRecentEmpty.replace(
                  "{max}",
                  String(SHORTS_RECENT_PROJECTS_MAX)
                )}
              </p>
            ) : (
              recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => loadRecent(item.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/40">
                    {item.thumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbSrc}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : loadingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                    ) : (
                      <History className="h-3.5 w-3.5 text-white/35" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-white/90">
                      {item.label}
                    </span>
                    {item.videoFileName ? (
                      <span className="block truncate text-[10px] text-white/40">
                        {item.videoFileName}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => {
          refreshRecent();
          setMenuOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/10 disabled:opacity-50"
        title={s.projectRecentTitle}
      >
        <History className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {s.projectRecentButton
            .replace("{count}", String(count))
            .replace("{max}", String(SHORTS_RECENT_PROJECTS_MAX))}
        </span>
        <span className="sm:hidden">
          {s.projectRecentButtonShort
            .replace("{count}", String(count))
            .replace("{max}", String(SHORTS_RECENT_PROJECTS_MAX))}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
        title={s.projectLoadFile}
      >
        {fileBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="hidden md:inline">{s.projectLoadFile}</span>
        <span className="md:hidden">{s.projectLoadFileShort}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".sca,.sca.json,.json,application/octet-stream,application/json"
        className="hidden"
        onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
      />
      {error ? (
        <span className="max-w-[10rem] truncate text-[10px] text-rose-300" title={error}>
          {error}
        </span>
      ) : null}
      {recentMenu}
    </div>
  );
}
