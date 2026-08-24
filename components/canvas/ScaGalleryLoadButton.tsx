"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Images } from "lucide-react";
import { useFeedback } from "@/components/FeedbackProvider";
import { useI18n } from "@/components/I18nProvider";
import { parseStudioProject, type StudioCanvasProjectV1 } from "@/lib/canvas/projectFile";
import { importSecureProject } from "@/lib/projectStorage";
import {
  fetchScaGalleryProjectContent,
  fetchScaGalleryProjects,
  type ScaGalleryProjectMeta,
} from "@/lib/scaGalleryProjects";

type Props = {
  onLoadProject: (project: StudioCanvasProjectV1) => void | Promise<void>;
  requireSubscription?: () => boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

export default function ScaGalleryLoadButton({
  onLoadProject,
  requireSubscription,
  disabled = false,
  compact = false,
  className = "",
}: Props) {
  const { showToast } = useFeedback();
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ScaGalleryProjectMeta[]>([]);
  const [max, setMax] = useState(10);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [isMounted, setIsMounted] = useState(false);

  const btnClass = compact
    ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0E1420] px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
    : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-50";

  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4 shrink-0";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchScaGalleryProjects();
      setProjects(data.projects);
      setMax(data.max);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({
        top: rect.bottom + 6,
        left: Math.max(8, rect.left),
        width: Math.max(280, rect.width),
      });
    }
  }, [open, refresh]);

  const handlePick = async (meta: ScaGalleryProjectMeta) => {
    if (requireSubscription && !requireSubscription()) return;
    setBusy(true);
    try {
      const sealed = await fetchScaGalleryProjectContent(meta.id);
      const raw = await importSecureProject(sealed);
      const project = parseStudioProject(raw);
      await onLoadProject(project);
      setOpen(false);
      showToast(cs.loadFromGalleryDone, "success");
    } catch (err) {
      console.warn("[ScaGalleryLoadButton] load failed", err);
      showToast(cs.loadFromGalleryFailed, "error");
    } finally {
      setBusy(false);
    }
  };

  const menu =
    open && coords && isMounted
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="close"
              className="fixed inset-0 z-[9998] cursor-default bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[9999] max-h-[min(320px,50vh)] overflow-y-auto rounded-xl border border-white/10 bg-navy/95 p-2 shadow-2xl backdrop-blur-xl"
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }}
            >
              <p className="px-2 py-1.5 text-[11px] font-semibold text-white/50">
                {cs.loadFromGalleryTitle.replace("{max}", String(max))}
              </p>
              {loading ? (
                <p className="px-2 py-4 text-center text-xs text-white/40">{cs.loadFromGalleryBusy}</p>
              ) : projects.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-white/40">{cs.loadFromGalleryEmpty}</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePick(p)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/80 hover:bg-white/5 disabled:opacity-50"
                  >
                    {p.thumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbSrc}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] text-white/40">
                        .sca
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  </button>
                ))
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          if (requireSubscription && !requireSubscription()) return;
          setOpen((v) => !v);
        }}
        className={`${btnClass} ${className}`}
      >
        <Images className={iconClass} />
        {cs.loadFromGallery}
      </button>
      {menu}
    </>
  );
}
