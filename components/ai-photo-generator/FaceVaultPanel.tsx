"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { useFeedback } from "@/components/FeedbackProvider";
import { useI18n } from "@/components/I18nProvider";
import type { PhotoKind } from "@/lib/canvas/addPhotoLayer";
import {
  isAllowedPrintPhotoFile,
  PRINT_PHOTO_ACCEPT,
  PRINT_PHOTO_FORMAT_HINT,
} from "@/lib/printWizardPhotoLayers";
import {
  getActiveTrainedVaultId,
  listTrainedVault,
  listUploadVault,
  PHOTO_TRAINED_VAULT_CHANGED_EVENT,
  PHOTO_UPLOAD_VAULT_CHANGED_EVENT,
  PHOTO_VAULT_MAX,
  pushTrainedVaultItem,
  removeTrainedVaultItem,
  removeUploadVaultItem,
  setActiveTrainedVaultId,
  type PhotoVaultItem,
} from "@/lib/photoVaultStorage";
import { recoverStudioStores } from "@/lib/studioStore/clientRecovery";

export type FaceVaultPanelProps = {
  onTrainedReady: (item: PhotoVaultItem) => void | Promise<void>;
  onInstallFile?: (file: File, mode: PhotoKind) => Promise<void>;
  onVaultItemRemoved?: (item: PhotoVaultItem) => void;
};

const TRAIN_MIN_MS = 1200;

function VaultThumb({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="max-h-full max-w-full object-contain"
      draggable={false}
    />
  );
}

type VaultThumbStripProps = {
  label: string;
  items: PhotoVaultItem[];
  selectedId?: string;
  disabled?: boolean;
  accent?: "default" | "trained";
  onPick: (item: PhotoVaultItem) => void;
  onDelete: (item: PhotoVaultItem) => void;
};

/** Compact horizontal thumb row — ~7–8 per line, corner trash only. */
function VaultThumbStrip({
  label,
  items,
  selectedId,
  disabled = false,
  accent = "default",
  onPick,
  onDelete,
}: VaultThumbStripProps) {
  const selectedRing =
    accent === "trained"
      ? "border-emerald-400 ring-1 ring-emerald-400/50"
      : "border-indigo-400 ring-1 ring-indigo-400/50";

  return (
    <div className="shrink-0 space-y-1.5">
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[11px] font-semibold text-slate-400">{label}</span>
        <span className="text-[10px] font-medium text-slate-500">
          {items.length}/{PHOTO_VAULT_MAX}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="flex h-11 items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-[#0B0F19] text-[10px] text-slate-600">
          비어 있음
        </div>
      ) : (
        <div
          role="listbox"
          aria-label={label}
          className="flex flex-row flex-wrap gap-1 rounded-lg border border-slate-800 bg-[#0B0F19] p-1"
        >
          {items.map((item) => {
            const isOn = item.id === selectedId;
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={isOn}
                className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-[#0E1420] ${
                  isOn
                    ? selectedRing
                    : "border-slate-700 hover:border-slate-500"
                } ${disabled ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(item)}
                  className="flex h-full w-full items-center justify-center p-0.5 disabled:cursor-not-allowed"
                  aria-label={item.label}
                >
                  <VaultThumb src={item.src} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  title="삭제"
                  aria-label="삭제"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  className="absolute right-0 top-0 z-[2] inline-flex h-4 w-4 items-center justify-center rounded-bl-md bg-black/75 text-white/90 transition hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-2.5 w-2.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FaceVaultPanel({
  onTrainedReady,
  onInstallFile,
  onVaultItemRemoved,
}: FaceVaultPanelProps) {
  const { showToast } = useFeedback();
  const { t } = useI18n();
  const cs = t.canvasStudio;
  const [uploads, setUploads] = useState<PhotoVaultItem[]>([]);
  const [trained, setTrained] = useState<PhotoVaultItem[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [selectedTrainedId, setSelectedTrainedId] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [training, setTraining] = useState(false);
  const [trainReady, setTrainReady] = useState(false);
  const [uploadBusy, setUploadBusy] = useState<"original" | "cutout" | null>(
    null
  );
  const trainSeqRef = useRef(0);
  const originalInputRef = useRef<HTMLInputElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);

  const refreshUploads = () => setUploads(listUploadVault());
  const refreshTrained = () => setTrained(listTrainedVault());

  useEffect(() => {
    void recoverStudioStores().then(() => {
      refreshUploads();
      refreshTrained();
      const activeId = getActiveTrainedVaultId();
      if (activeId) setSelectedTrainedId(activeId);
    });
    refreshUploads();
    refreshTrained();
    const activeId = getActiveTrainedVaultId();
    if (activeId) setSelectedTrainedId(activeId);
    const onUpload = () => refreshUploads();
    const onTrainedEvt = () => {
      refreshTrained();
      const id = getActiveTrainedVaultId();
      if (id) setSelectedTrainedId(id);
    };
    window.addEventListener(PHOTO_UPLOAD_VAULT_CHANGED_EVENT, onUpload);
    window.addEventListener(PHOTO_TRAINED_VAULT_CHANGED_EVENT, onTrainedEvt);
    window.addEventListener("storage", onUpload);
    window.addEventListener("storage", onTrainedEvt);
    return () => {
      window.removeEventListener(PHOTO_UPLOAD_VAULT_CHANGED_EVENT, onUpload);
      window.removeEventListener(
        PHOTO_TRAINED_VAULT_CHANGED_EVENT,
        onTrainedEvt
      );
      window.removeEventListener("storage", onUpload);
      window.removeEventListener("storage", onTrainedEvt);
    };
  }, []);

  useEffect(() => {
    if (!selectedUploadId) return;
    if (uploads.some((u) => u.id === selectedUploadId)) return;
    setSelectedUploadId("");
  }, [uploads, selectedUploadId]);

  useEffect(() => {
    if (!selectedTrainedId) return;
    if (trained.some((t) => t.id === selectedTrainedId)) return;
    setSelectedTrainedId("");
    setTrainReady(false);
  }, [trained, selectedTrainedId]);

  const selectedUpload =
    uploads.find((u) => u.id === selectedUploadId) ?? null;

  const onPickUpload = (item: PhotoVaultItem) => {
    if (training) return;
    setSelectedUploadId(item.id);
    setPreviewSrc(item.src);
    setTrainReady(false);
  };

  const runTrain = async () => {
    const item = selectedUpload;
    if (!item || training) {
      showToast("업로드 저장소에서 학습할 사진을 먼저 선택해 주세요.", "info");
      return;
    }
    const seq = ++trainSeqRef.current;
    setTraining(true);
    setPreviewSrc(item.src);
    const started = Date.now();
    try {
      const remain = Math.max(0, TRAIN_MIN_MS - (Date.now() - started));
      if (remain > 0) {
        await new Promise((r) => window.setTimeout(r, remain));
      }
      if (seq !== trainSeqRef.current) return;

      const trainedItem = pushTrainedVaultItem({
        src: item.src,
        label: item.label,
        photoKind: item.photoKind,
        sourceUploadId: item.id,
      });
      refreshTrained();
      setSelectedTrainedId(trainedItem.id);
      await onTrainedReady(trainedItem);
      setTrainReady(true);
      showToast(
        "학습 완료 — 캔버스에 반영했고 인페인팅 대기 상태입니다.",
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "학습/등록에 실패했습니다.",
        "error"
      );
    } finally {
      if (seq === trainSeqRef.current) {
        setTraining(false);
      }
    }
  };

  const onPickTrained = async (item: PhotoVaultItem) => {
    if (training) return;
    setSelectedTrainedId(item.id);
    setActiveTrainedVaultId(item.id);
    setPreviewSrc(item.src);
    setTrainReady(true);
    try {
      await onTrainedReady(item);
    } catch {
      /* non-blocking */
    }
  };

  const deleteUploadItem = (item: PhotoVaultItem) => {
    if (training) return;
    const removed = removeUploadVaultItem(item.id);
    if (!removed) return;
    refreshUploads();
    if (selectedUploadId === item.id) {
      setSelectedUploadId("");
      if (previewSrc === item.src) setPreviewSrc(null);
      setTrainReady(false);
    }
    onVaultItemRemoved?.(removed);
  };

  const deleteTrainedItem = (item: PhotoVaultItem) => {
    if (training) return;
    const removed = removeTrainedVaultItem(item.id);
    if (!removed) return;
    refreshTrained();
    if (selectedTrainedId === item.id) {
      setSelectedTrainedId("");
      setActiveTrainedVaultId(null);
      setTrainReady(false);
      if (previewSrc === item.src) setPreviewSrc(null);
    }
    onVaultItemRemoved?.(removed);
  };

  const pickUpload = (mode: "original" | "cutout", file: File | null) => {
    if (!file || !onInstallFile) return;
    if (!isAllowedPrintPhotoFile(file)) {
      showToast("JPG, PNG, WebP 이미지만 업로드할 수 있습니다.", "info");
      if (originalInputRef.current) originalInputRef.current.value = "";
      if (cutoutInputRef.current) cutoutInputRef.current.value = "";
      return;
    }
    void (async () => {
      setUploadBusy(mode);
      try {
        await onInstallFile(file, mode);
        refreshUploads();
        const latest = listUploadVault()[0];
        if (latest) {
          setSelectedUploadId(latest.id);
          setPreviewSrc(latest.src);
          setTrainReady(false);
        }
        showToast(
          mode === "cutout"
            ? "배경제거 사진을 업로드 저장소에 담았습니다."
            : "원본 사진을 업로드 저장소에 담았습니다.",
          "success"
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "사진 업로드에 실패했습니다.",
          "error"
        );
      } finally {
        setUploadBusy(null);
        if (originalInputRef.current) originalInputRef.current.value = "";
        if (cutoutInputRef.current) cutoutInputRef.current.value = "";
      }
    })();
  };

  const uploadDisabled = training || Boolean(uploadBusy) || !onInstallFile;
  const trainDisabled = training || !selectedUpload;

  return (
    <section className="relative z-[1] flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] pointer-events-auto sm:p-4">
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button
          type="button"
          disabled={uploadDisabled}
          onClick={() => originalInputRef.current?.click()}
          className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2 py-2.5 text-center transition hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white">
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
            {uploadBusy === "original"
              ? cs.uploadOriginalBusy
              : cs.uploadOriginal}
          </span>
          <span className="text-[10px] font-semibold tracking-tight text-pink-300">
            {PRINT_PHOTO_FORMAT_HINT}
          </span>
        </button>
        <button
          type="button"
          disabled={uploadDisabled}
          onClick={() => cutoutInputRef.current?.click()}
          className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl border border-indigo-400/45 bg-indigo-500/20 px-2 py-2.5 text-center transition hover:border-indigo-300/55 hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-indigo-50">
            <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
            {uploadBusy === "cutout" ? cs.uploadCutoutBusy : cs.uploadCutout}
          </span>
          <span className="text-[10px] font-semibold tracking-tight text-pink-300">
            {PRINT_PHOTO_FORMAT_HINT}
          </span>
        </button>
        <input
          ref={originalInputRef}
          type="file"
          accept={PRINT_PHOTO_ACCEPT}
          className="hidden"
          disabled={uploadDisabled}
          onChange={(e) => pickUpload("original", e.target.files?.[0] ?? null)}
        />
        <input
          ref={cutoutInputRef}
          type="file"
          accept={PRINT_PHOTO_ACCEPT}
          className="hidden"
          disabled={uploadDisabled}
          onChange={(e) => pickUpload("cutout", e.target.files?.[0] ?? null)}
        />
      </div>

      <VaultThumbStrip
        label="업로드 저장소"
        items={uploads}
        selectedId={selectedUploadId}
        disabled={training}
        onPick={onPickUpload}
        onDelete={deleteUploadItem}
      />

      <div className="shrink-0 space-y-1.5">
        <span className="block px-0.5 text-[11px] font-semibold text-slate-400">
          학습 타겟
        </span>
        <div className="relative mx-auto flex h-28 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-600 bg-[#0E1420]">
          {previewSrc ? (
            <VaultThumb src={previewSrc} />
          ) : (
            <span className="px-2 text-center text-[10px] text-slate-600">
              저장소에서 선택
            </span>
          )}
          {training ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-[1px]">
              <Loader2
                className="h-6 w-6 animate-spin text-indigo-200"
                aria-hidden
              />
              <span className="text-[9px] font-semibold text-indigo-100">
                학습 중…
              </span>
            </div>
          ) : null}
        </div>
        {trainReady && !training ? (
          <p className="text-center text-[10px] font-semibold text-emerald-300/90">
            학습 완료 · 인페인팅 대기
          </p>
        ) : (
          <p className="text-center text-[10px] text-slate-500">
            선택 후 학습/등록을 누르면 캔버스에 반영됩니다
          </p>
        )}
        <button
          type="button"
          disabled={trainDisabled}
          onClick={() => void runTrain()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-3 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-900/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {training ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {training ? "학습 중…" : "학습/등록"}
        </button>
      </div>

      <VaultThumbStrip
        label="학습사진 저장소"
        items={trained}
        selectedId={selectedTrainedId}
        disabled={training}
        accent="trained"
        onPick={(item) => void onPickTrained(item)}
        onDelete={deleteTrainedItem}
      />

      <div className="min-h-0 flex-1" aria-hidden />
    </section>
  );
}
