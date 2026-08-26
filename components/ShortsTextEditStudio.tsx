"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Check,
  Clapperboard,
  Download,
  Loader2,
  Maximize2,
  Trash2,
  Type,
} from "lucide-react";
import BgmSelectorPanel from "@/components/BgmSelectorPanel";
import ShortsCaptionTimelinePanel from "@/components/ShortsCaptionTimelinePanel";
import ShortsFullStudio from "@/components/ShortsFullStudio";
import ShortsPreviewControlBar from "@/components/ShortsPreviewControlBar";
import { useCredits } from "@/components/CreditsProvider";
import { useI18n } from "@/components/I18nProvider";
import { StickerMoreDropdown } from "@/components/StudioStylePickers";
import {
  createDefaultShortsBgmState,
  type ShortsBgmState,
} from "@/lib/shortsBgm";
import { resolveCaptionStyle } from "@/lib/shortsCaptionPresets";
import {
  DEFAULT_SHORTS_CAPTION_STYLE,
  SHORTS_STT_VERCEL_SAFE_BYTES,
  activeCaptionAt,
  captionTextRuns,
  clampCaptionNorm,
  createCaptionSegment,
  hexToRgba,
  limitCaptionsForRender,
  resolveCaptionBoxColor,
  resolveCaptionStrokeColor,
  resolveCaptionTextColor,
  type ShortsCaptionSegment,
  type ShortsCaptionStyle,
} from "@/lib/shortsCaptions";
import {
  publishShortsToYoutubeAssist,
  uploadShortsToYoutubeApi,
  type YoutubeUploadMeta,
} from "@/lib/shortsYoutubeUpload";
import {
  SHORTS_MASTER_HEIGHT,
  SHORTS_MASTER_WIDTH,
  SHORTS_VIDEO_POS_Y_DEFAULT,
  SHORTS_VIDEO_SCALE_DEFAULT,
  SHORTS_VIDEO_SCALE_MAX,
  SHORTS_VIDEO_SCALE_MIN,
  clampVideoPosY,
  clampVideoScale,
  extractShortsAudioForStt,
  mixShortsVideoWithBgm,
  triggerVideoDownload,
} from "@/lib/shortsFfmpegMix";
import { useShortsProjectStore } from "@/lib/shortsProjectStore";
import {
  buildShortsStudioProject,
  downloadVideoAndShortsProjectLocally,
  sessionFromShortsProject,
  takeShortsProjectForStudio,
  type ShortsStudioProjectV1,
} from "@/lib/shortsProjectFile";
import { pushShortsRecentProject } from "@/lib/shortsRecentProjects";
import {
  loadShortsStudioSession,
  saveShortsStudioSession,
  SHORTS_STUDIO_PATH,
  type ShortsStudioSession,
} from "@/lib/shortsStudioSession";
import { SHORTS_THUMBNAIL_PATH } from "@/lib/shortsThumbnail";
import ShortsProjectToolbar from "@/components/ShortsProjectToolbar";
import {
  SHORTS_BOX_WIDTH_MAX,
  SHORTS_BOX_WIDTH_MIN,
  SHORTS_FONT_PRESETS,
  SHORTS_FONT_WEIGHT_DEFAULT,
  SHORTS_FONT_WEIGHT_MAX,
  SHORTS_FONT_WEIGHT_MIN,
  SHORTS_FONT_WEIGHT_STEP,
  SHORTS_LINE_HEIGHT,
  clampBoxWidth,
  clampFontWeight,
  clampNorm,
  createShortsTextLayer,
  ensurePresetFontLoaded,
  ensureShortsFontsReady,
  exportCaptionOverlayPng,
  exportShortsOverlayPng,
  exportShortsThumbnailPng,
  isFullBleedBoxWidth,
  shortsBorderWidth,
  shortsBoxPad,
  shortsFontPx,
  triggerPngDownload,
  type ShortsTextLayer,
} from "@/lib/shortsStudioExport";
import {
  SHORTS_COLOR_PRESET_ORDER,
  EMOJI_QUICK,
  FONT_PRESET_PRIMARY,
  STICKER_BADGES,
  colorPresetFill,
  colorPresetMeta,
  fontForText,
  swatchNeedsOutline,
  type ColorPreset,
  type FontPreset,
  type StickerBadgeId,
  type TextAlign,
} from "@/lib/thumbnailStyles";

type DragState = {
  layerId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type CaptionDragState = {
  segmentId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type ResizeState = {
  layerId: string;
  pointerId: number;
  edge: "left" | "right";
  startClientX: number;
  startMaxWidth: number;
  startX: number;
};

type CaretRange = { start: number; end: number };

/**
 * Phase-4 Shorts text studio — multi-layer overlays, drag/resize,
 * emoji + sticker pickers, multilingual fonts, PNG export synced to preview.
 */
export default function ShortsTextEditStudio() {
  const { t } = useI18n();
  const router = useRouter();
  const { setShowCreditModal, refreshAccount } = useCredits();
  const [session, setSession] = useState<ShortsStudioSession | null>(null);
  const [ready, setReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  /**
   * Escape hatch: `/shorts/studio?legacy=1` restores the old single-column
   * editor. Default flow opens the hybrid dual studio immediately.
   */
  const [preferLegacySingle, setPreferLegacySingle] = useState(false);
  const [thumbnailLayers, setThumbnailLayers] = useState<ShortsTextLayer[]>(
    () => [createShortsTextLayer({ text: "", y: 0.78 })]
  );
  const [videoLayers, setVideoLayers] = useState<ShortsTextLayer[]>(() => [
    createShortsTextLayer({ text: "", y: 0.78 }),
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeVideoLayerId, setActiveVideoLayerId] = useState<string | null>(
    null
  );
  const [captions, setCaptions] = useState<ShortsCaptionSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<ShortsCaptionStyle>(
    () => ({ ...DEFAULT_SHORTS_CAPTION_STYLE })
  );
  const [fullStudioOpen, setFullStudioOpen] = useState(true);
  const [bindThumbIntro, setBindThumbIntro] = useState(true);
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(null);
  const [youtubeProgress, setYoutubeProgress] = useState(0);
  const [youtubeWatchUrl, setYoutubeWatchUrl] = useState<string | null>(null);
  const [sttAudioBlob, setSttAudioBlob] = useState<Blob | null>(null);
  const [activeCaptionId, setActiveCaptionId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [sttGenerating, setSttGenerating] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewH, setPreviewH] = useState(0);
  const [bgm, setBgmLocal] = useState<ShortsBgmState>(() =>
    createDefaultShortsBgmState()
  );
  const [mixing, setMixing] = useState(false);
  const [mixProgress, setMixProgress] = useState(0);
  const [mixStatus, setMixStatus] = useState<string | null>(null);
  const [mixError, setMixError] = useState<string | null>(null);
  /** Fingerprint of inputs used for the last successful mix (intro burn safety). */
  const lastMixInputKeyRef = useRef<string | null>(null);
  const [videoScale, setVideoScale] = useState(SHORTS_VIDEO_SCALE_DEFAULT);
  const [videoPosY, setVideoPosY] = useState(SHORTS_VIDEO_POS_Y_DEFAULT);

  const mixInputKey = useMemo(
    () =>
      [
        bindThumbIntro ? "1" : "0",
        session?.hook?.imageUrl || "",
        `${videoScale.toFixed(3)}:${videoPosY.toFixed(3)}`,
        bgm.bgmUrl || "",
        String(bgm.bgmVolume),
        thumbnailLayers
          .map(
            (l) =>
              `t:${l.id}:${l.text}:${l.x}:${l.y}:${l.fontSize}:${l.color}:${l.stickerId || ""}:${l.showBox ? 1 : 0}`
          )
          .join("|"),
        videoLayers
          .map(
            (l) =>
              `v:${l.id}:${l.text}:${l.x}:${l.y}:${l.fontSize}:${l.color}:${l.stickerId || ""}:${l.showBox ? 1 : 0}`
          )
          .join("|"),
        captions
          .map((c) => `${c.id}:${c.startSec}:${c.endSec}:${c.text}`)
          .join("|"),
      ].join("::"),
    [
      bgm.bgmUrl,
      bgm.bgmVolume,
      bindThumbIntro,
      captions,
      thumbnailLayers,
      videoLayers,
      session?.hook?.imageUrl,
      videoPosY,
      videoScale,
    ]
  );

  const projectVideoUrl = useShortsProjectStore((s) => s.videoUrl);
  const projectVideoName = useShortsProjectStore((s) => s.videoFileName);
  const mixedVideoUrl = useShortsProjectStore((s) => s.mixedVideoUrl);
  const setMixedVideoUrl = useShortsProjectStore((s) => s.setMixedVideoUrl);
  const setProjectBgm = useShortsProjectStore((s) => s.setBgm);
  const resolveVideoBlob = useShortsProjectStore((s) => s.resolveVideoBlob);
  const hydrateFromAsset = useShortsProjectStore((s) => s.hydrateFromAsset);

  const setBgm = useCallback(
    (next: ShortsBgmState) => {
      setBgmLocal(next);
      setProjectBgm({
        bgmUrl: next.bgmUrl,
        bgmName: next.bgmName,
        bgmVolume: next.bgmVolume,
      });
    },
    [setProjectBgm]
  );

  const previewRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<CaretRange>({ start: 0, end: 0 });
  const dragRef = useRef<DragState | null>(null);
  const captionDragRef = useRef<CaptionDragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    const sess = loadShortsStudioSession();
    setSession(sess);
    setReady(true);
    void ensureShortsFontsReady().then(() => setFontsReady(true));

    try {
      const legacy =
        new URLSearchParams(window.location.search).get("legacy") === "1";
      setPreferLegacySingle(legacy);
      if (legacy) setFullStudioOpen(false);
    } catch {
      /* ignore */
    }

    if (sess) {
      const videoUrl =
        sess.videoUrl || sess.playbackUrl || projectVideoUrl || null;
      const store = useShortsProjectStore.getState();
      if (
        sess.videoId &&
        (!store.videoId || store.videoId !== sess.videoId || !store.videoUrl)
      ) {
        void hydrateFromAsset({
          videoId: sess.videoId,
          fileName: sess.videoFileName || sess.fileName,
          sizeBytes: sess.sizeBytes,
          contentType: sess.contentType,
          previewUrl: videoUrl || "",
          storageKey: sess.storageKey,
          playbackUrl: sess.playbackUrl,
          storage: sess.storage,
        });
      }
      // Restore BGM from global store if already set this session.
      if (store.bgmUrl) {
        setBgmLocal({
          bgmUrl: store.bgmUrl,
          bgmName: store.bgmName,
          bgmVolume: store.bgmVolume,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  /** Dual-studio close → previous step (frame pick), not the legacy single editor. */
  const closeDualStudio = useCallback(() => {
    if (preferLegacySingle) {
      setFullStudioOpen(false);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(SHORTS_THUMBNAIL_PATH);
  }, [preferLegacySingle, router]);

  const applyShortsProject = useCallback(
    async (project: ShortsStudioProjectV1) => {
      const { edit, media } = project;
      setCaptions(edit.captions);
      setCaptionStyle(edit.captionStyle);
      setVideoLayers(edit.videoLayers);
      setThumbnailLayers(edit.thumbnailLayers);
      setBgm(edit.bgm);
      setVideoScale(edit.videoScale);
      setVideoPosY(edit.videoPosY);
      setBindThumbIntro(edit.bindThumbIntro);
      setActiveCaptionId(edit.captions[0]?.id ?? null);
      setActiveVideoLayerId(edit.videoLayers[0]?.id ?? null);
      setActiveId(edit.thumbnailLayers[0]?.id ?? null);
      setMixedVideoUrl(null);
      setMixError(null);
      setError(null);

      const nextSession = sessionFromShortsProject(project);
      setSession(nextSession);
      try {
        saveShortsStudioSession(nextSession);
      } catch {
        /* ignore */
      }

      const videoUrl = media.videoUrl || media.playbackUrl || null;
      if (media.videoId || videoUrl) {
        await hydrateFromAsset({
          videoId: media.videoId || nextSession.videoId,
          fileName: media.videoFileName || media.fileName || "shorts.mp4",
          sizeBytes: media.sizeBytes,
          contentType: media.contentType || "video/mp4",
          previewUrl: videoUrl || "",
          storageKey: media.storageKey,
          playbackUrl: media.playbackUrl || videoUrl,
          storage: media.storage || "local",
        });
      }

      setFullStudioOpen(true);
      setPreferLegacySingle(false);
    },
    [hydrateFromAsset, setBgm, setMixedVideoUrl]
  );

  /** Screen 12 handoff: apply stashed .sca project once studio mounts. */
  const pendingAppliedRef = useRef(false);
  useEffect(() => {
    if (!ready || pendingAppliedRef.current) return;
    const pending = takeShortsProjectForStudio();
    if (!pending) return;
    pendingAppliedRef.current = true;
    void applyShortsProject(pending);
  }, [ready, applyShortsProject]);

  const hasVideoSource = Boolean(
    projectVideoUrl ||
      session?.videoUrl ||
      session?.playbackUrl ||
      session?.videoId
  );
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const measure = () => setPreviewH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [session]);

  useEffect(() => {
    if (!thumbnailLayers.length) {
      if (activeId) setActiveId(null);
      return;
    }
    if (!activeId || !thumbnailLayers.some((l) => l.id === activeId)) {
      setActiveId(thumbnailLayers[0].id);
    }
  }, [thumbnailLayers, activeId]);

  useEffect(() => {
    if (!videoLayers.length) {
      if (activeVideoLayerId) setActiveVideoLayerId(null);
      return;
    }
    if (
      !activeVideoLayerId ||
      !videoLayers.some((l) => l.id === activeVideoLayerId)
    ) {
      setActiveVideoLayerId(videoLayers[0].id);
    }
  }, [videoLayers, activeVideoLayerId]);

  const active = thumbnailLayers.find((l) => l.id === activeId) ?? null;

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    const onTime = () => setPreviewTime(video.currentTime || 0);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onTime);
    onTime();
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onTime);
    };
  }, [projectVideoUrl, session?.videoUrl, session?.playbackUrl]);

  const liveCaption = activeCaptionAt(captions, previewTime);

  useEffect(() => {
    if (!fullStudioOpen || sttAudioBlob || !hasVideoSource) return;
    let cancelled = false;
    void (async () => {
      try {
        const videoBlob = await resolveVideoBlob();
        const wav = await extractShortsAudioForStt(videoBlob);
        if (!cancelled) setSttAudioBlob(wav);
      } catch (err) {
        console.warn("[shorts/studio] waveform prep", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullStudioOpen, sttAudioBlob, hasVideoSource, resolveVideoBlob]);

  // When the active layer's font changes, eagerly load that primary face.
  useEffect(() => {
    if (!active?.fontPreset) return;
    void ensurePresetFontLoaded(active.fontPreset);
  }, [active?.fontPreset]);

  const rememberCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    caretRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    };
  }, []);

  const patchActive = useCallback(
    (partial: Partial<ShortsTextLayer>) => {
      if (!activeId) return;
      setThumbnailLayers((prev) =>
        prev.map((l) => (l.id === activeId ? { ...l, ...partial } : l))
      );
      setExportDone(false);
    },
    [activeId]
  );

  const addLayer = useCallback(() => {
    const next = createShortsTextLayer({
      text: "",
      y: Math.min(0.9, 0.55 + thumbnailLayers.length * 0.08),
      color:
        SHORTS_COLOR_PRESET_ORDER[
          thumbnailLayers.length % SHORTS_COLOR_PRESET_ORDER.length
        ],
    });
    setThumbnailLayers((prev) => [...prev, next]);
    setActiveId(next.id);
    setExportDone(false);
  }, [thumbnailLayers.length]);

  const removeLayer = useCallback((id: string) => {
    setThumbnailLayers((prev) => {
      const next = prev.filter((l) => l.id !== id);
      return next.length ? next : [createShortsTextLayer()];
    });
    setActiveId((cur) => (cur === id ? null : cur));
    setExportDone(false);
  }, []);

  const insertSymbol = useCallback(
    (symbol: string) => {
      if (!active) return;
      const el = textareaRef.current;
      const { start, end } =
        el && document.activeElement === el
          ? { start: el.selectionStart, end: el.selectionEnd }
          : caretRef.current;
      const safeStart = Math.max(0, Math.min(start, active.text.length));
      const safeEnd = Math.max(safeStart, Math.min(end, active.text.length));
      const next =
        active.text.slice(0, safeStart) + symbol + active.text.slice(safeEnd);
      caretRef.current = {
        start: safeStart + symbol.length,
        end: safeStart + symbol.length,
      };
      patchActive({ text: next });
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        const caret = caretRef.current.start;
        ta.setSelectionRange(caret, caret);
      });
    },
    [active, patchActive]
  );

  const toggleSticker = useCallback(
    (id: StickerBadgeId) => {
      if (!active) return;
      patchActive({ stickerId: active.stickerId === id ? null : id });
    },
    [active, patchActive]
  );

  const onLayerPointerDown = (e: React.PointerEvent, layerId: string) => {
    if (resizeRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const layer = thumbnailLayers.find((l) => l.id === layerId);
    if (!layer) return;
    setActiveId(layerId);
    captionDragRef.current = null;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      layerId,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: layer.x,
      startY: layer.y,
    };
  };

  const onCaptionPointerDown = (
    e: React.PointerEvent,
    segmentId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const seg = captions.find((c) => c.id === segmentId);
    if (!seg) return;
    setActiveCaptionId(segmentId);
    dragRef.current = null;
    resizeRef.current = null;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    captionDragRef.current = {
      segmentId,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: seg.x,
      startY: seg.y,
    };
  };

  const onLayerPointerMove = (e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (resize && resize.pointerId === e.pointerId) {
      const rect = previewRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const dx = (e.clientX - resize.startClientX) / rect.width;
      const signed = resize.edge === "right" ? dx : -dx;
      const nextW = clampBoxWidth(resize.startMaxWidth + signed * 2);
      const halfDelta = (nextW - resize.startMaxWidth) / 2;
      const nextX =
        resize.edge === "right"
          ? clampNorm(resize.startX + halfDelta)
          : clampNorm(resize.startX - halfDelta);
      setThumbnailLayers((prev) =>
        prev.map((l) =>
          l.id === resize.layerId ? { ...l, maxWidth: nextW, x: nextX } : l
        )
      );
      setExportDone(false);
      return;
    }

    const capDrag = captionDragRef.current;
    if (capDrag && capDrag.pointerId === e.pointerId) {
      const rect = previewRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const dx = (e.clientX - capDrag.startClientX) / rect.width;
      const dy = (e.clientY - capDrag.startClientY) / rect.height;
      const x = clampCaptionNorm(capDrag.startX + dx);
      const y = clampCaptionNorm(capDrag.startY + dy);
      setCaptions((prev) =>
        prev.map((c) =>
          c.id === capDrag.segmentId ? { ...c, x, y } : c
        )
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const dx = (e.clientX - drag.startClientX) / rect.width;
    const dy = (e.clientY - drag.startClientY) / rect.height;
    const x = clampNorm(drag.startX + dx);
    const y = clampNorm(drag.startY + dy);
    setThumbnailLayers((prev) =>
      prev.map((l) => (l.id === drag.layerId ? { ...l, x, y } : l))
    );
    setExportDone(false);
  };

  const endDrag = (e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (resize && resize.pointerId === e.pointerId) {
      resizeRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    const capDrag = captionDragRef.current;
    if (capDrag && capDrag.pointerId === e.pointerId) {
      captionDragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onResizePointerDown = (
    e: React.PointerEvent,
    layerId: string,
    edge: "left" | "right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = thumbnailLayers.find((l) => l.id === layerId);
    if (!layer) return;
    setActiveId(layerId);
    dragRef.current = null;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    resizeRef.current = {
      layerId,
      pointerId: e.pointerId,
      edge,
      startClientX: e.clientX,
      startMaxWidth: layer.maxWidth,
      startX: layer.x,
    };
  };

  const onExport = useCallback(async () => {
    if (!session) return;
    setExporting(true);
    setError(null);
    setExportDone(false);
    try {
      await ensureShortsFontsReady();
      const blob = await exportShortsThumbnailPng({
        imageUrl: session.hook.imageUrl,
        layers: thumbnailLayers,
      });
      const base =
        session.fileName.replace(/\.[^.]+$/, "") || "shorts-thumbnail";
      triggerPngDownload(blob, `${base}-thumb.png`);
      setExportDone(true);
    } catch (err) {
      console.error("[shorts/studio] export", err);
      setError(t.shorts.studioExportError);
    } finally {
      setExporting(false);
    }
  }, [session, thumbnailLayers, t.shorts.studioExportError]);

  const onGenerateCaptions = useCallback(async () => {
    setSttError(null);
    if (!hasVideoSource) {
      setSttError(t.shorts.studioMixNeedVideo);
      return;
    }
    setSttGenerating(true);
    try {
      const videoBlob = await resolveVideoBlob();
      const originalName =
        projectVideoName ||
        session?.videoFileName ||
        session?.fileName ||
        "shorts.mp4";

      let uploadBlob: Blob;
      let fileName = "shorts-audio.wav";
      let sourceKind: "audio" | "video" = "audio";

      try {
        console.info("[shorts/studio] stt extracting audio", {
          videoBytes: videoBlob.size,
          type: videoBlob.type,
        });
        uploadBlob = await extractShortsAudioForStt(videoBlob);
        setSttAudioBlob(uploadBlob);
        fileName = "shorts-audio.wav";
        sourceKind = "audio";
      } catch (extractErr) {
        console.warn("[shorts/studio] stt audio extract failed", extractErr);
        if (videoBlob.size > SHORTS_STT_VERCEL_SAFE_BYTES) {
          setSttError(t.shorts.studioCaptionsPayloadTooLarge);
          return;
        }
        uploadBlob = videoBlob;
        fileName = originalName.match(/\.[A-Za-z0-9]{2,5}$/)
          ? originalName.replace(/[^\w.\-]+/g, "_").slice(0, 80)
          : "shorts-fallback.mp4";
        sourceKind = "video";
      }

      if (uploadBlob.size > SHORTS_STT_VERCEL_SAFE_BYTES) {
        setSttError(t.shorts.studioCaptionsPayloadTooLarge);
        return;
      }

      const form = new FormData();
      form.append("file", uploadBlob, fileName);
      form.append("fileName", fileName);
      form.append("mimeType", uploadBlob.type || "audio/wav");
      form.append("sourceKind", sourceKind);
      form.append("originalVideoName", originalName.slice(0, 120));

      console.info("[shorts/studio] stt upload", {
        fileName,
        mimeType: uploadBlob.type,
        bytes: uploadBlob.size,
        sourceKind,
      });

      const res = await fetch("/api/shorts/stt", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        segments?: ShortsCaptionSegment[];
        message?: string;
        detail?: string;
      };

      if (data.detail || data.code) {
        console.error("[shorts/studio] stt response error", {
          status: res.status,
          error: data.error,
          code: data.code,
          detail: data.detail,
          message: data.message,
        });
      }

      if (res.status === 401 || data.error === "authentication required") {
        setShowCreditModal(true);
        void refreshAccount();
        setSttError(t.shorts.studioCaptionsInsufficient);
        return;
      }
      if (res.status === 503 || data.error === "stt_unavailable") {
        setSttError(t.shorts.studioCaptionsUnavailable);
        return;
      }
      if (
        res.status === 413 ||
        data.error === "payload_too_large" ||
        data.error === "file_too_large"
      ) {
        setSttError(t.shorts.studioCaptionsPayloadTooLarge);
        void refreshAccount();
        return;
      }
      if (!res.ok) {
        setSttError(t.shorts.studioCaptionsError);
        void refreshAccount();
        return;
      }
      const next = (data.segments || []).map((s) =>
        createCaptionSegment({
          id: s.id,
          text: s.text,
          startSec: s.startSec,
          endSec: s.endSec,
          x: s.x,
          y: s.y,
          highlights: s.highlights,
          stylePresetId: s.stylePresetId,
        })
      );
      if (!next.length) {
        setSttError(t.shorts.studioCaptionsEmptyResult);
        void refreshAccount();
        return;
      }
      setCaptions(next);
      setActiveCaptionId(next[0]?.id ?? null);
      setFullStudioOpen(true);
      void refreshAccount();
    } catch (err) {
      console.error("[shorts/studio] stt", err);
      setSttError(t.shorts.studioCaptionsError);
    } finally {
      setSttGenerating(false);
    }
  }, [
    hasVideoSource,
    projectVideoName,
    refreshAccount,
    resolveVideoBlob,
    session?.fileName,
    session?.videoFileName,
    setShowCreditModal,
    t.shorts.studioCaptionsEmptyResult,
    t.shorts.studioCaptionsError,
    t.shorts.studioCaptionsInsufficient,
    t.shorts.studioCaptionsPayloadTooLarge,
    t.shorts.studioCaptionsUnavailable,
    t.shorts.studioMixNeedVideo,
  ]);

  const onSelectCaption = useCallback((id: string) => {
    setActiveCaptionId(id);
    const seg = captions.find((c) => c.id === id);
    const video = previewVideoRef.current;
    if (seg && video) {
      try {
        video.currentTime = Math.max(0, seg.startSec + 0.01);
      } catch {
        /* ignore */
      }
    }
  }, [captions]);

  const onPolishCaptions = useCallback(async () => {
    if (!captions.length) return;
    setPolishing(true);
    setSttError(null);
    try {
      const res = await fetch("/api/shorts/captions/polish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: captions, language: "ko" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        segments?: ShortsCaptionSegment[];
      };
      if (!res.ok) {
        setSttError(t.shorts.studioCaptionsPolishError);
        return;
      }
      const next = (data.segments || []).map((s) =>
        createCaptionSegment({
          ...s,
          highlights: s.highlights,
        })
      );
      if (next.length) setCaptions(next);
    } catch (err) {
      console.error("[shorts/studio] polish", err);
      setSttError(t.shorts.studioCaptionsPolishError);
    } finally {
      setPolishing(false);
    }
  }, [captions, t.shorts.studioCaptionsPolishError]);

  const onMixRender = useCallback(async (opts?: { autoDownload?: boolean }) => {
    const autoDownload = opts?.autoDownload !== false;
    setMixError(null);
    setMixStatus(null);
    if (!hasVideoSource) {
      setMixError(t.shorts.studioMixNeedVideo);
      return;
    }
    setMixing(true);
    setMixProgress(0);
    try {
      setMixStatus(t.shorts.studioMixLoadingVideo);
      const videoBlob = await resolveVideoBlob();

      setMixStatus(t.shorts.studioMixCapturingOverlay);
      const overlayPng = await exportShortsOverlayPng({
        layers: videoLayers,
        width: SHORTS_MASTER_WIDTH,
        height: SHORTS_MASTER_HEIGHT,
      });

      const capped = limitCaptionsForRender(captions);
      const captionOverlays = await Promise.all(
        capped.map(async (seg) => {
          const style = resolveCaptionStyle(
            seg.stylePresetId,
            captionStyle,
            seg
          );
          return {
            png: await exportCaptionOverlayPng({
              text: seg.text,
              x: seg.x,
              y: seg.y,
              width: SHORTS_MASTER_WIDTH,
              height: SHORTS_MASTER_HEIGHT,
              highlights: seg.highlights,
              style,
            }),
            startSec: seg.startSec,
            endSec: seg.endSec,
          };
        })
      );

      // Optional thumbnail still as intro (0–0.45s) so first frame matches YouTube thumb.
      if (bindThumbIntro && session?.hook?.imageUrl) {
        try {
          const introBlob = await exportShortsThumbnailPng({
            imageUrl: session.hook.imageUrl,
            layers: thumbnailLayers,
          });
          captionOverlays.unshift({
            png: introBlob,
            startSec: 0,
            endSec: 1,
          });
        } catch (err) {
          console.warn("[shorts/studio] intro thumb skip", err);
        }
      }

      setMixStatus(t.shorts.studioMixing);
      const mixed = await mixShortsVideoWithBgm({
        videoBlob,
        bgmUrl: bgm.bgmUrl || null,
        bgmVolume: bgm.bgmVolume,
        overlayPng,
        captions: captionOverlays,
        layout: { scale: videoScale, posY: videoPosY },
        onProgress: (p) => {
          setMixProgress(p.ratio);
          if (p.message === "loading_engine") {
            setMixStatus(t.shorts.studioMixLoadingEngine);
          } else if (
            p.message === "loading_files" ||
            p.message === "loading_bgm" ||
            p.message === "loading_overlay"
          ) {
            setMixStatus(t.shorts.studioMixLoadingVideo);
          } else if (p.message === "mixing" || p.message === "encoding") {
            setMixStatus(t.shorts.studioMixing);
          } else if (p.message === "done") {
            setMixStatus(t.shorts.studioMixDone);
          }
        },
      });
      const url = URL.createObjectURL(mixed);
      setMixedVideoUrl(url);
      lastMixInputKeyRef.current = mixInputKey;
      setMixProgress(100);
      setMixStatus(t.shorts.studioMixDone);

      // Auto-download finished MP4 + editable .sca, and push to recent (max 5).
      if (autoDownload) {
        const base =
          (
            projectVideoName ||
            session?.fileName ||
            session?.videoFileName ||
            "shorts"
          ).replace(/\.[^.]+$/, "") || "shorts";
        const store = useShortsProjectStore.getState();
        const project = buildShortsStudioProject({
          session,
          videoId: store.videoId,
          videoUrl: store.videoUrl,
          videoFileName: store.videoFileName,
          contentType: store.contentType,
          sizeBytes: store.sizeBytes,
          storageKey: store.storageKey,
          storage: store.storage,
          captions,
          captionStyle,
          videoLayers,
          thumbnailLayers,
          bgm,
          videoScale,
          videoPosY,
          bindThumbIntro,
        });
        try {
          await downloadVideoAndShortsProjectLocally({
            videoBlob: mixed,
            project,
            baseName: base,
            videoFileName: bgm.bgmUrl
              ? `${base}-bgm-mix.mp4`
              : `${base}-render.mp4`,
          });
          pushShortsRecentProject(project);
        } catch (err) {
          console.warn("[shorts/studio] project save failed; MP4 only", err);
          triggerVideoDownload(
            mixed,
            bgm.bgmUrl ? `${base}-bgm-mix.mp4` : `${base}-render.mp4`
          );
        }
      }
    } catch (err) {
      console.error("[shorts/studio] mix", err);
      setMixError(t.shorts.studioMixError);
    } finally {
      setMixing(false);
    }
  }, [
    bgm.bgmUrl,
    bgm.bgmVolume,
    bindThumbIntro,
    captionStyle,
    captions,
    hasVideoSource,
    mixInputKey,
    projectVideoName,
    resolveVideoBlob,
    session,
    setMixedVideoUrl,
    thumbnailLayers,
    videoLayers,
    videoPosY,
    videoScale,
    t.shorts.studioMixCapturingOverlay,
    t.shorts.studioMixDone,
    t.shorts.studioMixError,
    t.shorts.studioMixLoadingEngine,
    t.shorts.studioMixLoadingVideo,
    t.shorts.studioMixNeedVideo,
    t.shorts.studioMixing,
  ]);

  const prepareYoutubeAssets = useCallback(async () => {
    let videoOut: Blob | null = null;
    const mixIsCurrent =
      Boolean(mixedVideoUrl) && lastMixInputKeyRef.current === mixInputKey;
    const mustRemix = Boolean(hasVideoSource) && !mixIsCurrent;

    if (mustRemix) {
      await onMixRender({ autoDownload: false });
      const url = useShortsProjectStore.getState().mixedVideoUrl;
      if (url) {
        const res = await fetch(url);
        videoOut = await res.blob();
      }
    } else if (mixedVideoUrl) {
      const res = await fetch(mixedVideoUrl);
      videoOut = await res.blob();
    } else if (hasVideoSource) {
      videoOut = await resolveVideoBlob();
    }

    let thumbOut: Blob | null = null;
    if (session?.hook?.imageUrl) {
      const png = await exportShortsThumbnailPng({
        imageUrl: session.hook.imageUrl,
        layers: thumbnailLayers,
      });
      const bmp = await createImageBitmap(png);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(bmp, 0, 0);
        thumbOut = await new Promise<Blob | null>((resolve) =>
          c.toBlob((b) => resolve(b), "image/jpeg", 0.92)
        );
      }
    }

    return { videoOut, thumbOut };
  }, [
    hasVideoSource,
    mixInputKey,
    mixedVideoUrl,
    onMixRender,
    resolveVideoBlob,
    session?.hook?.imageUrl,
    thumbnailLayers,
  ]);

  const onYoutubeUpload = useCallback(
    async (meta: YoutubeUploadMeta) => {
      setYoutubeBusy(true);
      setYoutubeMessage(null);
      setYoutubeProgress(0);
      setYoutubeWatchUrl(null);
      try {
        const { videoOut, thumbOut } = await prepareYoutubeAssets();
        if (!videoOut || videoOut.size < 1) {
          setYoutubeMessage(t.shorts.youtubeNeedVideo);
          return;
        }

        const result = await uploadShortsToYoutubeApi({
          title: meta.title,
          description: meta.description,
          privacyStatus: meta.privacyStatus,
          videoBlob: videoOut,
          thumbnailBlob: thumbOut,
          onProgress: (pct) => setYoutubeProgress(pct),
        });
        setYoutubeProgress(100);
        setYoutubeWatchUrl(result.watchUrl);
        setYoutubeMessage(t.shorts.youtubeUploadReady);
      } catch (err) {
        console.error("[shorts/studio] youtube", err);
        const code =
          err && typeof err === "object" && "code" in err
            ? String((err as { code?: string }).code || "")
            : "";
        const msg = err instanceof Error ? err.message : "";
        if (code === "not_connected" || msg === "youtube_not_connected") {
          setYoutubeMessage(t.shorts.youtubeNeedConnect);
        } else if (
          code === "oauth_not_configured" ||
          msg === "youtube_oauth_not_configured"
        ) {
          setYoutubeMessage(t.shorts.youtubeNotConfigured);
        } else {
          setYoutubeMessage(
            msg && msg.length < 160 ? msg : t.shorts.youtubeUploadError
          );
        }
      } finally {
        setYoutubeBusy(false);
      }
    },
    [
      prepareYoutubeAssets,
      t.shorts.youtubeNeedConnect,
      t.shorts.youtubeNeedVideo,
      t.shorts.youtubeNotConfigured,
      t.shorts.youtubeUploadError,
      t.shorts.youtubeUploadReady,
    ]
  );

  const onYoutubeAssistFallback = useCallback(async () => {
    setYoutubeBusy(true);
    setYoutubeMessage(null);
    try {
      const { videoOut, thumbOut } = await prepareYoutubeAssets();
      const title =
        videoLayers.find((l) => l.text.trim())?.text.trim().slice(0, 80) ||
        thumbnailLayers.find((l) => l.text.trim())?.text.trim().slice(0, 80) ||
        captions.find((c) => c.text.trim())?.text.trim().slice(0, 80) ||
        "Studio Canvas Shorts";
      const result = await publishShortsToYoutubeAssist({
        title,
        videoBlob: videoOut,
        thumbnailBlob: thumbOut,
        bindThumbIntro,
        baseName: projectVideoName || session?.fileName || "shorts",
      });
      setYoutubeMessage(result.message || t.shorts.youtubeUploadReady);
    } catch (err) {
      console.error("[shorts/studio] youtube assist", err);
      setYoutubeMessage(t.shorts.youtubeUploadError);
    } finally {
      setYoutubeBusy(false);
    }
  }, [
    bindThumbIntro,
    captions,
    prepareYoutubeAssets,
    projectVideoName,
    session?.fileName,
    t.shorts.youtubeUploadError,
    t.shorts.youtubeUploadReady,
    thumbnailLayers,
    videoLayers,
  ]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-16 text-center text-sm text-white/85">
        {t.shorts.studioLoading}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-lg space-y-5 px-3 py-16 text-center">
        <p className="text-sm text-white/90">{t.shorts.studioMissing}</p>
        <p className="text-xs text-white/80">{t.shorts.projectRestoreHint}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ShortsProjectToolbar onLoadProject={applyShortsProject} />
        </div>
        <Link
          href={SHORTS_THUMBNAIL_PATH}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t.shorts.studioBack}
        </Link>
      </div>
    );
  }

  const alignBtn = (value: TextAlign, Icon: typeof AlignLeft) => (
    <button
      type="button"
      disabled={!active}
      onClick={() => patchActive({ align: value })}
      className={`flex flex-1 items-center justify-center rounded-lg py-2 transition disabled:opacity-40 ${
        active?.align === value
          ? "bg-white/15 text-white"
          : "text-white/85 hover:bg-white/5 hover:text-white"
      }`}
      aria-pressed={active?.align === value}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  const frameH = previewH > 0 ? previewH : 533; // 300×9/16 fallback
  const previewVideoUrl =
    projectVideoUrl || session.videoUrl || session.playbackUrl || null;

  return (
    <section
      id="shorts-text-studio"
      className={
        preferLegacySingle
          ? "relative mx-auto max-w-5xl px-3 py-8 sm:px-6 sm:py-12 lg:px-8"
          : "relative h-[100dvh] w-full overflow-hidden px-0 py-0"
      }
      data-path={SHORTS_STUDIO_PATH}
      data-fonts-ready={fontsReady ? "1" : "0"}
      data-dual-direct={preferLegacySingle ? "0" : "1"}
    >
      {preferLegacySingle ? (
        <>
      <div className="ambient-glow -top-16 left-1/3 h-56 w-56 bg-glow-purple/15" />

      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={SHORTS_THUMBNAIL_PATH}
            className="inline-flex items-center gap-1.5 text-xs text-white/85 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t.shorts.studioBack}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/90">
            <Type className="h-3.5 w-3.5 text-glow-violet" aria-hidden />
            {t.shorts.studioEyebrow}
          </div>
        </div>

        <header className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {t.shorts.studioTitle}
          </h1>
          <p className="max-w-2xl text-sm text-white/85">
            {t.shorts.studioSubtitle}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">
          <div className="mx-auto w-full max-w-[300px]">
            {/*
              Single 9:16 stage: video + overlays share this relative box so
              normalized x/y map 1:1 to the shorts canvas (and FFmpeg master).
            */}
            <div
              ref={previewRef}
              className="relative aspect-[9/16] w-full touch-none overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 select-none"
            >
              {/* Video plane (may scale/pan under fixed overlays) */}
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black">
                {previewVideoUrl ? (
                  <div
                    className="absolute"
                    style={{
                      left: "50%",
                      top: `${clampVideoPosY(videoPosY) * 100}%`,
                      width: `${clampVideoScale(videoScale) * 100}%`,
                      height: `${clampVideoScale(videoScale) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <video
                      ref={previewVideoRef}
                      key={previewVideoUrl}
                      src={previewVideoUrl}
                      className="h-full w-full bg-black object-contain"
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.hook.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </div>

              {/* Overlay plane — same bounds as stage; % coords = canvas coords */}
              <div className="absolute inset-0 z-10">
                {thumbnailLayers.map((layer) => {
                  const selected = layer.id === activeId;
                  const fill = colorPresetFill(layer.color);
                  const stroke = colorPresetMeta(layer.color).stroke;
                  const label = layer.text.trim() || t.shorts.studioEmptyLayer;
                  const family = fontForText(
                    layer.fontPreset,
                    layer.text.trim() || "Sample 가A"
                  );
                  const fontPx = shortsFontPx(layer.fontSize, frameH);
                  const boxPad = shortsBoxPad(fontPx);
                  const borderW = shortsBorderWidth(fontPx);
                  const widthPct = clampBoxWidth(layer.maxWidth) * 100;
                  const fullBleed = isFullBleedBoxWidth(layer.maxWidth);
                  const badge = layer.stickerId
                    ? STICKER_BADGES[layer.stickerId]
                    : null;

                  return (
                    <div
                      key={layer.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => onLayerPointerDown(e, layer.id)}
                      onPointerMove={onLayerPointerMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className={`absolute flex cursor-grab touch-none flex-col active:cursor-grabbing ${
                        selected ? "z-20" : "z-10"
                      } ${
                        layer.align === "left"
                          ? "items-start"
                          : layer.align === "right"
                            ? "items-end"
                            : "items-center"
                      }`}
                      style={{
                        left: fullBleed ? 0 : `${layer.x * 100}%`,
                        top: `${layer.y * 100}%`,
                        width: fullBleed ? "100%" : `${widthPct}%`,
                        transform: fullBleed
                          ? "translateY(-50%)"
                          : "translate(-50%, -50%)",
                      }}
                    >
                      {layer.showBox && (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute"
                          style={{
                            inset: `-${boxPad}px`,
                            backgroundColor: `rgba(0,0,0,${layer.boxOpacity})`,
                            borderRadius: fontPx * 0.35,
                            border: layer.showBoxBorder
                              ? `${borderW}px solid rgba(255,255,255,0.88)`
                              : "none",
                            boxSizing: "border-box",
                          }}
                        />
                      )}

                      {badge && (
                        <div
                          className="font-emoji relative mb-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide"
                          style={{
                            backgroundColor: badge.fill,
                            color: badge.textColor,
                            border: `1.5px solid ${badge.stroke}`,
                            boxShadow: `0 0 10px ${badge.glow}`,
                          }}
                        >
                          {badge.emoji ? (
                            <span className="font-emoji" aria-hidden>
                              {badge.emoji}
                            </span>
                          ) : null}
                          {badge.label}
                        </div>
                      )}

                      <span
                        className={`relative block w-full whitespace-pre-wrap break-words ${
                          layer.align === "left"
                            ? "text-left"
                            : layer.align === "right"
                              ? "text-right"
                              : "text-center"
                        } ${selected ? "ring-2 ring-glow-emerald/80 ring-offset-1 ring-offset-black/40" : ""}`}
                        data-font-preset={layer.fontPreset}
                        data-font-primary={FONT_PRESET_PRIMARY[layer.fontPreset]}
                        style={{
                          fontFamily: family,
                          fontWeight: clampFontWeight(
                            layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                          ),
                          fontSize: `${fontPx}px`,
                          lineHeight: SHORTS_LINE_HEIGHT,
                          color: fill,
                          WebkitTextFillColor: fill,
                          textShadow: `0 2px 8px ${colorPresetMeta(layer.color).shadow}`,
                          WebkitTextStroke:
                            stroke !== "transparent"
                              ? `${Math.max(1, fontPx * 0.045)}px ${stroke}`
                              : undefined,
                          paintOrder: "stroke fill",
                          fontVariantEmoji: "emoji",
                        }}
                      >
                        {label}
                        {selected && (
                          <>
                            <span
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={t.shorts.studioBoxWidth}
                              onPointerDown={(e) =>
                                onResizePointerDown(e, layer.id, "left")
                              }
                              onPointerMove={onLayerPointerMove}
                              onPointerUp={endDrag}
                              onPointerCancel={endDrag}
                              className="absolute top-1/2 left-0 z-30 h-8 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-glow-emerald/90 shadow ring-1 ring-black/40"
                            />
                            <span
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={t.shorts.studioBoxWidth}
                              onPointerDown={(e) =>
                                onResizePointerDown(e, layer.id, "right")
                              }
                              onPointerMove={onLayerPointerMove}
                              onPointerUp={endDrag}
                              onPointerCancel={endDrag}
                              className="absolute top-1/2 right-0 z-30 h-8 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-glow-emerald/90 shadow ring-1 ring-black/40"
                            />
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}

                {liveCaption ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) =>
                      onCaptionPointerDown(e, liveCaption.id)
                    }
                    onPointerMove={onLayerPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    className={`absolute z-30 flex w-[90%] max-w-[90%] cursor-grab touch-none flex-col items-center active:cursor-grabbing ${
                      activeCaptionId === liveCaption.id ? "z-40" : ""
                    }`}
                    style={{
                      left: `${liveCaption.x * 100}%`,
                      top: `${liveCaption.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {(() => {
                      const capStyle = resolveCaptionStyle(
                        liveCaption.stylePresetId,
                        captionStyle,
                        liveCaption
                      );
                      const baseFill = resolveCaptionTextColor(capStyle);
                      const hiFill = resolveCaptionTextColor(capStyle, {
                        highlight: true,
                      });
                      const stroke = resolveCaptionStrokeColor(capStyle);
                      const box = resolveCaptionBoxColor(capStyle);
                      const fontPx = shortsFontPx(capStyle.fontSize, frameH);
                      const boxPad = shortsBoxPad(fontPx);
                      return (
                        <span
                          className={`relative box-border block w-full max-w-full whitespace-pre-wrap break-words text-center font-extrabold shadow ${
                            activeCaptionId === liveCaption.id
                              ? "ring-2 ring-glow-emerald/80"
                              : ""
                          }`}
                          style={{
                            fontFamily: fontForText(
                              capStyle.fontPreset,
                              liveCaption.text || "가A"
                            ),
                            fontWeight: clampFontWeight(capStyle.fontWeight),
                            fontSize: `${fontPx}px`,
                            lineHeight: SHORTS_LINE_HEIGHT,
                            color: baseFill,
                            WebkitTextStroke: `${Math.max(0.6, capStyle.strokeWidth * 0.85)}px ${stroke}`,
                            paintOrder: "stroke fill",
                            textShadow: `0 ${capStyle.shadowDepth}px ${6 + capStyle.shadowDepth * 4}px rgba(0,0,0,0.65)`,
                            padding: capStyle.showBox
                              ? `${Math.max(2, Math.round(boxPad * 0.55))}px ${boxPad}px`
                              : undefined,
                            borderRadius: capStyle.showBox
                              ? `${Math.max(4, Math.round(fontPx * 0.35))}px`
                              : undefined,
                            backgroundColor: capStyle.showBox
                              ? hexToRgba(box, capStyle.boxOpacity)
                              : undefined,
                            border:
                              capStyle.showBox && capStyle.showBoxBorder
                                ? `1.5px solid ${stroke}`
                                : undefined,
                          }}
                        >
                          {captionTextRuns(
                            liveCaption.text,
                            liveCaption.highlights
                          ).map((run, i) => (
                            <span
                              key={`${liveCaption.id}-r${i}`}
                              className={
                                run.highlight && capStyle.popKeywords
                                  ? "inline-block origin-center animate-[shorts-cap-pop_0.45s_ease]"
                                  : undefined
                              }
                              style={{
                                color: run.highlight ? hiFill : baseFill,
                                fontSize:
                                  run.highlight && capStyle.popKeywords
                                    ? "1.12em"
                                    : undefined,
                              }}
                            >
                              {run.text}
                            </span>
                          ))}
                        </span>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </div>
            {previewVideoUrl && (
              <ShortsPreviewControlBar
                videoRef={previewVideoRef}
                videoKey={previewVideoUrl}
              />
            )}
            <p className="mt-2 text-center text-[11px] text-white/75">
              {captions.length
                ? t.shorts.studioCaptionsDragHint
                : t.shorts.studioDragHint}
            </p>
          </div>

          <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-white/90">
                {t.thumbnail.layersLabel}
              </p>
              <button
                type="button"
                onClick={addLayer}
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold leading-none text-white transition hover:bg-white/15"
              >
                {t.shorts.studioAddLayer}
              </button>
            </div>

            <ul className="flex flex-wrap gap-2">
              {thumbnailLayers.map((layer, i) => (
                <li key={layer.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(layer.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      layer.id === activeId
                        ? "bg-glow-emerald/20 text-glow-emerald ring-1 ring-glow-emerald/40"
                        : "bg-black/25 text-white/90 hover:text-white"
                    }`}
                  >
                    {t.thumbnail.lineN.replace("{n}", String(i + 1))}
                  </button>
                </li>
              ))}
            </ul>

            {active && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <div className="flex items-start gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={active.text}
                    onChange={(e) => {
                      patchActive({ text: e.target.value });
                      requestAnimationFrame(rememberCaret);
                    }}
                    onSelect={rememberCaret}
                    onKeyUp={rememberCaret}
                    onClick={rememberCaret}
                    onBlur={rememberCaret}
                    placeholder={t.shorts.studioTextPlaceholder}
                    className="min-w-0 flex-1 resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/55 outline-none focus:border-glow-emerald/40 focus:ring-2 focus:ring-glow-emerald/20"
                    style={{
                      fontFamily: fontForText(
                        active.fontPreset,
                        active.text || "Sample 가A"
                      ),
                      fontWeight: clampFontWeight(
                        active.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                      ),
                      fontVariantEmoji: "emoji",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeLayer(active.id)}
                    className="rounded-lg p-2 text-white/80 transition hover:bg-red-500/15 hover:text-red-300"
                    aria-label={t.shorts.studioDeleteLayer}
                    title={t.shorts.studioDeleteLayer}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-white/90">
                    {t.thumbnail.symbolsLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_QUICK.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertSymbol(s)}
                        className="font-emoji rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/80 transition hover:border-white/25 hover:bg-white/5"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <StickerMoreDropdown
                  label={t.thumbnail.stickers}
                  selectedId={active.stickerId}
                  onPick={toggleSticker}
                />

                <div>
                  <p className="mb-2 text-xs font-medium text-white/90">
                    {t.thumbnail.fontLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SHORTS_FONT_PRESETS.map((fp) => (
                      <button
                        key={fp}
                        type="button"
                        onClick={() => {
                          patchActive({ fontPreset: fp as FontPreset });
                          void ensurePresetFontLoaded(fp).then(() => {
                            // Force a paint after the face is available.
                            setFontsReady(true);
                          });
                        }}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                          active.fontPreset === fp
                            ? "bg-white/15 text-white"
                            : "bg-black/20 text-white/85 hover:text-white"
                        }`}
                        style={{
                          fontFamily: `"${FONT_PRESET_PRIMARY[fp]}", ${fontForText(fp, "Sample 가A")}`,
                          fontWeight: 700,
                        }}
                        title={FONT_PRESET_PRIMARY[fp]}
                      >
                        {t.thumbnail.fonts[fp]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-white/90">
                    <span>{t.shorts.studioFontSize}</span>
                    <span className="tabular-nums text-white/80">
                      {active.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={96}
                    step={1}
                    value={active.fontSize}
                    onChange={(e) =>
                      patchActive({ fontSize: Number(e.target.value) })
                    }
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-white/90">
                    {t.shorts.studioAlign}
                  </p>
                  <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    {alignBtn("left", AlignLeft)}
                    {alignBtn("center", AlignCenter)}
                    {alignBtn("right", AlignRight)}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-white/90">
                    <span>{t.shorts.studioFontWeight}</span>
                    <span className="tabular-nums text-white/80">
                      {clampFontWeight(
                        active.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                      )}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={SHORTS_FONT_WEIGHT_MIN}
                    max={SHORTS_FONT_WEIGHT_MAX}
                    step={SHORTS_FONT_WEIGHT_STEP}
                    value={clampFontWeight(
                      active.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                    )}
                    onChange={(e) =>
                      patchActive({
                        fontWeight: clampFontWeight(Number(e.target.value)),
                      })
                    }
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-white/90">
                    <span>{t.shorts.studioBoxWidth}</span>
                    <span className="tabular-nums text-white/80">
                      {Math.round(clampBoxWidth(active.maxWidth) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={SHORTS_BOX_WIDTH_MIN}
                    max={SHORTS_BOX_WIDTH_MAX}
                    step={0.01}
                    value={clampBoxWidth(active.maxWidth)}
                    onChange={(e) =>
                      patchActive({
                        maxWidth: clampBoxWidth(Number(e.target.value)),
                      })
                    }
                    className="w-full accent-emerald-400"
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/80">
                    <span>{t.shorts.studioBgBox}</span>
                    <input
                      type="checkbox"
                      checked={active.showBox}
                      onChange={(e) =>
                        patchActive({ showBox: e.target.checked })
                      }
                      className="h-4 w-4 accent-emerald-400"
                    />
                  </label>
                  {active.showBox && (
                    <>
                      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/80">
                        <span>{t.shorts.studioBgBorder}</span>
                        <input
                          type="checkbox"
                          checked={active.showBoxBorder}
                          onChange={(e) =>
                            patchActive({ showBoxBorder: e.target.checked })
                          }
                          className="h-4 w-4 accent-emerald-400"
                        />
                      </label>
                      <div>
                        <div className="mb-1 flex justify-between text-[11px] text-white/85">
                          <span>{t.shorts.studioBgOpacity}</span>
                          <span>{Math.round(active.boxOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0.15}
                          max={0.9}
                          step={0.05}
                          value={active.boxOpacity}
                          onChange={(e) =>
                            patchActive({ boxOpacity: Number(e.target.value) })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-white/90">
                    {t.shorts.studioColor}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SHORTS_COLOR_PRESET_ORDER.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={t.thumbnail.colors[c]}
                        onClick={() => patchActive({ color: c })}
                        className={`h-8 w-8 rounded-full ring-2 transition ${
                          active.color === c
                            ? "ring-white"
                            : "ring-transparent hover:ring-white/40"
                        }`}
                        style={{
                          backgroundColor: colorPresetFill(c),
                          border: swatchNeedsOutline(c)
                            ? "1px solid #555555"
                            : "1px solid transparent",
                        }}
                        aria-label={t.thumbnail.colors[c]}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold text-white/80">
                {t.shorts.studioVideoLayout}
              </p>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-white/85">
                  <span>{t.shorts.studioVideoScale}</span>
                  <span>{Math.round(clampVideoScale(videoScale) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={SHORTS_VIDEO_SCALE_MIN}
                  max={SHORTS_VIDEO_SCALE_MAX}
                  step={0.01}
                  value={clampVideoScale(videoScale)}
                  onChange={(e) =>
                    setVideoScale(clampVideoScale(Number(e.target.value)))
                  }
                  className="w-full accent-emerald-400"
                  aria-label={t.shorts.studioVideoScale}
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-white/85">
                  <span>{t.shorts.studioVideoPosY}</span>
                  <span>
                    {t.shorts.studioVideoPosYValue.replace(
                      "{n}",
                      String(Math.round(clampVideoPosY(videoPosY) * 100))
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={clampVideoPosY(videoPosY)}
                  onChange={(e) =>
                    setVideoPosY(clampVideoPosY(Number(e.target.value)))
                  }
                  className="w-full accent-emerald-400"
                  aria-label={t.shorts.studioVideoPosY}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFullStudioOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Maximize2 className="h-4 w-4 text-glow-emerald" aria-hidden />
              {t.shorts.fullStudioOpen}
            </button>

            <ShortsCaptionTimelinePanel
              captions={captions}
              activeCaptionId={activeCaptionId}
              currentTime={previewTime}
              generating={sttGenerating}
              error={sttError}
              disabled={!hasVideoSource || mixing}
              onGenerate={() => {
                setFullStudioOpen(true);
                void onGenerateCaptions();
              }}
              onChange={setCaptions}
              onSelect={onSelectCaption}
            />

            <BgmSelectorPanel value={bgm} onChange={setBgm} />

            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/85">
              {hasVideoSource ? (
                <span className="inline-flex items-center gap-1.5 text-glow-emerald/90">
                  <Clapperboard className="h-3.5 w-3.5" aria-hidden />
                  {t.shorts.studioVideoReady.replace(
                    "{name}",
                    projectVideoName ||
                      session.videoFileName ||
                      session.fileName ||
                      "shorts"
                  )}
                </span>
              ) : (
                <span>{t.shorts.studioVideoMissing}</span>
              )}
            </div>

            <button
              type="button"
              disabled={exporting}
              onClick={() => void onExport()}
              className="btn-primary flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold sm:text-base disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : exportDone ? (
                <Check className="h-5 w-5" aria-hidden />
              ) : (
                <Download className="h-5 w-5" aria-hidden />
              )}
              <span>
                {exporting
                  ? t.shorts.studioExporting
                  : exportDone
                    ? t.shorts.studioExportDone
                    : t.shorts.studioExport}
              </span>
            </button>

            <button
              type="button"
              disabled={mixing}
              onClick={() => void onMixRender()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-glow-emerald/40 bg-glow-emerald/10 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-glow-emerald/20 disabled:opacity-60 sm:text-base"
            >
              {mixing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Clapperboard className="h-5 w-5 text-glow-emerald" aria-hidden />
              )}
              <span>
                {mixing
                  ? `${t.shorts.studioMixing} ${mixProgress}%`
                  : t.shorts.studioMixRender}
              </span>
            </button>

            {(mixing || mixProgress > 0) && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-white/85">
                  <span>{mixStatus || t.shorts.studioMixProgress}</span>
                  <span className="tabular-nums">{mixProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-glow-emerald transition-[width] duration-200"
                    style={{ width: `${mixProgress}%` }}
                  />
                </div>
              </div>
            )}

            {mixedVideoUrl && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-xs font-medium text-white/90">
                  {t.shorts.studioMixPreview}
                </p>
                <video
                  key={mixedVideoUrl}
                  src={mixedVideoUrl}
                  controls
                  playsInline
                  className="aspect-[9/16] max-h-[360px] w-full rounded-lg bg-black object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        const res = await fetch(mixedVideoUrl);
                        const blob = await res.blob();
                        const base =
                          (
                            projectVideoName ||
                            session.fileName ||
                            "shorts"
                          ).replace(/\.[^.]+$/, "") || "shorts";
                        triggerVideoDownload(blob, `${base}-bgm-mix.mp4`);
                      } catch (err) {
                        console.error("[shorts/studio] mix download", err);
                        setMixError(t.shorts.studioMixError);
                      }
                    })();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {t.shorts.studioMixDownload}
                </button>
              </div>
            )}

            {(error || mixError) && (
              <p className="text-center text-xs text-red-300" role="alert">
                {mixError || error}
              </p>
            )}
          </div>
        </div>
      </div>
        </>
      ) : !fullStudioOpen ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-12">
          <p className="text-center text-sm text-white/90">
            {t.shorts.fullStudioTitle}
          </p>
          <button
            type="button"
            onClick={() => setFullStudioOpen(true)}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
            {t.shorts.fullStudioOpen}
          </button>
          <Link
            href={SHORTS_THUMBNAIL_PATH}
            className="inline-flex items-center gap-1.5 text-xs text-white/85 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t.shorts.studioBack}
          </Link>
        </div>
      ) : null}

      <ShortsFullStudio
        open={fullStudioOpen}
        onClose={closeDualStudio}
        videoUrl={previewVideoUrl}
        thumbImageUrl={session.hook.imageUrl}
        videoScale={videoScale}
        videoPosY={videoPosY}
        onVideoScaleChange={setVideoScale}
        onVideoPosYChange={setVideoPosY}
        captions={captions}
        onCaptionsChange={setCaptions}
        captionStyle={captionStyle}
        onCaptionStyleChange={setCaptionStyle}
        videoLayers={videoLayers}
        onVideoLayersChange={setVideoLayers}
        activeVideoLayerId={activeVideoLayerId}
        onActiveVideoLayerIdChange={setActiveVideoLayerId}
        thumbnailLayers={thumbnailLayers}
        onThumbnailLayersChange={setThumbnailLayers}
        activeThumbnailLayerId={activeId}
        onActiveThumbnailLayerIdChange={setActiveId}
        bgm={bgm}
        onBgmChange={setBgm}
        audioBlob={sttAudioBlob}
        sttGenerating={sttGenerating}
        sttError={sttError}
        onGenerateStt={() => void onGenerateCaptions()}
        onPolish={() => void onPolishCaptions()}
        polishing={polishing}
        onMixRender={() => {
          void onMixRender({ autoDownload: true });
        }}
        mixing={mixing}
        mixProgress={mixProgress}
        mixStatus={mixStatus}
        mixError={mixError}
        bindThumbIntro={bindThumbIntro}
        onBindThumbIntroChange={setBindThumbIntro}
        onYoutubeUpload={(meta) => void onYoutubeUpload(meta)}
        youtubeBusy={youtubeBusy}
        youtubeMessage={youtubeMessage}
        youtubeProgress={youtubeProgress}
        youtubeWatchUrl={youtubeWatchUrl}
        onYoutubeAssistFallback={() => void onYoutubeAssistFallback()}
        onLoadShortsProject={applyShortsProject}
      />
    </section>
  );
}
