"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Download,
  Layers,
  Lightbulb,
  MonitorPlay,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  clampImagePan,
  coverCrop,
  IMAGE_PAN_SENSITIVITY,
  normalizeImagePan,
  outputSizeForAspect,
  type AspectRatioKey,
  type ImagePan,
} from "@/lib/downloadImage";
import { downloadCanvasPrint } from "@/lib/printExport";
import { estimateCtrScore } from "@/lib/releaseNotes";
import {
  getAccountMeta,
  getFaceProfile,
  pushGalleryHistoryAndSync,
} from "@/lib/faceProfiles";
import { retentionContextFromAccount } from "@/lib/retentionPolicy";
import { blobToCompressedDataUrl } from "@/lib/processUpload";
import { uploadGalleryAsset } from "@/lib/galleryUpload";
import { KAKAO_REGISTERED_ORIGIN, shareImageViaKakao } from "@/lib/kakaoShare";
import { isShareAbortError, shareWithFallback } from "@/lib/webShare";
import {
  clampBoxWidth,
  clampFontWeight,
  SHORTS_BOX_WIDTH_MAX,
  SHORTS_BOX_WIDTH_MIN,
  SHORTS_FONT_WEIGHT_DEFAULT,
  SHORTS_FONT_WEIGHT_MAX,
  SHORTS_FONT_WEIGHT_MIN,
  SHORTS_FONT_WEIGHT_STEP,
} from "@/lib/shortsStudioExport";
import {
  EMOJI_QUICK,
  FONT_PRESET_PRIMARY,
  SHORTS_COLOR_PRESET_ORDER,
  STICKER_BADGES,
  applyColorRange,
  colorAtIndex,
  colorPresetFill,
  colorPresetMeta,
  createLayer,
  drawEmojiChar,
  forEachCodePoint,
  measureStickerBadge,
  drawStickerBadge,
  fontForChar,
  fontForText,
  isEmojiChar,
  stripStickerTokens,
  swatchNeedsOutline,
  type ColorPreset,
  type DepthMode,
  type FontPreset,
  type TextAlign,
  type TextLayer,
  type TextPos,
  type StickerBadgeId,
} from "@/lib/thumbnailStyles";
import { StickerMoreDropdown } from "@/components/StudioStylePickers";

type Props = {
  imageUrl: string;
  aspectRatio: AspectRatioKey;
  /** Cover-crop pan shared with ResultWorkspace preview / downloads */
  imagePan?: ImagePan;
  onImagePanChange?: (pan: ImagePan) => void;
  /** Optional face/object profile linked when saving to My Works */
  profileId?: string | null;
  profileName?: string | null;
};

type LayerAnchor = {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
};

type DragState =
  | {
      kind: "layer";
      layerId: string;
      startClientX: number;
      startClientY: number;
      startOffsetX: number;
      startOffsetY: number;
    }
  | {
      kind: "pan";
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
      startScale: number;
    };

const SNAP_THRESHOLD = 0.04;
const OFFSET_CLAMP = 0.4;

function clampOffset(v: number) {
  return Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, v));
}

function snapOffset(v: number): { value: number; snapped: boolean } {
  if (Math.abs(v) <= SNAP_THRESHOLD) return { value: 0, snapped: true };
  return { value: clampOffset(v), snapped: false };
}

export default function ThumbnailEditor({
  imageUrl,
  aspectRatio,
  imagePan = { x: 0, y: 0, scale: 1 },
  onImagePanChange,
  profileId = null,
  profileName = null,
}: Props) {
  const pan = normalizeImagePan(imagePan);
  const { t } = useI18n();
  const { planId } = useCredits();
  const { showToast } = useFeedback();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Selection guide lives on its own layer so exports stay free of editor chrome. */
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const layerAnchorsRef = useRef<LayerAnchor[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const paintLoadedImageRef = useRef<() => void>(() => undefined);
  const [, setImageEpoch] = useState(0);
  const [layers, setLayers] = useState<TextLayer[]>([
    createLayer({ text: "", color: "yellow", pos: "bottom" }),
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("");
  const [depth, setDepth] = useState<DepthMode>("front");
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState(false);
  const [abVariant, setAbVariant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{
    x: boolean;
    y: boolean;
    gx: number;
    gy: number;
  }>({ x: false, y: false, gx: 0, gy: 0 });

  useEffect(() => {
    if (!activeLayerId && layers[0]) setActiveLayerId(layers[0].id);
  }, [activeLayerId, layers]);

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];

  const [naturalSize, setNaturalSize] = useState({ w: 1080, h: 1920 });

  const aspect = useMemo(() => {
    if (aspectRatio === "original") return 0;
    if (aspectRatio === "16:9") return 16 / 9;
    if (aspectRatio === "1:1") return 1;
    if (aspectRatio === "4:3") return 4 / 3;
    if (aspectRatio === "4:5") return 4 / 5;
    if (aspectRatio === "3:1") return 3;
    if (aspectRatio === "4:1") return 4;
    if (aspectRatio === "a2" || aspectRatio === "a3") return 1 / Math.SQRT2;
    if (aspectRatio === "a4") return 1 / Math.SQRT2;
    if (aspectRatio === "id") return 3.5 / 4.5;
    return 9 / 16;
  }, [aspectRatio]);

  const canvasSize = useMemo(() => {
    if (aspectRatio === "original") {
      const { w, h } = naturalSize;
      // Keep native pixel ratio; only guard extreme GPU sizes.
      const maxEdge = 8192;
      const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
      return {
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale)),
      };
    }
    if (aspectRatio === "id") return { width: 1050, height: 1350 };
    const output = outputSizeForAspect(aspectRatio);
    if (output.width > 0 && output.height > 0) {
      const maxEdge = 1400;
      const scale = Math.min(1, maxEdge / Math.max(output.width, output.height));
      return {
        width: Math.max(1, Math.round(output.width * scale)),
        height: Math.max(1, Math.round(output.height * scale)),
      };
    }
    return { width: 1080, height: Math.round(1080 / aspect) };
  }, [aspect, aspectRatio, naturalSize]);

  const ctr = useMemo(() => {
    const joined = layers.map((l) => l.text).join("\n");
    const hasEmoji = [...joined].some((ch) => isEmojiChar(ch));
    return estimateCtrScore(joined, hasEmoji, showSafeZone);
  }, [layers, showSafeZone]);

  const drawStyledText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      xAnchor: number,
      y: number,
      width: number
    ) => {
      const { text, fontSize, fontPreset, align, stickerId } = layer;
      const fontWeight = clampFontWeight(
        layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
      );
      const pureText = stripStickerTokens(text);
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      let totalWidth = 0;
      forEachCodePoint(pureText, (ch) => {
        if (isEmojiChar(ch)) {
          totalWidth += fontSize * 1.1;
        } else {
          ctx.font = `${fontWeight} ${fontSize}px ${fontForChar(fontPreset, ch)}`;
          totalWidth += ctx.measureText(ch).width;
        }
      });

      const maxBox = width * clampBoxWidth(layer.maxWidth ?? 0.88);
      const contentW = Math.min(Math.max(totalWidth, fontSize * 2.2), maxBox);

      let x =
        align === "left"
          ? width * 0.08
          : align === "right"
            ? width * 0.92 - contentW
            : xAnchor - contentW / 2;

      x += layer.offsetX * width;
      const drawY = y + layer.offsetY * canvasSize.height;

      if (layer.showBox && (pureText.trim() || stickerId)) {
        const padX = fontSize * 0.35;
        const padY = fontSize * 0.45;
        const topPad = stickerId ? fontSize * 1.55 : padY;
        const boxX = x - padX;
        const boxY = drawY - topPad;
        const boxW = contentW + padX * 2;
        const boxH = topPad + padY;
        const opacity = Math.max(0.15, Math.min(0.9, layer.boxOpacity ?? 0.55));
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${opacity})`;
        ctx.beginPath();
        const r = Math.min(14, fontSize * 0.28);
        ctx.moveTo(boxX + r, boxY);
        ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
        ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
        ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
        ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
        ctx.closePath();
        ctx.fill();
        if (layer.showBoxBorder) {
          ctx.strokeStyle = "rgba(255,255,255,0.55)";
          ctx.lineWidth = Math.max(1.5, fontSize * 0.04);
          ctx.stroke();
        }
        ctx.restore();
      }

      let cursorX = x;
      forEachCodePoint(pureText, (ch, utf16Index) => {
        if (isEmojiChar(ch)) {
          const w = drawEmojiChar(ctx, ch, cursorX, drawY, fontSize);
          cursorX += w;
          return;
        }
        const presetKey = colorAtIndex(layer, utf16Index);
        const preset = colorPresetMeta(presetKey);
        ctx.font = `${fontWeight} ${fontSize}px ${fontForChar(fontPreset, ch)}`;
        const w = ctx.measureText(ch).width;
        ctx.shadowColor = preset.shadow;
        ctx.shadowBlur =
          presetKey === "white" || presetKey === "purplePink" ? 12 : 6;
        ctx.lineWidth = Math.max(3, fontSize * 0.08);
        if (preset.stroke !== "transparent") {
          ctx.strokeStyle = preset.stroke;
          ctx.strokeText(ch, cursorX, drawY);
        }
        ctx.fillStyle = preset.fill;
        ctx.fillText(ch, cursorX, drawY);
        cursorX += w;
      });
      ctx.shadowBlur = 0;

      // Independent overlay badge — max 1 per line (#97–#98)
      if (stickerId) {
        const scale = Math.max(0.7, fontSize / 48);
        const badgeY = drawY - fontSize * 0.95;
        let badgeX =
          align === "left"
            ? width * 0.08 + layer.offsetX * width
            : align === "right"
              ? width * 0.92 + layer.offsetX * width - measureStickerBadge(ctx, stickerId, scale)
              : xAnchor + layer.offsetX * width - measureStickerBadge(ctx, stickerId, scale) / 2;
        drawStickerBadge(ctx, stickerId, badgeX, badgeY, scale);
      }
    },
    [canvasSize.height]
  );

  /** Mirrors drawStyledText's layout math to place the selection guide. */
  const measureLayerBox = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      layer: TextLayer,
      xAnchor: number,
      y: number,
      width: number
    ) => {
      const { fontSize, fontPreset, align } = layer;
      const fontWeight = clampFontWeight(
        layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
      );
      const pureText = stripStickerTokens(layer.text);

      let totalWidth = 0;
      forEachCodePoint(pureText, (ch) => {
        if (isEmojiChar(ch)) {
          totalWidth += fontSize * 1.1;
        } else {
          ctx.font = `${fontWeight} ${fontSize}px ${fontForChar(fontPreset, ch)}`;
          totalWidth += ctx.measureText(ch).width;
        }
      });

      // Keep an interactive footprint even when the layer has no text yet.
      const maxBox = width * clampBoxWidth(layer.maxWidth ?? 0.88);
      const boxWidth = Math.min(Math.max(totalWidth, fontSize * 2.2), maxBox);
      let x =
        align === "left"
          ? width * 0.08
          : align === "right"
            ? width * 0.92 - boxWidth
            : xAnchor - boxWidth / 2;
      x += layer.offsetX * width;

      const drawY = y + layer.offsetY * canvasSize.height;
      const topPad = layer.stickerId ? fontSize * 1.7 : fontSize * 0.75;

      return {
        x,
        y: drawY - topPad,
        width: boxWidth,
        height: topPad + fontSize * 0.75,
      };
    },
    [canvasSize.height]
  );

  const paintLoadedImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img || img.naturalWidth < 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;

    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (aspectRatio !== "original") {
      const crop = coverCrop(
        img.naturalWidth,
        img.naturalHeight,
        aspect,
        pan.x,
        pan.y,
        pan.scale
      );
      sx = crop.sx;
      sy = crop.sy;
      sw = crop.sw;
      sh = crop.sh;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    const anchors: LayerAnchor[] = [];

    const drawLayers = () => {
      layers.forEach((layer) => {
        const layerPos = layer.pos ?? "bottom";
        const baseY =
          layerPos === "top"
            ? layer.fontSize * 1.2
            : layerPos === "center"
              ? height / 2
              : height - layer.fontSize * 1.1;
        const baseX = width / 2;
        anchors.push({
          id: layer.id,
          baseX,
          baseY,
          x: baseX + layer.offsetX * width,
          y: baseY + layer.offsetY * height,
        });
        if (!layer.text.trim() && !layer.stickerId) return;
        drawStyledText(ctx, layer, baseX, baseY, width);
      });
    };

    if (depth === "behind") {
      drawLayers();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(width * 0.5, height * 0.55, width * 0.28, height * 0.38, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      ctx.restore();
    } else {
      drawLayers();
    }

    layerAnchorsRef.current = anchors;

    if (showSafeZone) {
      ctx.save();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      const mx = width * 0.05;
      const my = height * 0.08;
      ctx.strokeRect(mx, my, width - mx * 2, height - my * 2);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.strokeRect(width * 0.1, height * 0.12, width * 0.8, height * 0.7);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
      ctx.font = `600 14px "Noto Sans KR", system-ui, sans-serif`;
      ctx.fillText("Safe Zone", mx + 8, my + 18);
      ctx.restore();
    }

    if (youtubePreview) {
      ctx.save();
      const barH = Math.max(28, height * 0.06);
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(0, 0, width, barH);
      ctx.fillRect(0, height - barH, width, barH);
      const tsW = width * 0.22;
      const tsH = height * 0.08;
      const tsX = width - tsW - width * 0.03;
      const tsY = height - barH - tsH - height * 0.02;
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(tsX, tsY, tsW, tsH);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(tsX, tsY, tsW, tsH);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `600 ${Math.max(11, Math.round(height * 0.018))}px "Noto Sans KR", system-ui, sans-serif`;
      ctx.fillText(t.thumbnail.timestampSafe, tsX + 6, tsY + tsH / 2 + 4);
      ctx.restore();
    }
  }, [
    aspect,
    aspectRatio,
    canvasSize,
    depth,
    drawStyledText,
    pan.x,
    pan.y,
    pan.scale,
    layers,
    showSafeZone,
    t.thumbnail.timestampSafe,
    youtubePreview,
  ]);

  paintLoadedImageRef.current = paintLoadedImage;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!imageUrl.trim()) return;

    const img = new Image();
    let revoked: string | null = null;
    let cancelled = false;

    const commit = () => {
      if (cancelled || img.naturalWidth < 1) return;
      loadedImageRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImageEpoch((n) => n + 1);
      paintLoadedImageRef.current();
    };

    img.onload = commit;

    const assignSrc = (src: string) => {
      img.src = src;
      if (img.complete && img.naturalWidth > 0) commit();
    };

    void (async () => {
      if (
        imageUrl.startsWith("data:") ||
        imageUrl.startsWith("blob:") ||
        imageUrl.startsWith("/")
      ) {
        assignSrc(imageUrl);
        return;
      }

      try {
        const proxied = `/api/media/fetch?src=${encodeURIComponent(imageUrl)}`;
        const res = await fetch(proxied, { credentials: "same-origin" });
        if (cancelled) return;
        if (res.ok) {
          const blob = await res.blob();
          if (cancelled) return;
          revoked = URL.createObjectURL(blob);
          assignSrc(revoked);
          return;
        }
      } catch {
        /* fall through */
      }

      if (cancelled) return;
      img.crossOrigin = "anonymous";
      img.onerror = () => {
        img.onerror = null;
        img.removeAttribute("crossOrigin");
        assignSrc(imageUrl);
      };
      assignSrc(imageUrl);
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [imageUrl]);

  useEffect(() => {
    paintLoadedImage();
  }, [paintLoadedImage]);

  /**
   * Overlay pass: active-layer bounding guide + snap guides.
   * Drawn on a separate canvas so exported thumbnails never contain editor chrome.
   */
  useEffect(() => {
    const canvas = guideCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (activeLayer) {
      const layerPos = activeLayer.pos ?? "bottom";
      const baseY =
        layerPos === "top"
          ? activeLayer.fontSize * 1.2
          : layerPos === "center"
            ? height / 2
            : height - activeLayer.fontSize * 1.1;
      const box = measureLayerBox(ctx, activeLayer, width / 2, baseY, width);

      const pad = Math.max(10, activeLayer.fontSize * 0.22);
      const bx = box.x - pad;
      const by = box.y - pad;
      const bw = box.width + pad * 2;
      const bh = box.height + pad * 2;
      const radius = Math.min(18, bw / 2, bh / 2);

      ctx.save();
      ctx.fillStyle = dragging
        ? "rgba(139, 92, 246, 0.12)"
        : "rgba(139, 92, 246, 0.06)";
      ctx.strokeStyle = dragging
        ? "rgba(167, 139, 250, 0.95)"
        : "rgba(167, 139, 250, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash(dragging ? [] : [12, 8]);
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, radius);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Corner ticks communicate "draggable region".
      const arm = Math.min(24, bw * 0.22, bh * 0.35);
      ctx.strokeStyle = "rgba(233, 213, 255, 0.95)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const corners: [number, number, number, number][] = [
        [bx, by + arm, bx, by],
        [bx, by, bx + arm, by],
        [bw + bx - arm, by, bw + bx, by],
        [bw + bx, by, bw + bx, by + arm],
        [bx, by + bh - arm, bx, by + bh],
        [bx, by + bh, bx + arm, by + bh],
        [bw + bx - arm, by + bh, bw + bx, by + bh],
        [bw + bx, by + bh - arm, bw + bx, by + bh],
      ];
      for (const [x1, y1, x2, y2] of corners) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (dragging && (snapGuides.x || snapGuides.y)) {
      ctx.save();
      ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      if (snapGuides.x) {
        ctx.beginPath();
        ctx.moveTo(snapGuides.gx, 0);
        ctx.lineTo(snapGuides.gx, height);
        ctx.stroke();
      }
      if (snapGuides.y) {
        ctx.beginPath();
        ctx.moveTo(0, snapGuides.gy);
        ctx.lineTo(width, snapGuides.gy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [activeLayer, canvasSize, dragging, snapGuides, measureLayerBox]);

  const canvasPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const nearestLayerId = (px: number, py: number): string | null => {
    const anchors = layerAnchorsRef.current;
    if (!anchors.length) return null;
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const a of anchors) {
      const d = Math.hypot(px - a.x, py - a.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = a.id;
      }
    }
    const maxHit = Math.max(canvasSize.width, canvasSize.height) * 0.28;
    return bestDist <= maxHit ? bestId : null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = canvasPointFromEvent(e);
    if (!pt) return;
    const layerId = nearestLayerId(pt.x, pt.y);
    if (layerId) {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        kind: "layer",
        layerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffsetX: layer.offsetX,
        startOffsetY: layer.offsetY,
      };
      setActiveLayerId(layerId);
      setDragging(true);
      const anchor = layerAnchorsRef.current.find((a) => a.id === layerId);
      setSnapGuides({
        x: Math.abs(layer.offsetX) <= SNAP_THRESHOLD,
        y: Math.abs(layer.offsetY) <= SNAP_THRESHOLD,
        gx: anchor?.baseX ?? canvasSize.width / 2,
        gy: anchor?.baseY ?? canvasSize.height / 2,
      });
      return;
    }

    if (!onImagePanChange || aspectRatio === "original") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "pan",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      startScale: pan.scale,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dxNorm = (e.clientX - drag.startClientX) / rect.width;
    const dyNorm = (e.clientY - drag.startClientY) / rect.height;

    if (drag.kind === "pan") {
      onImagePanChange?.(
        normalizeImagePan({
          x: clampImagePan(drag.startPanX - dxNorm * IMAGE_PAN_SENSITIVITY),
          y: clampImagePan(drag.startPanY - dyNorm * IMAGE_PAN_SENSITIVITY),
          scale: drag.startScale,
        })
      );
      return;
    }

    const sx = snapOffset(drag.startOffsetX + dxNorm);
    const sy = snapOffset(drag.startOffsetY + dyNorm);
    const anchor = layerAnchorsRef.current.find((a) => a.id === drag.layerId);
    setSnapGuides({
      x: sx.snapped,
      y: sy.snapped,
      gx: anchor?.baseX ?? canvasSize.width / 2,
      gy: anchor?.baseY ?? canvasSize.height / 2,
    });
    setLayers((prev) =>
      prev.map((l) =>
        l.id === drag.layerId
          ? { ...l, offsetX: sx.value, offsetY: sy.value }
          : l
      )
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    setSnapGuides({ x: false, y: false, gx: 0, gy: 0 });
  };

  const updateActive = (patch: Partial<TextLayer>) => {
    if (!activeLayer) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayer.id ? { ...l, ...patch } : l))
    );
  };

  const applySelectionColor = (color: ColorPreset) => {
    if (!activeLayer) return;
    const el = textareaRefs.current[activeLayer.id];
    if (!el) {
      updateActive({ color, ranges: [] });
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      updateActive({ color, ranges: [] });
      return;
    }
    updateActive({
      color,
      ranges: applyColorRange(activeLayer.ranges, start, end, color),
    });
  };

  const insertSymbol = (symbol: string) => {
    if (!activeLayer) return;
    const el = textareaRefs.current[activeLayer.id];
    if (!el) {
      updateActive({ text: activeLayer.text + symbol });
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next =
      activeLayer.text.slice(0, start) + symbol + activeLayer.text.slice(end);
    updateActive({ text: next });
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + symbol.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const insertSticker = (id: StickerBadgeId) => {
    if (!activeLayer) return;
    // Max 1 sticker per line — replace on click (#97)
    updateActive({ stickerId: activeLayer.stickerId === id ? null : id });
  };

  const addLayer = () => {
    const layer = createLayer({
      text: "",
      color: activeLayer?.color ?? "yellow",
      fontPreset: activeLayer?.fontPreset ?? "variety",
      fontSize: activeLayer?.fontSize ?? 48,
      fontWeight: activeLayer?.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT,
      maxWidth: activeLayer?.maxWidth ?? 0.88,
      showBox: activeLayer?.showBox ?? false,
      pos: activeLayer?.pos ?? "bottom",
    });
    setLayers((prev) => [...prev, layer]);
    setActiveLayerId(layer.id);
  };

  const deleteLayerById = (id: string) => {
    setLayers((prev) => {
      if (prev.length <= 1) {
        return [createLayer({ text: "", pos: "bottom" })];
      }
      return prev.filter((l) => l.id !== id);
    });
    setActiveLayerId((cur) => (cur === id ? "" : cur));
  };

  const applyAiSuggest = () => {
    const list = t.thumbnail.aiSuggestions;
    if (!list.length) return;
    const phrase = list[suggestIdx % list.length]!;
    setSuggestIdx((i) => i + 1);
    if (!activeLayer) return;
    updateActive({ text: stripStickerTokens(phrase), ranges: [], stickerId: activeLayer.stickerId });
  };

  const generateAbVariant = () => {
    const base = layers[0];
    if (!base) return;
    setAbVariant(true);
    const altColors: ColorPreset[] = ["red", "neonLime", "white", "orange"];
    const nextColor =
      altColors.find((c) => c !== base.color) ?? "red";
    const tone =
      base.text.trim().length > 0
        ? `${base.text.replace(/[!?]+$/u, "")}?`
        : "B · Wait for it 🔥";
    const variant = createLayer({
      text: tone,
      color: nextColor,
      fontPreset: base.fontPreset === "impact" ? "neon" : "impact",
      fontSize: Math.min(120, Math.max(28, Math.round(base.fontSize * 0.88))),
      align: base.align,
      pos: base.pos === "top" ? "center" : "top",
      offsetX: 0,
      offsetY: base.offsetY !== 0 ? -base.offsetY : -0.08,
    });
    setLayers((prev) => {
      if (abVariant && prev.length > 1) {
        return [prev[0]!, variant, ...prev.slice(2)];
      }
      return [...prev, variant];
    });
    setActiveLayerId(variant.id);
  };

  const exportBlob = async (timeoutMs = 8_000): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      let settled = false;
      const done = (b: Blob | null) => {
        if (settled) return;
        settled = true;
        resolve(b);
      };
      const timer = window.setTimeout(() => done(null), timeoutMs);
      try {
        canvas.toBlob(
          (b) => {
            window.clearTimeout(timer);
            done(b);
          },
          "image/jpeg",
          0.95
        );
      } catch {
        window.clearTimeout(timer);
        done(null);
      }
    });
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      if (!blob) return;

      // 1) Local file download
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `studio-canvas-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      // 2) Persist edited result into My Works (cloud + local mirror)
      try {
        const dataUrl = await blobToCompressedDataUrl(blob, 1280, 0.88);
        const id = `thumb-${Date.now()}`;
        const profile =
          profileId != null ? getFaceProfile(profileId) : null;
        const uploaded = await uploadGalleryAsset(dataUrl, id, planId);
        await pushGalleryHistoryAndSync(
          {
            id,
            imageUrl: uploaded?.thumbnailUrl ?? dataUrl,
            thumbnailUrl: uploaded?.thumbnailUrl ?? dataUrl,
            originalKey: uploaded?.originalKey,
            storageId: uploaded?.storageId ?? id,
            createdAt: Date.now(),
            styleId: "thumbnail-edit",
            profileId: profileId ?? profile?.id,
            profileName: profileName ?? profile?.name,
          },
          retentionContextFromAccount(planId, getAccountMeta())
        );
        showToast(t.creator.savedToGallery, "success");
      } catch (err) {
        console.warn("[ThumbnailEditor] save to My Works failed", err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async (format: "png" | "pdf") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const output = outputSizeForAspect(aspectRatio);
      await downloadCanvasPrint(
        canvas,
        format,
        output.width > 0 && output.height > 0
          ? { width: output.width, height: output.height, name: output.name }
          : "a4"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      const file = blob
        ? new File([blob], `studio-canvas-thumbnail-${Date.now()}.jpg`, {
            type: "image/jpeg",
          })
        : null;
      const result = await shareWithFallback({
        title: "Studio Canvas AI",
        text: t.thumbnail.shareText,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        file,
      });
      if (result === "copied") {
        showToast(t.creator.shareCopied, "success");
      }
    } catch (err) {
      if (isShareAbortError(err)) return;
      try {
        const pageUrl = typeof window !== "undefined" ? window.location.href : "";
        if (pageUrl && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(pageUrl);
          showToast(t.creator.shareCopied, "success");
        } else {
          showToast(t.thumbnail.shareFailed, "error");
        }
      } catch {
        showToast(t.thumbnail.shareFailed, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleKakaoShare = async () => {
    setKakaoBusy(true);
    try {
      const blob = await exportBlob();
      const file = blob
        ? new File([blob], `studio-canvas-thumbnail-${Date.now()}.jpg`, {
            type: "image/jpeg",
          })
        : null;

      try {
        // Do not pass R2/blob publicImageUrl — Kakao only accepts registered-domain
        // or Kakao CDN images. File is uploaded via Kakao.Share.uploadImage.
        const mode = await shareImageViaKakao({
          file,
          publicImageUrl: null,
          title: "Studio Canvas AI",
          description: t.thumbnail.shareText,
          linkUrl: KAKAO_REGISTERED_ORIGIN,
          buttonTitle: t.thumbnail.kakaoShareOpen,
        });
        if (mode === "kakao") return;
      } catch (err) {
        console.warn("[ThumbnailEditor] Kakao Share failed", err);
      }

      // Fallback: mobile share sheet (user can pick KakaoTalk) or copy link.
      if (file) {
        const result = await shareWithFallback({
          title: "Studio Canvas AI",
          text: t.thumbnail.shareText,
          url: KAKAO_REGISTERED_ORIGIN,
          file,
        });
        if (result === "copied") {
          showToast(t.thumbnail.kakaoShareFallback, "success");
        }
        return;
      }

      showToast(t.thumbnail.kakaoShareFailed, "error");
    } catch (err) {
      if (isShareAbortError(err)) return;
      showToast(t.thumbnail.kakaoShareFailed, "error");
    } finally {
      setKakaoBusy(false);
    }
  };

  const downloadBlobFile = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  };

  /**
   * YouTube share = download thumbnail + open YouTube Studio.
   * Do NOT use navigator.share here: on desktop Chrome/Edge the OS share sheet
   * can stay pending forever, so youtubeBusy never clears (infinite loading).
   * There is no /api/youtube route and no YouTube Data API OAuth in this app.
   */
  const handleYoutubeShare = async () => {
    setYoutubeBusy(true);
    try {
      const blob = await exportBlob();
      if (!blob) {
        showToast(t.thumbnail.shareFailed, "error");
        return;
      }

      downloadBlobFile(blob, `studio-canvas-youtube-${Date.now()}.jpg`);

      const studio = window.open(
        "https://studio.youtube.com",
        "_blank",
        "noopener,noreferrer"
      );
      if (!studio) {
        showToast(t.thumbnail.shareFailed, "error");
        return;
      }
      showToast(t.thumbnail.youtubeShareReady, "success");
    } catch (err) {
      console.warn("[ThumbnailEditor] YouTube share failed", err);
      showToast(t.thumbnail.shareFailed, "error");
    } finally {
      setYoutubeBusy(false);
    }
  };

  const chip = (active: boolean) =>
    active
      ? "border-glow-emerald/45 bg-glow-emerald/15 text-white"
      : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/80";

  const alignBtn = (
    key: TextAlign,
    Icon: typeof AlignLeft,
    label: string
  ) => (
    <button
      key={key}
      type="button"
      onClick={() => updateActive({ align: key })}
      className={`inline-flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs transition ${
        activeLayer?.align === key
          ? "bg-white/15 text-white"
          : "text-white/45 hover:bg-white/5 hover:text-white/80"
      }`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );

  const FONT_KEYS = [
    "variety",
    "clean",
    "vlog",
    "neon",
    "impact",
    "serif",
    "rounded",
    "poster",
    "pretendard",
    "gmarket",
    "jua",
    "jalnan",
  ] as const satisfies readonly FontPreset[];

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-gray-950/80 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white/90">{t.thumbnail.title}</h4>
        <span className="rounded-full border border-glow-emerald/30 bg-glow-emerald/10 px-2.5 py-1 text-[10px] text-emerald-200">
          {t.thumbnail.freeBadge}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-full" />
        <canvas
          ref={guideCanvasRef}
          className="absolute inset-0 block h-full w-full touch-none cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
      <p className="text-[11px] text-white/40">{t.thumbnail.dragHint}</p>

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
        <p className="text-xs text-emerald-200/90">
          {t.thumbnail.ctrScore.replace("{score}", String(ctr.score))}
        </p>
        {ctr.tips.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {ctr.tips.map((key) => (
              <li key={key} className="text-[11px] text-white/40">
                · {t.thumbnail.ctrTips[key] ?? key}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowSafeZone((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs ${chip(showSafeZone)}`}
        >
          {t.thumbnail.safeZone}
        </button>
        <button
          type="button"
          onClick={() => setYoutubePreview((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${chip(youtubePreview)}`}
        >
          <MonitorPlay className="h-3 w-3" />
          {t.thumbnail.youtubePreview}
        </button>
        <button
          type="button"
          onClick={() => setDepth((d) => (d === "front" ? "behind" : "front"))}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${chip(depth === "behind")}`}
        >
          <Layers className="h-3 w-3" />
          {depth === "behind" ? t.thumbnail.depthBehind : t.thumbnail.depthFront}
        </button>
        <button
          type="button"
          onClick={applyAiSuggest}
          className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100"
        >
          <Lightbulb className="h-3 w-3" />
          {t.thumbnail.aiSuggest}
        </button>
        <button
          type="button"
          onClick={generateAbVariant}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${chip(abVariant)}`}
        >
          <Copy className="h-3 w-3" />
          {t.thumbnail.abGenerate}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-white/60">{t.thumbnail.positionLabel}</p>
        <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/25">
          {(
            [
              ["top", t.thumbnail.posTop],
              ["center", t.thumbnail.posCenter],
              ["bottom", t.thumbnail.posBottom],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateActive({ pos: key as TextPos, offsetY: 0 })}
              className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                (activeLayer?.pos ?? "bottom") === key
                  ? "bg-glow-purple/25 text-white"
                  : "text-white/45 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 텍스트 레이어 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/60">{t.thumbnail.layersLabel}</p>
          <button
            type="button"
            onClick={addLayer}
            className="inline-flex items-center gap-1 rounded-lg border border-glow-emerald/35 bg-glow-emerald/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-glow-emerald/20"
          >
            <Plus className="h-3 w-3" />
            {t.thumbnail.addLine}
          </button>
        </div>

        {layers.map((layer, idx) => {
          const isActive = layer.id === (activeLayer?.id ?? activeLayerId);
          return (
            <div
              key={layer.id}
              className={`rounded-xl border p-3 transition ${
                isActive
                  ? "border-glow-purple/45 bg-glow-purple/10"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLayerId(layer.id)}
                  className={`min-w-0 truncate rounded-lg px-2 py-1 text-left text-[11px] font-medium ${
                    isActive
                      ? "bg-glow-emerald/20 text-glow-emerald"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {t.thumbnail.lineN.replace("{n}", String(idx + 1))}
                  {abVariant && idx === layers.length - 1 && layers.length > 1
                    ? " · B"
                    : idx === 0 && abVariant
                      ? " · A"
                      : ""}
                </button>
                <button
                  type="button"
                  onClick={() => deleteLayerById(layer.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400/35 bg-red-500/10 text-red-300 transition hover:border-red-400/60 hover:bg-red-500/25"
                  aria-label="Delete layer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                ref={(el) => {
                  textareaRefs.current[layer.id] = el;
                }}
                value={layer.text}
                onFocus={() => setActiveLayerId(layer.id)}
                onChange={(e) => {
                  setActiveLayerId(layer.id);
                  const pure = stripStickerTokens(e.target.value);
                  setLayers((prev) =>
                    prev.map((l) =>
                      l.id === layer.id ? { ...l, text: pure, ranges: [] } : l
                    )
                  );
                }}
                rows={idx === 0 ? 2 : 3}
                placeholder={t.thumbnail.textPlaceholder}
                className="font-emoji w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-glow-emerald/40 focus:ring-2 focus:ring-glow-emerald/20"
                style={{
                  fontFamily: fontForText(layer.fontPreset, layer.text || "가A"),
                  fontWeight: clampFontWeight(
                    layer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                  ),
                  fontVariantEmoji: "emoji",
                }}
              />
              {layer.stickerId ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(() => {
                    const badge = STICKER_BADGES[layer.stickerId!];
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLayerId(layer.id);
                          setLayers((prev) =>
                            prev.map((l) =>
                              l.id === layer.id ? { ...l, stickerId: null } : l
                            )
                          );
                        }}
                        className="font-emoji rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold"
                        style={{
                          borderColor: badge.stroke,
                          backgroundColor: badge.fill,
                          color: badge.textColor,
                        }}
                      >
                        {badge.emoji ? (
                          <span className="font-emoji mr-0.5" aria-hidden>
                            {badge.emoji}
                          </span>
                        ) : null}
                        {badge.label} ×
                      </button>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {activeLayer ? (
        <div className="flex flex-col gap-5 border-t border-white/10 pt-4">
          <div>
            <p className="mb-2 text-xs font-medium text-white/60">
              {t.thumbnail.symbolsLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_QUICK.map((s) => (
                <button
                  key={s}
                  type="button"
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
            selectedId={activeLayer.stickerId}
            onPick={insertSticker}
          />

          <div>
            <p className="mb-2 text-xs font-medium text-white/60">
              {t.thumbnail.fontLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FONT_KEYS.map((fp) => (
                <button
                  key={fp}
                  type="button"
                  onClick={() => updateActive({ fontPreset: fp })}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                    activeLayer.fontPreset === fp
                      ? "bg-white text-black"
                      : "bg-black/25 text-white/45 hover:text-white/80"
                  }`}
                  style={{
                    fontFamily: `"${FONT_PRESET_PRIMARY[fp]}", ${fontForText(fp, "가A")}`,
                    fontWeight: 700,
                  }}
                >
                  {t.thumbnail.fonts[fp] ?? fp}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>{t.thumbnail.sizeLabel}</span>
              <span className="tabular-nums text-white/80">
                {activeLayer.fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={24}
              max={120}
              value={activeLayer.fontSize}
              onChange={(e) => updateActive({ fontSize: Number(e.target.value) })}
              className="w-full accent-emerald-400"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-white/60">
              {t.thumbnail.alignLabel}
            </p>
            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/25">
              {alignBtn("left", AlignLeft, t.thumbnail.alignLeft)}
              {alignBtn("center", AlignCenter, t.thumbnail.alignCenter)}
              {alignBtn("right", AlignRight, t.thumbnail.alignRight)}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>{t.shorts.studioFontWeight}</span>
              <span className="tabular-nums text-white/80">
                {clampFontWeight(
                  activeLayer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
                )}
              </span>
            </div>
            <input
              type="range"
              min={SHORTS_FONT_WEIGHT_MIN}
              max={SHORTS_FONT_WEIGHT_MAX}
              step={SHORTS_FONT_WEIGHT_STEP}
              value={clampFontWeight(
                activeLayer.fontWeight ?? SHORTS_FONT_WEIGHT_DEFAULT
              )}
              onChange={(e) =>
                updateActive({
                  fontWeight: clampFontWeight(Number(e.target.value)),
                })
              }
              className="w-full accent-emerald-400"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>{t.shorts.studioBoxWidth}</span>
              <span className="tabular-nums text-white/80">
                {Math.round(clampBoxWidth(activeLayer.maxWidth ?? 0.88) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={SHORTS_BOX_WIDTH_MIN}
              max={SHORTS_BOX_WIDTH_MAX}
              step={0.01}
              value={clampBoxWidth(activeLayer.maxWidth ?? 0.88)}
              onChange={(e) =>
                updateActive({
                  maxWidth: clampBoxWidth(Number(e.target.value)),
                })
              }
              className="w-full accent-emerald-400"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/80">
              <span>{t.shorts.studioBgBox}</span>
              <input
                type="checkbox"
                checked={Boolean(activeLayer.showBox)}
                onChange={(e) => updateActive({ showBox: e.target.checked })}
                className="h-4 w-4 accent-emerald-400"
              />
            </label>
            {activeLayer.showBox ? (
              <>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white/80">
                  <span>{t.shorts.studioBgBorder}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(activeLayer.showBoxBorder)}
                    onChange={(e) =>
                      updateActive({ showBoxBorder: e.target.checked })
                    }
                    className="h-4 w-4 accent-emerald-400"
                  />
                </label>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-white/45">
                    <span>{t.shorts.studioBgOpacity}</span>
                    <span>
                      {Math.round((activeLayer.boxOpacity ?? 0.55) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={0.9}
                    step={0.05}
                    value={activeLayer.boxOpacity ?? 0.55}
                    onChange={(e) =>
                      updateActive({ boxOpacity: Number(e.target.value) })
                    }
                    className="w-full accent-emerald-400"
                  />
                </div>
              </>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-white/60">
              {t.thumbnail.colorLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {SHORTS_COLOR_PRESET_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={t.thumbnail.colors[c]}
                  aria-label={t.thumbnail.colors[c]}
                  onClick={() => applySelectionColor(c)}
                  className={`h-8 w-8 rounded-full ring-2 transition ${
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
        </div>
      ) : null}

      <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" />
          {t.thumbnail.saveAlbum}
          <span className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/90">
            1크레딧
          </span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="btn-secondary w-full py-2.5 text-sm disabled:opacity-50"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          {t.thumbnail.share}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void handleKakaoShare()}
          disabled={kakaoBusy}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{t.thumbnail.kakaoShare}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleYoutubeShare()}
          disabled={youtubeBusy}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
        >
          <MonitorPlay className="h-4 w-4 shrink-0" />
          <span className="truncate">{t.thumbnail.youtubeShare}</span>
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void handlePrint("png")}
          disabled={busy}
          className="btn-secondary w-full py-2 text-xs disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {t.thumbnail.printPng}
        </button>
        <button
          type="button"
          onClick={() => void handlePrint("pdf")}
          disabled={busy}
          className="btn-secondary w-full py-2 text-xs disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          {t.thumbnail.printPdf}
        </button>
      </div>
      {t.thumbnail.creditNote ? (
        <p className="text-[11px] text-white/35">{t.thumbnail.creditNote}</p>
      ) : null}
    </div>
  );
}
