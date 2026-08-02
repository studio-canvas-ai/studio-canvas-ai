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
  Minus,
  MonitorPlay,
  Plus,
  Share2,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import type { AspectRatioKey } from "@/lib/downloadImage";
import { downloadCanvasPrint } from "@/lib/printExport";
import { estimateCtrScore } from "@/lib/releaseNotes";
import {
  COLOR_PRESET_ORDER,
  COLOR_PRESETS,
  EMOJI_QUICK,
  STICKER_BADGE_IDS,
  STICKER_BADGES,
  applyColorRange,
  colorAtIndex,
  createLayer,
  drawEmojiChar,
  forEachCodePoint,
  measureStickerBadge,
  drawStickerBadge,
  fontForChar,
  isEmojiChar,
  stripStickerTokens,
  type ColorPreset,
  type DepthMode,
  type FontPreset,
  type TextAlign,
  type TextLayer,
  type TextPos,
  type StickerBadgeId,
} from "@/lib/thumbnailStyles";

type Props = {
  imageUrl: string;
  aspectRatio: AspectRatioKey;
};

type LayerAnchor = {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
};

type DragState = {
  layerId: string;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
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

export default function ThumbnailEditor({ imageUrl, aspectRatio }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Selection guide lives on its own layer so exports stay free of editor chrome. */
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const layerAnchorsRef = useRef<LayerAnchor[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const [layers, setLayers] = useState<TextLayer[]>([
    createLayer({ text: "", color: "yellow", pos: "bottom" }),
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("");
  const [depth, setDepth] = useState<DepthMode>("front");
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState(false);
  const [abVariant, setAbVariant] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const aspect = useMemo(() => {
    if (aspectRatio === "16:9") return 16 / 9;
    if (aspectRatio === "1:1") return 1;
    if (aspectRatio === "a4") return 1 / Math.SQRT2;
    return 9 / 16;
  }, [aspectRatio]);

  const canvasSize = useMemo(() => {
    if (aspectRatio === "16:9") return { width: 1280, height: Math.round(1280 / aspect) };
    if (aspectRatio === "a4") return { width: 1240, height: Math.round(1240 / aspect) };
    if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
    return { width: 1080, height: Math.round(1080 / aspect) };
  }, [aspect, aspectRatio]);

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
      const pureText = stripStickerTokens(text);
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      let totalWidth = 0;
      forEachCodePoint(pureText, (ch) => {
        if (isEmojiChar(ch)) {
          totalWidth += fontSize * 1.1;
        } else {
          ctx.font = `700 ${fontSize}px ${fontForChar(fontPreset, ch)}`;
          totalWidth += ctx.measureText(ch).width;
        }
      });

      let x =
        align === "left"
          ? width * 0.08
          : align === "right"
            ? width * 0.92 - totalWidth
            : xAnchor - totalWidth / 2;

      x += layer.offsetX * width;
      const drawY = y + layer.offsetY * canvasSize.height;

      forEachCodePoint(pureText, (ch, utf16Index) => {
        if (isEmojiChar(ch)) {
          const w = drawEmojiChar(ctx, ch, x, drawY, fontSize);
          x += w;
          return;
        }
        const presetKey = colorAtIndex(layer, utf16Index);
        const preset = COLOR_PRESETS[presetKey];
        ctx.font = `700 ${fontSize}px ${fontForChar(fontPreset, ch)}`;
        const w = ctx.measureText(ch).width;
        ctx.shadowColor = preset.shadow;
        ctx.shadowBlur =
          presetKey === "white" || presetKey === "purplePink" ? 12 : 6;
        ctx.lineWidth = Math.max(3, fontSize * 0.08);
        if (preset.stroke !== "transparent") {
          ctx.strokeStyle = preset.stroke;
          ctx.strokeText(ch, x, drawY);
        }
        ctx.fillStyle = preset.fill;
        ctx.fillText(ch, x, drawY);
        x += w;
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
      const pureText = stripStickerTokens(layer.text);

      let totalWidth = 0;
      forEachCodePoint(pureText, (ch) => {
        if (isEmojiChar(ch)) {
          totalWidth += fontSize * 1.1;
        } else {
          ctx.font = `700 ${fontSize}px ${fontForChar(fontPreset, ch)}`;
          totalWidth += ctx.measureText(ch).width;
        }
      });

      // Keep an interactive footprint even when the layer has no text yet.
      const boxWidth = Math.max(totalWidth, fontSize * 2.2);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvasSize;
    canvas.width = width;
    canvas.height = height;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ir = img.naturalWidth / img.naturalHeight;
      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (ir > aspect) {
        sw = img.naturalHeight * aspect;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / aspect;
        sy = (img.naturalHeight - sh) / 2;
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
        // Timestamp cover zone (bottom-right)
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

    };
    img.src = imageUrl;
  }, [
    imageUrl,
    aspect,
    canvasSize,
    layers,
    depth,
    showSafeZone,
    youtubePreview,
    drawStyledText,
    t.thumbnail.timestampSafe,
  ]);

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
    if (!layerId) return;
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
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
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dxNorm = (e.clientX - drag.startClientX) / rect.width;
    const dyNorm = (e.clientY - drag.startClientY) / rect.height;
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
      updateActive({ color });
      return;
    }
    updateActive({
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
      pos: activeLayer?.pos ?? "bottom",
    });
    setLayers((prev) => [...prev, layer]);
    setActiveLayerId(layer.id);
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

  const exportBlob = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
    });
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studio-canvas-thumbnail-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async (format: "png" | "pdf") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      await downloadCanvasPrint(canvas, format, "a4");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      if (!blob) return;
      const file = new File([blob], `studio-canvas-thumbnail-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Studio Canvas AI",
          text: t.thumbnail.shareText,
        });
        return;
      }
      await handleDownload();
    } catch {
      // cancelled
    } finally {
      setBusy(false);
    }
  };

  const handleKakaoShare = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      if (blob) {
        const file = new File(
          [blob],
          `studio-canvas-thumbnail-${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Studio Canvas AI",
            text: t.thumbnail.shareText,
            url: window.location.href,
          });
          return;
        }
        if (navigator.share) {
          await navigator.share({
            title: "Studio Canvas AI",
            text: t.thumbnail.shareText,
            url: window.location.href,
          });
          return;
        }
      }
      const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(window.location.href)}`;
      const opened = window.open(kakaoUrl, "_blank", "noopener,noreferrer");
      if (!opened) await handleDownload();
    } catch {
      try {
        const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(window.location.href)}`;
        window.open(kakaoUrl, "_blank", "noopener,noreferrer");
      } catch {
        await handleDownload();
      }
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    active
      ? "border-glow-purple/50 bg-glow-purple/15 text-white"
      : "border-white/10 text-white/45";

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-white/80">{t.thumbnail.title}</h4>
        <span className="rounded-full border border-glow-emerald/30 bg-glow-emerald/10 px-2.5 py-1 text-[10px] text-emerald-200">
          {t.thumbnail.freeBadge}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
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

      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
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
        <p className="mb-2 text-xs text-white/50">{t.thumbnail.positionLabel}</p>
        <div className="flex flex-wrap gap-2">
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
              onClick={() =>
                updateActive({ pos: key as TextPos, offsetY: 0 })
              }
              className={`rounded-full border px-3 py-1.5 text-xs ${chip(
                (activeLayer?.pos ?? "bottom") === key
              )}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-white/50">{t.thumbnail.layersLabel}</p>
          <button
            type="button"
            onClick={addLayer}
            className="inline-flex items-center gap-1 rounded-full border border-glow-emerald/30 px-3 py-1 text-[11px] text-emerald-200"
          >
            <Plus className="h-3 w-3" />
            {t.thumbnail.addLine}
          </button>
        </div>

        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            className={`rounded-xl border p-3 ${
              layer.id === activeLayer?.id
                ? "border-glow-purple/40 bg-glow-purple/5"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveLayerId(layer.id)}
              className="mb-2 text-[11px] text-white/40"
            >
              {t.thumbnail.lineN.replace("{n}", String(idx + 1))}
              {abVariant && idx === layers.length - 1 && layers.length > 1
                ? " · B"
                : idx === 0 && abVariant
                  ? " · A"
                  : ""}
            </button>
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
                    l.id === layer.id
                      ? { ...l, text: pure, ranges: [] }
                      : l
                  )
                );
              }}
              rows={2}
              placeholder={t.thumbnail.textPlaceholder}
              className="font-emoji w-full resize-y rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-300 focus:border-glow-purple/40"
            />
            {layer.stickerId && (
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
                      title="Remove sticker"
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
            )}
            <p className="mt-1 text-[10px] text-white/30">{t.thumbnail.selectionHint}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs text-white/50">{t.thumbnail.symbolsLabel}</p>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_QUICK.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => insertSymbol(s)}
              className="font-emoji rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/80 hover:border-white/25"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-white/50">{t.thumbnail.stickers}</p>
        <div className="flex flex-wrap gap-1.5">
          {STICKER_BADGE_IDS.map((id) => {
            const badge = STICKER_BADGES[id];
            const selected = activeLayer?.stickerId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => insertSticker(id)}
                className={`font-emoji rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide ${
                  selected ? "ring-2 ring-white/70" : ""
                }`}
                style={{
                  borderColor: badge.stroke,
                  backgroundColor: badge.fill,
                  color: badge.textColor,
                  boxShadow: selected ? `0 0 14px ${badge.glow}` : "0 0 10px rgba(0,0,0,0.25)",
                }}
              >
                {badge.emoji ? (
                  <span className="font-emoji mr-1" aria-hidden>
                    {badge.emoji}
                  </span>
                ) : null}
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeLayer && (
        <>
          <div>
            <p className="mb-2 text-xs text-white/50">{t.thumbnail.alignLabel}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["left", AlignLeft, t.thumbnail.alignLeft],
                  ["center", AlignCenter, t.thumbnail.alignCenter],
                  ["right", AlignRight, t.thumbnail.alignRight],
                ] as const
              ).map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateActive({ align: key as TextAlign })}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${chip(activeLayer.align === key)}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-white/50">{t.thumbnail.colorLabel}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COLOR_PRESET_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applySelectionColor(key)}
                  className={`rounded-xl border px-2 py-2 text-[11px] leading-tight ${
                    activeLayer.color === key
                      ? "border-glow-emerald/50 bg-glow-emerald/10 text-white"
                      : "border-white/10 text-white/50"
                  }`}
                >
                  {t.thumbnail.colors[key]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-white/50">{t.thumbnail.fontLabel}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["variety", t.thumbnail.fonts.variety],
                  ["clean", t.thumbnail.fonts.clean],
                  ["vlog", t.thumbnail.fonts.vlog],
                  ["neon", t.thumbnail.fonts.neon],
                  ["impact", t.thumbnail.fonts.impact],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateActive({ fontPreset: key as FontPreset })}
                  className={`rounded-full border px-3 py-1.5 text-xs ${chip(activeLayer.fontPreset === key)}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-white/50">{t.thumbnail.sizeLabel}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateActive({
                      fontSize: Math.max(24, activeLayer.fontSize - 4),
                    })
                  }
                  className="rounded-lg border border-white/10 p-1.5 text-white/70"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2.5rem] text-center text-xs text-white/70">
                  {activeLayer.fontSize}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateActive({
                      fontSize: Math.min(120, activeLayer.fontSize + 4),
                    })
                  }
                  className="rounded-lg border border-white/10 p-1.5 text-white/70"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={24}
              max={120}
              value={activeLayer.fontSize}
              onChange={(e) => updateActive({ fontSize: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[36, 48, 64, 80].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateActive({ fontSize: n })}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45"
                >
                  {n}px
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" />
          {t.thumbnail.saveAlbum}
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
      <button
        type="button"
        onClick={() => void handleKakaoShare()}
        disabled={busy}
        className="btn-secondary w-full py-2.5 text-sm disabled:opacity-50"
      >
        <Share2 className="h-4 w-4 shrink-0" />
        {t.thumbnail.kakaoShare}
      </button>
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
