"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Clapperboard,
  Loader2,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Youtube,
} from "lucide-react";
import {
  BgColorDropdown,
  EmojiMoreDropdown,
  StickerMoreDropdown,
} from "@/components/StudioStylePickers";
import BgmSelectorPanel from "@/components/BgmSelectorPanel";
import ShortsCaptionWaveTimeline from "@/components/ShortsCaptionWaveTimeline";
import ShortsPreviewControlBar, {
  SHORTS_PREVIEW_DEFAULT_VOLUME,
} from "@/components/ShortsPreviewControlBar";
import { useI18n } from "@/components/I18nProvider";
import {
  SHORTS_CAPTION_PRESETS,
  resolveCaptionStyle,
  type ShortsCaptionPresetId,
} from "@/lib/shortsCaptionPresets";
import type { ShortsBgmState } from "@/lib/shortsBgm";
import {
  SHORTS_CAPTION_CREDIT_COST,
  DEFAULT_SHORTS_CAPTION_STYLE,
  activeCaptionAt,
  applyCaptionPosPreset,
  applyStylePresetIdToAll,
  applyCaptionVisualPatch,
  captionSegmentAt,
  captionTextRuns,
  clampCaptionNorm,
  createCaptionSegment,
  hexToRgba,
  normalizeHexColor,
  resolveCaptionBoxColor,
  normalizeCaptionEntranceEffect,
  resolveCaptionFontPreset,
  resolveCaptionStrokeColor,
  resolveCaptionTextColor,
  SHORTS_CAPTION_COLOR_CHIPS,
  SHORTS_CAPTION_FONT_SIZE_MAX,
  SHORTS_CAPTION_FONT_SIZE_MIN,
  clampCaptionFontSize,
  splitCaptionAtCaret,
  type ShortsCaptionEntranceEffect,
  type ShortsCaptionSegment,
  type ShortsCaptionStyle,
  type ShortsCaptionPosPreset,
} from "@/lib/shortsCaptions";
import {
  SHORTS_VIDEO_POS_Y_DEFAULT,
  SHORTS_VIDEO_SCALE_DEFAULT,
  SHORTS_VIDEO_SCALE_MAX,
  SHORTS_VIDEO_SCALE_MIN,
  clampVideoPosY,
  clampVideoScale,
} from "@/lib/shortsFfmpegMix";
import {
  SHORTS_BOX_WIDTH_MAX,
  SHORTS_BOX_WIDTH_MIN,
  SHORTS_FONT_PRESETS,
  SHORTS_FONT_WEIGHT_DEFAULT,
  SHORTS_FONT_WEIGHT_MAX,
  SHORTS_FONT_WEIGHT_MIN,
  SHORTS_FONT_WEIGHT_STEP,
  clampBoxWidth,
  clampFontWeight,
  createShortsTextLayer,
  ensurePresetFontLoaded,
  isFullBleedBoxWidth,
  shortsBoxPad,
  shortsFontPx,
  type ShortsTextLayer,
} from "@/lib/shortsStudioExport";
import {
  EMOJI_QUICK,
  FONT_PRESET_PRIMARY,
  SHORTS_CAPTION_FONT_PRESETS,
  SHORTS_COLOR_PRESET_ORDER,
  STICKER_BADGES,
  colorPresetFill,
  colorPresetMeta,
  fontForText,
  swatchNeedsOutline,
  type FontPreset,
  type StickerBadgeId,
  type TextAlign,
} from "@/lib/thumbnailStyles";
import {
  extractWaveformPeaks,
  type ShortsWaveformPeaks,
} from "@/lib/shortsWaveform";
import {
  fetchYoutubeConnectionStatus,
  youtubeConnectUrl,
  type YoutubePrivacyStatus,
  type YoutubeUploadMeta,
} from "@/lib/shortsYoutubeUpload";

/** Thumbnail intro burned at the head of the timeline (0–1s). */
export const SHORTS_THUMB_INTRO_END_SEC = 1;

export type { YoutubeUploadMeta };

type Props = {
  open: boolean;
  onClose: () => void;
  videoUrl: string | null;
  thumbImageUrl: string | null;
  videoScale: number;
  videoPosY: number;
  onVideoScaleChange: (v: number) => void;
  onVideoPosYChange: (v: number) => void;
  captions: ShortsCaptionSegment[];
  onCaptionsChange: (next: ShortsCaptionSegment[]) => void;
  captionStyle: ShortsCaptionStyle;
  onCaptionStyleChange: (next: ShortsCaptionStyle) => void;
  /** Title/text layers burned into the video timeline overlay. */
  videoLayers: ShortsTextLayer[];
  onVideoLayersChange: (next: ShortsTextLayer[]) => void;
  activeVideoLayerId: string | null;
  onActiveVideoLayerIdChange: (id: string | null) => void;
  /** Title/text layers for the thumbnail / intro still only. */
  thumbnailLayers: ShortsTextLayer[];
  onThumbnailLayersChange: (next: ShortsTextLayer[]) => void;
  activeThumbnailLayerId: string | null;
  onActiveThumbnailLayerIdChange: (id: string | null) => void;
  bgm: ShortsBgmState;
  onBgmChange: (next: ShortsBgmState) => void;
  audioBlob: Blob | null;
  sttGenerating: boolean;
  sttError: string | null;
  onGenerateStt: () => void;
  onPolish: () => void;
  polishing: boolean;
  onMixRender: () => void;
  mixing: boolean;
  mixProgress: number;
  mixStatus: string | null;
  mixError: string | null;
  bindThumbIntro: boolean;
  onBindThumbIntroChange: (v: boolean) => void;
  onYoutubeUpload: (meta: YoutubeUploadMeta) => void;
  youtubeBusy: boolean;
  youtubeMessage: string | null;
  youtubeProgress: number;
  youtubeWatchUrl: string | null;
  onYoutubeAssistFallback?: () => void;
};

/**
 * Hybrid dual studio — full-page 9:16 video + thumbnail editor (no floating window).
 * Free editing; only AI STT charges credits (parent-owned).
 */
export default function ShortsFullStudio({
  open,
  onClose,
  videoUrl,
  thumbImageUrl,
  videoScale,
  videoPosY,
  onVideoScaleChange,
  onVideoPosYChange,
  captions,
  onCaptionsChange,
  captionStyle,
  onCaptionStyleChange,
  videoLayers,
  onVideoLayersChange,
  activeVideoLayerId,
  onActiveVideoLayerIdChange,
  thumbnailLayers,
  onThumbnailLayersChange,
  activeThumbnailLayerId,
  onActiveThumbnailLayerIdChange,
  bgm,
  onBgmChange,
  audioBlob,
  sttGenerating,
  sttError,
  onGenerateStt,
  onPolish,
  polishing,
  onMixRender,
  mixing,
  mixProgress,
  mixStatus,
  mixError,
  bindThumbIntro,
  onBindThumbIntroChange,
  onYoutubeUpload,
  youtubeBusy,
  youtubeMessage,
  youtubeProgress,
  youtubeWatchUrl,
  onYoutubeAssistFallback,
}: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    kind: "caption" | "layer";
    /** Which dual stage owns this layer drag (for shared title overlays). */
    host?: "video" | "thumbnail";
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [previewTime, setPreviewTime] = useState(0);
  const [duration, setDuration] = useState(0);
  /** Single source of truth for selected caption across player / timeline / panel. */
  const [activeCapId, setActiveCapId] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<ShortsWaveformPeaks | null>(null);
  const [stageH, setStageH] = useState(0);
  /** Exact video-stage box — caption workspace mirrors this size. */
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const [panelTab, setPanelTab] = useState<"caption" | "thumb" | "youtube">(
    "thumb"
  );
  /**
   * Active dual screen (blinking border): left = video edit, right = thumbnail.
   * Scale / posY sliders + pan only affect this screen's content.
   */
  const [activeScreenId, setActiveScreenId] = useState<"left" | "right">(
    "right"
  );
  const activePreview: "video" | "thumbnail" =
    activeScreenId === "left" ? "video" : "thumbnail";
  /** Independent framing for the right (thumbnail) stage — never shares left video layout. */
  const [thumbScale, setThumbScale] = useState(SHORTS_VIDEO_SCALE_DEFAULT);
  const [thumbPosY, setThumbPosY] = useState(SHORTS_VIDEO_POS_Y_DEFAULT);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [inplaceDraft, setInplaceDraft] = useState("");
  const captionListRef = useRef<HTMLUListElement>(null);
  const captionPanelRef = useRef<HTMLDivElement>(null);
  const panelCapTextRef = useRef<HTMLTextAreaElement>(null);
  const inplaceInputRef = useRef<HTMLTextAreaElement>(null);
  const captionPointerRef = useRef<{
    id: string;
    x0: number;
    y0: number;
    moved: boolean;
  } | null>(null);
  /** One-shot skip after programmatic seek from caption click. */
  const skipPlayheadSyncRef = useRef(false);
  /** True while pointer is over the caption tools panel. */
  const captionPanelHoverRef = useRef(false);
  /** True while focus is inside caption tools (select / color / textarea). */
  const captionPanelFocusRef = useRef(false);
  /**
   * Manual selection pin — playhead must not steal focus while the user is
   * editing styles or until the pin expires after leaving the panel.
   */
  const manualCapPinRef = useRef<{ id: string; until: number } | null>(null);
  const panelCapFocusedRef = useRef(false);
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState(
    "#Shorts #StudioCanvasAI"
  );
  const [ytPrivacy, setYtPrivacy] =
    useState<YoutubePrivacyStatus>("unlisted");
  const [captionFontScope, setCaptionFontScope] = useState<"active" | "all">(
    "all"
  );
  /** After dragging a caption in "all" scope — offer apply-to-all at drop position. */
  const [applyAllPosOffer, setApplyAllPosOffer] = useState<{
    captionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [ytConfigured, setYtConfigured] = useState(false);
  const [ytConnected, setYtConnected] = useState(false);
  const [ytChannelTitle, setYtChannelTitle] = useState<string | null>(null);
  const [ytStatusLoading, setYtStatusLoading] = useState(false);
  const [showYtSuccess, setShowYtSuccess] = useState(false);
  /** Bumps when entrance effect changes so CSS animation can replay without remapping captions. */
  const [entranceAnimTick, setEntranceAnimTick] = useState(0);

  const live = activeCaptionAt(captions, previewTime);
  const playheadSeg = captionSegmentAt(captions, previewTime);
  const activeCap = captions.find((c) => c.id === activeCapId) || null;

  /** Text-edit panel always targets the focused dual preview. */
  const layers =
    activePreview === "video" ? videoLayers : thumbnailLayers;
  const activeLayerId =
    activePreview === "video" ? activeVideoLayerId : activeThumbnailLayerId;
  const onLayersChange =
    activePreview === "video" ? onVideoLayersChange : onThumbnailLayersChange;
  const onActiveLayerIdChange =
    activePreview === "video"
      ? onActiveVideoLayerIdChange
      : onActiveThumbnailLayerIdChange;

  const activeLayer =
    layers.find((l) => l.id === activeLayerId) || layers[0] || null;

  const overlayStyle = useMemo(() => {
    const seg =
      (editingCaptionId
        ? captions.find((c) => c.id === editingCaptionId)
        : null) ||
      live ||
      activeCap;
    return resolveCaptionStyle(
      seg?.stylePresetId || activeCap?.stylePresetId,
      captionStyle,
      seg
    );
  }, [
    activeCap,
    captionStyle,
    captions,
    editingCaptionId,
    live,
  ]);

  // Playhead → active caption (SSOT). Never steal focus while the user is
  // hovering / focusing the caption panel or has a manual pin active.
  useEffect(() => {
    if (editingCaptionId) return;
    if (captionPanelHoverRef.current || captionPanelFocusRef.current) return;
    if (panelCapFocusedRef.current) return;
    if (skipPlayheadSyncRef.current) {
      skipPlayheadSyncRef.current = false;
      return;
    }
    const pin = manualCapPinRef.current;
    if (pin && performance.now() < pin.until) {
      return;
    }
    if (pin && performance.now() >= pin.until) {
      manualCapPinRef.current = null;
    }
    const at = captionSegmentAt(captions, previewTime);
    if (at) {
      if (at.id !== activeCapId) setActiveCapId(at.id);
      return;
    }
    // No segment at playhead: keep selection if still valid, else first caption.
    if (activeCapId && captions.some((c) => c.id === activeCapId)) return;
    setActiveCapId(captions[0]?.id ?? null);
  }, [previewTime, captions, editingCaptionId, activeCapId]);

  // Auto-scroll ONLY the caption <ul> (never the parent tools panel).
  useEffect(() => {
    if (!captions.length || !activeCapId) return;
    if (captionPanelHoverRef.current || captionPanelFocusRef.current) return;
    if (panelCapFocusedRef.current) return;
    const pin = manualCapPinRef.current;
    if (pin && performance.now() < pin.until) return;

    const list = captionListRef.current;
    if (!list) return;
    const el = list.querySelector(
      `[data-cap-id="${activeCapId}"]`
    ) as HTMLElement | null;
    if (!el) return;

    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;
    if (elTop >= viewTop && elBottom <= viewBottom) return;
    const nextTop = Math.max(
      0,
      elTop - Math.max(0, (list.clientHeight - el.offsetHeight) / 2)
    );
    list.scrollTo({ top: nextTop, behavior: "smooth" });
  }, [activeCapId, captions.length]);

  // After AI captions land, jump to caption tools + reveal large workspace.
  const prevCaptionCountRef = useRef(0);
  useEffect(() => {
    const prev = prevCaptionCountRef.current;
    prevCaptionCountRef.current = captions.length;
    if (prev === 0 && captions.length > 0) {
      setPanelTab("caption");
    }
  }, [captions.length]);

  // Full-page shell: Escape closes; lock document scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const pinManualCaption = useCallback((id: string, holdMs = 12_000) => {
    manualCapPinRef.current = {
      id,
      until: performance.now() + holdMs,
    };
  }, []);

  /** Preview focus is independent from the right-side edit tab. */
  const focusPreview = useCallback((which: "video" | "thumbnail") => {
    setActiveScreenId(which === "video" ? "left" : "right");
  }, []);

  const setCaptionPanelHover = useCallback((hovering: boolean) => {
    captionPanelHoverRef.current = hovering;
    if (!hovering) {
      // Keep manual pin briefly after leaving so playhead doesn't yank focus.
      const pin = manualCapPinRef.current;
      if (pin) {
        manualCapPinRef.current = {
          id: pin.id,
          until: performance.now() + 2_500,
        };
      }
      // Resume playhead samples for overlay sync once the user leaves.
      if (!captionPanelFocusRef.current && !panelCapFocusedRef.current) {
        const t = videoRef.current?.currentTime;
        if (typeof t === "number" && Number.isFinite(t)) {
          setPreviewTime(t);
        }
      }
    }
  }, []);

  const onCaptionPanelFocusIn = useCallback(() => {
    captionPanelFocusRef.current = true;
    panelCapFocusedRef.current = true;
  }, []);

  const onCaptionPanelFocusOut = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      captionPanelFocusRef.current = false;
      panelCapFocusedRef.current = false;
      if (!captionPanelHoverRef.current) {
        const t = videoRef.current?.currentTime;
        if (typeof t === "number" && Number.isFinite(t)) {
          setPreviewTime(t);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!editingCaptionId) return;
    const id = window.setTimeout(() => inplaceInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [editingCaptionId]);

  const suggestedYtTitle = useMemo(() => {
    const fromVideo = videoLayers.find((l) => l.text.trim())?.text.trim();
    const fromThumb = thumbnailLayers.find((l) => l.text.trim())?.text.trim();
    const fromCap = captions.find((c) => c.text.trim())?.text.trim();
    return (fromVideo || fromThumb || fromCap || "Studio Canvas Shorts").slice(
      0,
      100
    );
  }, [captions, thumbnailLayers, videoLayers]);

  useEffect(() => {
    if (!open) return;
    setYtTitle((prev) => (prev.trim() ? prev : suggestedYtTitle));
  }, [open, suggestedYtTitle]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("yt") === "connected" || params.get("yt") === "error") {
      setPanelTab("youtube");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setYtStatusLoading(true);
    void fetchYoutubeConnectionStatus()
      .then((s) => {
        if (cancelled) return;
        setYtConfigured(s.configured);
        setYtConnected(s.connected);
        setYtChannelTitle(s.channelTitle);
      })
      .catch(() => {
        if (cancelled) return;
        setYtConfigured(false);
        setYtConnected(false);
        setYtChannelTitle(null);
      })
      .finally(() => {
        if (!cancelled) setYtStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (youtubeWatchUrl) setShowYtSuccess(true);
  }, [youtubeWatchUrl]);

  useEffect(() => {
    if (!open) return;
    void ensurePresetFontLoaded(
      captionStyle.fontPreset || DEFAULT_SHORTS_CAPTION_STYLE.fontPreset
    );
  }, [open, captionStyle.fontPreset]);

  useEffect(() => {
    if (!open || !audioBlob) {
      setPeaks(null);
      return;
    }
    let cancelled = false;
    void extractWaveformPeaks(audioBlob, 280)
      .then((p) => {
        if (!cancelled) setPeaks(p);
      })
      .catch(() => {
        if (!cancelled) setPeaks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, audioBlob]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !open) return;
    video.volume = SHORTS_PREVIEW_DEFAULT_VOLUME;
    const onMeta = () =>
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onSeeked = () => {
      if (
        captionPanelHoverRef.current ||
        captionPanelFocusRef.current ||
        panelCapFocusedRef.current
      ) {
        return;
      }
      setPreviewTime(video.currentTime || 0);
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("seeked", onSeeked);
    onMeta();
    onSeeked();
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [open, videoUrl]);

  // Keep both 9:16 stages the same pixel height (1:1 symmetry).
  useEffect(() => {
    if (!open) return;
    const sync = () => {
      const stageEl = stageRef.current;
      const a = stageEl?.getBoundingClientRect().height || 0;
      const b = thumbRef.current?.getBoundingClientRect().height || 0;
      const h = Math.max(a, b);
      if (h > 0) setStageH(h);
      if (stageEl) {
        const r = stageEl.getBoundingClientRect();
        const w = Math.round(r.width);
        const hh = Math.round(r.height);
        if (w > 0 && hh > 0) {
          setStageBox((prev) =>
            prev.w === w && prev.h === hh ? prev : { w, h: hh }
          );
        }
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (stageRef.current) ro.observe(stageRef.current);
    if (thumbRef.current) ro.observe(thumbRef.current);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [open, captions.length]);

  const seek = useCallback((sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.currentTime = Math.max(0, sec);
    } catch {
      /* ignore */
    }
    setPreviewTime(sec);
  }, []);

  const togglePreviewPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Pause is synchronous for instant Space response; play may be async.
    if (video.paused || video.ended) {
      void video.play().catch((err) => {
        console.warn("[shorts/full-studio] play failed", err);
      });
    } else {
      video.pause();
    }
  }, []);

  const togglePreviewPlaybackRef = useRef(togglePreviewPlayback);
  togglePreviewPlaybackRef.current = togglePreviewPlayback;

  /** Throttled samples from the control bar (~8 Hz) for caption SSOT sync.
   * Skip while the caption tools panel is interactive so select/color UI
   * does not remount / lose focus from parent re-renders. */
  const onPlayheadSample = useCallback((sec: number) => {
    if (
      captionPanelHoverRef.current ||
      captionPanelFocusRef.current ||
      panelCapFocusedRef.current
    ) {
      return;
    }
    setPreviewTime((prev) => (Math.abs(prev - sec) < 0.02 ? prev : sec));
  }, []);

  // Spacebar play/pause anywhere in dual studio (capture + ref = no lag).
  // Typing in text fields → Space inserts whitespace only.
  useEffect(() => {
    if (!open) return;
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      if (el.closest("[contenteditable='true']")) return true;
      if (el.tagName === "TEXTAREA") return true;
      if (el.tagName === "SELECT") return true;
      if (el.tagName === "INPUT") {
        const type = (
          (el as HTMLInputElement).type || "text"
        ).toLowerCase();
        if (
          type === "range" ||
          type === "checkbox" ||
          type === "radio" ||
          type === "button" ||
          type === "submit" ||
          type === "reset" ||
          type === "file" ||
          type === "color" ||
          type === "hidden"
        ) {
          return false;
        }
        return true;
      }
      return Boolean(
        el.closest(
          "textarea, input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='password'], input[type='url'], input[type='tel'], input[type='number'], [contenteditable='true']"
        )
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (isTypingTarget(e.target)) return;
      if (e.repeat) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === "range") {
        try {
          active.blur();
        } catch {
          /* ignore */
        }
      }
      e.preventDefault();
      e.stopPropagation();
      togglePreviewPlaybackRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  const onSelectCap = useCallback(
    (id: string) => {
      setEditingCaptionId(null);
      setActiveCapId(id);
      pinManualCaption(id);
      focusPreview("video");
      const seg = captions.find((c) => c.id === id);
      if (seg) {
        skipPlayheadSyncRef.current = true;
        seek(seg.startSec + 0.01);
      }
    },
    [captions, focusPreview, pinManualCaption, seek]
  );

  const applyPreset = (presetId: ShortsCaptionPresetId) => {
    const preset = SHORTS_CAPTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (activeCapId) pinManualCaption(activeCapId);
    // Keep the user's chosen caption font when swapping style packs.
    onCaptionStyleChange({
      ...preset.style,
      fontPreset: captionStyle.fontPreset,
    });
    onCaptionsChange(
      applyStylePresetIdToAll(captions, presetId).map((c) => ({
        ...c,
        y: preset.y,
        x: 0.5,
        textColor: preset.style.textColor,
        strokeColor: preset.style.strokeColor,
        boxColor: preset.style.boxColor,
      }))
    );
  };

  const applyCaptionFont = useCallback(
    (fontPreset: FontPreset) => {
      void ensurePresetFontLoaded(fontPreset);
      if (activeCapId) pinManualCaption(activeCapId);
      onCaptionStyleChange({ ...captionStyle, fontPreset });
      onCaptionsChange(
        applyCaptionVisualPatch(
          captions,
          { fontPreset },
          { scope: captionFontScope, id: activeCapId }
        )
      );
    },
    [
      activeCapId,
      captionFontScope,
      captionStyle,
      captions,
      onCaptionStyleChange,
      onCaptionsChange,
      pinManualCaption,
    ]
  );

  const applyCaptionColors = useCallback(
    (patch: {
      textColor?: string;
      strokeColor?: string;
      boxColor?: string;
    }) => {
      if (activeCapId) pinManualCaption(activeCapId);
      const nextStyle = {
        ...captionStyle,
        ...(patch.textColor
          ? { textColor: normalizeHexColor(patch.textColor) }
          : {}),
        ...(patch.strokeColor
          ? {
              strokeColor: normalizeHexColor(patch.strokeColor, "#111111"),
            }
          : {}),
        ...(patch.boxColor
          ? { boxColor: normalizeHexColor(patch.boxColor, "#000000") }
          : {}),
      };
      onCaptionStyleChange(nextStyle);
      onCaptionsChange(
        applyCaptionVisualPatch(captions, patch, {
          scope: captionFontScope,
          id: activeCapId,
        })
      );
    },
    [
      activeCapId,
      captionFontScope,
      captionStyle,
      captions,
      onCaptionStyleChange,
      onCaptionsChange,
      pinManualCaption,
    ]
  );

  const applyCaptionFontSize = useCallback(
    (raw: number) => {
      const fontSize = clampCaptionFontSize(raw);
      if (activeCapId) pinManualCaption(activeCapId);
      onCaptionStyleChange({ ...captionStyle, fontSize });
      onCaptionsChange(
        applyCaptionVisualPatch(
          captions,
          { fontSize },
          { scope: captionFontScope, id: activeCapId }
        )
      );
    },
    [
      activeCapId,
      captionFontScope,
      captionStyle,
      captions,
      onCaptionStyleChange,
      onCaptionsChange,
      pinManualCaption,
    ]
  );

  const applyCaptionEntrance = useCallback(
    (entranceEffect: ShortsCaptionEntranceEffect) => {
      const next = normalizeCaptionEntranceEffect(entranceEffect);
      if (next === captionStyle.entranceEffect) return;
      // Style-only update: avoid remapping every caption (that froze the dual studio).
      onCaptionStyleChange({ ...captionStyle, entranceEffect: next });
      setEntranceAnimTick((n) => n + 1);
    },
    [captionStyle, onCaptionStyleChange]
  );

  const patchCaptionTextById = useCallback(
    (id: string, text: string) => {
      onCaptionsChange(
        captions.map((c) =>
          c.id === id ? createCaptionSegment({ ...c, text }) : c
        )
      );
    },
    [captions, onCaptionsChange]
  );

  const patchActiveCapText = (text: string) => {
    if (!activeCap) return;
    patchCaptionTextById(activeCap.id, text);
    if (editingCaptionId === activeCap.id) setInplaceDraft(text);
  };

  const beginInplaceEdit = useCallback(
    (seg: ShortsCaptionSegment) => {
      setActiveCapId(seg.id);
      pinManualCaption(seg.id);
      focusPreview("video");
      setEditingCaptionId(seg.id);
      setInplaceDraft(seg.text);
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
    },
    [focusPreview, pinManualCaption]
  );

  const commitInplaceEdit = useCallback(() => {
    if (!editingCaptionId) return;
    patchCaptionTextById(editingCaptionId, inplaceDraft);
    setEditingCaptionId(null);
  }, [editingCaptionId, inplaceDraft, patchCaptionTextById]);

  const cancelInplaceEdit = useCallback(() => {
    setEditingCaptionId(null);
  }, []);

  const splitActiveCaptionAtCaret = useCallback(() => {
    if (!activeCap) return;
    const el = panelCapTextRef.current;
    const caret =
      el && document.activeElement === el
        ? el.selectionStart ?? activeCap.text.length
        : el?.selectionStart ?? activeCap.text.length;
    const result = splitCaptionAtCaret(
      captions,
      activeCap.id,
      caret,
      duration || peaks?.durationSec || Infinity
    );
    if (!result) return;
    if (editingCaptionId) setEditingCaptionId(null);
    onCaptionsChange(result.captions);
    setActiveCapId(result.nextId);
    pinManualCaption(result.nextId);
    const nextSeg = result.captions.find((c) => c.id === result.nextId);
    if (nextSeg) seek(nextSeg.startSec);
    requestAnimationFrame(() => {
      const ta = panelCapTextRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(0, 0);
    });
  }, [
    activeCap,
    captions,
    duration,
    editingCaptionId,
    onCaptionsChange,
    peaks?.durationSec,
    pinManualCaption,
    seek,
  ]);

  const patchActiveLayer = (partial: Partial<ShortsTextLayer>) => {
    if (!activeLayer) return;
    onLayersChange(
      layers.map((l) =>
        l.id === activeLayer.id ? { ...l, ...partial } : l
      )
    );
  };

  const patchLayerById = (id: string, partial: Partial<ShortsTextLayer>) => {
    onLayersChange(
      layers.map((l) => (l.id === id ? { ...l, ...partial } : l))
    );
  };

  const autoResizeLayerTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(36, el.scrollHeight)}px`;
  };

  const videoPanRef = useRef<{
    pointerId: number;
    startClientY: number;
    startPosY: number;
    moved: boolean;
    host: "video" | "thumbnail";
    hostEl: HTMLElement;
  } | null>(null);

  const onScreenPanPointerDown = (
    e: React.PointerEvent<HTMLElement>,
    host: "video" | "thumbnail"
  ) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "[data-title-layer], [data-cap-overlay], textarea, input, select, button"
      )
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    focusPreview(host);
    const startPosY =
      host === "video"
        ? clampVideoPosY(videoPosY)
        : clampVideoPosY(thumbPosY);
    videoPanRef.current = {
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startPosY,
      moved: false,
      host,
      hostEl: e.currentTarget,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onScreenPanPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const pan = videoPanRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    // Scope isolation: only the captured host container drives its own layout.
    if (e.currentTarget !== pan.hostEl) return;
    const h = pan.hostEl.clientHeight || stageBox.h || 400;
    if (h <= 0) return;
    const deltaY = e.clientY - pan.startClientY;
    if (Math.abs(deltaY) > 3) pan.moved = true;
    const next = clampVideoPosY(pan.startPosY + deltaY / h);
    if (pan.host === "video") {
      onVideoPosYChange(next);
    } else {
      setThumbPosY(next);
    }
  };

  const onScreenPanPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const pan = videoPanRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    if (e.currentTarget !== pan.hostEl) return;
    const moved = pan.moved;
    const host = pan.host;
    videoPanRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // Click without drag on the video stage → play/pause.
    if (!moved && host === "video") {
      togglePreviewPlaybackRef.current();
    }
  };

  const onPointerDownItem = (
    e: React.PointerEvent,
    id: string,
    kind: "caption" | "layer",
    x: number,
    y: number,
    host: "video" | "thumbnail" = "thumbnail"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (kind === "caption") {
      if (editingCaptionId && editingCaptionId !== id) {
        commitInplaceEdit();
      }
      setApplyAllPosOffer(null);
      setActiveCapId(id);
      pinManualCaption(id);
      setActiveScreenId("left");
      captionPointerRef.current = {
        id,
        x0: e.clientX,
        y0: e.clientY,
        moved: false,
      };
    } else {
      if (editingCaptionId) commitInplaceEdit();
      if (host === "video") {
        onActiveVideoLayerIdChange(id);
      } else {
        onActiveThumbnailLayerIdChange(id);
      }
      setActiveScreenId(host === "video" ? "left" : "right");
      captionPointerRef.current = null;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      kind,
      host: kind === "layer" ? host : undefined,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: x,
      startY: y,
    };
  };

  const onPointerMoveItem = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const capPtr = captionPointerRef.current;
    if (capPtr && drag.kind === "caption") {
      const dist = Math.hypot(e.clientX - capPtr.x0, e.clientY - capPtr.y0);
      if (dist > 5) capPtr.moved = true;
    }
    // Don't reposition while in-place editing this caption.
    if (drag.kind === "caption" && editingCaptionId === drag.id) return;
    const hostEl =
      drag.kind === "caption"
        ? stageRef.current
        : drag.host === "video"
          ? stageRef.current
          : thumbRef.current;
    const rect = hostEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const dx = (e.clientX - drag.startClientX) / rect.width;
    const dy = (e.clientY - drag.startClientY) / rect.height;
    const x = clampCaptionNorm(drag.startX + dx);
    const y = clampCaptionNorm(drag.startY + dy);
    if (drag.kind === "caption") {
      onCaptionsChange(
        captions.map((c) => (c.id === drag.id ? { ...c, x, y } : c))
      );
    } else if (drag.host === "video") {
      onVideoLayersChange(
        videoLayers.map((l) => (l.id === drag.id ? { ...l, x, y } : l))
      );
    } else {
      onThumbnailLayersChange(
        thumbnailLayers.map((l) => (l.id === drag.id ? { ...l, x, y } : l))
      );
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const capPtr = captionPointerRef.current;
    const wasClick =
      drag.kind === "caption" &&
      capPtr &&
      capPtr.id === drag.id &&
      !capPtr.moved;
    const wasMoved =
      drag.kind === "caption" &&
      Boolean(capPtr && capPtr.id === drag.id && capPtr.moved);
    const draggedId = drag.id;
    const dragStartX = drag.startX;
    const dragStartY = drag.startY;
    const dragStartClientX = drag.startClientX;
    const dragStartClientY = drag.startClientY;
    dragRef.current = null;
    captionPointerRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (wasClick) {
      setApplyAllPosOffer(null);
      const seg = captions.find((c) => c.id === draggedId);
      if (seg) beginInplaceEdit(seg);
      return;
    }
    if (wasMoved && captionFontScope === "all") {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const x = clampCaptionNorm(
          dragStartX + (e.clientX - dragStartClientX) / rect.width
        );
        const y = clampCaptionNorm(
          dragStartY + (e.clientY - dragStartClientY) / rect.height
        );
        setApplyAllPosOffer({ captionId: draggedId, x, y });
        return;
      }
    }
    setApplyAllPosOffer(null);
  };

  const applyCaptionVAlign = (preset: ShortsCaptionPosPreset) => {
    setApplyAllPosOffer(null);
    if (captionFontScope === "all") {
      onCaptionsChange(captions.map((c) => applyCaptionPosPreset(c, preset)));
      return;
    }
    if (!activeCap) return;
    onCaptionsChange(
      captions.map((c) =>
        c.id === activeCap.id ? applyCaptionPosPreset(c, preset) : c
      )
    );
  };

  const applyDragPosToAll = () => {
    if (!applyAllPosOffer) return;
    const { x, y } = applyAllPosOffer;
    onCaptionsChange(captions.map((c) => ({ ...c, x, y })));
    setApplyAllPosOffer(null);
  };

  const alignBtn = (value: TextAlign, Icon: typeof AlignLeft) => (
    <button
      type="button"
      disabled={!activeLayer}
      onClick={() => patchActiveLayer({ align: value })}
      className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition disabled:opacity-40 ${
        activeLayer?.align === value
          ? "bg-white/15 text-white"
          : "text-white/45 hover:bg-white/5"
      }`}
      aria-pressed={activeLayer?.align === value}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  const overlayFill = resolveCaptionTextColor(overlayStyle);
  const overlayHiFill = resolveCaptionTextColor(overlayStyle, {
    highlight: true,
  });
  const overlayStroke = resolveCaptionStrokeColor(overlayStyle);
  const overlayBox = resolveCaptionBoxColor(overlayStyle);
  const overlayFontPx = shortsFontPx(overlayStyle.fontSize, stageH || 420);
  const overlayBoxPad = shortsBoxPad(overlayFontPx);
  // Prefer playhead segment for canvas (matches timeline); fall back to selection.
  const canvasCap =
    (editingCaptionId
      ? captions.find((c) => c.id === editingCaptionId)
      : null) ||
    live ||
    playheadSeg ||
    activeCap;
  const overlayFontFamily = fontForText(
    overlayStyle.fontPreset,
    canvasCap?.text || "가A"
  );
  /** Shared caption chrome — view + inplace edit must match (no size jump on focus). */
  const captionOverlayTextStyle: CSSProperties = {
    whiteSpace: "pre-wrap",
    fontFamily: overlayFontFamily,
    fontWeight: clampFontWeight(overlayStyle.fontWeight),
    fontSize: `${overlayFontPx}px`,
    color: overlayFill,
    WebkitTextStroke: `${Math.max(0.6, overlayStyle.strokeWidth * 0.85)}px ${overlayStroke}`,
    paintOrder: "stroke fill",
    lineHeight: 1.2,
    textShadow: `0 ${overlayStyle.shadowDepth}px ${6 + overlayStyle.shadowDepth * 4}px rgba(0,0,0,0.7)`,
    padding: `${Math.max(2, Math.round(overlayBoxPad * 0.55))}px ${overlayBoxPad}px`,
    borderRadius: `${Math.max(4, Math.round(overlayFontPx * 0.35))}px`,
    backgroundColor: overlayStyle.showBox
      ? hexToRgba(overlayBox, overlayStyle.boxOpacity)
      : "transparent",
    border:
      overlayStyle.showBox && overlayStyle.showBoxBorder
        ? `1.5px solid ${overlayStroke}`
        : "1.5px solid transparent",
    boxSizing: "border-box",
    transform: "none",
  };
  const captionEntrance = normalizeCaptionEntranceEffect(
    captionStyle.entranceEffect
  );
  const captionEntranceClass =
    captionEntrance === "bounce"
      ? "shorts-cap-entrance-bounce"
      : captionEntrance === "slide"
        ? "shorts-cap-entrance-slide"
        : captionEntrance === "wordHighlight"
          ? "shorts-cap-entrance-word"
          : "";

  const addLayer = () => {
    const next = createShortsTextLayer({
      text: "",
      y: Math.min(0.9, 0.55 + layers.length * 0.08),
      color:
        SHORTS_COLOR_PRESET_ORDER[
          layers.length % SHORTS_COLOR_PRESET_ORDER.length
        ],
    });
    onLayersChange([...layers, next]);
    onActiveLayerIdChange(next.id);
  };

  const deleteLayerById = (id: string) => {
    const next = layers.filter((l) => l.id !== id);
    onLayersChange(next);
    if (activeLayerId === id || !next.some((l) => l.id === activeLayerId)) {
      onActiveLayerIdChange(next[0]?.id ?? null);
    }
  };

  const headerRight = (
    <>
      <button
        type="button"
        disabled={sttGenerating || !videoUrl}
        onClick={onGenerateStt}
        className="inline-flex items-center gap-1 rounded-lg border border-glow-emerald/40 bg-glow-emerald/15 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50"
      >
        {sttGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {t.shorts.studioCaptionsGenerate.replace(
          "{n}",
          String(SHORTS_CAPTION_CREDIT_COST)
        )}
      </button>
      <button
        type="button"
        disabled={polishing || !captions.length}
        onClick={onPolish}
        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
      >
        {polishing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
        {t.shorts.studioCaptionsPolish}
      </button>
      <button
        type="button"
        disabled={mixing}
        onClick={onMixRender}
        className="inline-flex min-w-[7.5rem] items-center justify-center gap-1 rounded-lg bg-glow-emerald/20 px-2.5 py-1.5 text-[11px] font-bold ring-1 ring-glow-emerald/40 disabled:opacity-50"
        aria-busy={mixing}
      >
        {mixing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Clapperboard className="h-3.5 w-3.5" />
        )}
        {mixing
          ? `${mixProgress}%`
          : t.shorts.studioMixRender}
      </button>
      <button
        type="button"
        disabled={youtubeBusy}
        onClick={() => setPanelTab("youtube")}
        className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-[11px] font-bold text-red-100 ring-1 ring-red-400/40 disabled:opacity-50"
      >
        {youtubeBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Youtube className="h-3.5 w-3.5" />
        )}
        {youtubeBusy
          ? `${t.shorts.youtubeUploading} ${youtubeProgress}%`
          : t.shorts.youtubeUpload}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
        {t.shorts.fullStudioClose}
      </button>
    </>
  );

  /** Fit two 9:16 stages into the preview row (capped so timeline stays visible). */
  const stageShellBaseClass =
    "relative min-h-0 max-h-full touch-none overflow-hidden rounded-xl bg-black shadow-lg shadow-black/40 transition-[box-shadow,opacity] duration-150";
  const stageShellActiveClass =
    "ring-2 ring-glow-emerald ring-offset-1 ring-offset-[#0a0c12] shadow-[0_0_0_1px_rgba(52,211,153,0.4),0_0_18px_rgba(52,211,153,0.4)]";
  const stageShellIdleClass = "ring-1 ring-white/12 opacity-[0.9]";
  const stageShellStyle: CSSProperties = {
    aspectRatio: "9 / 16",
    width: "auto",
    height: "min(100%, 100cqh, calc((100cqw - 0.75rem) * 8 / 9))",
    maxHeight: "100%",
    minHeight: 0,
  };

  /**
   * Sticky bottom panel: preview takes leftover (1fr); controls+timeline size
   * to content (auto) and never shrink away under the dual stages.
   */
  const studioBodyGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr) auto",
    gridTemplateColumns: "minmax(0, 1fr)",
    minHeight: 0,
    minWidth: 0,
    flex: "1 1 0%",
    overflow: "hidden",
  };

  const controlPanelWrapperStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: "0.25rem",
    minHeight: "10.5rem",
    height: "auto",
    overflow: "visible",
  };

  const controlPanelRowStyle: CSSProperties = {
    flex: "0 0 auto",
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
    minHeight: 0,
  };

  /** Independent title/text overlays per dual stage (no cross-sync). */
  const renderTitleLayers = (
    host: "video" | "thumbnail",
    hostLayers: ShortsTextLayer[],
    hostActiveId: string | null
  ) =>
    hostLayers.map((layer) => {
      const selected = layer.id === hostActiveId;
      const label = layer.text.trim() || t.shorts.studioEmptyLayer;
      const fontPxL = shortsFontPx(layer.fontSize, stageH || 420);
      const fillL = colorPresetFill(layer.color);
      const colorMeta = colorPresetMeta(layer.color);
      const badge = layer.stickerId
        ? STICKER_BADGES[layer.stickerId]
        : null;
      const fullBleed = isFullBleedBoxWidth(layer.maxWidth);
      return (
        <div
          key={`${host}-${layer.id}`}
          role="button"
          tabIndex={0}
          data-title-layer={layer.id}
          onPointerDown={(e) => {
            focusPreview(host);
            onPointerDownItem(e, layer.id, "layer", layer.x, layer.y, host);
          }}
          onPointerMove={onPointerMoveItem}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className={`pointer-events-auto absolute z-10 flex cursor-grab touch-none flex-col active:cursor-grabbing ${
            selected ? "z-20" : ""
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
            width: fullBleed
              ? "100%"
              : `${clampBoxWidth(layer.maxWidth) * 100}%`,
            transform: fullBleed
              ? "translateY(-50%)"
              : "translate(-50%, -50%)",
          }}
        >
          {badge ? (
            <span
              className="mb-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                background: badge.fill,
                color: badge.textColor,
              }}
            >
              {badge.emoji} {badge.label}
            </span>
          ) : null}
          <span
            className={`relative block w-full whitespace-pre-wrap break-words font-extrabold ${
              layer.showBox
                ? fullBleed
                  ? "rounded-none py-1"
                  : "rounded-md px-2 py-1"
                : ""
            } ${selected ? "ring-2 ring-glow-emerald/70" : ""} ${
              layer.align === "left"
                ? "text-left"
                : layer.align === "right"
                  ? "text-right"
                  : "text-center"
            }`}
            style={{
              fontFamily: fontForText(
                layer.fontPreset,
                layer.text || "가A"
              ),
              fontWeight: clampFontWeight(
                layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
              ),
              fontSize: `${fontPxL}px`,
              color: fillL,
              WebkitTextFillColor: fillL,
              textShadow: `0 2px 8px ${colorMeta.shadow}`,
              backgroundColor: layer.showBox
                ? hexToRgba(
                    layer.boxColor || "#000000",
                    layer.boxOpacity ?? 0.55
                  )
                : undefined,
              border:
                layer.showBox && (layer.showBoxBorder ?? false)
                  ? "1.5px solid rgba(255,255,255,0.88)"
                  : undefined,
              paddingLeft: layer.showBox && fullBleed ? 0 : undefined,
              paddingRight: layer.showBox && fullBleed ? 0 : undefined,
            }}
            data-font-primary={FONT_PRESET_PRIMARY[layer.fontPreset]}
          >
            {label}
          </span>
        </div>
      );
    });

  const captionWorkspaceOpen = captions.length > 0;
  /**
   * Row A — [dual stages | caption WS | sidebar]
   * Row B — control bar + waveform (full width; WS never invades)
   * WS height matches one stage; width is ~25% wider than 9:16 to use left gutter.
   */
  const SIDEBAR_W_PX = 300;
  const CAPTION_WS_MIN_W = 280;
  const WORKSPACE_WIDTH_SCALE = 1.5;
  const workspaceH = Math.max(
    0,
    Math.round(stageBox.h > 0 ? stageBox.h : stageH > 0 ? stageH : 0)
  );
  const workspaceBaseW =
    workspaceH > 0 ? Math.round((workspaceH * 9) / 16) : 0;
  const workspaceW =
    workspaceBaseW > 0
      ? Math.round(workspaceBaseW * WORKSPACE_WIDTH_SCALE)
      : 0;
  const centerColW =
    captionWorkspaceOpen && workspaceW > 0
      ? Math.max(CAPTION_WS_MIN_W, workspaceW + 16)
      : captionWorkspaceOpen
        ? Math.max(CAPTION_WS_MIN_W, Math.round(292 * WORKSPACE_WIDTH_SCALE))
        : 0;
  const mainGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr)",
    gridTemplateColumns:
      captionWorkspaceOpen && centerColW > 0
        ? `minmax(0, 1fr) minmax(${CAPTION_WS_MIN_W}px, ${centerColW}px) ${SIDEBAR_W_PX}px`
        : `minmax(0, 1fr) minmax(${SIDEBAR_W_PX}px, ${SIDEBAR_W_PX}px)`,
  };

  const captionEditorWorkspace = captionWorkspaceOpen ? (
      <div
        ref={captionPanelRef}
        className="box-border flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-xl bg-[#07090f] shadow-lg shadow-black/40 ring-1 ring-white/15"
        style={{
          width: workspaceW > 0 ? workspaceW : "100%",
          height: workspaceH > 0 ? workspaceH : "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          flex: "0 0 auto",
        }}
        onPointerEnter={() => setCaptionPanelHover(true)}
        onPointerLeave={() => setCaptionPanelHover(false)}
        onFocusCapture={onCaptionPanelFocusIn}
        onBlurCapture={onCaptionPanelFocusOut}
        aria-label={t.shorts.captionWorkspaceTitle}
      >
        <div className="box-border w-full shrink-0 border-b border-white/10 px-2.5 py-1.5">
          <p className="truncate text-[11px] font-semibold tracking-wide text-white/90">
            {t.shorts.captionWorkspaceTitle}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-white/40">
            {t.shorts.captionWorkspaceHint}
          </p>
        </div>

        <div className="box-border w-full min-w-0 shrink-0 space-y-1.5 border-b border-white/10 px-2.5 py-1.5">
          {activeCap ? (
            <>
              <p className="truncate text-[10px] font-semibold text-glow-emerald/90">
                #
                {Math.max(
                  1,
                  captions.findIndex((c) => c.id === activeCap.id) + 1
                )}{" "}
                <span className="font-normal text-white/40">
                  {activeCap.startSec.toFixed(1)}s –{" "}
                  {activeCap.endSec.toFixed(1)}s
                </span>
              </p>
              <div className="box-border flex w-full min-w-0 items-stretch gap-2">
                <textarea
                  ref={panelCapTextRef}
                  rows={4}
                  value={activeCap.text}
                  onChange={(e) => patchActiveCapText(e.target.value)}
                  onFocus={() => {
                    panelCapFocusedRef.current = true;
                    captionPanelFocusRef.current = true;
                    if (activeCap.id) pinManualCaption(activeCap.id);
                    setActiveCapId(activeCap.id);
                    if (
                      editingCaptionId &&
                      editingCaptionId !== activeCap.id
                    ) {
                      commitInplaceEdit();
                    }
                    try {
                      videoRef.current?.pause();
                    } catch {
                      /* ignore */
                    }
                  }}
                  onBlur={() => {
                    panelCapFocusedRef.current = false;
                  }}
                  onKeyDown={(e) => {
                    // Never let studio chrome steal Enter / Space while typing captions.
                    e.stopPropagation();
                  }}
                  className="box-border min-h-[5rem] min-w-0 flex-1 resize-y whitespace-pre-wrap rounded-lg border border-white/12 bg-black/50 px-2.5 py-2 text-[12px] leading-relaxed text-white outline-none focus:border-glow-emerald/45 focus:ring-1 focus:ring-glow-emerald/25"
                  style={{ whiteSpace: "pre-wrap" }}
                  aria-label={t.shorts.dualStudioTabCaption}
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // Keep caret position in textarea before button steals focus.
                    e.preventDefault();
                  }}
                  onClick={() => splitActiveCaptionAtCaret()}
                  disabled={!activeCap.text.length}
                  className="box-border inline-flex w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-glow-emerald/35 bg-glow-emerald/15 px-1.5 py-2 text-[10px] font-bold text-glow-emerald transition hover:bg-glow-emerald/25 disabled:opacity-35"
                  aria-label={t.shorts.captionSplit}
                  title={t.shorts.captionSplitHint}
                >
                  <Scissors className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-w-full px-0.5 text-center leading-tight break-keep">
                    {t.shorts.captionSplit}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-white/40">
              {t.shorts.studioCaptionsEmpty}
            </p>
          )}
        </div>

        <ul
          ref={captionListRef}
          className="box-border flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-1.5"
        >
          {captions.map((seg, i) => (
            <li key={seg.id} data-cap-id={seg.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelectCap(seg.id)}
                className={`box-border w-full max-w-full rounded-lg px-2 py-1.5 text-left text-[11px] leading-snug transition ${
                  seg.id === activeCapId
                    ? "bg-glow-emerald/15 text-white ring-1 ring-glow-emerald/40"
                    : playheadSeg?.id === seg.id
                      ? "bg-white/10 text-white/85"
                      : "bg-black/35 text-white/60 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                <span className="mr-1 font-semibold text-white/40">
                  #{i + 1}
                </span>
                <span className="break-words">{seg.text || "…"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
  ) : null;

  if (!open) return null;

  return (
    <div
      role="application"
      aria-label={t.shorts.fullStudioTitle}
      data-studio-shell="full-page"
      className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0b0d14] text-white"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={t.shorts.studioBack}
            title={t.shorts.studioBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{t.shorts.fullStudioTitle}</p>
            {t.shorts.fullStudioSubtitle ? (
              <p className="truncate text-[11px] text-white/45">
                {t.shorts.fullStudioSubtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {headerRight}
        </div>
      </header>

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        onPointerUpCapture={(e) => {
          const t = e.target;
          if (t instanceof HTMLInputElement && t.type === "range") {
            // Drop focus after scrubbing so Space toggles playback, not the slider.
            requestAnimationFrame(() => {
              try {
                t.blur();
              } catch {
                /* ignore */
              }
            });
          }
        }}
      >
        {(sttError || youtubeMessage || mixError) && (
          <p className="shrink-0 border-b border-white/10 bg-black/40 px-3 py-1 text-[10px] text-amber-100">
            {mixError || sttError || youtubeMessage}
          </p>
        )}
        {(mixing || mixProgress > 0) && (
          <div className="shrink-0 space-y-1 border-b border-white/10 bg-glow-emerald/10 px-3 py-1.5">
            <div className="flex items-center justify-between gap-2 text-[10px] text-white/70">
              <span className="truncate">
                {mixStatus || t.shorts.studioMixProgress}
              </span>
              <span className="shrink-0 tabular-nums font-bold text-glow-emerald">
                {mixProgress}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-glow-emerald transition-[width] duration-150"
                style={{ width: `${Math.max(0, Math.min(100, mixProgress))}%` }}
              />
            </div>
          </div>
        )}

        <div style={studioBodyGridStyle} data-studio-body-split="preview-timeline">
          {/* ROW A — dual stages | caption workspace | sidebar */}
          <div
            className="box-border min-h-0 min-w-0 max-h-full overflow-hidden"
            style={mainGridStyle}
          >
            {/* LEFT — dual 9:16 preview stages only (no timeline here) */}
            <section className="box-border flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-white/10 bg-black/25">
              <div
                className="flex min-h-0 min-w-0 flex-1 items-center justify-center gap-3 overflow-hidden px-1.5 py-1"
                style={{ containerType: "size" }}
              >
              <div
                ref={stageRef}
                role="button"
                tabIndex={0}
                data-preview-host="video"
                onPointerDown={(e) => onScreenPanPointerDown(e, "video")}
                onPointerMove={onScreenPanPointerMove}
                onPointerUp={onScreenPanPointerUp}
                onPointerCancel={onScreenPanPointerUp}
                onKeyDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (
                    target?.closest(
                      "textarea, input, select, [contenteditable='true']"
                    )
                  ) {
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusPreview("video");
                  }
                }}
                className={`${stageShellBaseClass} ${
                  activeScreenId === "left"
                    ? stageShellActiveClass
                    : stageShellIdleClass
                }`}
                style={stageShellStyle}
                aria-label={t.shorts.dualStudioVideoPanel}
                aria-pressed={activeScreenId === "left"}
                data-active-screen={activeScreenId === "left" ? "1" : "0"}
              >
                <p className="pointer-events-none absolute left-0 right-0 top-1 z-40 text-center text-[10px] font-semibold tracking-wide text-white/75 drop-shadow">
                  {t.shorts.dualStudioVideoPanel}
                </p>
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                {videoUrl ? (
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
                      ref={videoRef}
                      key={videoUrl}
                      src={videoUrl}
                      className="h-full w-full object-contain"
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-white/35">
                    {t.shorts.studioVideoMissing}
                  </div>
                )}
              </div>
              {/* Transparent pan / click surface (under overlays). */}
              <div
                className="absolute inset-0 z-[5] cursor-ns-resize touch-none bg-transparent"
                aria-hidden
              />
              <div className="absolute inset-0 z-10 pointer-events-none">
                {canvasCap ? (
                  <div
                    role="button"
                    tabIndex={0}
                    data-cap-overlay
                    onPointerDown={(e) => {
                      focusPreview("video");
                      if (editingCaptionId === canvasCap.id) return;
                      onPointerDownItem(
                        e,
                        canvasCap.id,
                        "caption",
                        canvasCap.x,
                        canvasCap.y
                      );
                    }}
                    onPointerMove={onPointerMoveItem}
                    onPointerUp={endPointer}
                    onPointerCancel={endPointer}
                    className={`pointer-events-auto absolute z-30 flex w-[90%] flex-col items-center ${
                      editingCaptionId === canvasCap.id
                        ? "cursor-text"
                        : "cursor-grab touch-none active:cursor-grabbing"
                    } ${
                      canvasCap.id === activeCapId
                        ? "ring-1 ring-glow-emerald/50 rounded-md"
                        : ""
                    }`}
                    style={{
                      left: `${canvasCap.x * 100}%`,
                      top: `${canvasCap.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div
                      key={`enter-${canvasCap.id}-${captionEntrance}-${entranceAnimTick}`}
                      className={
                        editingCaptionId === canvasCap.id
                          ? undefined
                          : captionEntranceClass || undefined
                      }
                      style={
                        editingCaptionId === canvasCap.id
                          ? { transform: "none", animation: "none" }
                          : undefined
                      }
                    >
                    {editingCaptionId === canvasCap.id ? (
                      <textarea
                        ref={inplaceInputRef}
                        rows={Math.max(1, inplaceDraft.split("\n").length)}
                        value={inplaceDraft}
                        onChange={(e) => {
                          setInplaceDraft(e.target.value);
                          patchCaptionTextById(canvasCap.id, e.target.value);
                        }}
                        onBlur={() => commitInplaceEdit()}
                        onKeyDown={(e) => {
                          // Keep Enter/Space inside the textarea (stage role=button must not swallow them).
                          e.stopPropagation();
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInplaceEdit();
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="relative box-border block w-full max-w-full resize-none appearance-none whitespace-pre-wrap break-words text-center font-extrabold outline-none ring-2 ring-glow-emerald/70"
                        style={captionOverlayTextStyle}
                        aria-label={t.shorts.dualStudioTabCaption}
                      />
                    ) : (
                      <span
                        className="relative box-border block w-full max-w-full whitespace-pre-wrap break-words text-center font-extrabold"
                        style={captionOverlayTextStyle}
                      >
                        {captionTextRuns(
                          canvasCap.text,
                          canvasCap.highlights
                        ).map((run, i) => (
                          <span
                            key={`${canvasCap.id}-${i}`}
                            className={
                              run.highlight && overlayStyle.popKeywords
                                ? "inline-block origin-center"
                                : undefined
                            }
                            style={{
                              color: run.highlight ? overlayHiFill : overlayFill,
                              fontSize: "inherit",
                              transform: "none",
                            }}
                          >
                            {run.text}
                          </span>
                        ))}
                        {!canvasCap.text.trim() ? (
                          <span className="text-white/35">…</span>
                        ) : null}
                      </span>
                    )}
                    </div>
                    {applyAllPosOffer &&
                    applyAllPosOffer.captionId === canvasCap.id &&
                    captionFontScope === "all" ? (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          applyDragPosToAll();
                        }}
                        className="absolute -bottom-1 right-0 z-40 translate-y-full rounded-md bg-glow-emerald px-2 py-1 text-[10px] font-bold text-black shadow-lg shadow-black/50 ring-1 ring-glow-emerald/60"
                      >
                        {t.shorts.captionApplyAllPos}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="absolute inset-0 z-[15] pointer-events-none">
                {renderTitleLayers(
                  "video",
                  videoLayers,
                  activeVideoLayerId
                )}
              </div>
              </div>

              <div
                ref={thumbRef}
                role="button"
                tabIndex={0}
                data-preview-host="thumbnail"
                onPointerDown={(e) => onScreenPanPointerDown(e, "thumbnail")}
                onPointerMove={onScreenPanPointerMove}
                onPointerUp={onScreenPanPointerUp}
                onPointerCancel={onScreenPanPointerUp}
                onKeyDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (
                    target?.closest(
                      "textarea, input, select, [contenteditable='true']"
                    )
                  ) {
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusPreview("thumbnail");
                  }
                }}
                className={`${stageShellBaseClass} ${
                  activeScreenId === "right"
                    ? stageShellActiveClass
                    : stageShellIdleClass
                }`}
                style={stageShellStyle}
                aria-label={t.shorts.dualStudioThumbPanel}
                aria-pressed={activeScreenId === "right"}
                data-active-screen={activeScreenId === "right" ? "1" : "0"}
              >
                <p className="pointer-events-none absolute left-0 right-0 top-1 z-40 text-center text-[10px] font-semibold tracking-wide text-white/75 drop-shadow">
                  {t.shorts.dualStudioThumbPanel}
                </p>
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                {thumbImageUrl ? (
                  <div
                    className="absolute"
                    style={{
                      left: "50%",
                      top: `${clampVideoPosY(thumbPosY) * 100}%`,
                      width: `${clampVideoScale(thumbScale) * 100}%`,
                      height: `${clampVideoScale(thumbScale) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-white/35">
                    {t.shorts.studioMissing}
                  </div>
                )}
              </div>
              <div
                className="absolute inset-0 z-[5] cursor-ns-resize touch-none bg-transparent"
                aria-hidden
              />
              {renderTitleLayers(
                "thumbnail",
                thumbnailLayers,
                activeThumbnailLayerId
              )}
              </div>
            </div>
            </section>

            {/* CENTER — caption workspace: min-width protected, never shrinks away */}
            {captionWorkspaceOpen ? (
              <section
                className="box-border flex h-full min-h-0 min-w-[280px] shrink-0 flex-col items-center justify-center overflow-hidden border-r border-white/10 bg-[#05070c] px-2 py-1"
                aria-label={t.shorts.captionWorkspaceTitle}
                data-caption-workspace-col
              >
                {captionEditorWorkspace}
              </section>
            ) : null}

            {/* RIGHT — tools sidebar */}
            <aside className="box-border flex h-full min-h-0 w-full min-w-[300px] shrink-0 flex-col overflow-hidden bg-[#0e111a]">
            <div className="shrink-0 border-b border-white/10 px-2.5 py-1.5">
              <div className="flex gap-1 rounded-lg bg-black/40 p-0.5">
                {(
                  [
                    ["thumb", t.shorts.dualStudioTabThumb],
                    ["caption", t.shorts.dualStudioTabCaption],
                    ["youtube", t.shorts.youtubeUploadPanelTitle],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPanelTab(id);
                    }}
                    className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-2 text-[10px] font-semibold sm:text-xs ${
                      panelTab === id
                        ? id === "youtube"
                          ? "bg-red-500/25 text-red-100"
                          : "bg-glow-emerald/20 text-glow-emerald"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
              {panelTab === "thumb" ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-white/60">
                      {t.thumbnail.layersLabel}
                      <span className="ml-1.5 text-[10px] font-normal text-white/35">
                        (
                        {activePreview === "video"
                          ? t.shorts.dualStudioVideoPanel
                          : t.shorts.dualStudioThumbPanel}
                        )
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={addLayer}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      {t.shorts.studioAddLayer}
                    </button>
                  </div>

                  {layers.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {layers.map((layer, i) => {
                        const selected =
                          layer.id === (activeLayer?.id ?? activeLayerId);
                        return (
                          <li
                            key={layer.id}
                            className={`rounded-xl border p-2.5 transition ${
                              selected
                                ? "border-glow-emerald/45 bg-glow-emerald/5"
                                : "border-white/10 bg-black/25"
                            }`}
                            onClick={() => {
                              onActiveLayerIdChange(layer.id);
                            }}
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  selected
                                    ? "bg-glow-emerald/20 text-glow-emerald"
                                    : "bg-white/10 text-white/60"
                                }`}
                              >
                                {t.thumbnail.lineN.replace(
                                  "{n}",
                                  String(i + 1)
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteLayerById(layer.id);
                                }}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-400/35 bg-red-500/10 text-red-300 transition hover:border-red-400/60 hover:bg-red-500/25 hover:text-red-200"
                                aria-label={t.shorts.studioDeleteLayer}
                                title={t.shorts.studioDeleteLayer}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                            <textarea
                              data-layer-id={layer.id}
                              rows={1}
                              value={layer.text}
                              placeholder={t.shorts.studioTextPlaceholder}
                              onFocus={() => {
                                onActiveLayerIdChange(layer.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                patchLayerById(layer.id, {
                                  text: e.target.value,
                                });
                                autoResizeLayerTextarea(e.currentTarget);
                              }}
                              ref={(node) => {
                                autoResizeLayerTextarea(node);
                              }}
                              className={`w-full resize-none overflow-hidden rounded-lg border bg-black/30 px-2.5 py-1.5 text-sm leading-snug text-white outline-none placeholder:text-white/30 ${
                                selected
                                  ? "border-glow-emerald/50 ring-1 ring-glow-emerald/25"
                                  : "border-white/10 focus:border-glow-emerald/35"
                              }`}
                              style={{
                                fontFamily: fontForText(
                                  layer.fontPreset,
                                  layer.text || "가A"
                                ),
                                fontWeight: clampFontWeight(
                                  layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                                ),
                                fontVariantEmoji: "emoji",
                              }}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-white/40">
                      {t.shorts.studioEmptyLayer}
                    </p>
                  )}

                  {activeLayer ? (
                    <div className="flex flex-col gap-6 border-t border-white/10 pt-4">
                      {/* emoji */}
                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">
                          {t.thumbnail.symbolsLabel}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {EMOJI_QUICK.map((em) => (
                            <button
                              key={em}
                              type="button"
                              className="font-emoji rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/80 transition hover:border-white/25 hover:bg-white/5"
                              onClick={() =>
                                patchActiveLayer({
                                  text: `${activeLayer.text}${em}`,
                                })
                              }
                            >
                              {em}
                            </button>
                          ))}
                          <EmojiMoreDropdown
                            label={t.thumbnail.symbolsMoreLabel}
                            onPick={(symbol) =>
                              patchActiveLayer({
                                text: `${activeLayer.text}${symbol}`,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* stickers — same toggle overlay as “기타” emoji dropdown */}
                      <div className="relative z-10">
                        <StickerMoreDropdown
                          label={t.thumbnail.stickers}
                          selectedId={activeLayer.stickerId}
                          onPick={(id) =>
                            patchActiveLayer({
                              stickerId:
                                activeLayer.stickerId === id
                                  ? null
                                  : (id as StickerBadgeId),
                            })
                          }
                        />
                      </div>

                      {/* fonts */}
                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">
                          {t.thumbnail.fontLabel}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {SHORTS_FONT_PRESETS.map((fp) => (
                            <button
                              key={fp}
                              type="button"
                              onClick={() => {
                                patchActiveLayer({
                                  fontPreset: fp as FontPreset,
                                });
                                void ensurePresetFontLoaded(fp);
                              }}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                                activeLayer.fontPreset === fp
                                  ? "bg-white/15 text-white"
                                  : "bg-black/20 text-white/45 hover:text-white/80"
                              }`}
                              style={{
                                fontFamily: `"${FONT_PRESET_PRIMARY[fp]}", ${fontForText(fp, "가A")}`,
                                fontWeight: 700,
                              }}
                            >
                              {t.thumbnail.fonts[fp]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ⑤ size / weight / align / box */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                          <span>{t.shorts.studioFontSize}</span>
                          <span className="tabular-nums text-white/80">
                            {activeLayer.fontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={18}
                          max={96}
                          step={1}
                          value={activeLayer.fontSize}
                          onChange={(e) =>
                            patchActiveLayer({
                              fontSize: Number(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">
                          {t.shorts.studioAlign}
                        </p>
                        <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          {alignBtn("left", AlignLeft)}
                          {alignBtn("center", AlignCenter)}
                          {alignBtn("right", AlignRight)}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                          <span>{t.shorts.studioFontWeight}</span>
                          <span className="tabular-nums text-white/80">
                            {clampFontWeight(
                              activeLayer.fontWeight ??
                                SHORTS_FONT_WEIGHT_DEFAULT
                            )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={SHORTS_FONT_WEIGHT_MIN}
                          max={SHORTS_FONT_WEIGHT_MAX}
                          step={SHORTS_FONT_WEIGHT_STEP}
                          value={clampFontWeight(
                            activeLayer.fontWeight ??
                              SHORTS_FONT_WEIGHT_DEFAULT
                          )}
                          onChange={(e) =>
                            patchActiveLayer({
                              fontWeight: clampFontWeight(
                                Number(e.target.value)
                              ),
                            })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                          <span>{t.shorts.studioBoxWidth}</span>
                          <span className="tabular-nums text-white/80">
                            {Math.round(
                              clampBoxWidth(activeLayer.maxWidth) * 100
                            )}
                            %
                          </span>
                        </div>
                        <input
                          type="range"
                          min={SHORTS_BOX_WIDTH_MIN}
                          max={SHORTS_BOX_WIDTH_MAX}
                          step={0.01}
                          value={clampBoxWidth(activeLayer.maxWidth)}
                          onChange={(e) =>
                            patchActiveLayer({
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
                            checked={activeLayer.showBox}
                            onChange={(e) =>
                              patchActiveLayer({ showBox: e.target.checked })
                            }
                            className="h-4 w-4 accent-emerald-400"
                          />
                        </label>
                        {activeLayer.showBox ? (
                          <>
                            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/80">
                              <span>{t.shorts.studioBgBorder}</span>
                              <input
                                type="checkbox"
                                checked={activeLayer.showBoxBorder ?? false}
                                onChange={(e) =>
                                  patchActiveLayer({
                                    showBoxBorder: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 accent-emerald-400"
                              />
                            </label>
                            <div>
                              <div className="mb-1 flex justify-between text-[11px] text-white/45">
                                <span>{t.shorts.studioBgOpacity}</span>
                                <span>
                                  {Math.round(
                                    (activeLayer.boxOpacity ?? 0.55) * 100
                                  )}
                                  %
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0.15}
                                max={0.9}
                                step={0.05}
                                value={activeLayer.boxOpacity ?? 0.55}
                                onChange={(e) =>
                                  patchActiveLayer({
                                    boxOpacity: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-emerald-400"
                              />
                            </div>
                          </>
                        ) : null}
                      </div>

                      {/* colors */}
                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">
                          {t.shorts.studioColor}
                        </p>
                        <div className="grid grid-cols-6 gap-2">
                          {SHORTS_COLOR_PRESET_ORDER.map((c) => (
                            <button
                              key={c}
                              type="button"
                              title={t.thumbnail.colors[c]}
                              aria-label={t.thumbnail.colors[c]}
                              onClick={() => {
                                if (!activeLayer) return;
                                patchActiveLayer({ color: c });
                              }}
                              className={`aspect-square w-full max-w-[2rem] justify-self-center rounded-full ring-2 transition ${
                                activeLayer.color === c
                                  ? "ring-white"
                                  : "ring-transparent hover:ring-white/40"
                              }`}
                              style={{
                                backgroundColor: colorPresetFill(c),
                                border: swatchNeedsOutline(c)
                                  ? "1px solid #555555"
                                  : "1px solid transparent",
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* background color */}
                      <div>
                        <p className="mb-2 text-xs font-medium text-white/60">
                          {t.thumbnail.bgColorLabel}
                        </p>
                        <div className="flex flex-col gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-white/70">
                            <input
                              type="checkbox"
                              checked={Boolean(activeLayer.showBox)}
                              onChange={(e) =>
                                patchActiveLayer({
                                  showBox: e.target.checked,
                                })
                              }
                              className="h-3.5 w-3.5 accent-emerald-400"
                            />
                            {t.thumbnail.bgColorEnable}
                          </label>
                          <BgColorDropdown
                            label={t.thumbnail.bgColorLabel}
                            value={activeLayer.boxColor || "#000000"}
                            onChange={(hex) =>
                              patchActiveLayer({
                                boxColor: hex,
                                showBox: true,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white/40">
                      {t.shorts.studioEmptyLayer}
                    </p>
                  )}

                  <label className="flex items-start gap-2 rounded-xl border border-glow-emerald/25 bg-glow-emerald/10 px-3 py-2.5 text-xs text-white/80">
                    <input
                      type="checkbox"
                      checked={bindThumbIntro}
                      onChange={(e) =>
                        onBindThumbIntroChange(e.target.checked)
                      }
                      className="mt-0.5 accent-emerald-400"
                    />
                    <span>
                      {t.shorts.bindThumbIntro}
                      <span className="mt-0.5 block text-[10px] font-normal text-white/40">
                        {t.shorts.bindThumbIntroHint}
                      </span>
                    </span>
                  </label>

                  <div className="border-t border-white/10 pt-2">
                    <BgmSelectorPanel value={bgm} onChange={onBgmChange} />
                  </div>
                </>
              ) : null}

              {panelTab === "caption" ? (
                <div
                  className="flex flex-col gap-6"
                  onPointerEnter={() => setCaptionPanelHover(true)}
                  onPointerLeave={() => setCaptionPanelHover(false)}
                  onFocusCapture={onCaptionPanelFocusIn}
                  onBlurCapture={onCaptionPanelFocusOut}
                >
                  {captionWorkspaceOpen ? (
                    <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-white/50">
                      {t.shorts.captionWorkspaceStylesHint}
                    </p>
                  ) : (
                    <p className="text-xs text-white/40">
                      {t.shorts.studioCaptionsEmpty}
                    </p>
                  )}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/65">
                      {t.shorts.captionFontLabel}
                    </p>
                    <div className="mb-2 flex gap-1 rounded-lg bg-black/40 p-0.5">
                      {(
                        [
                          ["all", t.shorts.captionFontScopeAll],
                          ["active", t.shorts.captionFontScopeActive],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setApplyAllPosOffer(null);
                            setCaptionFontScope(id);
                          }}
                          className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 text-[10px] font-semibold ${
                            captionFontScope === id
                              ? "bg-white/15 text-white"
                              : "text-white/45 hover:text-white/70"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={resolveCaptionFontPreset(activeCap, captionStyle)}
                      onChange={(e) =>
                        applyCaptionFont(e.target.value as FontPreset)
                      }
                      className="w-full rounded-md border border-white/15 bg-black/50 px-2.5 py-2 text-[12px] text-white outline-none ring-glow-emerald/40 focus:ring-1"
                      style={{
                        fontFamily: fontForText(
                          resolveCaptionFontPreset(activeCap, captionStyle),
                          "가A"
                        ),
                        fontWeight: 700,
                      }}
                      aria-label={t.shorts.captionFontLabel}
                    >
                      {SHORTS_CAPTION_FONT_PRESETS.map((fp) => (
                        <option
                          key={fp}
                          value={fp}
                          style={{
                            fontFamily: `"${FONT_PRESET_PRIMARY[fp]}", sans-serif`,
                            fontWeight: 700,
                          }}
                        >
                          {t.shorts.captionFonts[fp]}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["top", t.shorts.studioVAlignTop],
                          ["mid", t.shorts.studioVAlignMiddle],
                          ["bottom", t.shorts.studioVAlignBottom],
                        ] as const
                      ).map(([preset, label]) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyCaptionVAlign(preset)}
                          disabled={
                            captionFontScope === "active" && !activeCap
                          }
                          className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/15 disabled:opacity-40"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/55">
                      <span>{t.shorts.studioFontSize}</span>
                      <span className="tabular-nums text-white/80">
                        {clampCaptionFontSize(overlayStyle.fontSize)}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={SHORTS_CAPTION_FONT_SIZE_MIN}
                      max={SHORTS_CAPTION_FONT_SIZE_MAX}
                      step={1}
                      value={clampCaptionFontSize(overlayStyle.fontSize)}
                      onChange={(e) =>
                        applyCaptionFontSize(Number(e.target.value))
                      }
                      onPointerDown={() => {
                        if (activeCapId) pinManualCaption(activeCapId);
                      }}
                      className="w-full accent-emerald-400"
                      aria-label={t.shorts.studioFontSize}
                    />
                    <p className="mt-1 text-[10px] text-white/35">
                      {t.shorts.captionFontSizeHint}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-white/65">
                      {t.shorts.captionColorTitle}
                    </p>
                    {(
                      [
                        [
                          "text",
                          t.shorts.captionTextColorLabel,
                          resolveCaptionTextColor(overlayStyle),
                          (hex: string) => applyCaptionColors({ textColor: hex }),
                        ],
                        [
                          "stroke",
                          t.shorts.captionStrokeColorLabel,
                          resolveCaptionStrokeColor(overlayStyle),
                          (hex: string) =>
                            applyCaptionColors({ strokeColor: hex }),
                        ],
                        [
                          "box",
                          t.shorts.captionBoxColorLabel,
                          resolveCaptionBoxColor(overlayStyle),
                          (hex: string) => applyCaptionColors({ boxColor: hex }),
                        ],
                      ] as const
                    ).map(([key, label, value, onPick]) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-white/55">
                            {label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={normalizeHexColor(value)}
                              onChange={(e) => onPick(e.target.value)}
                              className="h-7 w-9 cursor-pointer rounded border border-white/20 bg-transparent p-0.5"
                              aria-label={label}
                            />
                            <span className="min-w-[4.5rem] text-[10px] tabular-nums text-white/45">
                              {normalizeHexColor(value)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {SHORTS_CAPTION_COLOR_CHIPS.map((chip) => {
                            const selected =
                              normalizeHexColor(value) ===
                              normalizeHexColor(chip.hex);
                            return (
                              <button
                                key={`${key}-${chip.id}`}
                                type="button"
                                title={chip.hex}
                                onClick={() => onPick(chip.hex)}
                                className={`h-6 w-6 rounded-full border transition ${
                                  selected
                                    ? "ring-2 ring-glow-emerald ring-offset-1 ring-offset-[#0e111a]"
                                    : "border-white/25 hover:scale-105"
                                }`}
                                style={{ backgroundColor: chip.hex }}
                                aria-label={`${label} ${chip.hex}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <label className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                      <span>{t.shorts.captionShowBoxLabel}</span>
                      <input
                        type="checkbox"
                        checked={captionStyle.showBox}
                        onChange={(e) =>
                          onCaptionStyleChange({
                            ...captionStyle,
                            showBox: e.target.checked,
                          })
                        }
                        className="accent-emerald-400"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-white/65">
                      {t.shorts.captionPresetsTitle}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SHORTS_CAPTION_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPreset(p.id)}
                          className={`rounded-md px-2 py-1.5 text-left text-[11px] font-semibold ${
                            activeCap?.stylePresetId === p.id
                              ? "bg-glow-emerald/20 text-glow-emerald ring-1 ring-glow-emerald/40"
                              : "bg-black/30 text-white/65 hover:bg-white/10"
                          }`}
                        >
                          {t.shorts[p.labelKey]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-2 text-xs text-white/70">
                    <span>{t.shorts.studioCaptionsPopToggle}</span>
                    <input
                      type="checkbox"
                      checked={captionStyle.popKeywords}
                      onChange={(e) =>
                        onCaptionStyleChange({
                          ...captionStyle,
                          popKeywords: e.target.checked,
                        })
                      }
                      className="accent-emerald-400"
                    />
                  </label>
                  <div className="border-t border-white/10 pt-2">
                    <BgmSelectorPanel value={bgm} onChange={onBgmChange} />
                  </div>
                </div>
              ) : null}

              {panelTab === "youtube" ? (
                <div className="flex flex-col gap-4">
                  <p className="text-xs font-semibold text-white/80">
                    {t.shorts.youtubeUploadPanelTitle}
                  </p>

                  {ytStatusLoading ? (
                    <p className="flex items-center gap-2 text-[11px] text-white/45">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      …
                    </p>
                  ) : !ytConfigured ? (
                    <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                      {t.shorts.youtubeNotConfigured}
                    </p>
                  ) : ytConnected ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                      <span>
                        {t.shorts.youtubeConnectedAs.replace(
                          "{name}",
                          ytChannelTitle || "YouTube"
                        )}
                      </span>
                      <button
                        type="button"
                        className="text-white/40 underline-offset-2 hover:text-white hover:underline"
                        onClick={() => {
                          void fetch("/api/shorts/youtube/disconnect", {
                            method: "POST",
                            credentials: "include",
                          }).then(() => {
                            setYtConnected(false);
                            setYtChannelTitle(null);
                          });
                        }}
                      >
                        {t.shorts.youtubeDisconnect}
                      </button>
                    </div>
                  ) : (
                    <a
                      href={youtubeConnectUrl()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/25 px-3 py-2.5 text-xs font-bold text-red-50 ring-1 ring-red-400/40"
                    >
                      <Youtube className="h-4 w-4" />
                      {t.shorts.youtubeConnect}
                    </a>
                  )}

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-white/60">
                      {t.shorts.youtubeTitleLabel}
                    </span>
                    <input
                      type="text"
                      value={ytTitle}
                      maxLength={100}
                      onChange={(e) => setYtTitle(e.target.value)}
                      placeholder={t.shorts.youtubeTitlePlaceholder}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-red-400/40"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-white/60">
                      {t.shorts.youtubeDescriptionLabel}
                    </span>
                    <textarea
                      rows={4}
                      value={ytDescription}
                      maxLength={5000}
                      onChange={(e) => setYtDescription(e.target.value)}
                      placeholder={t.shorts.youtubeDescriptionPlaceholder}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-red-400/40"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-white/60">
                      {t.shorts.youtubePrivacyLabel}
                    </span>
                    <select
                      value={ytPrivacy}
                      onChange={(e) =>
                        setYtPrivacy(e.target.value as YoutubePrivacyStatus)
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-red-400/40"
                    >
                      <option value="public">
                        {t.shorts.youtubePrivacyPublic}
                      </option>
                      <option value="unlisted">
                        {t.shorts.youtubePrivacyUnlisted}
                      </option>
                      <option value="private">
                        {t.shorts.youtubePrivacyPrivate}
                      </option>
                    </select>
                  </label>

                  {(youtubeBusy || youtubeProgress > 0) && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-white/55">
                        <span>{t.shorts.youtubeUploading}</span>
                        <span className="tabular-nums font-bold text-red-200">
                          {youtubeProgress}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                        <div
                          className="h-full rounded-full bg-red-400 transition-[width] duration-150"
                          style={{
                            width: `${Math.max(0, Math.min(100, youtubeProgress))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {youtubeMessage ? (
                    <p className="text-[11px] text-amber-100/90">{youtubeMessage}</p>
                  ) : null}

                  <button
                    type="button"
                    disabled={youtubeBusy || !ytConfigured}
                    onClick={() => {
                      if (!ytConnected) {
                        window.location.href = youtubeConnectUrl();
                        return;
                      }
                      onYoutubeUpload({
                        title: ytTitle.trim() || suggestedYtTitle,
                        description: ytDescription,
                        privacyStatus: ytPrivacy,
                      });
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/30 px-4 py-3 text-sm font-bold text-white ring-1 ring-red-400/50 transition hover:bg-red-500/40 disabled:opacity-50"
                  >
                    {youtubeBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Youtube className="h-4 w-4" />
                    )}
                    {youtubeBusy
                      ? `${t.shorts.youtubeUploading} ${youtubeProgress}%`
                      : ytConnected
                        ? t.shorts.youtubeUpload
                        : t.shorts.youtubeConnect}
                  </button>

                  {onYoutubeAssistFallback ? (
                    <button
                      type="button"
                      disabled={youtubeBusy}
                      onClick={onYoutubeAssistFallback}
                      className="w-full text-center text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                    >
                      {t.shorts.youtubeAssistFallback}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
          </div>

          {/* ROW B — sticky control panel: sliders + timeline (content-sized, never clipped) */}
          <div
            className="control-panel-wrapper z-10 border-t border-white/10 bg-black/55 px-1.5 py-1"
            data-studio-control-panel
            style={controlPanelWrapperStyle}
          >
            <div
              className="control-panel-sliders"
              style={controlPanelRowStyle}
            >
              {videoUrl ? (
                <ShortsPreviewControlBar
                  layout="stacked"
                  videoRef={videoRef}
                  videoKey={videoUrl}
                  duration={duration || peaks?.durationSec || 0}
                  onSeek={seek}
                  onPlayheadSample={onPlayheadSample}
                  scaleLabel={t.shorts.studioSliderScale}
                  posYLabel={t.shorts.studioSliderPosY}
                  scaleValueFormat="percent"
                  videoScale={
                    activeScreenId === "left"
                      ? clampVideoScale(videoScale)
                      : clampVideoScale(thumbScale)
                  }
                  videoPosY={
                    activeScreenId === "left"
                      ? clampVideoPosY(videoPosY)
                      : clampVideoPosY(thumbPosY)
                  }
                  onVideoScaleChange={(v) => {
                    const next = clampVideoScale(v);
                    if (activeScreenId === "left") {
                      onVideoScaleChange(next);
                    } else {
                      setThumbScale(next);
                    }
                  }}
                  onVideoPosYChange={(v) => {
                    const next = clampVideoPosY(v);
                    if (activeScreenId === "left") {
                      onVideoPosYChange(next);
                    } else {
                      setThumbPosY(next);
                    }
                  }}
                  videoScaleMin={SHORTS_VIDEO_SCALE_MIN}
                  videoScaleMax={SHORTS_VIDEO_SCALE_MAX}
                  videoScaleStep={0.01}
                  entranceEffect={captionEntrance}
                  onEntranceEffectChange={applyCaptionEntrance}
                />
              ) : (
                <div className="h-9 rounded-lg border border-dashed border-white/10 bg-black/30" />
              )}
            </div>
            <div
              className="control-panel-timeline"
              style={{
                ...controlPanelRowStyle,
                minHeight: "4rem",
              }}
            >
              <ShortsCaptionWaveTimeline
                compact
                captions={captions}
                activeCaptionId={activeCapId}
                currentTime={previewTime}
                durationSec={duration || peaks?.durationSec || 0}
                peaks={peaks}
                videoRef={videoRef}
                videoKey={videoUrl}
                onChange={onCaptionsChange}
                onSelect={onSelectCap}
                onSeek={seek}
              />
            </div>
          </div>
        </div>

        {showYtSuccess && youtubeWatchUrl ? (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/15 bg-[#12151f] p-5 shadow-2xl">
              <p className="text-center text-base font-bold text-white">
                {t.shorts.youtubeUploadSuccess}
              </p>
              <p className="text-center text-xs text-white/55">
                {t.shorts.youtubeUploadReady}
              </p>
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/30 px-4 py-3 text-sm font-bold text-white ring-1 ring-red-400/40"
              >
                <Youtube className="h-4 w-4" />
                {t.shorts.youtubeOpenVideo}
              </a>
              <button
                type="button"
                onClick={() => setShowYtSuccess(false)}
                className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white"
              >
                {t.shorts.fullStudioClose}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
