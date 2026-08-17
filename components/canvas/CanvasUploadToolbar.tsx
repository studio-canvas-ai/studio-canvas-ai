"use client";

/**
 * Compact [삭제] [원본업로드] [배경제거업로드] toolbar — shared by
 * Template Studio and Print Smart Form (PreviewCanvas header).
 */

import { useRef, useState } from "react";
import { Eraser, ImagePlus, Trash2, Upload } from "lucide-react";
import { useFeedback } from "@/components/FeedbackProvider";
import { useCanvasStore } from "@/lib/canvas/canvasStore";
import { addPhotoLayerFromFile } from "@/lib/canvas/addPhotoLayer";

export type CanvasUploadToolbarProps = {
  className?: string;
  /** Compact chips for title-row placement */
  dense?: boolean;
  /** Force single-line horizontal layout (no wrap). */
  nowrap?: boolean;
  /** Extra hook after a successful mutation (e.g. persist wizard session). */
  onLayersChanged?: () => void;
  /** Called after delete so parent can clear subject plane etc. */
  onDeleteObject?: (id: string, type: string) => void;
  disabled?: boolean;
};

export default function CanvasUploadToolbar({
  className = "",
  dense = false,
  nowrap = false,
  onLayersChanged,
  onDeleteObject,
  disabled = false,
}: CanvasUploadToolbarProps) {
  const { showToast } = useFeedback();
  const originalInputRef = useRef<HTMLInputElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"original" | "cutout" | null>(null);

  const selectedId = useCanvasStore((s) => s.selectedId);
  const selected = useCanvasStore((s) =>
    s.objects.find((o) => o.id === s.selectedId) ?? null
  );
  const canDelete = Boolean(
    selected && !selected.locked && selected.type !== "background"
  );

  const btn =
    dense
      ? "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition disabled:opacity-40"
      : "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition disabled:opacity-40";

  const deleteSelected = () => {
    const store = useCanvasStore.getState();
    const id = store.selectedId;
    if (!id) {
      showToast("삭제할 객체를 선택해 주세요.", "info");
      return;
    }
    const obj = store.objects.find((o) => o.id === id);
    if (!obj || obj.locked || obj.type === "background") {
      showToast("이 객체는 삭제할 수 없습니다.", "info");
      return;
    }
    onDeleteObject?.(obj.id, obj.type);
    store.removeObject(id);
    onLayersChanged?.();
    showToast("선택한 객체를 삭제했습니다.", "success");
  };

  const pick = (mode: "original" | "cutout", file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    void (async () => {
      setBusy(mode);
      try {
        await addPhotoLayerFromFile(file, { mode });
        onLayersChanged?.();
        showToast(
          mode === "cutout"
            ? "배경 제거 후 새 레이어로 추가했습니다."
            : "원본 사진을 새 레이어로 추가했습니다.",
          "success"
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "사진 업로드에 실패했습니다.",
          "error"
        );
      } finally {
        setBusy(null);
        if (originalInputRef.current) originalInputRef.current.value = "";
        if (cutoutInputRef.current) cutoutInputRef.current.value = "";
      }
    })();
  };

  return (
    <div
      className={`flex items-center gap-1.5 ${
        nowrap ? "flex-nowrap" : "flex-wrap"
      } ${className}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || !canDelete || Boolean(busy)}
        onClick={deleteSelected}
        className={`${btn} border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20`}
        title="선택 객체 삭제"
      >
        <Trash2 className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
        삭제
      </button>
      <button
        type="button"
        disabled={disabled || Boolean(busy)}
        onClick={() => originalInputRef.current?.click()}
        className={`${btn} border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
        title="원본(배경 포함) 레이어 추가"
      >
        <Upload className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {busy === "original" ? "올리는 중…" : "원본업로드"}
      </button>
      <button
        type="button"
        disabled={disabled || Boolean(busy)}
        onClick={() => cutoutInputRef.current?.click()}
        className={`${btn} border-indigo-400/35 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20`}
        title="배경 제거 후 피사체 레이어 추가"
      >
        {busy === "cutout" ? (
          <Eraser className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
        ) : (
          <ImagePlus className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
        )}
        {busy === "cutout" ? "누끼 중…" : "배경제거업로드"}
      </button>
      <input
        ref={originalInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={Boolean(busy)}
        onChange={(e) => pick("original", e.target.files?.[0] ?? null)}
      />
      <input
        ref={cutoutInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={Boolean(busy)}
        onChange={(e) => pick("cutout", e.target.files?.[0] ?? null)}
      />
      <span className="sr-only">{selectedId || "none"}</span>
    </div>
  );
}
