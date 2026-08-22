"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import { ChevronDown, Download, Loader2, Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import BrandWatermark from "@/components/BrandWatermark";
import ThumbnailEditor from "@/components/ThumbnailEditor";
import {
  ASPECT_RATIO_CLASS,
  DEFAULT_IMAGE_PAN,
  IMAGE_PAN_SENSITIVITY,
  IMAGE_SCALE_MAX,
  IMAGE_SCALE_MIN,
  aspectRatioValue,
  clampImagePan,
  clampImageScale,
  coverCrop,
  normalizeImagePan,
  type AspectRatioKey,
  type DownloadQuality,
  type ExportPreset,
  type ImagePan,
} from "@/lib/downloadImage";
import { PROMPT_MAX_LENGTH, REGENERATE_CREDIT_COST } from "@/lib/data";
import { requestAiBackground } from "@/lib/aiBackground";
import { toDisplayImageSrc } from "@/lib/resultSession";

export type ResultWorkspaceVariant = "ai" | "photo";

type Props = {
  variant: ResultWorkspaceVariant;
  drafts: string[];
  focusedDraft: 0 | 1;
  onFocusDraft: (idx: 0 | 1) => void;
  /** Per-draft crop aspect; index matches 시안 1 / 시안 2. */
  draftAspectRatios: [AspectRatioKey, AspectRatioKey];
  onDraftAspectRatioChange: (idx: 0 | 1, key: AspectRatioKey) => void;
  /** Per-draft pan/zoom; edits never cross-write the other slot. */
  draftImagePans: [ImagePan, ImagePan];
  onDraftImagePanChange: (idx: 0 | 1, pan: ImagePan) => void;
  selectedRawUrl: string;
  draftRevision: number;
  regeneratingSlot: 0 | 1 | null;
  isDownloading: boolean;
  isGenerating: boolean;
  regenerateBusy: boolean;
  onExportDownload: (preset: DownloadQuality) => void;
  onDelete?: () => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRegenerate: () => void;
  creditsLabel: string;
  unlimitedCredits: boolean;
  credits: number;
  maxCredits: number;
  actionMessage?: string | null;
  gallerySavedMsg?: boolean;
  showBrandWatermark: boolean;
  /** Gallery direct-edit origin: general photos vs face/object models. */
  directEditSource?: "photos" | "models" | null;
  profileId?: string | null;
  profileName?: string | null;
  exportPreset: ExportPreset;
  /** Replace the focused draft with a fused portrait (face + style + background re-render). */
  onGenerateBackgroundFusion?: (keyword: string) => Promise<void>;
  /** @deprecated Legacy bg-only paste — use onGenerateBackgroundFusion. */
  onApplyAiBackground?: (imageUrl: string) => void;
};

function frameMaxClassFor(aspect: AspectRatioKey, dual: boolean): string {
  if (aspect === "original") {
    return dual ? "w-full max-w-[280px]" : "mx-auto w-full max-w-xl";
  }
  if (aspect === "4:1") {
    return dual ? "w-full max-w-[360px]" : "mx-auto w-full max-w-5xl";
  }
  if (aspect === "3:1") {
    return dual ? "w-full max-w-[340px]" : "mx-auto w-full max-w-4xl";
  }
  if (aspect === "16:9") {
    return dual ? "w-full max-w-[320px]" : "mx-auto w-full max-w-2xl";
  }
  if (aspect === "4:3") {
    return dual ? "w-full max-w-[280px]" : "mx-auto w-full max-w-2xl";
  }
  if (aspect === "4:5") {
    return dual ? "w-full max-w-[230px]" : "mx-auto w-full max-w-md";
  }
  if (aspect === "a2" || aspect === "a3" || aspect === "a4") {
    return dual ? "w-full max-w-[240px]" : "mx-auto w-full max-w-md";
  }
  return dual ? "w-full max-w-[240px]" : "mx-auto w-full max-w-sm";
}

const ASPECT_TABS: AspectRatioKey[] = ["original", "9:16", "16:9", "1:1", "id", "a4"];
const PROMO_ASPECT_GROUPS: Array<{
  titleKey: "printGroupPoster" | "printGroupBanner" | "printGroupSocial";
  items: AspectRatioKey[];
}> = [
  { titleKey: "printGroupPoster", items: ["a2", "a3", "a4"] },
  { titleKey: "printGroupBanner", items: ["3:1", "4:1"] },
  { titleKey: "printGroupSocial", items: ["4:3", "1:1", "4:5", "16:9"] },
];

function FramedCropImage({
  src,
  aspectRatio,
  pan,
  isOriginal,
}: {
  src: string;
  aspectRatio: AspectRatioKey;
  pan: ImagePan;
  isOriginal: boolean;
}) {
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const ratio = aspectRatioValue(aspectRatio);
  const crop =
    !isOriginal && nat.w > 0 && nat.h > 0 && ratio > 0
      ? coverCrop(nat.w, nat.h, ratio, pan.x, pan.y, pan.scale)
      : null;

  if (isOriginal || !crop) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget;
          setNat({ w: el.naturalWidth, h: el.naturalHeight });
        }}
        className={
          isOriginal
            ? "pointer-events-none h-auto w-full select-none object-contain"
            : "pointer-events-none h-full w-full select-none object-cover"
        }
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      draggable={false}
      onLoad={(e) => {
        const el = e.currentTarget;
        setNat({ w: el.naturalWidth, h: el.naturalHeight });
      }}
      className="pointer-events-none absolute max-w-none select-none"
      style={{
        left: `${-(crop.sx / crop.sw) * 100}%`,
        top: `${-(crop.sy / crop.sh) * 100}%`,
        width: `${(nat.w / crop.sw) * 100}%`,
        height: `${(nat.h / crop.sh) * 100}%`,
      }}
    />
  );
}

export default function ResultWorkspace({
  variant,
  drafts,
  focusedDraft,
  onFocusDraft,
  draftAspectRatios,
  onDraftAspectRatioChange,
  draftImagePans,
  onDraftImagePanChange,
  selectedRawUrl,
  draftRevision,
  regeneratingSlot,
  isDownloading,
  isGenerating,
  regenerateBusy,
  onExportDownload,
  onDelete,
  prompt,
  onPromptChange,
  onRegenerate,
  creditsLabel,
  unlimitedCredits,
  credits,
  maxCredits,
  actionMessage,
  gallerySavedMsg,
  showBrandWatermark,
  directEditSource = null,
  profileId = null,
  profileName = null,
  exportPreset,
  onGenerateBackgroundFusion,
  onApplyAiBackground,
}: Props) {
  const { t } = useI18n();
  const { showToast } = useFeedback();
  const aiToolsEnabled = variant === "ai";
  const slots = (variant === "photo" ? drafts.slice(0, 1) : drafts.slice(0, 2)).filter(
    (url): url is string => typeof url === "string" && url.trim().length > 8
  );
  const dual = aiToolsEnabled && slots.length >= 2;
  const focusedAspect = draftAspectRatios[focusedDraft] ?? draftAspectRatios[0];
  const focusedIsOriginal = focusedAspect === "original";
  const busy = isDownloading || !selectedRawUrl;
  const focusedPan = normalizeImagePan(
    draftImagePans[focusedDraft] ?? draftImagePans[0] ?? DEFAULT_IMAGE_PAN
  );
  const [panning, setPanning] = useState(false);
  const [promoMenuOpen, setPromoMenuOpen] = useState(false);
  const [bgKeyword, setBgKeyword] = useState("");
  const [bgGenerating, setBgGenerating] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const bgBusy = bgGenerating || regenerateBusy;
  const frameRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const pointersRef = useRef(
    new Map<number, { x: number; y: number; draftIdx: 0 | 1 }>()
  );
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: ImagePan;
    moved: boolean;
    draftIdx: 0 | 1;
  } | null>(null);
  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    draftIdx: 0 | 1;
  } | null>(null);
  const pansRef = useRef(draftImagePans);
  pansRef.current = draftImagePans;
  const aspectsRef = useRef(draftAspectRatios);
  aspectsRef.current = draftAspectRatios;

  const triggerBgGenerate = async () => {
    const keyword = bgKeyword.trim();
    if (!keyword) {
      showToast("키워드를 입력해 주세요.", "error");
      return;
    }
    if (bgBusy) return;
    if (!onGenerateBackgroundFusion && !onApplyAiBackground) {
      showToast("배경 생성 기능을 사용할 수 없습니다.", "error");
      return;
    }

    console.info("[ResultWorkspace] bg-generate click", {
      keywordPreview: keyword.slice(0, 80),
      focusedDraft,
      hasFusionHandler: Boolean(onGenerateBackgroundFusion),
    });

    flushSync(() => {
      setBgGenerating(true);
      setBgError(null);
    });

    try {
      if (onGenerateBackgroundFusion) {
        await onGenerateBackgroundFusion(keyword);
      } else if (onApplyAiBackground) {
        const { imageUrl } = await requestAiBackground({
          prompt: keyword,
          aspectRatio: focusedAspect,
        });
        onApplyAiBackground(imageUrl);
        showToast("배경이 생성되어 적용되었습니다.", "success");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI 배경 생성에 실패했습니다.";
      console.error("[ResultWorkspace] bg-generate failed", err);
      setBgError(message);
      showToast(message, "error");
    } finally {
      setBgGenerating(false);
    }
  };

  const aspectLabel = (key: AspectRatioKey) => {
    if (key === "original") return t.creator.aspectOriginal;
    if (key === "9:16") return t.creator.aspect916;
    if (key === "16:9") return t.creator.aspect169;
    if (key === "1:1") return t.creator.aspect11;
    if (key === "4:3") return t.creator.aspect43;
    if (key === "4:5") return t.creator.aspect45;
    if (key === "3:1") return t.creator.aspect31;
    if (key === "4:1") return t.creator.aspect41;
    if (key === "a2") return t.creator.aspectA2;
    if (key === "a3") return t.creator.aspectA3;
    if (key === "id") return t.creator.aspectId;
    return t.creator.aspectA4;
  };

  const panFor = useCallback((draftIdx: 0 | 1) => {
    return normalizeImagePan(pansRef.current[draftIdx] ?? DEFAULT_IMAGE_PAN);
  }, []);

  const setScale = useCallback(
    (draftIdx: 0 | 1, nextScale: number) => {
      const current = panFor(draftIdx);
      onDraftImagePanChange(
        draftIdx,
        normalizeImagePan({ ...current, scale: clampImageScale(nextScale) })
      );
    },
    [onDraftImagePanChange, panFor]
  );

  const pointerDistance = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  const onPanPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, draftIdx: 0 | 1) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const slotOriginal = (aspectsRef.current[draftIdx] ?? "9:16") === "original";
      if (slotOriginal) {
        onFocusDraft(draftIdx);
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        draftIdx,
      });

      if (pointersRef.current.size >= 2) {
        panDragRef.current = null;
        const dist = pointerDistance();
        if (dist > 0) {
          pinchRef.current = {
            startDist: dist,
            startScale: panFor(draftIdx).scale,
            draftIdx,
          };
        }
        setPanning(true);
        return;
      }

      pinchRef.current = null;
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...panFor(draftIdx) },
        moved: false,
        draftIdx,
      };
      setPanning(true);
    },
    [onFocusDraft, panFor]
  );

  const onPanPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        draftIdx:
          pointersRef.current.get(e.pointerId)?.draftIdx ??
          (focusedDraft === 1 ? 1 : 0),
      });

      const pinch = pinchRef.current;
      if (pinch && pointersRef.current.size >= 2) {
        const dist = pointerDistance();
        if (dist > 0 && pinch.startDist > 0) {
          setScale(pinch.draftIdx, pinch.startScale * (dist / pinch.startDist));
        }
        return;
      }

      const drag = panDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const deltaX = (e.clientX - drag.startX) / rect.width;
      const deltaY = (e.clientY - drag.startY) / rect.height;
      if (Math.abs(deltaX) > 0.008 || Math.abs(deltaY) > 0.008) drag.moved = true;
      onDraftImagePanChange(
        drag.draftIdx,
        normalizeImagePan({
          x: clampImagePan(drag.origin.x - deltaX * IMAGE_PAN_SENSITIVITY),
          y: clampImagePan(drag.origin.y - deltaY * IMAGE_PAN_SENSITIVITY),
          scale: drag.origin.scale,
        })
      );
    },
    [focusedDraft, onDraftImagePanChange, setScale]
  );

  const onPanPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      pointersRef.current.delete(e.pointerId);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
      }
      if (pointersRef.current.size === 1) {
        const remaining = [...pointersRef.current.entries()][0];
        if (remaining) {
          const [id, pt] = remaining;
          panDragRef.current = {
            pointerId: id,
            startX: pt.x,
            startY: pt.y,
            origin: { ...panFor(pt.draftIdx) },
            moved: true,
            draftIdx: pt.draftIdx,
          };
        }
        return;
      }

      const drag = panDragRef.current;
      const wasClick = drag && drag.pointerId === e.pointerId && !drag.moved;
      const draftIdx = drag?.draftIdx;
      if (!drag || drag.pointerId === e.pointerId) {
        panDragRef.current = null;
      }
      if (pointersRef.current.size === 0) setPanning(false);
      if (wasClick && draftIdx != null) onFocusDraft(draftIdx);
      else if (drag?.moved && draftIdx != null) onFocusDraft(draftIdx);
    },
    [onFocusDraft, panFor]
  );

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const [draftIdx, node] of frameRefs.current.entries()) {
      const idx = (draftIdx === 1 ? 1 : 0) as 0 | 1;
      const onWheel = (e: WheelEvent) => {
        if ((aspectsRef.current[idx] ?? "9:16") === "original") return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        setScale(idx, panFor(idx).scale * factor);
        onFocusDraft(idx);
      };
      node.addEventListener("wheel", onWheel, { passive: false });
      cleanups.push(() => node.removeEventListener("wheel", onWheel));
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [setScale, panFor, onFocusDraft, slots.length, draftRevision, draftAspectRatios]);

  const handleAspectChange = (key: AspectRatioKey) => {
    onDraftAspectRatioChange(focusedDraft, key);
    onDraftImagePanChange(focusedDraft, { ...DEFAULT_IMAGE_PAN });
    setPromoMenuOpen(false);
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <div className="text-center">
        {variant === "photo" && directEditSource !== "models" ? (
          <>
            <span className="mb-3 inline-flex rounded-full border border-glow-emerald/40 bg-glow-emerald/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
              {t.creator.directEditBadge}
            </span>
            <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
              {t.creator.directEditTitle}
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-white/50">
              {t.creator.directEditSubtitle}
            </p>
          </>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
              {t.creator.detailPhaseTitle}
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-white/50">
              {t.creator.detailPhaseSubtitle}
            </p>
          </>
        )}
      </div>

      <div
        className={`grid items-start gap-3 ${
          dual ? "grid-cols-2 justify-items-center" : "grid-cols-1"
        }`}
      >
        {slots.map((url, idx) => {
          const draftIdx = idx as 0 | 1;
          const isFocused = focusedDraft === draftIdx || !dual;
          const slotAspect = draftAspectRatios[draftIdx] ?? draftAspectRatios[0];
          const slotOriginal = slotAspect === "original";
          const slotAspectClass = slotOriginal
            ? ""
            : ASPECT_RATIO_CLASS[slotAspect] ?? ASPECT_RATIO_CLASS["9:16"];
          const slotPan = normalizeImagePan(
            draftImagePans[draftIdx] ?? draftImagePans[0] ?? DEFAULT_IMAGE_PAN
          );
          return (
            <div
              key={`workspace-slot-${draftIdx}-${draftRevision}`}
              className={`flex min-w-0 flex-col gap-2 ${frameMaxClassFor(slotAspect, dual)}`}
            >
              <button
                type="button"
                ref={(el) => {
                  if (el) frameRefs.current.set(draftIdx, el);
                  else frameRefs.current.delete(draftIdx);
                }}
                onPointerDown={(e) => onPanPointerDown(e, draftIdx)}
                onPointerMove={slotOriginal ? undefined : onPanPointerMove}
                onPointerUp={slotOriginal ? undefined : onPanPointerUp}
                onPointerCancel={slotOriginal ? undefined : onPanPointerUp}
                title={slotOriginal ? undefined : t.creator.imagePanHint}
                className={`relative w-full overflow-hidden rounded-2xl bg-white/[0.04] transition-all duration-300 ${slotAspectClass} ${
                  slotOriginal
                    ? "cursor-pointer"
                    : panning && isFocused
                      ? "cursor-grabbing touch-none"
                      : "cursor-grab touch-none"
                } ${
                  isFocused
                    ? "ring-2 ring-glow-purple shadow-[0_0_24px_rgba(139,92,246,0.28)]"
                    : "ring-1 ring-white/10 hover:ring-white/25"
                }`}
              >
                <FramedCropImage
                  src={toDisplayImageSrc(url)}
                  aspectRatio={slotAspect}
                  pan={slotPan}
                  isOriginal={slotOriginal}
                />
                {aiToolsEnabled && (
                  <div className="absolute top-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                    {draftIdx === 0 ? t.creator.draftA : t.creator.draftB}
                  </div>
                )}
                {aiToolsEnabled && isFocused && (
                  <div className="absolute top-2 right-2 rounded-md bg-glow-purple/90 px-2 py-1 text-[10px] font-semibold text-white">
                    [{t.creator.draftSelected}]
                  </div>
                )}
                {isFocused && <BrandWatermark visible={showBrandWatermark} />}
                {regeneratingSlot === draftIdx && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/55 px-3 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-glow-purple" />
                    <p className="text-[10px] font-medium text-white">
                      {t.creator.bgFusionGenerating}
                    </p>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {!focusedIsOriginal ? (
        <div className="space-y-2">
          <p className="text-center text-xs text-white/40">{t.creator.imagePanHint}</p>
          <div className="mx-auto flex max-w-sm items-center gap-2">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={focusedPan.scale <= IMAGE_SCALE_MIN}
              onClick={() => setScale(focusedDraft, focusedPan.scale / 1.12)}
              className="rounded-lg border border-white/10 p-1.5 text-white/70 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min={IMAGE_SCALE_MIN}
              max={IMAGE_SCALE_MAX}
              step={0.01}
              value={focusedPan.scale}
              onChange={(e) => setScale(focusedDraft, Number(e.target.value))}
              className="h-1.5 w-full accent-violet-500"
              aria-label={t.creator.imageZoomLabel}
            />
            <button
              type="button"
              aria-label="Zoom in"
              disabled={focusedPan.scale >= IMAGE_SCALE_MAX}
              onClick={() => setScale(focusedDraft, focusedPan.scale * 1.12)}
              className="rounded-lg border border-white/10 p-1.5 text-white/70 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/50">
              {focusedPan.scale.toFixed(2)}×
            </span>
          </div>
        </div>
      ) : null}

      {gallerySavedMsg ? (
        <p className="text-center text-xs text-glow-emerald">{t.creator.savedToGallery}</p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-white/70">{t.creator.aspectRatioLabel}</p>
        <div className="flex flex-wrap items-start gap-2">
          {ASPECT_TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleAspectChange(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                focusedAspect === key
                  ? "bg-glow-purple/15 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {aspectLabel(key)}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPromoMenuOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                promoMenuOpen ||
                ["a2", "a3", "3:1", "4:1", "4:3", "4:5"].includes(focusedAspect)
                  ? "bg-glow-purple/15 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              <span>{t.creator.printPromoMenu}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${promoMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {promoMenuOpen ? (
              <div className="absolute left-0 z-20 mt-2 w-[17rem] rounded-2xl border border-white/10 bg-navy/95 p-3 shadow-2xl backdrop-blur-xl">
                <div className="space-y-3">
                  {PROMO_ASPECT_GROUPS.map((group) => (
                    <div key={group.titleKey} className="space-y-1.5">
                      <p className="px-1 text-[11px] font-semibold text-white/40">
                        {t.creator[group.titleKey]}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((key) => (
                          <button
                            key={`${group.titleKey}-${key}`}
                            type="button"
                            onClick={() => handleAspectChange(key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                              focusedAspect === key
                                ? "bg-glow-emerald/15 text-white ring-1 ring-glow-emerald/40"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {aspectLabel(key)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-purple-500/30 bg-gray-900/80 p-4 shadow-lg">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-purple-300">
            ✨ AI 배경 생성 및 추천
          </span>
          <span className="text-xs text-gray-400">
            키워드로 배경을 즉시 만들어보세요
          </span>
        </div>
        {bgBusy ? (
          <div
            className="mb-3 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-950/40 px-3 py-2.5 text-sm text-purple-100"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-purple-300" />
            <span>{t.creator.bgFusionGenerating}</span>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            type="text"
            value={bgKeyword}
            onChange={(e) => setBgKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void triggerBgGenerate();
              }
            }}
            placeholder="예: 노을 지는 벚꽃길, 신비로운 숲속, 모던한 스튜디오..."
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none disabled:opacity-60"
            disabled={bgBusy || (!onGenerateBackgroundFusion && !onApplyAiBackground)}
          />
          <button
            type="button"
            disabled={
              !bgKeyword.trim() ||
              bgBusy ||
              (!onGenerateBackgroundFusion && !onApplyAiBackground)
            }
            onClick={() => void triggerBgGenerate()}
            className="inline-flex min-w-[6.5rem] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bgBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>생성 중...</span>
              </>
            ) : (
              "배경 생성"
            )}
          </button>
        </div>
        {bgError ? (
          <p className="mt-2 text-xs text-red-300" role="alert">
            {bgError}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(
            [
              "🌸 만개한 벚꽃",
              "🌅 노을 풍경",
              "🏛️ 클래식 스튜디오",
              "✨ 몽환적 파스텔",
            ] as const
          ).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setBgKeyword(tag.replace(/^[^\s]+\s/, ""))}
              className="rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => onExportDownload("hd")}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 px-3 py-3 text-sm font-bold disabled:opacity-50 sm:col-span-2"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>{isDownloading ? "..." : t.creator.actionDownloadHd}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onExportDownload("original")}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-50 sm:col-span-2"
        >
          <span>{t.creator.exportOriginal}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onExportDownload("id-photo")}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-50 sm:col-span-2"
        >
          <span>{t.creator.exportIdPhoto}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onExportDownload("print-png")}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-50 sm:col-span-3"
        >
          <span>{t.creator.exportPrintPng}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onExportDownload("print-pdf")}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-3 py-3 text-sm disabled:opacity-50 sm:col-span-3"
        >
          <span>{t.creator.exportPrintPdf}</span>
        </button>
      </div>

      <div className="space-y-3">
        {creditsLabel ? (
          <p className="text-center text-xs text-white/40">
            {t.creator.creditBadge
              .replace("{current}", unlimitedCredits ? creditsLabel : String(credits))
              .replace("{max}", unlimitedCredits ? creditsLabel : String(maxCredits))}
          </p>
        ) : null}

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="w-full py-2 text-center text-sm text-red-300/80 transition hover:text-red-200"
          >
            {t.creator.deletePortrait}
          </button>
        ) : null}

        {aiToolsEnabled ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white/80">{t.creator.promptLabel}</p>
            <textarea
              value={prompt}
              maxLength={PROMPT_MAX_LENGTH}
              onChange={(e) => onPromptChange(e.target.value.slice(0, PROMPT_MAX_LENGTH))}
              placeholder={t.creator.promptPlaceholder}
              rows={3}
              className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-300 focus:ring-1 focus:ring-glow-purple/40"
            />
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isGenerating || regenerateBusy}
              className="btn-secondary flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
            >
              <Wand2
                className={`h-4 w-4 shrink-0 ${regenerateBusy || isGenerating ? "animate-pulse" : ""}`}
              />
              <Sparkles
                className={`h-4 w-4 shrink-0 text-amber-300 ${regenerateBusy || isGenerating ? "animate-pulse" : ""}`}
              />
              <span>
                {regenerateBusy
                  ? t.creator.regenerateBusyLabel
                  : unlimitedCredits || credits >= REGENERATE_CREDIT_COST
                    ? t.creator.regenerateWithCredit
                    : t.creator.regenerateNeedCredit}
              </span>
            </button>
            {actionMessage ? (
              <p className="text-center text-xs text-glow-emerald">{actionMessage}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedRawUrl ? (
        <div className="space-y-3 border-t border-white/10 pt-6">
          {variant === "photo" ? (
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-white/85">
                텍스트 · 스티커 편집
              </p>
              <p className="mt-1 text-xs text-white/40">
                쇼츠 에디터와 같은 방식으로 문구와 강조 요소를 꾸밀 수 있습니다.
              </p>
            </div>
          ) : null}
          <ThumbnailEditor
            key={`workspace-editor-${focusedDraft}-${draftRevision}-${selectedRawUrl}`}
            imageUrl={selectedRawUrl}
            aspectRatio={focusedAspect}
            imagePan={focusedPan}
            onImagePanChange={(pan) => onDraftImagePanChange(focusedDraft, pan)}
            profileId={profileId}
            profileName={profileName}
          />
        </div>
      ) : null}
    </div>
  );
}
