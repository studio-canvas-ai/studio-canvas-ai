"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ImagePlus,
  Trash2,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { useFeedback } from "@/components/FeedbackProvider";
import {
  deleteFaceProfileRemote,
  fetchFaceProfilesFromServer,
  FACE_PROFILES_UPDATED_EVENT,
  listFaceProfiles,
  sanitizeFaceProfilePhotos,
  upsertFaceProfileAndSync,
  type FaceProfile,
} from "@/lib/faceProfiles";
import { TRAIN_CREDIT_COST } from "@/lib/data";
import { processUploadFiles, urlToCompressedDataUrl } from "@/lib/processUpload";
import {
  hasUnlimitedProfileSlots,
  resolveProfileMaxSlots,
} from "@/lib/profileSlotPolicy";
import {
  TRAIN_SELECTION_MAX,
  TRAIN_SELECTION_MIN,
  saveTrainSelection,
} from "@/lib/trainSelection";
import { clearResultSession } from "@/lib/resultSession";

type Props = {
  compact?: boolean;
  onSelect?: (profile: FaceProfile) => void;
  selectedId?: string | null;
};

type PhotoPick = { key: string; url: string; profileId: string; index: number };

const MODEL_ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.svg,image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/svg+xml";

export default function FaceProfilePanel({ compact, onSelect, selectedId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { showToast, confirm } = useFeedback();
  const {
    planId,
    billingInterval,
    authUser,
    isAuthenticated,
    credits,
    unlimitedCredits,
    setShowCreditModal,
  } = useCredits();
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trainBusy, setTrainBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unlimitedSlots = hasUnlimitedProfileSlots(authUser?.email);
  const maxSlots = useMemo(
    () =>
      resolveProfileMaxSlots({
        email: authUser?.email,
        planId,
        billingInterval,
      }),
    [authUser?.email, billingInterval, planId]
  );
  const slotsFull = !unlimitedSlots && profiles.length >= maxSlots;

  const vaultPhotos = useMemo<PhotoPick[]>(() => {
    const out: PhotoPick[] = [];
    for (const profile of profiles) {
      (profile.photoUrls ?? []).forEach((url, index) => {
        if (!url) return;
        out.push({
          key: `${profile.id}::${index}`,
          url,
          profileId: profile.id,
          index,
        });
      });
    }
    return out;
  }, [profiles]);

  const selectedUrls = useMemo(() => {
    const map = new Map(vaultPhotos.map((item) => [item.key, item.url]));
    return selectedKeys.map((key) => map.get(key)).filter((url): url is string => Boolean(url));
  }, [selectedKeys, vaultPhotos]);

  const profileById = useMemo(() => {
    const map = new Map<string, FaceProfile>();
    for (const profile of profiles) map.set(profile.id, profile);
    return map;
  }, [profiles]);

  const canStartTraining =
    selectedUrls.length >= TRAIN_SELECTION_MIN &&
    selectedUrls.length <= TRAIN_SELECTION_MAX;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isAuthenticated) {
        setProfiles([]);
        setSelectedKeys([]);
        return;
      }
      const fromServer = await fetchFaceProfilesFromServer();
      if (cancelled) return;
      setProfiles(sanitizeFaceProfilePhotos(fromServer));
    })();

    const onUpdate = () => {
      if (!isAuthenticated) return;
      setProfiles(sanitizeFaceProfilePhotos(listFaceProfiles()));
    };
    window.addEventListener(FACE_PROFILES_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(FACE_PROFILES_UPDATED_EVENT, onUpdate);
    };
  }, [isAuthenticated]);

  const handleDeleteProfile = async (profile: FaceProfile) => {
    if (deletingId) return;
    const approved = await confirm({
      title: t.profiles.deleteConfirmTitle,
      message: t.profiles.deleteConfirm,
      confirmLabel: t.gallery.worksDeleteYes,
      cancelLabel: t.gallery.worksDeleteNo,
      tone: "danger",
    });
    if (!approved) return;

    setDeletingId(profile.id);
    const prev = profiles;
    setProfiles((list) => list.filter((p) => p.id !== profile.id));
    setSelectedKeys((keys) =>
      keys.filter((key) => !key.startsWith(`${profile.id}::`))
    );

    try {
      const result = await deleteFaceProfileRemote(profile.id);
      if (result.ok) {
        showToast(t.profiles.deleteDone, "success");
        return;
      }
      setProfiles(prev);
      showToast(t.profiles.deleteFailed, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVaultPhoto = async (pick: PhotoPick) => {
    const profile = profiles.find((p) => p.id === pick.profileId);
    if (!profile || deletingId) return;

    const approved = await confirm({
      title: t.profiles.deletePhotoConfirmTitle,
      message: t.profiles.deletePhotoConfirm,
      confirmLabel: t.gallery.worksDeleteYes,
      cancelLabel: t.gallery.worksDeleteNo,
      tone: "danger",
    });
    if (!approved) return;

    const nextUrls = (profile.photoUrls ?? []).filter((_, i) => i !== pick.index);
    if (nextUrls.length === 0) {
      await handleDeleteProfile(profile);
      return;
    }

    setDeletingId(profile.id);
    const prev = profiles;
    const updated: FaceProfile = {
      ...profile,
      photoUrls: nextUrls,
      updatedAt: Date.now(),
    };
    setProfiles((list) =>
      list.map((p) => (p.id === profile.id ? updated : p))
    );
    setSelectedKeys((keys) =>
      keys.filter((key) => !key.startsWith(`${profile.id}::`))
    );

    try {
      const next = await upsertFaceProfileAndSync(updated);
      setProfiles(sanitizeFaceProfilePhotos(next));
      showToast(t.profiles.deletePhotoDone, "success");
    } catch {
      setProfiles(prev);
      showToast(t.profiles.deleteFailed, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const buildDurablePhotos = async (urls: string[]) => {
    const durable: string[] = [];
    for (const url of urls.slice(0, 12)) {
      durable.push(
        url.startsWith("data:image/") ? url : await urlToCompressedDataUrl(url)
      );
    }
    return durable;
  };

  const ingestFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList as FileList | File[]);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, errors } = await processUploadFiles(files, 12 - photos.length);
      if (ok.length) {
        setPhotos((prev) => [...prev, ...ok.map((f) => f.url)].slice(0, 12));
      }
      if (errors.length) setError(t.profiles.uploadError);
    } finally {
      setBusy(false);
    }
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
    if (files?.length) void ingestFiles(files);
  };

  const togglePhoto = (key: string) => {
    setError(null);
    setSelectedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      if (prev.length >= TRAIN_SELECTION_MAX) {
        setError(
          t.profiles.trainSelectMax.replace("{max}", String(TRAIN_SELECTION_MAX))
        );
        return prev;
      }
      return [...prev, key];
    });
  };

  const saveProfile = async (): Promise<FaceProfile | null> => {
    if (!name.trim()) {
      setError(t.profiles.nameRequired);
      return null;
    }
    if (photos.length < 1) {
      setError(t.profiles.photoRequired);
      return null;
    }
    if (!unlimitedSlots && profiles.length >= maxSlots) {
      setError(t.profiles.slotFull.replace("{n}", String(maxSlots)));
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const durablePhotos = await buildDurablePhotos(photos);
      const profile: FaceProfile = {
        id: `fp-${Date.now()}`,
        name: name.trim(),
        slot: profiles.length + 1,
        photoUrls: durablePhotos,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const next = await upsertFaceProfileAndSync(profile);
      const cleaned = sanitizeFaceProfilePhotos(next);
      setProfiles(cleaned);
      setName("");
      setPhotos([]);
      onSelect?.(profile);
      setVaultOpen(true);
      setSelectedKeys(
        durablePhotos
          .slice(0, TRAIN_SELECTION_MAX)
          .map((_, index) => `${profile.id}::${index}`)
      );
      showToast(t.profiles.saveDone, "success");
      return profile;
    } catch {
      setError(t.profiles.uploadError);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const startSelectedTraining = async () => {
    if (!canStartTraining) {
      setError(
        t.profiles.trainSelectRange
          .replace("{min}", String(TRAIN_SELECTION_MIN))
          .replace("{max}", String(TRAIN_SELECTION_MAX))
      );
      setVaultOpen(true);
      return;
    }
    if (!unlimitedCredits && credits < TRAIN_CREDIT_COST) {
      setShowCreditModal(true);
      return;
    }

    setTrainBusy(true);
    setError(null);
    try {
      let urls = selectedUrls.slice(0, TRAIN_SELECTION_MAX);
      try {
        urls = await Promise.all(urls.map((url) => urlToCompressedDataUrl(url)));
      } catch {
        /* keep original https/data URLs */
      }
      saveTrainSelection(urls);
      clearResultSession();

      const params = new URLSearchParams();
      params.set("intent", "train");
      params.set("autostart", "train");
      params.set("source", "selection");
      params.set("view", "compare");
      router.push(`/generate?${params.toString()}`);
    } finally {
      setTrainBusy(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-6 rounded-3xl bg-white/[0.03] p-5 sm:p-6"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
          <UserRound className="h-4 w-4 text-glow-purple" />
          {t.profiles.title}
        </h3>
        <span className="text-[11px] text-white/40">
          {unlimitedSlots
            ? t.profiles.slotsUnlimited
            : t.profiles.slots
                .replace("{used}", String(profiles.length))
                .replace("{max}", String(maxSlots))}
        </span>
      </div>

      {!compact && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setVaultOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-white/80 transition hover:bg-white/[0.07]"
          >
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-glow-emerald" />
              {t.profiles.vaultToggle.replace("{n}", String(profiles.length))}
            </span>
            {vaultOpen ? (
              <ChevronUp className="h-4 w-4 text-white/45" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/45" />
            )}
          </button>

          {vaultOpen && (
            <div className="space-y-4">
              {vaultPhotos.length === 0 ? (
                <p className="py-10 text-center text-sm text-white/40">
                  {t.profiles.vaultEmpty}
                </p>
              ) : (
                <>
                  <p className="px-0.5 text-xs text-white/40">
                    {t.profiles.trainSelectHint
                      .replace("{min}", String(TRAIN_SELECTION_MIN))
                      .replace("{max}", String(TRAIN_SELECTION_MAX))}{" "}
                    <span className="font-medium text-glow-purple/90">
                      {t.profiles.trainSelectCount
                        .replace("{n}", String(selectedUrls.length))
                        .replace("{max}", String(TRAIN_SELECTION_MAX))}
                    </span>
                  </p>
                  <div className="max-h-[min(58vh,640px)] overflow-y-auto overscroll-contain rounded-xl border border-white/5 bg-black/10 p-2 sm:p-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                      {vaultPhotos.map((pick) => {
                        const profile = profileById.get(pick.profileId);
                        const checked = selectedKeys.includes(pick.key);
                        return (
                          <article
                            key={pick.key}
                            className={`relative overflow-hidden rounded-xl border bg-white/[0.02] transition ${
                              checked
                                ? "border-glow-purple/60 ring-2 ring-glow-purple/40"
                                : "border-white/10 hover:border-white/20"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (profile) onSelect?.(profile);
                                togglePhoto(pick.key);
                              }}
                              className="relative block w-full"
                            >
                              <div className="relative aspect-[3/4] bg-white/5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={pick.url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <span
                                  className={`absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-md shadow-md ${
                                    checked
                                      ? "bg-glow-purple text-white"
                                      : "bg-black/50 text-transparent ring-1 ring-white/40"
                                  }`}
                                  aria-hidden
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === pick.profileId}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDeleteVaultPhoto(pick);
                              }}
                              aria-label={t.profiles.deletePhotoConfirmTitle}
                              className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/80 shadow-lg backdrop-blur-sm transition hover:border-red-400/40 hover:bg-red-600/80 hover:text-white disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <div className="px-2.5 py-2 text-[11px] font-medium text-white/65">
                              #{profile?.slot ?? "?"}{" "}
                              <span className="text-white/40">{profile?.name}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void startSelectedTraining()}
                    disabled={busy || trainBusy || !canStartTraining}
                    className="btn-primary inline-flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4" />
                    {trainBusy ? t.profiles.training : t.profiles.trainSelected}
                  </button>
                  {!canStartTraining && selectedUrls.length > 0 && (
                    <p className="text-center text-[11px] text-white/40">
                      {t.profiles.trainSelectRange
                        .replace("{min}", String(TRAIN_SELECTION_MIN))
                        .replace("{max}", String(TRAIN_SELECTION_MAX))}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {compact && profiles.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect?.(p)}
              className={`rounded-xl border p-3 text-left text-sm ${
                selectedId === p.id
                  ? "border-glow-emerald/50 bg-glow-emerald/10"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              #{p.slot} {p.name}
            </button>
          ))}
        </div>
      )}

      {!compact && (
        <div className="space-y-4 pt-1">
          <label
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition sm:min-h-[260px] ${
              dragOver
                ? "border-glow-emerald/70 bg-emerald-500/10"
                : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]"
            } ${busy || slotsFull ? "pointer-events-none opacity-50" : ""}`}
          >
            <ImagePlus
              className={`h-10 w-10 ${dragOver ? "text-glow-emerald" : "text-white/30"}`}
            />
            <div className="space-y-1">
              <p className="text-base font-semibold text-white/85">
                {busy ? t.profiles.uploading : t.profiles.uploadPhotos}
              </p>
              <p className="text-sm text-white/50">{t.profiles.uploadDropHint}</p>
              <p className="text-xs text-white/35">
                JPG, JPEG, PNG, WebP, HEIC, SVG · 최대 20MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={MODEL_ACCEPT_ATTR}
              className="hidden"
              disabled={busy || slotsFull}
              onChange={(e) => {
                void ingestFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((url, index) => (
                <div
                  key={`${url.slice(0, 40)}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white/80 opacity-0 transition group-hover:opacity-100"
                    aria-label={t.common.close}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.profiles.namePlaceholder}
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-glow-purple/40"
          />
          <p className="text-xs text-white/40">{t.profiles.createHint}</p>
          {error && <p className="text-xs text-amber-200">{error}</p>}
          {slotsFull && !error && (
            <p className="text-xs text-amber-200">
              {t.profiles.slotFull.replace("{n}", String(maxSlots))}
            </p>
          )}

          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={busy || trainBusy || slotsFull}
            className="w-full py-2 text-sm text-white/50 transition hover:text-white disabled:opacity-50"
          >
            {t.profiles.save}
          </button>
        </div>
      )}
    </div>
  );
}
