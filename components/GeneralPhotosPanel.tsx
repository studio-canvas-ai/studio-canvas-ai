"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, Wand2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import { useCredits } from "@/components/CreditsProvider";
import { MAX_UPLOAD_BYTES } from "@/lib/data";
import {
  GENERAL_PHOTOS_UPDATED_EVENT,
  deleteGeneralPhotoRemote,
  fetchGeneralPhotos,
  uploadGeneralPhotoFile,
  type GeneralPhoto,
  type GeneralPhotoQuota,
} from "@/lib/generalPhotos";
import {
  compressFileForCloudUpload,
  isAcceptedImageFile,
  yieldToMain,
} from "@/lib/processUpload";

const GALLERY_ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,.svg,image/jpeg,image/png,image/webp,image/heic,image/heif,image/svg+xml";

export default function GeneralPhotosPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const { showToast, confirm } = useFeedback();
  const { isAuthenticated, openAuthModal } = useCredits();
  const [photos, setPhotos] = useState<GeneralPhoto[]>([]);
  const [quota, setQuota] = useState<GeneralPhotoQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [jumpBusyId, setJumpBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setPhotos([]);
      setQuota(null);
      setLoading(false);
      return;
    }
    const result = await fetchGeneralPhotos();
    setPhotos(result.photos);
    setQuota(result.quota);
    setLoading(false);
    if (result.status === 401) {
      setError(t.gallery.photosSignInRequired);
    }
  }, [isAuthenticated, t.gallery.photosSignInRequired]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(GENERAL_PHOTOS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(GENERAL_PHOTOS_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const showStorageFull = async () => {
    await confirm({
      title: t.gallery.photosQuotaTitle,
      message: t.gallery.photosQuotaPaidFull,
      confirmLabel: t.common.confirm,
      cancelLabel: t.common.close,
    });
  };

  const handleUpload = async (fileList: FileList | File[] | null) => {
    if (!fileList || (fileList instanceof FileList ? !fileList.length : !fileList.length)) {
      return;
    }
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const room =
        quota?.remaining ?? Math.max(0, (quota?.limit ?? 0) - photos.length);
      if (room < 1) {
        await showStorageFull();
        setError(t.gallery.photosQuotaPaidFull);
        return;
      }

      const files = Array.from(fileList as FileList | File[]).slice(0, room);
      let uploaded = 0;
      const failures: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!isAcceptedImageFile(file)) {
          failures.push(file.name);
          continue;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          failures.push(file.name);
          continue;
        }

        try {
          await yieldToMain();
          const compressed = await compressFileForCloudUpload(file);
          await yieldToMain();
          const result = await uploadGeneralPhotoFile(compressed, file.name, {
            silent: true,
          });

          if (!result.ok) {
            if (result.error === "storage_full") {
              await showStorageFull();
              setError(result.message ?? t.gallery.photosQuotaPaidFull);
              break;
            }
            if (result.status === 429) {
              setError(t.gallery.photosRateLimited);
              break;
            }
            if (result.status === 401) {
              openAuthModal();
              break;
            }
            failures.push(file.name);
            continue;
          }

          uploaded += 1;
          if (result.photo) {
            setPhotos((prev) => [
              result.photo!,
              ...prev.filter((p) => p.id !== result.photo!.id),
            ]);
          }
          if (result.quota) {
            setQuota((prev) =>
              prev
                ? {
                    ...prev,
                    used: result.quota!.used,
                    limit: result.quota!.limit,
                    remaining:
                      result.quota!.remaining ??
                      Math.max(0, result.quota!.limit - result.quota!.used),
                  }
                : prev
            );
          }
        } catch {
          failures.push(file.name);
        }
      }

      if (uploaded > 0) {
        showToast(t.gallery.photosSaved, "success");
        // Single refresh after the batch (avoids mid-upload stutter).
        void refresh();
      }
      if (failures.length && uploaded === 0) {
        setError(t.gallery.photosUploadError);
      } else if (failures.length) {
        setError(t.gallery.photosUploadError);
      } else {
        setError(null);
      }
    } catch {
      setError(t.gallery.photosUploadError);
    } finally {
      setBusy(false);
    }
  };

  const goEdit = async (photo: GeneralPhoto) => {
    setJumpBusyId(photo.id);
    try {
      const params = new URLSearchParams();
      params.set("photoId", photo.id);
      params.set("source", "general-photo");
      router.push(`/template-studio?${params.toString()}`);
    } finally {
      setJumpBusyId(null);
    }
  };

  const handleDelete = async (photo: GeneralPhoto) => {
    const ok = await confirm({
      title: t.gallery.photosDelete,
      message: t.gallery.photosDeleteConfirm,
      confirmLabel: t.gallery.worksDeleteYes,
      cancelLabel: t.gallery.worksDeleteNo,
      tone: "danger",
    });
    if (!ok) return;

    // Optimistic UI — remove immediately so confirm feels instant.
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setQuota((prev) =>
      prev
        ? {
            ...prev,
            used: Math.max(0, prev.used - 1),
            remaining: Math.min(prev.limit, prev.remaining + 1),
          }
        : prev
    );

    const result = await deleteGeneralPhotoRemote(photo.id);
    if (result.ok) {
      showToast(t.gallery.photosDeleteDone, "success");
      return;
    }

    // Roll back if server rejected (e.g. already gone / auth).
    showToast(t.gallery.photosUploadError, "error");
    void refresh();
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files?.length) void handleUpload(files);
  };

  if (!isAuthenticated) {
    return (
      <div className="glass-card space-y-4 p-4 sm:p-6">
        <h3 className="text-sm font-medium text-white/80">{t.gallery.photosTitle}</h3>
        <p className="text-sm text-white/50">{t.gallery.photosSignInRequired}</p>
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="btn-primary px-4 py-2.5 text-sm"
        >
          {t.nav.login}
        </button>
      </div>
    );
  }

  const storageFull = quota != null && quota.remaining < 1;

  return (
    <div className="glass-card space-y-4 p-4 sm:p-6">
      <div>
        <h3 className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
          <ImagePlus className="h-4 w-4 text-glow-emerald" />
          {t.gallery.photosTitle}
        </h3>
        {quota != null && (
          <p className="mt-1 text-xs text-white/40">
            {quota.used}/{quota.limit}
          </p>
        )}
      </div>

      {/* Same dashed dropzone pattern as FaceProfilePanel (AI model upload). */}
      <label
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition sm:min-h-[260px] ${
          dragOver
            ? "border-glow-emerald/70 bg-emerald-500/10"
            : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]"
        } ${busy || loading || storageFull ? "pointer-events-none opacity-50" : ""}`}
      >
        <ImagePlus
          className={`h-10 w-10 ${dragOver ? "text-glow-emerald" : "text-white/30"}`}
        />
        <div className="space-y-1">
          <p className="text-base font-semibold text-white/85">
            {busy ? t.gallery.photosUploading : t.gallery.photosUpload}
          </p>
          <p className="text-sm text-white/50">{t.gallery.photosDropHint}</p>
          <p className="text-xs text-white/35">
            JPG, JPEG, PNG, WebP, HEIC, SVG · 최대 20MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={GALLERY_ACCEPT_ATTR}
          className="hidden"
          disabled={busy || loading || storageFull}
          onChange={(e) => {
            void handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="text-xs text-amber-200">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-sm text-white/45">
          {t.gallery.photosLoading}
        </p>
      ) : photos.length === 0 ? (
        <p className="text-center text-sm text-white/45">{t.gallery.photosEmpty}</p>
      ) : (
        <div className="max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain rounded-xl border border-white/5 bg-black/10 p-2 sm:p-3">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <div className="relative aspect-square bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.name ?? ""}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex gap-2 p-3">
                  <button
                    type="button"
                    disabled={jumpBusyId === photo.id}
                    onClick={() => void goEdit(photo)}
                    className="btn-primary inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 py-2 text-xs disabled:opacity-50"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {t.gallery.createDraftFromPhoto}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(photo)}
                    className="inline-flex items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-200 hover:bg-red-500/20"
                    aria-label={t.gallery.photosDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
